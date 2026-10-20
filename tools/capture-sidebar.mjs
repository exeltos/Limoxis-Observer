// Sidebar hierarchy screens (hospital admin): desktop 1440 expanded, another group opened, tablet icon rail.
//
//   npm run build && node tools/capture-sidebar.mjs [--tag before|after]
//
// Writes docs/manual/screens/fixes/sidebar/<tag>-<name>.jpg. The app runs from dist/ in the Help Center preview frame.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const out = path.join(root, 'docs/manual/screens/fixes/sidebar')
const args = process.argv.slice(2)
const tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : 'after'
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

async function session(viewport, run) {
  const context = await browser.newContext({ viewport, locale: 'el-GR' })
  const page = await context.newPage()
  await context.addInitScript(() => {
    const getItem = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) { return /^limoxis\.(briefing|birthday)\.seen/.test(String(key)) ? '1' : getItem.call(this, key) }
  })
  const app = () => page.frames().find(f => f !== page.mainFrame())
  const open = async route => {
    const q = new URLSearchParams({ helpPreview: '1', helpLang: 'el', helpRole: 'hospital_admin' })
    await page.goto(`${origin}/__frame?r=${encodeURIComponent(`${route}?${q}`)}`)
    await page.waitForTimeout(1500)
    await app()?.waitForFunction(() => { const c = document.querySelector('.content'); return c && !document.querySelector('.route-loading') && c.innerText.trim().length > 60 }, null, { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1200)
  }
  const shot = async (name, clip) => page.screenshot({ path: path.join(out, `${tag}-${name}.jpg`), type: 'jpeg', quality: 70, ...(clip ? { clip } : {}) })
  try { await run({ page, app, open, shot }) } finally { await context.close() }
}

const side = { x: 0, y: 0, width: 260, height: 900 }
await session({ width: 1440, height: 900 }, async ({ page, app, open, shot }) => {
  await open('/surveillance')
  await shot('surveillance', side)
  await open('/patients/PT-260231')
  await shot('patient-record', side)
  await open('/surveillance')
  const headings = app().locator('.nav-section-heading[aria-expanded="false"]')
  if (await headings.count()) await headings.first().click()
  await page.waitForTimeout(400)
  await shot('other-group-open', side)
})
await session({ width: 820, height: 900 }, async ({ open, shot }) => {
  await open('/surveillance')
  await shot('tablet-rail', { x: 0, y: 0, width: 330, height: 900 })
})
await browser.close()
server.close()
