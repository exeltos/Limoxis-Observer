// Controls screens (hospital admin, demo): list, filters, record (one and several departments), new control, empty list; desktop 1440 and tablet 820.
//
//   npm run build && node tools/capture-controls.mjs [--tag after]
//
// Writes docs/manual/screens/fixes/controls/<tag>-<name>-<desktop|tablet>.jpg. The app runs from dist/ in the Help Center preview frame.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const out = path.join(root, 'docs/manual/screens/fixes/controls')
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

const OPEN_ROLE = 'hospital_admin'
async function openRoute(page, app, origin, route, extra = {}) {
  const q = new URLSearchParams({ helpPreview: '1', helpLang: 'el', helpRole: OPEN_ROLE, ...extra })
  if (extra.role) q.set('helpRole', extra.role)
  await page.goto(`${origin}/__frame?r=${encodeURIComponent(`${route}${route.includes('?') ? '&' : '?'}${q}`)}`)
  await page.waitForTimeout(1500)
  await app()?.waitForFunction(() => { const c = document.querySelector('.content'); return c && !document.querySelector('.route-loading') && c.innerText.trim().length > 40 }, null, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1000)
}
for (const [size, viewport] of [['desktop', { width: 1440, height: 900 }], ['tablet', { width: 820, height: 1100 }]]) {
  await session(viewport, async ({ page, app, shot }) => {
    const go = (route, extra) => openRoute(page, app, origin, route, extra)
    await go('/controls')
    await shot(`list-${size}`)
    await app().getByRole('button', { name: /Φίλτρα/ }).first().click().catch(() => {})
    await page.waitForTimeout(500)
    await shot(`filters-${size}`)
    let single = null, multi = null
    for (const n of [1, 2, 3, 4, 5]) {
      const code = `CTRL-DEMO-000${n}`
      await go(`/controls/${code}`)
      const rows = await app().locator('.control-ov-department').count()
      if (rows === 1 && !single) { single = code; await shot(`record-single-${size}`) }
      if (rows > 1 && !multi) { multi = code; await shot(`record-multi-${size}`) }
      if (single && multi) break
    }
    if (!single) {
      // The demo has no one-department control: a department user sees only their own department of one.
      await go('/controls/CTRL-DEMO-0001', { role: 'department_user' })
      await shot(`record-single-${size}`)
    }
    if (multi) { await go(`/controls/${multi}`, { tab: 'history' }); await shot(`record-executions-${size}`) }
    await go('/controls/new')
    await shot(`create-${size}`)
    await app().getByRole('button', { name: /Προχωρημένα/ }).click().catch(() => {})
    await page.waitForTimeout(400)
    await shot(`create-advanced-${size}`)
    await go('/controls', { helpEmpty: '1' })
    await shot(`empty-${size}`)
  })
}
await browser.close()
server.close()
