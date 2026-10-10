// Finds `!important` flags that change nothing on the screens the visual
// regression check opens, by asking Chrome which rules apply to each element.
//
// For every element (and pseudo-element) of every screen state of
// tools/visual-regression.mjs, Chrome DevTools lists the matching rules in
// cascade order. For each `!important` declaration D and each property it sets
// (shorthands expanded to longhands), the cascade winner is computed twice, with
// D important and with D normal. D's flag is needed when the winner or its value
// differs on any element. A flag is reported as removable only when D matched at
// least one element and was never needed; flags of rules that matched nothing in
// these states (hover, other screens) are left alone.
//
//   npx vite build --outDir <dir>      (the production build: its cascade is the app's)
//   node tools/check-redundant-important.mjs --build <dir> [--quick true] [--write true]
//
// --write removes the removable flags from the source stylesheets. Verify the
// result with tools/visual-regression.mjs, which compares computed styles.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import postcss from 'postcss'

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []))
const buildDir = path.resolve(args.build || 'dist')
const quick = args.quick === 'true'
const write = args.write === 'true'

const WRAP = '<!doctype html><html><body style="margin:0"><script>const q=new URLSearchParams(location.search);document.write(`<iframe src="${q.get("r")}?helpPreview=1&helpLang=${q.get("l")}" style="border:0;width:100vw;height:100vh"></iframe>`)</script></body></html>'
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' }
function serve(root) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (url === '/__visual_wrap.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(WRAP); return }
    let file = path.join(root, url)
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)))
}

// The same screen states as tools/visual-regression.mjs.
const ROUTES = ['/', '/patients', '/surveillance', '/laboratory', '/prevention', '/employees', '/quality', '/analysis', '/training', '/committees', '/documents', '/management', '/indicators', '/pharmacy', '/controls', '/my-department']
const SIZES = { desktop: [1440, 900], tablet: [900, 700], phone: [390, 844] }
function states() {
  const list = []
  for (const size of quick ? ['desktop'] : Object.keys(SIZES)) for (const route of ROUTES) list.push({ size, route, lang: 'el' })
  for (const route of ['/', '/surveillance', '/laboratory', '/quality', '/analysis']) list.push({ size: 'desktop', route, lang: 'en' })
  for (const route of ['/surveillance', '/laboratory', '/quality', '/employees', '/prevention', '/documents', '/committees', '/training']) list.push({ size: 'desktop', route, lang: 'el', act: 'create' })
  for (const route of ['/surveillance', '/laboratory', '/patients']) list.push({ size: 'desktop', route, lang: 'el', act: 'filters' })
  list.push({ size: 'desktop', route: '/', lang: 'el', act: 'notifications' })
  list.push({ size: 'phone', route: '/laboratory', lang: 'el', act: 'create' })
  for (let tab = 0; tab < 5; tab++) list.push({ size: 'desktop', route: '/surveillance', lang: 'el', act: 'record', tab })
  for (let tab = 0; tab < 5; tab++) list.push({ size: 'phone', route: '/surveillance', lang: 'en', act: 'record', tab })
  return list
}

async function dismissBriefing(frame) {
  const button = frame.locator('.login-briefing-dialog button').first()
  if (await button.count()) await button.click({ timeout: 2000 }).catch(() => {})
}

async function open(page, port, s) {
  await page.goto(`http://127.0.0.1:${port}/__visual_wrap.html?r=${encodeURIComponent(s.route)}&l=${s.lang}`)
  await page.waitForTimeout(1800)
  const frame = page.frames().find(item => item !== page.mainFrame())
  await dismissBriefing(frame); await page.waitForTimeout(250)
  try {
    if (s.act === 'create') await frame.locator('.page-actions button, .page-header button.primary, button:has-text("Δημιουργία"), button:has-text("Νέ")').first().click({ timeout: 2500 })
    if (s.act === 'filters') await frame.locator('button:has-text("Φίλτρα")').first().click({ timeout: 2500 })
    if (s.act === 'notifications') await frame.locator('.notification-button').first().click({ timeout: 2500 })
    if (s.act === 'record') {
      await frame.locator('tbody tr').first().click({ timeout: 3000 }); await page.waitForTimeout(1500); await dismissBriefing(frame)
      const tabs = await frame.locator('[role=tab]').all()
      if (tabs[s.tab]) await tabs[s.tab].click({ timeout: 2500 })
    }
  } catch { /* the state is still analysed as it is */ }
  await page.waitForTimeout(700); await dismissBriefing(frame)
}

