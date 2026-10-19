// Previews of the supplier certificate renewal (one e-mail per supplier) for the
// manual: the public form of the demo link with three certificates, the same form
// after one is submitted, the e-mail rendered with sample data, and the in-app queue
// (grouping, «no answer», the disabled buttons of a Quality user who was not
// designated, and the same queue for a designated sender).
//
//   npm run build && node --experimental-strip-types tools/capture-supplier-renewal-screens.mjs
//
// Writes docs/manual/screens/supplier-renewal/*.png at 1440×900 and 820×1180. Only
// the demo link (/supplier-certificate/demo) and the help-preview sample data are
// used: nothing is read from or sent to the database.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const out = path.join(root, 'docs/manual/screens/supplier-renewal')
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ is missing: run `npm run build` first.'); process.exit(1) }
fs.mkdirSync(out, { recursive: true })
const { supplierCertificateRenewalEmail } = await import(path.join(root, 'supabase/functions/_shared/supplierCertificateEmail.ts'))

const DEVICES = { desktop: { width: 1440, height: 900 }, tablet: { width: 820, height: 1180 } }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' }
const frame = '<!doctype html><html><body style="margin:0"><script>const q=new URLSearchParams(location.search);const f=document.createElement("iframe");f.src=q.get("r");f.style.cssText="border:0;width:100vw;height:100vh;display:block";document.body.append(f)</script></body></html>'
const day = offset => { const date = new Date(); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10) }
const email = supplierCertificateRenewalEmail({
  organizationName: 'Γενικό Νοσοκομείο (δείγμα)', supplierName: 'Ιατροτεχνική Δείγμα Α.Ε.', kind: 'send', expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(), actionUrl: 'https://limoxis.example/supplier-certificate/demo',
  certificates: [
    { type: 'ISO 14001', number: 'EM-2291', expiresOn: day(-45) },
    { type: 'ISO 9001', number: 'QM-2290', expiresOn: day(-20) },
    { type: 'ISO 13485', title: 'Ιατροτεχνολογικά προϊόντα', number: 'MD-4471', expiresOn: day(-8) },
  ],
})
fs.writeFileSync(path.join(out, 'email.html'), email.html)

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
const browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') } : {})
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const errors = []

for (const [device, viewport] of Object.entries(DEVICES)) {
  const context = await browser.newContext({ viewport, locale: 'el-GR', hasTouch: device === 'tablet' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(`${device}: ${error.message}`))
  const shot = async (name, target = page) => { await page.waitForTimeout(500); await target.screenshot({ path: path.join(out, `${name}-${device}.png`) }); console.log(`${name}-${device}.png`) }

  // 1. The public form of the demo link: three certificates, each with its own form.
  await page.goto(`${origin}/supplier-certificate/demo?helpLang=el`)
  await page.getByText('Προεπισκόπηση με δείγμα').waitFor()
  await shot('01-supplier-form')
  // 2. One certificate submitted (simulated: the demo link sends nothing).
  const first = page.locator('section.supplier-certificate-item').first()
  await first.getByLabel(/Αριθμός πιστοποιητικού/).fill('QM-2290/2')
  await first.getByLabel(/Ημερομηνία λήξης/).fill(new Date(Date.now() + 3 * 365 * 86400000).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }))
  await first.getByLabel(/Ημερομηνία λήξης/).press('Tab')
  await first.locator('input[type=file]').setInputFiles({ name: 'ISO-9001-2026.pdf', mimeType: 'application/pdf', buffer: pdf })
  await first.getByRole('button', { name: /Υποβολή πιστοποιητικού/ }).click()
  await page.getByText(/Υποβλήθηκαν 1 από 3/).waitFor()
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot('02-supplier-form-one-submitted')
  // 3. The e-mail, rendered with sample data.
  await page.goto(`${origin}/__email`)
  await shot('03-email')
  // 4. The queue in the app (help-preview sample data): a Quality Manager who was not designated…
  await page.goto(`${origin}/__frame?r=${encodeURIComponent('/quality/suppliers/renewals?helpPreview=1&helpLang=el&helpRole=quality_manager')}`)
  const app = () => page.frames().find(item => item !== page.mainFrame())
  await page.waitForTimeout(2500)
  await app().getByText('Χωρίς απάντηση (10 ημέρες)').waitFor({ timeout: 15000 })
  await shot('04-queue-not-designated')
  await app().getByText('Χωρίς απάντηση (10 ημέρες)').scrollIntoViewIfNeeded()
  await shot('04b-queue-not-designated-no-answer')
  await app().getByText('Χωρίς απάντηση (7+ ημέρες)').click()
  await shot('04c-queue-filter-no-answer')
  // …and the designated sender (the preview's administrator with every permission).
  await page.goto(`${origin}/__frame?r=${encodeURIComponent('/quality/suppliers/renewals?helpPreview=1&helpLang=el')}`)
  await page.waitForTimeout(2500)
  await app().getByText('Χωρίς απάντηση (10 ημέρες)').waitFor({ timeout: 15000 })
  await shot('05-queue-sender')
  await context.close()
}
await browser.close(); server.close()
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
