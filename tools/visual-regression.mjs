// Visual regression check: compares two production builds (base vs head) by the
// computed style of every rendered element, on every main screen, at desktop,
// tablet and phone widths, in Greek and English, with the common dialogs,
// filters and patient-record tabs open.
//
// Computed styles are deterministic, unlike screenshot pixels (anti-aliasing
// differs run to run), so any difference is a real visual change. Screenshots
// of both builds are saved for every state that differs.
//
//   npm run build && npx vite build --outDir dist-base   # (base checkout)
//   node tools/visual-regression.mjs --base dist-base --head dist [--out visual-report]
//
// The demo workspace is opened through the help-preview iframe mode, so no
// Supabase account is needed.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []))
const baseDir = path.resolve(args.base || 'dist-base')
const headDir = path.resolve(args.head || 'dist')
const outDir = path.resolve(args.out || 'visual-report')
const quick = args.quick === 'true'

const WRAP = '<!doctype html><html><body style="margin:0"><script>const q=new URLSearchParams(location.search);document.write(`<iframe src="${q.get("r")}?helpPreview=1&helpLang=${q.get("l")}" style="border:0;width:100vw;height:100vh"></iframe>`)</script></body></html>'
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' }

function serve(root) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (url === '/__visual_wrap.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(WRAP); return }
    let file = path.join(root, url)
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)))
}

const ROUTES = ['/', '/patients', '/surveillance', '/laboratory', '/prevention', '/employees', '/quality', '/analysis', '/training', '/committees', '/documents', '/management', '/indicators', '/pharmacy', '/controls', '/my-department']
const SIZES = { desktop: [1440, 900], tablet: [900, 700], phone: [390, 844] }
function states() {
  const list = []
  for (const size of quick ? ['desktop'] : Object.keys(SIZES)) for (const route of ROUTES) list.push({ size, route, lang: 'el' })
  for (const route of ['/', '/surveillance', '/laboratory', '/quality', '/analysis']) list.push({ size: 'desktop', route, lang: 'en' })
  for (const route of ['/surveillance', '/laboratory', '/quality', '/employees', '/prevention', '/documents', '/committees', '/training']) list.push({ size: 'desktop', route, lang: 'el', act: 'create' })
  for (const route of ['/surveillance', '/laboratory', '/patients']) list.push({ size: 'desktop', route, lang: 'el', act: 'filters' })
  list.push({ size: 'desktop', route: '/', lang: 'el', act: 'notifications' })
  list.push({ size: 'phone', route: '/laboratory', lang: 'el', act: 'create' })
  for (let tab = 0; tab < 5; tab++) list.push({ size: 'desktop', route: '/surveillance', lang: 'el', act: 'record', tab })
  for (let tab = 0; tab < 5; tab++) list.push({ size: 'phone', route: '/surveillance', lang: 'en', act: 'record', tab })
  return list
}
const stateName = s => `${s.size}-${s.lang}${s.route.replace(/\//g, '_')}${s.act ? `-${s.act}${s.tab ?? ''}` : ''}`

async function dismissBriefing(frame) {
  const button = frame.locator('.login-briefing-dialog button').first()
  if (await button.count()) await button.click({ timeout: 2000 }).catch(() => {})
}

