// Operations (Controls, Kitchen): before/after of the thermal list, stock, controls list, control record and day record.
//
//   npx vite build --outDir <dir> && node tools/capture-operations-terms.mjs --dist <dir> --tag before|after
//
// Writes docs/manual/screens/fixes/operations-terms/<tag>-<name>.jpg (desktop 1440).
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const dist = path.resolve(root, arg('--dist', 'dist'))
const tag = arg('--tag', 'after')
const out = path.join(root, 'docs/manual/screens/fixes/operations-terms')
fs.mkdirSync(out, { recursive: true })

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' }
const frameHtml = '<!doctype html><html><body style="margin:0"><script>const q=new URLSearchParams(location.search);const f=document.createElement("iframe");f.src=q.get("r");f.style.cssText="border:0;width:100vw;height:100vh";document.body.appendChild(f)</script></body></html>'
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
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'el-GR' })
const page = await context.newPage()
await context.addInitScript(() => {
  const getItem = Storage.prototype.getItem
  Storage.prototype.getItem = function (key) { return /^limoxis\.(briefing|birthday)\.seen/.test(String(key)) ? '1' : getItem.call(this, key) }
})
const app = () => page.frames().find(f => f !== page.mainFrame())
async function open(route) {
  const q = new URLSearchParams({ helpPreview: '1', helpLang: 'el', helpRole: 'hospital_admin' })
  await page.goto(`${origin}/__frame?r=${encodeURIComponent(`${route}${route.includes('?') ? '&' : '?'}${q}`)}`)
  await page.waitForTimeout(1500)
  await app()?.waitForFunction(() => { const c = document.querySelector('.content'); return c && !document.querySelector('.route-loading') && c.innerText.trim().length > 60 }, null, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1200)
}
const shot = name => page.screenshot({ path: path.join(out, `${tag}-${name}.jpg`), type: 'jpeg', quality: 60 })

await open('/kitchen/days/kd-7')
await app().getByRole('tab', { name: /Παράμετροι ζέστης/ }).click().catch(() => {})
await page.waitForTimeout(600)
await shot('thermal-list')
await app().getByRole('tab', { name: /Α΄ ύλες/ }).click().catch(() => {})
await page.waitForTimeout(400)
await shot('day-record')
await open('/kitchen?tab=storage&view=stock')
await shot('stock')
await open('/kitchen?tab=storage&view=receipts')
await shot('receipts')
await open('/controls')
await shot('controls-list')
await open('/controls/CTRL-DEMO-0004')
await shot('control-record')
await browser.close()
server.close()
