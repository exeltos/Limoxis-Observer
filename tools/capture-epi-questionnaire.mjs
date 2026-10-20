// Screens of the epidemiological questionnaire (docs/EPI_QUESTIONNAIRE.md): the header line, the section
// row, the prefilled dialog, the mini version in the sample request, the list reminder and the settings.
// Desktop 1440 and tablet 820.
//
//   npm run build && node tools/capture-epi-questionnaire.mjs [--only a,b,c]
//
// Writes docs/manual/screens/fixes/questionnaire/<name>-<desktop|tablet>.jpg. The app runs from dist/
// in the Help Center preview frame (sample data, no account, no database).
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const out = path.join(root, 'docs/manual/screens/fixes/questionnaire')
const args = process.argv.slice(2)
const only = (args.includes('--only') ? args[args.indexOf('--only') + 1] : '').split(',').filter(Boolean)
fs.mkdirSync(out, { recursive: true })
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('dist/ is missing: run `npm run build` first.')

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' }
const frameHtml = '<!doctype html><html><body style="margin:0"><script>const q=new URLSearchParams(location.search);const f=document.createElement("iframe");f.src=q.get("r");f.style.cssText="border:0;width:100vw;height:100vh;display:block";document.body.append(f)</script></body></html>'
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local')
  if (url.pathname === '/__frame') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(frameHtml); return }
  let file = path.join(dist, decodeURIComponent(url.pathname))
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const SIZES = { desktop: { width: 1440, height: 1000 }, tablet: { width: 820, height: 1000 } }
const problems = []

async function session(size, role, run) {
  const context = await browser.newContext({ viewport: SIZES[size], locale: 'el-GR' })
  const page = await context.newPage()
  page.on('pageerror', error => problems.push(`${size}/${role}: pageerror ${String(error?.message || error).slice(0, 160)}`))
  page.on('console', message => { if (message.type() === 'error') problems.push(`${size}/${role}: console ${message.text().slice(0, 160)}`) })
  await context.addInitScript(() => {
    const getItem = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) { return /^limoxis\.(briefing|birthday)\.seen/.test(String(key)) ? '1' : getItem.call(this, key) }
  })
  const app = () => page.frames().find(f => f !== page.mainFrame())
  const open = async (route, extra = {}) => {
    const q = new URLSearchParams({ helpPreview: '1', helpLang: 'el', helpRole: role, ...extra })
    await page.goto(`${origin}/__frame?r=${encodeURIComponent(`${route}?${q}`)}`)
    await page.waitForTimeout(1500)
    await app()?.waitForFunction(() => { const c = document.querySelector('.content'); return c && !document.querySelector('.route-loading') && c.innerText.trim().length > 60 }, null, { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    for (let i = 0; i < 3; i++) {
      const close = app()?.locator('.observer-dialog header button[aria-label="Κλείσιμο"]').first()
      if (!close || !(await close.count())) break
      await close.click().catch(() => {}); await page.waitForTimeout(300)
    }
  }
  const shot = async (name, clip = null) => {
    if (only.length && !only.includes(name)) return
    await page.screenshot({ path: path.join(out, `${name}-${size}.jpg`), type: 'jpeg', quality: 66, ...(clip ? { clip } : {}) })
  }
  const openAll = async () => {
    const toggles = app().locator('.episode-form-section:not(.is-open) .episode-form-section-toggle')
    for (let i = (await toggles.count()) - 1; i >= 0; i--) await toggles.nth(i).click().catch(() => {})
    await page.waitForTimeout(500)
  }
  const box = async selector => app().locator(selector).first().boundingBox().catch(() => null)
  const unionClip = async selectors => {
    const boxes = (await Promise.all(selectors.map(box))).filter(Boolean)
    if (!boxes.length) return null
    const x = Math.min(...boxes.map(b => b.x)) - 8, y = Math.min(...boxes.map(b => b.y)) - 8
    return { x: Math.max(0, x), y: Math.max(0, y), width: Math.min(SIZES[size].width - Math.max(0, x), Math.max(...boxes.map(b => b.x + b.width)) - x + 8), height: Math.max(...boxes.map(b => b.y + b.height)) - y + 8 }
  }
  try { await run({ page, app, open, shot, openAll, box, unionClip }) } finally { await context.close() }
}

for (const size of ['desktop', 'tablet']) {
  await session(size, 'infection_control_lead', async ({ page, app, open, shot, unionClip }) => {
    // Header line and the safety signal in the summary.
    await open('/surveillance/SUR-260041')
    await shot('a-header-risk-line')
    // The section row of the forms tab, then the prefilled dialog.
    await app().getByRole('tab', { name: /Φόρμες & ερωτηματολόγια/ }).click()
    await page.waitForTimeout(1500)
    const toggle = app().locator('[data-section="epiQuestionnaire"] .episode-form-section-toggle').first()
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
    await page.waitForTimeout(500)
    await shot('b-section-row', await unionClip(['[data-section="epiQuestionnaire"]']))
    await app().locator('[data-section="epiQuestionnaire"]').getByRole('button', { name: 'Άνοιγμα' }).first().click()
    await page.waitForTimeout(1200)
    await shot('c-questionnaire-dialog')
    await app().locator('.observer-dialog header button[aria-label="Κλείσιμο"]').first().click().catch(() => {})
    // The episode row of the surveillance tab.
    await app().getByRole('tab', { name: /Επιτήρηση & Δείγματα/ }).click()
    await page.waitForTimeout(1200)
    await shot('d-episode-row', await unionClip(['.sv-episode']))
    // The sample request: the three core questions, prefilled from the episode.
    await app().locator('.sv-episode-head').first().click().catch(() => {})
    await page.waitForTimeout(1500)
    await app().getByRole('button', { name: /^Δείγμα/ }).first().click().catch(() => {})
    await page.waitForTimeout(800)
    await app().getByRole('button', { name: 'Αίτημα δείγματος' }).first().click().catch(() => {})
    await page.waitForTimeout(1500)
    await shot('e-sample-request-mini')
  })
  // The list with the grey reminder.
  await session(size, 'infection_control_lead', async ({ page, app, open, shot }) => {
    await open('/surveillance')
    await page.waitForTimeout(800)
    await shot('f-list-reminder')
  })
  // Settings: the registry row, the questions and the wording dialog (hospital administrator).
  await session(size, 'hospital_admin', async ({ page, app, open, shot }) => {
    await open('/management', { tab: 'libraries' })
    await app().getByRole('tab', { name: /Ερωτηματολόγια/ }).first().click().catch(() => {})
    await page.waitForTimeout(1000)
    await shot('g-settings-registry')
    await app().getByText('Επιδημιολογικό ερωτηματολόγιο επιτήρησης').first().click().catch(() => {})
    await page.waitForTimeout(800)
    await shot('h-settings-questions')
    await app().getByRole('button', { name: 'Διατύπωση' }).first().click().catch(() => {})
    await page.waitForTimeout(800)
    await shot('i-settings-wording')
  })
}
// An empty hospital (?helpEmpty=1): the list, the settings and the lab register still render without a failure.
for (const [role, route, extra] of [['infection_control_lead', '/surveillance', {}], ['infection_control_lead', '/laboratory', {}], ['hospital_admin', '/management', { tab: 'libraries' }]])
  await session('desktop', role, async ({ page, open }) => {
    await open(route, { helpEmpty: '1', ...extra })
    await page.waitForTimeout(500)
  })
await browser.close()
server.close()
if (problems.length) { console.log(problems.join('\n')); process.exitCode = 0 }
console.log(`done: ${out}`)