async function capture(page, port, s) {
  await page.goto(`http://127.0.0.1:${port}/__visual_wrap.html?r=${encodeURIComponent(s.route)}&l=${s.lang}`)
  await page.waitForTimeout(1800)
  const frame = page.frames().find(item => item !== page.mainFrame())
  await dismissBriefing(frame); await page.waitForTimeout(250)
  let interacted = true
  try {
    if (s.act === 'create') await frame.locator('.page-actions button, .page-header button.primary, button:has-text("Δημιουργία"), button:has-text("Νέ")').first().click({ timeout: 2500 })
    if (s.act === 'filters') await frame.locator('button:has-text("Φίλτρα")').first().click({ timeout: 2500 })
    if (s.act === 'notifications') await frame.locator('.notification-button').first().click({ timeout: 2500 })
    if (s.act === 'record') {
      await frame.locator('tbody tr').first().click({ timeout: 3000 }); await page.waitForTimeout(1500); await dismissBriefing(frame)
      const tabs = await frame.locator('[role=tab]').all()
      if (tabs[s.tab]) await tabs[s.tab].click({ timeout: 2500 })
    }
  } catch { interacted = false }
  await page.waitForTimeout(700); await dismissBriefing(frame)
  const styles = await frame.evaluate(() => [...document.querySelectorAll('body *')].map(element => {
    const computed = getComputedStyle(element); const values = {}
    for (let index = 0; index < computed.length; index++) values[computed[index]] = computed.getPropertyValue(computed[index])
    return [element.tagName + (typeof element.className === 'string' && element.className ? '.' + element.className.trim().split(/\s+/).join('.') : ''), values]
  }))
  const png = await page.screenshot({ animations: 'disabled', caret: 'hide' })
  return { styles, png, interacted }
}

function compare(before, after) {
  if (before.length !== after.length) return { count: 1, sample: `element count ${before.length} → ${after.length}` }
  let count = 0; let sample = ''
  for (let index = 0; index < before.length; index++) {
    const [name, a] = before[index]; const [, b] = after[index]
    const animated = a['animation-name'] !== 'none'
    for (const key of Object.keys(a)) {
      if (a[key] === b[key] || (animated && (key === 'transform' || key === 'opacity'))) continue
      count++
      if (!sample) sample = `${name.slice(0, 80)} { ${key}: ${a[key]} → ${b[key]} }`
    }
  }
  return { count, sample }
}

let chromium
try { ({ chromium } = await import('playwright')) } catch { console.error('playwright is not installed: npm ci'); process.exit(2) }
for (const dir of [baseDir, headDir]) if (!fs.existsSync(path.join(dir, 'index.html'))) { console.error(`No build found in ${dir}`); process.exit(2) }

const [baseServer, headServer] = await Promise.all([serve(baseDir), serve(headDir)])
const basePort = baseServer.address().port; const headPort = headServer.address().port
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
fs.mkdirSync(outDir, { recursive: true })
const results = []
for (const [size, [width, height]] of Object.entries(SIZES)) {
  const list = states().filter(s => s.size === size)
  if (!list.length) continue
  const basePage = await browser.newPage({ viewport: { width, height } })
  const headPage = await browser.newPage({ viewport: { width, height } })
  for (const s of list) {
    const before = await capture(basePage, basePort, s)
    const after = await capture(headPage, headPort, s)
    const diff = compare(before.styles, after.styles)
    const name = stateName(s)
    if (diff.count) {
      fs.writeFileSync(path.join(outDir, `${name}-base.png`), before.png)
      fs.writeFileSync(path.join(outDir, `${name}-head.png`), after.png)
    }
    results.push({ name, elements: after.styles.length, differences: diff.count, sample: diff.sample, interactionMissed: !before.interacted || !after.interacted })
  }
  await basePage.close(); await headPage.close()
}
await browser.close(); baseServer.close(); headServer.close()

const changed = results.filter(r => r.differences)
const elements = results.reduce((sum, r) => sum + r.elements, 0)
const lines = [
  '## Visual regression (computed styles)',
  '',
  `${results.length} screen states, ${elements.toLocaleString('en')} elements compared: **${changed.length ? `${changed.length} state(s) changed` : 'no visual changes'}**.`,
  ...(changed.length ? ['', '| State | Style differences | First difference |', '|---|---|---|', ...changed.map(r => `| ${r.name} | ${r.differences} | \`${r.sample.replace(/\|/g, '\\|')}\` |`), '', 'Screenshots of both builds for these states are in the `visual-report` artifact. If the change is intended, add the `visual-change` label to the pull request.'] : []),
]
const report = lines.join('\n')
fs.writeFileSync(path.join(outDir, 'report.md'), report + '\n')
fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 1))
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n')
console.log(report)
process.exit(changed.length ? 1 : 0)