// Declared entries of a style (with their longhands), as Chrome reports them.
// `ordinal` counts earlier declarations of the same property in the same rule,
// including ones Chrome does not apply, so it identifies the declaration in the
// stylesheet whatever Chrome skipped.
function declared(style) {
  const seen = {}
  const out = []
  for (const p of style?.cssProperties || []) {
    if (!p.range) continue
    const name = p.name.toLowerCase()
    const ordinal = seen[name] = (seen[name] ?? -1) + 1
    if (p.disabled || p.parsedOk === false) continue
    out.push({
      name,
      ordinal,
      important: Boolean(p.important),
      longhands: p.longhandProperties?.length ? p.longhandProperties.map(l => l.name) : [name],
      value: p.value.replace(/\s*!important\s*$/i, '').trim(),
    })
  }
  return out
}

// The winning declaration for one longhand: important beats normal; inline beats
// author rules of the same importance; later author rules beat earlier ones.
function winner(candidates, flipped) {
  const important = c => (c === flipped ? false : c.important)
  const pick = list => list.filter(c => c.inline).at(-1) || list.filter(c => !c.inline).at(-1)
  const imp = candidates.filter(important)
  return imp.length ? pick(imp) : pick(candidates)
}

const status = new Map() // declaration key -> { needed, matched, sheet, line, column, name }

function analyse(rules, inline) {
  const entries = []
  rules.forEach((match, order) => {
    const rule = match.rule
    if (rule.origin !== 'regular' || !rule.style?.range) return
    declared(rule.style).forEach(d => entries.push({ ...d, order, inline: false, key: `${rule.styleSheetId}@${rule.style.range.startLine}:${rule.style.range.startColumn}#${d.name}#${d.ordinal}`, sheet: rule.styleSheetId, range: rule.style.range }))
  })
  declared(inline).forEach(d => entries.push({ ...d, inline: true }))
  const byLonghand = new Map()
  for (const e of entries) for (const l of e.longhands) { if (!byLonghand.has(l)) byLonghand.set(l, []); byLonghand.get(l).push(e) }
  for (const d of entries) {
    if (d.inline || !d.important) continue
    const s = status.get(d.key) || { needed: false, matched: 0, sheet: d.sheet, range: d.range, ordinal: d.ordinal, name: d.name }
    s.matched++
    for (const l of d.longhands) {
      const candidates = byLonghand.get(l)
      const before = winner(candidates, null)
      const after = winner(candidates, d)
      if (before !== after && before.value !== after.value) s.needed = true
    }
    status.set(d.key, s)
  }
}

let chromium
try { ({ chromium } = await import('playwright')) } catch { console.error('playwright is not installed: npm ci'); process.exit(2) }
if (!fs.existsSync(path.join(buildDir, 'index.html'))) { console.error(`No build found in ${buildDir}`); process.exit(2) }
const server = await serve(buildDir)
const port = server.address().port
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const sheetUrls = new Map()
let elements = 0
for (const [size, [width, height]] of Object.entries(SIZES)) {
  const list = states().filter(s => s.size === size)
  if (!list.length) continue
  const page = await browser.newPage({ viewport: { width, height } })
  const cdp = await page.context().newCDPSession(page)
  cdp.on('CSS.styleSheetAdded', ({ header }) => sheetUrls.set(header.styleSheetId, header.sourceURL))
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
  for (const s of list) {
    await open(page, port, s)
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true })
    const findFrameDocument = node => node.contentDocument || (node.children || []).map(findFrameDocument).find(Boolean)
    const frameDocument = findFrameDocument(root)
    if (!frameDocument) continue
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: frameDocument.nodeId, selector: 'body, body *' })
    for (const nodeId of nodeIds) {
      let matched
      try { matched = await cdp.send('CSS.getMatchedStylesForNode', { nodeId }) } catch { continue }
      elements++
      analyse(matched.matchedCSSRules || [], matched.inlineStyle)
      for (const pseudo of matched.pseudoElements || []) analyse(pseudo.matches || [], null)
    }
    if (process.env.IMPORTANT_PROGRESS) console.log(`${s.size} ${s.route} ${s.act || ''}${s.tab ?? ''}: ${nodeIds.length} elements, ${status.size} flags seen`)
  }
  await page.close()
}
await browser.close(); server.close()
if (process.env.IMPORTANT_PROGRESS) console.log('mapping to source…')

