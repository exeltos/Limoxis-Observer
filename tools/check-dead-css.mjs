// Detects (or with --write removes) provably dead CSS from the globally imported stylesheets (main.jsx order):
// a declaration is dead when a LATER rule with the identical selector, in the
// identical at-rule context, declares the same property and wins the cascade
// (later order; importance not weaker). Same selector => same specificity.
// Rules left empty are removed. Nothing is reordered.
import fs from 'node:fs'
import postcss from 'postcss'

const root = ''
const write = process.argv.includes('--write')
const main = fs.readFileSync(root + 'src/main.jsx', 'utf8')
const files = [...main.matchAll(/import '\.\/(styles\/[^']+\.css)'/g)].map(m => 'src/' + m[1])
const asts = files.map(f => ({ f, ast: postcss.parse(fs.readFileSync(root + f, 'utf8'), { from: f }) }))

function context(node) {
  const parts = []; let p = node.parent
  while (p && p.type !== 'root') { if (p.type === 'atrule') parts.unshift('@' + p.name + ' ' + p.params.replace(/\s+/g, ' ').trim()); else if (p.type === 'rule') parts.unshift(p.selector); p = p.parent }
  return parts.join(' | ')
}
const norm = s => s.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').trim()

// Collect all declarations in global order.
const decls = []
for (const { ast } of asts) ast.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
  const key = context(rule) + ' || ' + norm(rule.selector)
  rule.each(node => { if (node.type === 'decl') decls.push({ node, key, prop: node.prop.toLowerCase(), imp: !!node.important }) })
})
// Walk backwards tracking, per (key,prop), whether a later winning declaration exists.
const seen = new Map() // key|prop -> strongest later importance seen (true if an !important exists later)
let dead = 0
for (let i = decls.length - 1; i >= 0; i--) {
  const d = decls[i]
  const k = d.key + '|' + d.prop
  const later = seen.get(k)
  // Same-rule duplicates can be intentional fallbacks (display:-webkit-box;display:flex): only kill across rules.
  const killable = later && later.rule !== d.node.parent && !/^-(webkit|moz|ms|o)-/.test(d.node.value) && (!d.imp || later.imp)
  if (killable) { d.node.remove(); dead++ }
  if (!later || (d.imp && !later.imp)) seen.set(k, { imp: d.imp || !!later?.imp, rule: d.node.parent ?? later?.rule })
  else if (!later.imp && d.imp) later.imp = true
}
let emptied = 0
for (const { ast } of asts) {
  ast.walkRules(rule => { if (!rule.nodes.some(n => n.type === 'decl' || n.type === 'rule' || n.type === 'atrule')) { rule.remove(); emptied++ } })
  ast.walkAtRules(at => { if (at.nodes && at.nodes.length === 0) at.remove() })
}
let before = 0, after = 0
for (const { f, ast } of asts) {
  const orig = fs.readFileSync(root + f, 'utf8'); const out = ast.toString()
  before += orig.length; after += out.length
  if (write) fs.writeFileSync(root + f, out)
}
if (!write && (dead || emptied)) {
  console.error(`Dead CSS detected: ${dead} overridden declarations, ${emptied} rules left empty (${before - after} bytes). Run npm run css:prune.`)
  process.exit(1)
}
console.log(write
  ? `Pruned ${dead} overridden declarations and ${emptied} empty rules (${before - after} bytes) across ${files.length} stylesheets.`
  : `Dead CSS audit passed: ${files.length} global stylesheets, no overridden declarations.`)
