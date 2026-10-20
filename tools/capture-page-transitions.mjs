// Records what the screen shows, frame by frame, while moving between pages,
// and flags every in-between state that is neither the previous page nor the
// next one: a blank content area, the page-loading line, an empty-state text
// («Δεν υπάρχουν…») that is gone once the data arrive, KPI tiles that read 0
// and then fill, another page's title, or the sidebar/header disappearing.
//
//   npm run build && node tools/capture-page-transitions.mjs [--cpu 4] [--latency 300] [--strips dir] [--only sidebar,records]
//
// It runs the built app (dist/) in the Help Center preview frame with the
// sample hospital, as tools/capture-screen-matrix.mjs does, follows every
// sidebar entry in order and then moves record → record. --cpu throttles the
// CPU (CDP) so that short flashes last long enough to be seen. --strips writes
// a PNG strip of the frames of each flagged (or --strip-ids) transition.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const cpu = Number(argValue('--cpu')) || 1
const latency = Number(argValue('--latency')) || 0
const stripsDir = argValue('--strips') ? path.resolve(root, argValue('--strips')) : null
const stripIds = argValue('--strip-ids')?.split(',') || null
const stripPrefix = argValue('--strip-prefix') || ''
const only = argValue('--only')?.split(',') || null
const reportFile = argValue('--report') ? path.resolve(root, argValue('--report')) : null
// --dist compares another build (e.g. the base branch built into dist-base/).
const dist = path.resolve(root, argValue('--dist') || 'dist')
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ is missing: run `npm run build` first.'); process.exit(1) }

// Record → record moves (same screen, another id) and list → record → list.
export const RECORD_MOVES = [
  ['/patients/PT-260190', '/patients/PT-260184'],
  ['/surveillance/SUR-260041', '/surveillance/SUR-260039'],
  ['/laboratory/LAB-260829-013', '/laboratory/LAB-260209-005'],
  ['/employees/EMP-001', '/employees/EMP-002'],
  ['/training/TRN-001', '/training/TRN-003'],
  ['/documents/DOC-008', '/documents/DOC-002'],
  ['/controls/CTRL-DEMO-0001', '/controls/CTRL-DEMO-0002'],
  ['/committees/COM-001', '/committees/COM-002'],
  ['/prevention/handHygiene/HH-2601', '/prevention/handHygiene/HH-2602'],
  ['/quality/incidents/INC-250911-001', '/quality/incidents/INC-250923-002'],
]

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg' }
const frame = '<!doctype html><html><body style="margin:0"><script>const q=new URLSearchParams(location.search);const f=document.createElement("iframe");f.src=q.get("r");f.style.cssText="border:0;width:100vw;height:100vh;display:block";document.body.append(f)</script></body></html>'
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local')
  if (url.pathname === '/__frame') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(frame); return }
  let file = path.join(dist, decodeURIComponent(url.pathname))
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') } : {})
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'el-GR' })
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
const errors = []
page.on('pageerror', error => errors.push(String(error?.message || error).slice(0, 300)))
await page.goto(`${origin}/__frame?r=${encodeURIComponent('/?helpPreview=1&helpLang=el')}`)
await page.waitForTimeout(4000)
const app = () => page.frames().find(f => f !== page.mainFrame())
if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
// --latency adds a round-trip delay to every request (page files), as on a slow line.
if (latency) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency, downloadThroughput: 750 * 1024 / 8 * 8, uploadThroughput: 250 * 1024 / 8 }) }

