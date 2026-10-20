// Screens of N1 · bulk creation of accounts from the employee roster (Platform
// Owner only), for the manual: the roster with the selection, the bulk role, the
// confirmation, the account e-mail (rendered with sample data), the activation
// page, the result of the run and the «Έχει λογαριασμό – δεν ενεργοποίησε» filter.
//
//   VITE_SUPABASE_URL=https://sample.supabase.co VITE_SUPABASE_ANON_KEY=sample npx vite build --outDir /tmp/limoxis-n1-dist
//   DIST=/tmp/limoxis-n1-dist node --experimental-strip-types tools/capture-bulk-accounts-screens.mjs
//
// Writes docs/manual/screens/n1/*.jpg at 1440×900 and 820×1180. The app runs from
// dist/ in the Help Center owner preview (?helpPreview=1&helpOwner=1: sample
// hospitals and a simulated run, nothing leaves the browser); the activation page
// gets a sample answer for its link.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// DIST: a build with a (sample) Supabase URL, so that the activation page calls its endpoint (answered here).
const dist = path.resolve(root, process.env.DIST || 'dist')
const out = path.join(root, 'docs/manual/screens/n1')
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ is missing: run `npm run build` first.'); process.exit(1) }
fs.mkdirSync(out, { recursive: true })
const { accountCreatedEmail } = await import(path.join(root, 'supabase/functions/_shared/accountCreatedEmail.ts'))
const { accessLinkExpiry } = await import(path.join(root, 'supabase/functions/_shared/bulkAccounts.ts'))

const ORG = '11111111-0000-4000-8000-000000000001'
const HOSPITAL = 'Γ.Ν. Θεσσαλονίκης «Παπανικολάου»'
const expiresAt = accessLinkExpiry().toISOString()
const email = accountCreatedEmail({ organizationName: HOSPITAL, organizationEmail: 'ipc@papanikolaou.example', organizationPhone: '2313 307000', recipientName: 'Ιωάννα Παππά', username: 'IP40718', roleLabel: 'Χρήστης Τμήματος', departmentName: 'ΜΕΘ', expiresAt, actionUrl: 'https://www.limoxis.com/activate?access=ACT-3f7a…' })
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' }
const frame = '<!doctype html><html><body style="margin:0"><script>const q=new URLSearchParams(location.search);const f=document.createElement("iframe");f.src=q.get("r");f.style.cssText="border:0;width:100vw;height:100vh;display:block";document.body.append(f)</script></body></html>'
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local')
  if (url.pathname === '/__frame') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(frame); return }
  if (url.pathname === '/__email') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(email.html); return }
  let file = path.join(dist, decodeURIComponent(url.pathname))
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const executablePath = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const DEVICES = { desktop: { width: 1440, height: 900 }, tablet: { width: 820, height: 1180 } }
const errors = []
const save = async (page, name, device, options = {}) => { await page.waitForTimeout(450); for (const target of page.frames()) await target.evaluate(() => document.querySelectorAll('.toast-stack').forEach(el => el.remove())).catch(() => {}); await page.screenshot({ path: path.join(out, `${name}-${device}.jpg`), type: 'jpeg', quality: 72, ...options }); console.log(`${name}-${device}.jpg`) }

for (const [device, viewport] of Object.entries(DEVICES)) {
  // The account e-mail.
  {
    const context = await browser.newContext({ viewport, locale: 'el-GR' })
    const page = await context.newPage()
    await page.goto(`${origin}/__email`)
    await save(page, 'n1-4-account-email', device, { fullPage: true })
    await context.close()
  }
  // The activation page, with a sample answer for its link.
  {
    const context = await browser.newContext({ viewport, locale: 'el-GR' })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(`${device}: ${error.message}`))
    await page.route('**/functions/v1/redeem-access-token', route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, organizationName: HOSPITAL, username: 'IP40718', roleLabel: 'Χρήστης Τμήματος', departmentName: 'ΜΕΘ', expiresAt }) })
    })
    await page.goto(`${origin}/activate?access=ACT-${'0'.repeat(64)}`)
    await page.waitForSelector('.activation-context', { timeout: 15000 })
    const inputs = page.locator('input.input')
    await inputs.nth(0).fill('Kalimera2026')
    await inputs.nth(1).fill('Kalimera2026')
    await save(page, 'n1-5-activation', device)
    await context.close()
  }
  // The owner preview: the hospital's «Χρήστες & Ρόλοι».
  const context = await browser.newContext({ viewport, locale: 'el-GR' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(`${device}: ${error.message}`))
  const r = `/platform?helpPreview=1&helpLang=el&helpOwner=1#organizations?organization=${ORG}&tab=users`
  await page.goto(`${origin}/__frame?r=${encodeURIComponent(r)}`)
  await page.waitForTimeout(3000)
  const f = page.frames().find(item => item !== page.mainFrame())
  for (let i = 0; i < 4; i++) {
    const close = f.locator('.observer-dialog header button[aria-label="Κλείσιμο"]').first()
    if (!(await close.count())) break
    await close.click().catch(() => {})
    await page.waitForTimeout(300)
  }
  await f.getByRole('tab', { name: /Εργαζόμενοι χωρίς λογαριασμό/ }).click()
  await f.waitForSelector('.bulk-accounts-table')
  const rowOf = name => f.locator('.bulk-accounts-table tbody tr', { hasText: name })
  const roles = { 'Ιωάννα Παππά': 'department_user', 'Κωνσταντίνα Ρίζου': 'department_manager', 'Θεόδωρος Μαυρίδης': 'doctor_reviewer', 'Αθανάσιος Γκίκας': 'laboratory', 'Ευδοκία Σταμάτη': 'pharmacy', 'Παρασκευή Λιάπη': 'infection_control_member', 'Γεράσιμος Κουτσός': 'occupational_physician', 'Νεκταρία Φωτίου': 'link_nurse', 'Ηλίας Μπαλτάς': 'hr_office' }
  for (const [name, role] of Object.entries(roles)) await rowOf(name).locator('select').first().selectOption(role)
  for (const name of ['Μιχάλης Τσιρίγος', 'Σοφία Δημάκη', 'Δέσποινα Αργυρίου']) await rowOf(name).locator('input[type=checkbox]').check()
  const top = () => f.locator('.bulk-accounts-table-wrap').evaluate(el => { el.scrollTop = 0 })
  await top()
  await save(page, 'n1-1-roster-selection', device)
  await f.getByRole('button', { name: /Ορισμός ρόλου σε όλους τους επιλεγμένους/ }).click()
  await f.getByRole('radio', { name: /Χρήστης Τμήματος/ }).click()
  await top()
  await save(page, 'n1-2-bulk-role', device)
  await f.getByRole('button', { name: /^Εφαρμογή σε/ }).click()
  await f.getByRole('button', { name: 'Δημιουργία λογαριασμών & αποστολή' }).click()
  await f.waitForSelector('.bulk-accounts-dialog-grid')
  await f.locator('.bulk-accounts-existing input[type=checkbox]').first().check()
  await save(page, 'n1-3-confirm-dialog', device)
  await f.getByRole('button', { name: /^Δημιουργία \d+ & αποστολή/ }).click()
  await f.waitForSelector('.bulk-accounts-summary')
  await top()
  await save(page, 'n1-6-result', device)
  await f.getByRole('button', { name: /Έχει λογαριασμό – δεν ενεργοποίησε/ }).click()
  await f.locator('.bulk-accounts-table thead input[type=checkbox]').check()
  await top()
  await save(page, 'n1-7-not-activated-filter', device)
  await context.close()
}
await browser.close()
server.close()
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
