// Accessibility check (WCAG 2.1 A/AA via axe-core) of every main screen of a
// production build, opened as the demo workspace (help-preview iframe mode,
// no Supabase account needed). Fails on any violation.
//
//   npm run build && npm run audit:a11y            # checks dist/
//   node tools/check-accessibility.mjs --dist dist
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []))
const root = path.resolve(args.dist || 'dist')
const ROUTES = ['/', '/patients', '/surveillance', '/laboratory', '/prevention', '/employees', '/quality', '/analysis', '/training', '/committees', '/documents', '/management', '/indicators', '/pharmacy', '/controls', '/my-department']
const WRAP = '<!doctype html><html lang="el"><head><title>a11y</title></head><body style="margin:0"><script>const q=new URLSearchParams(location.search);document.write(`<iframe title="Limoxis Observer" src="${q.get("r")}?helpPreview=1&helpLang=${q.get("l")}" style="border:0;width:100vw;height:100vh"></iframe>`)</script></body></html>'
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }

if (!fs.existsSync(path.join(root, 'index.html'))) { console.error(`No build found in ${root}: run npm run build`); process.exit(2) }
let chromium, axeSource
try { ({ chromium } = await import('playwright')); axeSource = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8') } catch { console.error('playwright/axe-core not installed: npm ci'); process.exit(2) }

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (url === '/__a11y_wrap.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(WRAP); return }
  let file = path.join(root, url)
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const violations = []
for (const lang of ['el', 'en']) for (const route of ROUTES) {
  await page.goto(`http://127.0.0.1:${port}/__a11y_wrap.html?r=${encodeURIComponent(route)}&l=${lang}`)
  await page.waitForTimeout(1800)
  const frame = page.frames().find(item => item !== page.mainFrame())
  const briefing = frame.locator('.login-briefing-dialog button').first()
  if (await briefing.count()) await briefing.click({ timeout: 2000 }).catch(() => {})
  await page.waitForTimeout(300)
  await frame.evaluate(axeSource)
  const found = await frame.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => n.target.join(' ')) })))
  for (const v of found) violations.push({ screen: `${lang} ${route}`, ...v })
}
await browser.close(); server.close()

const lines = ['## Accessibility (WCAG 2.1 AA, axe-core)', '', `${ROUTES.length * 2} screens checked: **${violations.length ? `${violations.length} violation group(s)` : 'no violations'}**.`]
if (violations.length) lines.push('', '| Screen | Rule | Impact | Elements | Example |', '|---|---|---|---|---|', ...violations.map(v => `| ${v.screen} | ${v.id} | ${v.impact} | ${v.nodes.length} | \`${String(v.nodes[0]).replace(/\|/g, '\\|').slice(0, 90)}\` |`))
const report = lines.join('\n')
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n')
console.log(report)
process.exit(violations.length ? 1 : 0)