// One sample per animation frame inside the app frame.
const installSampler = watch => {
  const EMPTY = /(Δεν (?:υπάρχ|βρέθηκ|έχ)[^.·\n]{0,50}|Καμί[αά] [^.·\n]{0,40}|Κανέν[αα] [^.·\n]{0,40}|No [a-z ]{0,30}(?:yet|found|records))/g
  window.__samples = []
  window.__sampling = true
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const tick = () => {
    if (!window.__sampling) return
    const content = document.querySelector('.content')
    const text = (content?.innerText || '').replace(/\s+/g, ' ').trim()
    const kpis = [...(content?.querySelectorAll('[class*="kpi"] strong, [class*="metric"] strong, [class*="stat-card"] strong, [class*="summary-card"] strong') || [])].filter(visible).map(el => el.textContent.trim())
    window.__samples.push({
      t: Math.round(performance.now()),
      wall: Date.now(),
      path: location.pathname,
      sidebar: Boolean(document.querySelector('.sidebar')),
      topbar: Boolean(document.querySelector('.topbar')),
      textLength: text.length,
      head: text.slice(0, 80),
      h1: (content?.querySelector('h1, h2')?.innerText || '').trim().slice(0, 80),
      busy: Boolean(content?.querySelector('[aria-busy="true"], .page-loading-skeleton')),
      empties: [...new Set(text.match(EMPTY) || [])].map(s => s.slice(0, 50)),
      zeroKpis: kpis.filter(v => /^0([.,]0+)?%?$/.test(v)).length,
      kpis: kpis.length,
      denied: /Δεν έχετε πρόσβαση|Access denied|Δεν επιτρέπεται/i.test(text),
      // Record → record: which of the two record codes the content shows.
      ids: (watch || []).map(code => text.includes(code)),
    })
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

async function settle(maxMs = 7000) {
  // Settled = the content text has not changed for 900 ms.
  const start = Date.now(); let last = ''; let since = Date.now()
  while (Date.now() - start < maxMs) {
    const now = await app().evaluate(() => (document.querySelector('.content')?.innerText || '').length + '|' + (document.querySelector('.content h1, .content h2')?.innerText || '')).catch(() => '')
    if (now !== last) { last = now; since = Date.now() }
    if (Date.now() - since > 900) break
    await page.waitForTimeout(100)
  }
}

let screencastFrames = []
cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
  screencastFrames.push({ t: metadata.timestamp, data })
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})

function analyse(samples, before, watch) {
  const final = samples.at(-1) || {}
  const flags = new Set()
  // The new page's own frames start with its title (the same title as before: with the first change).
  const firstNew = final.h1 === before.h1 ? samples.findIndex(s => s.head !== samples[0]?.head) : samples.findIndex(s => s.h1 && s.h1 !== before.h1)
  for (const [index, s] of samples.entries()) {
    if (!s.sidebar || !s.topbar) flags.add('shell-unmounted')
    if (s.textLength < 3 && !s.busy) flags.add('blank-content')
    if (s.denied && !final.denied) flags.add('access-denied-flash')
    if (s.h1 && s.h1 !== before.h1 && s.h1 !== final.h1) flags.add(`other-title:${s.h1.slice(0, 40)}`)
    // Only the new page's own in-between states count from here on.
    if (firstNew < 0 || index < firstNew) continue
    for (const empty of s.empties) if (!final.empties?.includes(empty)) flags.add(`empty-flash:${empty.slice(0, 40)}`)
    if (s.zeroKpis > (final.zeroKpis || 0)) flags.add('zero-kpi-flash')
  }
  // The new record's code next to the previous record's data (state kept from the last record).
  if (watch && !final.ids?.[0]) for (const s of samples) if (s.ids?.[0] && s.ids?.[1]) flags.add('previous-record-data')
  return [...flags]
}

async function transition(id, go, watch = null) {
  const before = await app().evaluate(() => ({ h1: (document.querySelector('.content h1, .content h2')?.innerText || '').trim().slice(0, 80) }))
  screencastFrames = []
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, maxWidth: 640, maxHeight: 400, everyNthFrame: 1 })
  await app().evaluate(installSampler, watch)
  const started = Date.now()
  await go()
  await settle()
  const samples = await app().evaluate(() => { window.__sampling = false; return window.__samples })
  await cdp.send('Page.stopScreencast')
  const flags = analyse(samples, before, watch)
  const result = { id, ms: Date.now() - started, frames: samples.length, from: before.h1, to: samples.at(-1)?.h1, flags }
  // The distinct frames of a flagged move, for the report.
  if (flags.length) result.samples = samples.filter((x, i) => i === 0 || x.head !== samples[i - 1].head || x.busy !== samples[i - 1].busy).map(({ t, h1, head, busy, empties }) => ({ t, h1, head, busy, empties }))
  console.log(`${flags.length ? 'FLASH' : 'ok   '} ${id.padEnd(46)} ${flags.join(' | ')}`)
  if (stripsDir && (stripIds ? stripIds.includes(id) : flags.length)) {
    // One frame per state the screen went through (old page, blank, placeholder, empty state, data).
    const state = x => (x.textLength < 3 && !x.busy ? 'κενή οθόνη' : x.busy ? 'φόρτωση' : x.empties.length && !samples.at(-1).empties.length ? '«Δεν υπάρχουν…»' : x.zeroKpis > samples.at(-1).zeroKpis ? 'μηδενικοί δείκτες' : '')
    const sig = x => `${state(x)}|${x.h1}|${x.head.slice(0, 40)}`
    const moments = samples.filter((x, i) => i === 0 || sig(x) !== sig(samples[i - 1])).map(x => ({ wall: x.wall }))
    // Frames composited before the click belong to the previous move.
    const fresh = screencastFrames.filter(f => f.t * 1000 >= started - 40)
    await writeStrip(id, fresh.length ? fresh : screencastFrames, moments)
  }
  return result
}

