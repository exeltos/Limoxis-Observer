// Captures every main screen as a review matrix: Greek and English, a full
// hospital (the sample data) and an empty one (?helpEmpty=1: departments and
// the demo user, no records), on desktop and tablet (landscape and portrait).
//
//   npm run build && npm run screens:matrix
//   node tools/capture-screen-matrix.mjs --lang en --state empty --device tablet-portrait --only quality,kitchen
//
// Writes docs/screens/matrix/<lang>/<state>/<device>/<screen>.jpg and
// docs/screens/matrix/index.json (one entry per capture, with the console
// errors, page errors and error-boundary flag of that page). The app runs from
// dist/ inside the Help Center preview frame, as tools/capture-manual-screens.mjs
// does, so no account or database is needed.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const listArg = (name, all) => (argValue(name) ? argValue(name).split(',') : all)
const outRoot = path.resolve(root, argValue('--out') || 'docs/screens/matrix')
const dist = path.join(root, 'dist')
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ is missing: run `npm run build` first.'); process.exit(1) }

export const DEVICES = {
  desktop: { width: 1440, height: 900 },
  'tablet-landscape': { width: 1024, height: 768, hasTouch: true },
  'tablet-portrait': { width: 820, height: 1180, hasTouch: true },
}
// id → route. `tabs: true` also captures every tab of the screen (<id>.tabNN.jpg);
// `record: true` is a record page of the sample data (captured in the full state only).
export const MATRIX_SCREENS = [
  { id: 'login', route: '/login', login: true },
  { id: 'dashboard', route: '/' },
  { id: 'executive', route: '/executive' },
  { id: 'surveillance', route: '/surveillance' },
  { id: 'patients', route: '/patients' },
  { id: 'laboratory', route: '/laboratory' },
  { id: 'prevention', route: '/prevention' },
  { id: 'controls', route: '/controls' },
  { id: 'quality', route: '/quality', tabs: true },
  { id: 'employees', route: '/employees' },
  { id: 'interviews', route: '/interviews' },
  { id: 'analysis', route: '/analysis' },
  { id: 'indicators', route: '/indicators' },
  { id: 'training', route: '/training' },
  { id: 'committees', route: '/committees' },
  { id: 'documents', route: '/documents' },
  { id: 'regulations', route: '/regulations' },
  { id: 'kitchen', route: '/kitchen', tabs: true },
  { id: 'pharmacy', route: '/pharmacy' },
  { id: 'occupational-health', route: '/occupational-health' },
  { id: 'calendar', route: '/calendar' },
  { id: 'management', route: '/management' },
  { id: 'record-patient', route: '/patients/PT-260190', record: true },
  { id: 'record-surveillance', route: '/surveillance/SUR-260041', record: true },
  { id: 'record-laboratory', route: '/laboratory/LAB-260829-013', record: true },
  { id: 'record-prevention', route: '/prevention/handHygiene/HH-2601', record: true },
  { id: 'record-control', route: '/controls/CTRL-DEMO-0001', record: true },
  { id: 'record-employee', route: '/employees/EMP-001', record: true },
  { id: 'record-training', route: '/training/TRN-001', record: true },
  { id: 'record-committee', route: '/committees/COM-001', record: true },
  { id: 'record-document', route: '/documents/DOC-008', record: true },
  { id: 'record-kitchen-receipt', route: '/kitchen/receipts/kr-1', record: true },
]

const languages = listArg('--lang', ['el', 'en'])
const states = listArg('--state', ['full', 'empty'])
const devices = listArg('--device', Object.keys(DEVICES))
const only = argValue('--only')?.split(',')
const concurrency = Number(argValue('--jobs')) || 4

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' }
// The preview frame needs a parent page: the app only enters help-preview mode inside an iframe.
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

// What the screen looks like from inside: error boundary, horizontal overflow, empty states.
const inspect = () => {
  const doc = document.documentElement
  const content = document.querySelector('.content') || document.body
  const text = (content.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    errorBoundary: Boolean(document.querySelector('.screen-error-boundary, .app-error-boundary')),
    errorText: (document.querySelector('.screen-error-boundary, .app-error-boundary')?.innerText || '').slice(0, 300),
    horizontalOverflowPx: Math.max(0, doc.scrollWidth - doc.clientWidth),
    pageHeight: doc.scrollHeight,
    title: (document.querySelector('.content h1, main h1, h1')?.innerText || '').trim().slice(0, 120),
    textLength: text.length,
    loading: Boolean(document.querySelector('[aria-busy="true"], .route-loading')),
  }
}

