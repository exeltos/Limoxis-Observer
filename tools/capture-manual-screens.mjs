// Captures one screenshot per manual section (Demo data, Greek and English) for the
// illustrated PDF manual (tools/build-manual-pdf.mjs embeds them when present).
//
//   npm run build && npm run manual:screens        # writes docs/manual/screens/<lang>/<id>.jpg
//   node tools/capture-manual-screens.mjs --lang el --only patients,laboratory
//
// The app runs from dist/ inside the Help Center preview frame (?helpPreview=1),
// the same sample-data mode the Help Center uses, so no account or database is needed.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const languages = argValue('--lang') ? [argValue('--lang')] : ['el', 'en']
const only = argValue('--only')?.split(',')
const outRoot = path.resolve(root, argValue('--out') || 'docs/manual/screens')
const dist = path.join(root, 'dist')
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ is missing: run `npm run build` first.'); process.exit(1) }

// id → route, optional tabs to open (by visible label [el, en]), optional extra query.
export const MANUAL_SCREENS = [
  { id: 'overview', route: '/' },
  { id: 'patients', route: '/patients/PT-260190', tabs: [] },
  { id: 'laboratory', route: '/laboratory' },
  { id: 'national', route: '/analysis', tabs: [['Αναφορές & AI', 'Reports & AI']] },
  { id: 'surveillance', route: '/surveillance' },
  { id: 'indicators', route: '/indicators' },
  { id: 'prevention', route: '/prevention' },
  { id: 'controls', route: '/controls' },
  { id: 'quality', route: '/quality' },
  { id: 'training', route: '/training', tabs: [['Ετήσιο πλάνο', 'Annual plan']] },
  { id: 'governance', route: '/committees/COM-001' },
  { id: 'occupational_health', route: '/occupational-health' },
  { id: 'pharmacy', route: '/pharmacy' },
  { id: 'prevalence_survey', route: '/management', tabs: [['Δεδομένα δεικτών', 'Indicator data'], ['Επιπολασμός λοιμώξεων (PPS)', 'Prevalence survey (PPS)']] },
  { id: 'lira', route: '/management', tabs: [['LIRA & AI', 'LIRA & AI']] },
  { id: 'platform', route: '/platform', owner: true },
]

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' }
// The preview frame needs a parent page: the app only enters help-preview mode inside an iframe.
const frame = '<!doctype html><html><body style="margin:0"><script>const q=new URLSearchParams(location.search);const f=document.createElement("iframe");f.src=q.get("r");f.style.cssText="border:0;width:100vw;height:100vh";document.body.append(f)</script></body></html>'
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const appFrame = () => page.frames().find(f => f !== page.mainFrame())
async function closeDialogs() {
  for (let i = 0; i < 3; i++) {
    const close = appFrame()?.locator('.observer-dialog header button[aria-label="Κλείσιμο"], .observer-dialog header button[aria-label="Close"]').first()
    if (!close || !(await close.count())) return
    await close.click().catch(() => {}); await page.waitForTimeout(350)
  }
}

let written = 0
for (const language of languages) {
  const dir = path.join(outRoot, language); fs.mkdirSync(dir, { recursive: true })
  for (const screen of MANUAL_SCREENS.filter(s => !only || only.includes(s.id))) {
    const query = new URLSearchParams({ helpPreview: '1', helpLang: language, ...(screen.owner ? { helpOwner: '1' } : {}) })
    await page.goto(`${origin}/__frame?r=${encodeURIComponent(`${screen.route}?${query}`)}`)
    await page.waitForTimeout(2600); await closeDialogs()
    for (const labels of screen.tabs || []) {
      const label = labels[language === 'en' ? 1 : 0]
      const tab = appFrame().locator('.content [role=tab], .content nav button').filter({ hasText: label }).first()
      if (await tab.count()) { await tab.click(); await page.waitForTimeout(1200); await closeDialogs() } else console.warn(`  ${screen.id}: tab "${label}" not found`)
    }
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(dir, `${screen.id}.jpg`), type: 'jpeg', quality: 72 })
    written++
    console.log(`${language} ${screen.id}`)
  }
}
await browser.close(); server.close()
console.log(`${written} screenshots in ${path.relative(root, outRoot)}`)
