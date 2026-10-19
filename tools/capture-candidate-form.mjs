// Screenshots of the candidate's tablet form (/apply/demo, sample data) and of the HR
// «Αίτηση από tablet» dialog, inside the Help Center preview frame as
// tools/capture-screen-matrix.mjs does: no account or database.
//
//   npm run build && node tools/capture-candidate-form.mjs [--lang el|en]
//
// Writes docs/manual/screens/candidate-form/: every step at 820×1180 (portrait), the
// consents and review steps also at 1180×820 (landscape), the HR dialog at 1440×900.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const language = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'el'
const out = path.join(root, 'docs/manual/screens/candidate-form')
const dist = path.join(root, 'dist')
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ is missing: run `npm run build` first.'); process.exit(1) }
fs.mkdirSync(out, { recursive: true })

const STEPS = ['welcome', 'personal', 'contact', 'education', 'languages', 'experience', 'about', 'consents', 'review']
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' }
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
const suffix = language === 'el' ? '' : `.${language}`
const problems = []

async function shoot(viewport, route, file, act) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1400, locale: language === 'en' ? 'en-GB' : 'el-GR' })
  const page = await context.newPage()
  page.on('pageerror', error => problems.push(`${file}: ${error.message}`))
  const query = new URLSearchParams({ helpPreview: '1', helpLang: language })
  const sep = route.includes('?') ? '&' : '?'
  await page.goto(`${origin}/__frame?r=${encodeURIComponent(`${route}${sep}${query}`)}`)
  await page.waitForTimeout(2200)
  const app = page.frames().find(f => f !== page.mainFrame())
  if (act) await act(app, page)
  await page.screenshot({ path: path.join(out, file), type: 'png' })
  const overflow = await app.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth).catch(() => 0)
  if (overflow > 0) problems.push(`${file}: horizontal overflow ${overflow}px`)
  await context.close()
  console.log(file)
}

const portrait = { width: 820, height: 1180 }, landscape = { width: 1180, height: 820 }
for (const [index, step] of STEPS.entries()) await shoot(portrait, `/apply/demo?step=${index}`, `${String(index + 1).padStart(2, '0')}-${step}.portrait${suffix}.png`)
const toSignature = async app => { await app.locator('.apply-sign').evaluate(el => el.scrollIntoView({ block: 'center' })); await app.waitForTimeout(400) }
await shoot(portrait, '/apply/demo?step=7', `08-consents-signature.portrait${suffix}.png`, toSignature)
await shoot(landscape, '/apply/demo?step=7', `08-consents-signature.landscape${suffix}.png`, toSignature)
for (const [index, step] of STEPS.entries()) if (['consents', 'review'].includes(step)) await shoot(landscape, `/apply/demo?step=${index}`, `${String(index + 1).padStart(2, '0')}-${step}.landscape${suffix}.png`)
await shoot({ width: 1440, height: 900 }, '/interviews', `hr-tablet-dialog${suffix}.png`, async app => {
  await app.getByRole('button', { name: language === 'en' ? 'Application from a tablet' : 'Αίτηση από tablet' }).click()
  await app.waitForTimeout(500)
  await app.getByRole('button', { name: language === 'en' ? 'Create the link' : 'Δημιουργία συνδέσμου' }).click()
  await app.waitForTimeout(700)
})
await shoot({ width: 1440, height: 900 }, '/interviews/demo-cand-1', `hr-record-consents${suffix}.png`, async app => {
  await app.locator('.interviews-consents').scrollIntoViewIfNeeded()
  await app.waitForTimeout(500)
})
await browser.close(); server.close()
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1 }