async function captureCombo(language, state, device) {
  const viewport = DEVICES[device]
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: Boolean(viewport.hasTouch), locale: language === 'en' ? 'en-GB' : 'el-GR' })
  const page = await context.newPage()
  let log = null
  page.on('console', message => { if (log && ['error', 'warning'].includes(message.type())) log[message.type() === 'error' ? 'consoleErrors' : 'consoleWarnings'].push(message.text().slice(0, 400)) })
  page.on('pageerror', error => { if (log) log.pageErrors.push(String(error?.message || error).slice(0, 400)) })
  page.on('requestfailed', request => { if (log && !request.url().startsWith('data:')) log.failedRequests.push(`${request.failure()?.errorText || 'failed'} ${request.url().slice(0, 200)}`) })
  const appFrame = screen => (screen.login ? page.mainFrame() : page.frames().find(f => f !== page.mainFrame()))
  const dir = path.join(outRoot, language, state, device)
  fs.mkdirSync(dir, { recursive: true })
  const entries = []
  const closeDialogs = async screen => {
    for (let i = 0; i < 3; i++) {
      const close = appFrame(screen)?.locator('.observer-dialog header button[aria-label="Κλείσιμο"], .observer-dialog header button[aria-label="Close"]').first()
      if (!close || !(await close.count())) return
      await close.click().catch(() => {}); await page.waitForTimeout(350)
    }
  }
  const shoot = async (screen, file, extra = {}) => {
    await page.waitForTimeout(400)
    const target = path.join(dir, file)
    await page.screenshot({ path: target, type: 'jpeg', quality: 70 })
    const facts = await appFrame(screen)?.evaluate(inspect).catch(error => ({ inspectError: String(error.message || error) }))
    const entry = {
      id: extra.tabIndex ? `${screen.id}.tab${String(extra.tabIndex).padStart(2, '0')}` : screen.id,
      screen: screen.id, language, state, device, viewport: `${viewport.width}x${viewport.height}`,
      route: screen.route, file: path.relative(outRoot, target).split(path.sep).join('/'), bytes: fs.statSync(target).size,
      ...extra, ...facts, ...structuredClone(log),
    }
    entry.flagged = Boolean(entry.errorBoundary || entry.pageErrors.length || entry.consoleErrors.length || entry.inspectError)
    entries.push(entry)
    log.consoleErrors = []; log.consoleWarnings = []; log.pageErrors = []; log.failedRequests = []
  }
  for (const screen of MATRIX_SCREENS.filter(s => !only || only.includes(s.id))) {
    if (screen.record && state === 'empty') continue
    log = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] }
    if (screen.login) {
      if (state === 'empty') continue // the login page has no hospital data
      await page.goto(`${origin}${screen.route}?helpLang=${language}`)
    } else {
      const query = new URLSearchParams({ helpPreview: '1', helpLang: language, ...(state === 'empty' ? { helpEmpty: '1' } : {}) })
      await page.goto(`${origin}/__frame?r=${encodeURIComponent(`${screen.route}?${query}`)}`)
    }
    await page.waitForTimeout(2600); await closeDialogs(screen)
    await shoot(screen, `${screen.id}.jpg`)
    if (screen.tabs) {
      const tabs = appFrame(screen).locator('.content [role=tab]')
      const count = await tabs.count()
      for (let index = 1; index < count; index++) {
        const tab = tabs.nth(index)
        const label = ((await tab.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim()
        const visible = await tab.isVisible().catch(() => false)
        await tab.scrollIntoViewIfNeeded().catch(() => {})
        await tab.click({ timeout: 4000 }).catch(error => log.pageErrors.push(`tab "${label}" could not be clicked: ${String(error.message).split('\n')[0]}`))
        await page.waitForTimeout(1300); await closeDialogs(screen)
        await shoot(screen, `${screen.id}.tab${String(index + 1).padStart(2, '0')}.jpg`, { tabIndex: index + 1, tabLabel: label, tabVisibleBeforeScroll: visible })
      }
      if (entries.length && count) entries.find(e => e.id === screen.id && e.device === device).tabCount = count
    }
    console.log(`${language}/${state}/${device} ${screen.id}`)
  }
  await context.close()
  return entries
}

const combos = languages.flatMap(language => states.flatMap(state => devices.map(device => [language, state, device])))
const results = []
let next = 0
await Promise.all(Array.from({ length: Math.min(concurrency, combos.length) }, async () => {
  while (next < combos.length) { const combo = combos[next++]; results.push(...await captureCombo(...combo)) }
}))
await browser.close(); server.close()

// A partial run (--lang/--state/--device/--only) updates its own entries in the index.
const indexFile = path.join(outRoot, 'index.json')
const previous = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')).captures || [] : []
const keyOf = e => `${e.language}/${e.state}/${e.device}/${e.id}`
const fresh = new Set(results.map(keyOf))
const captures = [...previous.filter(e => !fresh.has(keyOf(e))), ...results].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
const flagged = captures.filter(e => e.flagged)
fs.writeFileSync(indexFile, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  devices: DEVICES, languages: ['el', 'en'], states: ['full', 'empty'],
  totals: { captures: captures.length, flagged: flagged.length, bytes: captures.reduce((sum, e) => sum + e.bytes, 0) },
  flagged: flagged.map(keyOf),
  captures,
}, null, 1)}\n`)
console.log(`${results.length} screenshots in ${path.relative(root, outRoot)} · ${flagged.length} flagged (see index.json)`)
