// Dead CSS selectors: fails (or with --write removes the rules) when every
// selector of a rule requires a class or id that no code can ever set — the
// name appears nowhere in the built JavaScript/HTML (app + libraries) or the
// sources, not even as the stem of a dynamically built name ("kpi-" + tone,
// `sv-tone-${x}`, ['x', y].join('-')). Runs after `npm run build`.
//
//   npm run build && npm run audit:dead-selectors            # check
//   node tools/check-dead-selectors.mjs --write               # remove
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
const root = ''
const dist = process.argv.find(arg => !arg.startsWith('-') && arg !== process.argv[0] && arg !== process.argv[1]) || 'dist'
if (!fs.existsSync(dist + '/index.html')) { console.error(`No build found in ${dist}: run npm run build`); process.exit(2) }
const write = process.argv.includes('--write')
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])
const code = walk(dist).filter(f => /\.(js|html)$/.test(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n')
// also the source (dynamic names are clearer there) and markdown/help content rendered as HTML
const src = walk('src').concat(fs.existsSync('public') ? walk('public') : []).filter(f => /\.(jsx?|mjs|html|md|json)$/.test(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n') + fs.readFileSync('index.html', 'utf8')
const corpus = code + '\n' + src
const cache = new Map()
function tokenUsed(tok) {
  if (cache.has(tok)) return cache.get(tok)
  let used = corpus.includes(tok)
  if (!used) {
    // any stem at a '-' or '_' boundary, followed by something that builds a name
    const cuts = [...tok.matchAll(/[-_]/g)].map(m => m.index + 1)
    for (const cut of cuts) {
      const stem = tok.slice(0, cut)
      const re = new RegExp(stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `(\\$\\{|['"\`]\\s*\\+|\\{)`)
      if (re.test(corpus)) { used = true; break }
      // a quoted stem, as in ['analysis', tab].join('-')
      const bare = stem.slice(0, -1)
      if (bare.length >= 3 && new RegExp(`['"\`]${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`][^;\\n]{0,160}\\.join\\(\\s*['"\`][-_]['"\`]`).test(corpus)) { used = true; break }
    }
    // camelCase / prefix concatenation without a separator: "prefix"+x
    if (!used) { for (let i = tok.length - 1; i >= 3; i--) { const stem = tok.slice(0, i); if (new RegExp(`['"\`]${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]\\s*\\+|${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\$\\{`).test(corpus)) { used = true; break } } }
  }
  cache.set(tok, used)
  return used
}
function splitTop(list) { const out = []; let depth = 0, cur = ''; for (const ch of list) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch } out.push(cur); return out.map(s => s.trim()).filter(Boolean) }
// classes/ids required by a selector part: only outside functional pseudo-classes
// (:not/:is/:where/:has arguments are skipped), outside attribute brackets.
function required(part) {
  let depth = 0, out = [], i = 0
  while (i < part.length) {
    const ch = part[i]
    if (ch === '(' ) { depth++; i++; continue }
    if (ch === ')') { depth--; i++; continue }
    if (ch === '[') { while (i < part.length && part[i] !== ']') i++; i++; continue }
    if (ch === '\\') { i += 2; continue }
    if ((ch === '.' || ch === '#') && depth === 0 && /[a-zA-Z_-]/.test(part[i + 1] || '')) {
      let j = i + 1, name = ''
      while (j < part.length && /[\w-]/.test(part[j])) name += part[j++]
      if (part[j] === '\\') return null // escaped class names: skip
      out.push(name); i = j; continue
    }
    i++
  }
  return out
}
const files = walk('src').filter(f => f.endsWith('.css'))
let rulesDead = 0, declsDead = 0; const perFile = {}; const samples = []
for (const f of files) {
  const ast = postcss.parse(fs.readFileSync(f, 'utf8'))
  let changed = false
  ast.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
    const parts = splitTop(rule.selector)
    const dead = parts.every(p => { const req = required(p); return req && req.some(t => !tokenUsed(t)) })
    if (!dead) return
    let n = 0; rule.walkDecls(() => { n++ })
    rulesDead++; declsDead += n
    perFile[f] = (perFile[f] || 0) + 1
    if (samples.length < 25) samples.push(rule.selector.slice(0, 110))
    if (write) { const parent = rule.parent; rule.remove(); changed = true; if (parent.type === 'atrule' && !parent.nodes.length) parent.remove() }
  })
  if (write && changed) fs.writeFileSync(f, ast.toString())
}
if (!rulesDead) { console.log('Dead selector audit passed: every CSS rule can match an element the app renders.'); process.exit(0) }
console.log(`${write ? 'Removed' : 'Found'} ${rulesDead} CSS rule(s) (${declsDead} declarations) whose selectors require classes no code sets:`)
for (const [file, n] of Object.entries(perFile)) console.log(`- ${file}: ${n} rule(s)`)
console.log(samples.map(s => `  ${s}`).join('\n'))
if (!write) { console.log('Remove them with: node tools/check-dead-selectors.mjs --write'); process.exit(1) }