// A strip (three per row, at most 6) of the frames painted at each state change of one transition, as a small PNG.
async function writeStrip(id, frames, moments) {
  if (!frames.length) return
  const picked = []
  for (const moment of moments) {
    // The first frame painted after the DOM reached that state.
    const frame = frames.find(f => f.t * 1000 >= moment.wall + 12) || frames.at(-1)
    if (!picked.some(p => p.data === frame.data)) picked.push(frame)
  }
  if (picked.length > 6) picked.splice(5, picked.length - 6)
  if (picked.at(-1)?.data !== frames.at(-1).data) picked.push(frames.at(-1))
  const t0 = picked[0].t
  fs.mkdirSync(stripsDir, { recursive: true })
  const stripPage = await browser.newPage({ viewport: { width: 1200, height: 100 } })
  const cells = picked.map(f => `<figure><img src="data:image/jpeg;base64,${f.data}"><figcaption>+${Math.round((f.t - t0) * 1000)} ms</figcaption></figure>`).join('')
  await stripPage.setContent(`<style>body{margin:0;font:12px system-ui;background:#fff}h2{font-size:13px;margin:6px 8px}div{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:0 6px 8px}figure{margin:0}img{width:100%;display:block;border:1px solid #ccc}figcaption{text-align:center;color:#444}</style><h2>${id}</h2><div>${cells}</div>`)
  const file = path.join(stripsDir, `${stripPrefix}${id.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}.png`)
  await stripPage.screenshot({ path: file, fullPage: true })
  await stripPage.close()
}

const pushRoute = route => app().evaluate(target => { window.history.pushState({ usr: null, key: Math.random().toString(36).slice(2), idx: (window.history.state?.idx || 0) + 1 }, '', `${target}${window.location.search}`); window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state })) }, route)
const results = []

if (!only || only.includes('sidebar')) {
  // Expand "More" so every sidebar entry is a visible link.
  await app().locator('.sidebar .nav-group-trigger').first().click().catch(() => {})
  const links = await app().evaluate(() => [...document.querySelectorAll('.sidebar a.nav-item')].map(a => a.getAttribute('href')))
  for (const href of [...links.slice(1), links[0]]) {
    results.push(await transition(`sidebar ${href}`, async () => {
      const link = app().locator(`.sidebar a.nav-item[href="${href}"]`).first()
      // A dialog left open (a briefing, a guide) would take the click: fall back to the router.
      if (await link.isVisible().catch(() => false)) await link.click({ timeout: 2500 }).catch(() => pushRoute(href))
      else await pushRoute(href)
    }))
  }
}
if (!only || only.includes('records')) {
  for (const [first, second] of RECORD_MOVES) {
    const list = `/${first.split('/')[1]}`
    await pushRoute(list); await settle()
    results.push(await transition(`list→record ${first}`, () => pushRoute(first)))
    results.push(await transition(`record→record ${second}`, () => pushRoute(second), [first.split('/').pop(), second.split('/').pop()]))
    results.push(await transition(`record→list ${list}`, () => pushRoute(list)))
  }
}

await browser.close(); server.close()
const flagged = results.filter(r => r.flags.length)
console.log(`${results.length} transitions, ${flagged.length} with an in-between state (cpu ×${cpu})${errors.length ? `, ${errors.length} page errors` : ''}`)
if (reportFile) fs.writeFileSync(reportFile, `${JSON.stringify({ cpu, latency, results: args.includes('--brief') ? results.map(({ samples, ...rest }) => rest) : results, errors }, null, 1)}\n`)