// Map each declaration Chrome saw back to the built stylesheet, then to source.
const norm = s => String(s).replace(/\s+/g, ' ').replace(/\s*([>+~,:;(){}])\s*/g, '$1').trim()
const context = node => { const parts = []; for (let p = node.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') parts.unshift(`@${p.name} ${norm(p.params)}`); return parts.join('|') }
const declKey = decl => `${context(decl.parent)}||${norm(decl.parent.selector)}||${decl.prop.toLowerCase()}||${norm(decl.value)}`

// Chrome's style ranges are 0-based and start just after "{"; postcss lines are
// 1-based. Each built stylesheet is indexed once by that position.
const builtByFile = new Map()
function builtIndex(url) {
  const file = path.join(buildDir, 'assets', path.basename(new URL(url).pathname))
  if (builtByFile.has(file)) return builtByFile.get(file)
  let entry = null
  if (fs.existsSync(file)) {
    const ast = postcss.parse(fs.readFileSync(file, 'utf8'))
    const byPosition = new Map()
    ast.walkRules(rule => {
      if (!rule.source?.start) return
      const head = rule.toString()
      const brace = head.indexOf('{')
      if (brace < 0) return
      const lines = head.slice(0, brace + 1).split('\n')
      const line = rule.source.start.line - 1 + lines.length - 1
      const column = (lines.length === 1 ? rule.source.start.column - 1 : 0) + lines.at(-1).length
      byPosition.set(`${line}:${column}`, rule)
    })
    entry = { ast, byPosition }
  }
  builtByFile.set(file, entry)
  return entry
}
function builtDeclaration(s) {
  const url = sheetUrls.get(s.sheet); if (!url) return null
  const index = builtIndex(url); if (!index) return null
  const rule = index.byPosition.get(`${s.range.startLine}:${s.range.startColumn}`)
  if (!rule) return null
  // The same property, at the same ordinal, and important: otherwise unmapped.
  const decl = rule.nodes.filter(n => n.type === 'decl' && n.prop.toLowerCase() === s.name)[s.ordinal]
  return decl && decl.important ? decl : null
}

const builtVerdict = new Map() // built declaration key -> { removable, needed }
let unmapped = 0
for (const s of status.values()) {
  const decl = builtDeclaration(s)
  if (!decl || !decl.important) { unmapped++; continue }
  const key = declKey(decl)
  const v = builtVerdict.get(key) || { needed: false, seen: 0 }
  v.seen++; if (s.needed) v.needed = true
  builtVerdict.set(key, v)
}
// A built declaration with the same key must be removable everywhere it occurs.
const builtCounts = new Map()
for (const entry of builtByFile.values()) entry?.ast.walkDecls(decl => { if (decl.important && decl.parent.type === 'rule') builtCounts.set(declKey(decl), (builtCounts.get(declKey(decl)) || 0) + 1) })

function walk(dir, out = []) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f, out); else if (f.endsWith('.css')) out.push(f) } return out }
const sources = walk('src').map(file => ({ file, ast: postcss.parse(fs.readFileSync(file, 'utf8'), { from: file }) }))
const sourceCounts = new Map()
for (const { ast } of sources) ast.walkDecls(decl => { if (decl.important && decl.parent.type === 'rule') sourceCounts.set(declKey(decl), (sourceCounts.get(declKey(decl)) || 0) + 1) })

let removable = 0, needed = 0, ambiguous = 0
const perFile = {}
for (const { file, ast } of sources) {
  let changed = false
  ast.walkDecls(decl => {
    if (!decl.important || decl.parent.type !== 'rule') return
    const key = declKey(decl)
    const v = builtVerdict.get(key)
    if (!v) return
    if (v.needed) { needed++; return }
    // Every built copy of this declaration was seen and never needed, and the
    // source has exactly as many copies as the build: safe to drop the flag.
    if (sourceCounts.get(key) !== builtCounts.get(key) || v.seen < (builtCounts.get(key) || 0)) { ambiguous++; return }
    removable++; perFile[file] = (perFile[file] || 0) + 1
    if (write) { decl.important = false; delete decl.raws.important; changed = true }
  })
  if (changed) fs.writeFileSync(file, ast.toString())
}
const total = sources.reduce((n, { ast }) => { let c = 0; ast.walkDecls(d => { if (d.important) c++ }); return n + c }, 0)
console.log(`${elements.toLocaleString('en')} elements analysed; ${status.size} !important declarations matched at least one element (${unmapped} not mapped to the build).`)
for (const [file, n] of Object.entries(perFile).sort((a, b) => b[1] - a[1])) console.log(`${n}\t${file}`)
console.log(`${removable} removable, ${needed} needed, ${ambiguous} left alone (duplicates not all seen); ${total} !important in the sources${write && removable ? ' (removed the removable ones)' : ''}.`)
