// Χρώματα CSS ως μεταβλητές (tokens).
//
// Κάθε χρώμα #rrggbb γραμμένο απευθείας σε δήλωση γίνεται var(--token). Το όνομα
// βγαίνει από το μητρώο tools/color-tokens.json: ρόλος (text, surface, border,
// shadow, fill) + οικογένεια (neutral, brand, success, warning, danger, accent)
// + φωτεινότητα 0–1000, ή υπάρχουσα μεταβλητή του :root με την ίδια ακριβώς τιμή.
// Η τιμή δεν αλλάζει ποτέ: κάθε μεταβλητή κρατά το ακριβές χρώμα που αντικαθιστά.
//
//   node tools/css-color-tokens.ts                         μέτρηση ανά αρχείο (χρώματα απευθείας, !important)
//   node tools/css-color-tokens.ts --check                 αποτυγχάνει αν ένα αρχείο έχει περισσότερα χρώματα απευθείας από το όριο
//   node tools/css-color-tokens.ts --write-baseline        καταγράφει τα τωρινά όρια (tools/raw-color-baseline.json)
//   node tools/css-color-tokens.ts --write --tokens <αρχείο.css> <αρχεία.css…>
//        αντικαθιστά τα χρώματα στα αρχεία και ορίζει όσες νέες μεταβλητές χρειάζονται
//        σε μπλοκ :root στο <αρχείο.css> (ανάμεσα στα σχόλια «color tokens»).
//
// Δεν αγγίζονται: οι ορισμοί μεταβλητών μέσα σε :root (αυτοί είναι τα tokens), οι
// τιμές μέσα σε url(…) ή σε εισαγωγικά, @property, @page, @font-face, ::backdrop
// και ::-webkit-scrollbar (εκεί οι μεταβλητές του :root δεν είναι πάντα διαθέσιμες).
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import { readSource } from './readSource.ts'

const REGISTRY = 'tools/color-tokens.json'
const BASELINE = 'tools/raw-color-baseline.json'
const START = '/* color tokens: start */'
const END = '/* color tokens: end */'
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g

export function normalizeHex(hex) {
  let h = hex.slice(1).toLowerCase()
  if (h.length <= 4) h = [...h].map(c => c + c).join('')
  return `#${h}`
}

export function colorRole(prop) {
  const p = prop.toLowerCase()
  if (/^(color|caret-color|-webkit-text-fill-color|text-decoration-color|text-emphasis-color|-webkit-text-stroke(-color)?)$/.test(p)) return 'text'
  if (p.startsWith('background')) return 'surface'
  if (/^(border|outline|column-rule)/.test(p)) return 'border'
  if (p.includes('shadow')) return 'shadow'
  if (p.startsWith('--')) {
    if (/(^|-)(bg|surface|canvas|background|soft|fill-bg)(-|$)/.test(p)) return 'surface'
    if (/(^|-)(border|line|ring|outline)(-|$)/.test(p)) return 'border'
    if (/(^|-)(text|fg|ink|muted|on-dark)(-|$)/.test(p)) return 'text'
    if (/shadow/.test(p)) return 'shadow'
  }
  return 'fill'
}

const SKIP_SELECTOR = /::backdrop|::-webkit-scrollbar/
const SKIP_ATRULE = new Set(['property', 'page', 'font-face'])
const isRootRule = rule => rule?.type === 'rule' && rule.selector.trim() === ':root'

function skipped(decl) {
  const rule = decl.parent
  if (decl.prop.startsWith('--') && isRootRule(rule)) return true
  if (rule?.type === 'rule' && SKIP_SELECTOR.test(rule.selector)) return true
  for (let p = rule; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule' && SKIP_ATRULE.has(p.name.toLowerCase())) return true
  return false
}

// Τα σημεία ενός value όπου ένα # δεν είναι χρώμα: url(…) και κείμενο σε εισαγωγικά.
function protectedRanges(value) {
  const ranges = []
  for (const m of value.matchAll(/url\([^)]*\)|"[^"]*"|'[^']*'/gi)) ranges.push([m.index, m.index + m[0].length])
  return ranges
}

export function rawColors(value) {
  const ranges = protectedRanges(value)
  return [...value.matchAll(HEX)].filter(m => !ranges.some(([a, b]) => m.index >= a && m.index < b))
}

export function countFile(css) {
  const root = postcss.parse(css)
  let colors = 0
  root.walkDecls(decl => { if (!skipped(decl)) colors += rawColors(decl.value).length })
  return { colors, important: (css.match(/!important/g) || []).length }
}

function cssFiles(dir = 'src', out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) cssFiles(full, out)
    else if (entry.name.endsWith('.css')) out.push(full.split(path.sep).join('/'))
  }
  return out.sort()
}

// var(--x, #hex) όπου η --x ορίζεται μία φορά στο :root του foundation.css (πάντα φορτωμένη):
// η εναλλακτική τιμή δεν χρησιμοποιείται ποτέ, οπότε φεύγει αντί να γίνει μεταβλητή.
const FALLBACK = /var\((--[\w-]+)\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/g
let globalTokens = null
function alwaysDefined() {
  if (globalTokens) return globalTokens
  const defs = new Map()
  for (const file of cssFiles()) postcss.parse(readSource(file)).walkDecls(/^--/, decl => {
    const atRoot = file === 'src/styles/foundation.css' && isRootRule(decl.parent) && decl.parent.parent?.type === 'root'
    const entry = defs.get(decl.prop) || { defs: 0, atRoot: true }
    entry.defs++; entry.atRoot = entry.atRoot && atRoot
    defs.set(decl.prop, entry)
  })
  globalTokens = new Set([...defs].filter(([, e]) => e.defs === 1 && e.atRoot).map(([name]) => name))
  return globalTokens
}
const dropFallbacks = text => text.replace(FALLBACK, (whole, name) => (alwaysDefined().has(name) ? `var(${name})` : whole))

function replaceIn(text, map, prop, used) {
  text = dropFallbacks(text)
  const ranges = protectedRanges(text)
  return text.replace(HEX, (hex, index) => {
    if (ranges.some(([a, b]) => index >= a && index < b)) return hex
    const key = `${colorRole(prop)}|${normalizeHex(hex)}`
    const name = map[key]
    if (!name) throw new Error(`Δεν υπάρχει μεταβλητή για ${key} στο ${REGISTRY}: τρέξε --init-registry.`)
    used.add(name)
    return `var(${name})`
  })
}

function writeTokens(tokensFile, used, registry) {
  const fresh = [...used].filter(name => registry.tokens[name])
  let css = fs.existsSync(tokensFile) ? fs.readFileSync(tokensFile, 'utf8') : ''
  const existing = new Map()
  const start = css.indexOf(START)
  const end = css.indexOf(END)
  if (start >= 0 && end > start) {
    for (const m of css.slice(start, end).matchAll(/(--[\w-]+):\s*([^;]+);/g)) existing.set(m[1], m[2].trim())
  }
  for (const name of fresh) existing.set(name, registry.tokens[name])
  if (!existing.size) return 0
  const lines = [...existing].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([name, value]) => `  ${name}:${value};`)
  const block = `${START}\n:root{\n${lines.join('\n')}\n}\n${END}`
  if (start >= 0 && end > start) css = css.slice(0, start) + block + css.slice(end + END.length)
  else css = css ? `${block}\n${css}` : `${block}\n`
  fs.writeFileSync(tokensFile, css)
  return fresh.length
}

// Το μητρώο: όνομα για κάθε ζεύγος ρόλος|χρώμα όλων των αρχείων CSS. Φτιάχνεται μία
// φορά (--init-registry) και μετά μόνο συμπληρώνεται, ώστε τα ονόματα να μένουν ίδια.
const FAMILY_ORDER = ['neutral', 'brand', 'success', 'warning', 'danger', 'accent']
function family(hex) {
  const h = hex.slice(1)
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const c = max - min; const l = (max + min) / 2
  const s = c === 0 ? 0 : c / (1 - Math.abs(2 * l - 1))
  let hue = 0
  if (c) { hue = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4; hue *= 60; if (hue < 0) hue += 360 }
  const alpha = h.length === 8 ? Math.round(parseInt(h.slice(6, 8), 16) / 2.55) : 100
  const name = c < 0.04 || s < 0.22 ? 'neutral' : hue < 15 || hue >= 330 ? 'danger' : hue < 65 ? 'warning' : hue < 170 ? 'success' : hue < 260 ? 'brand' : 'accent'
  return { name, step: Math.round(l * 1000), alpha }
}

// Ονόματα με λέξη για τα πιο συχνά χρώματα (ρόλος, όχι απόχρωση).
const ALIASES = {
  'text|#ffffff': '--text-inverse',
  'border|#edf1f4': '--border-faint',
  'text|#b42318': '--text-danger',
  'surface|#fbfcfd': '--surface-subtle',
  'text|#1d3a52': '--text-heading',
  'surface|#f7f9fb': '--surface-muted',
  'text|#64748b': '--text-subtle',
  'surface|#f8fafc': '--surface-soft',
  'text|#1d6b3a': '--text-success',
  'border|#e1e8ee': '--border-soft',
  'text|#000000': '--text-black',
  'surface|#000000': '--surface-black',
}
// Ο ρόλος μιας υπάρχουσας μεταβλητής: η τελευταία λέξη ρόλου στο όνομά της (--lo-surface-border → border).
const ROLE_WORDS = { bg: 'surface', surface: 'surface', canvas: 'surface', soft: 'surface', fg: 'text', text: 'text', muted: 'text', value: 'text', ink: 'text', border: 'border', line: 'border' }
const REUSE_ROLE = name => name.split('-').reverse().map(word => ROLE_WORDS[word]).find(Boolean) || 'any'
const REUSE_PREFERENCE = name => (name.startsWith('--lo-color-') ? 0 : /^--lo-(surface|text)-/.test(name) ? 1 : name.startsWith('--lo-status-') ? 2 : 9)

function initRegistry() {
  const previous = fs.existsSync(REGISTRY) ? JSON.parse(fs.readFileSync(REGISTRY, 'utf8')) : { tokens: {}, map: {} }
  const usage = new Map()
  const rootTokens = new Map() // όνομα → [τιμή, πόσοι ορισμοί]
  for (const file of cssFiles()) {
    const root = postcss.parse(readSource(file))
    root.walkDecls(decl => {
      if (decl.prop.startsWith('--')) {
        const entry = rootTokens.get(decl.prop) || { value: null, defs: 0, rootOnly: true }
        entry.defs++
        if (!isRootRule(decl.parent) || decl.parent.parent?.type !== 'root') entry.rootOnly = false
        const only = decl.value.trim().match(/^#[0-9a-fA-F]{3,8}$/)
        entry.value = only ? normalizeHex(only[0]) : null
        rootTokens.set(decl.prop, entry)
      }
      if (skipped(decl)) return
      for (const m of rawColors(decl.value)) {
        const key = `${colorRole(decl.prop)}|${normalizeHex(m[0])}`
        usage.set(key, (usage.get(key) || 0) + 1)
      }
    })
  }
  const reusable = [...rootTokens].filter(([name, e]) => e.defs === 1 && e.rootOnly && e.value && /^--lo-(color|surface|text|status)-/.test(name))
  const tokens = { ...previous.tokens }
  const map = { ...previous.map }
  const taken = new Set([...Object.keys(tokens), ...rootTokens.keys()])
  const keys = [...usage.keys()].filter(key => !map[key]).sort((a, b) => usage.get(b) - usage.get(a) || a.localeCompare(b))
  for (const key of keys) {
    const [role, hex] = key.split('|')
    const reuse = reusable.filter(([name, e]) => e.value === hex && (REUSE_ROLE(name) === role || REUSE_ROLE(name) === 'any')).sort(([a], [b]) => REUSE_PREFERENCE(a) - REUSE_PREFERENCE(b) || a.localeCompare(b))[0]
    if (reuse) { map[key] = reuse[0]; continue }
    const sameValue = Object.entries(tokens).find(([name, value]) => value === hex && name.startsWith(`--${role}-`))
    if (sameValue) { map[key] = sameValue[0]; continue }
    let name = ALIASES[key]
    if (!name || taken.has(name)) {
      const f = family(hex)
      const stem = `--${role}-${f.name}-${f.step}${f.alpha < 100 ? `-a${f.alpha}` : ''}`
      name = stem
      for (let n = 2; taken.has(name); n++) name = `${stem}-${n}`
    }
    taken.add(name); tokens[name] = hex; map[key] = name
  }
  const sortedTokens = Object.fromEntries(Object.entries(tokens).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })))
  const sortedMap = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))
  fs.writeFileSync(REGISTRY, `${JSON.stringify({ tokens: sortedTokens, map: sortedMap }, null, 1)}\n`)
  console.log(`${Object.keys(sortedMap).length} ζεύγη ρόλος|χρώμα, ${Object.keys(sortedTokens).length} νέες μεταβλητές, ${Object.keys(sortedMap).length - Object.keys(sortedTokens).length} σε υπάρχουσες.`)
}

const args = process.argv.slice(2)
if (args.includes('--init-registry')) { initRegistry(); process.exit(0) }

if (args.includes('--write')) {
  const at = args.indexOf('--tokens')
  const tokensFile = at >= 0 ? args[at + 1] : null
  const targets = args.filter((a, i) => !a.startsWith('--') && i !== at + 1)
  if (!tokensFile || !targets.length) { console.error('Χρήση: --write --tokens <αρχείο.css> <αρχεία.css…>'); process.exit(2) }
  const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'))
  const used = new Set()
  let replaced = 0
  for (const file of targets) {
    const css = fs.readFileSync(file, 'utf8')
    const root = postcss.parse(css)
    let changed = false
    root.walkDecls(decl => {
      if (skipped(decl) || !rawColors(decl.value).length) return
      const value = replaceIn(decl.value, registry.map, decl.prop, used)
      replaced += rawColors(decl.value).length
      if (decl.raws.value) decl.raws.value = { value, raw: replaceIn(decl.raws.value.raw, registry.map, decl.prop, used) }
      decl.value = value
      changed = true
    })
    if (changed) fs.writeFileSync(file, root.toString())
  }
  const added = writeTokens(tokensFile, used, registry)
  console.log(`${replaced} χρώματα έγιναν μεταβλητές σε ${targets.length} αρχεία· ${added} ορισμοί στο ${tokensFile}.`)
  process.exit(0)
}

const counts = Object.fromEntries(cssFiles().map(file => [file, countFile(readSource(file))]))
const colorCounts = Object.fromEntries(Object.entries(counts).filter(([, c]) => c.colors > 0).map(([file, c]) => [file, c.colors]))
const total = Object.values(colorCounts).reduce((a, b) => a + b, 0)

if (args.includes('--write-baseline')) {
  fs.writeFileSync(BASELINE, `${JSON.stringify(colorCounts, null, 2)}\n`)
  console.log(`Καταγράφηκαν τα χρώματα απευθείας ${Object.keys(colorCounts).length} αρχείων (${total} συνολικά).`)
  process.exit(0)
}

if (args.includes('--check')) {
  const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {}
  const raised = Object.entries(colorCounts).filter(([file, n]) => n > (baseline[file] ?? 0)).map(([file, n]) => `${file}: ${n} (όριο ${baseline[file] ?? 0})`)
  if (raised.length) {
    console.error(`Έλεγχος χρωμάτων CSS: χρώματα γραμμένα απευθείας πάνω από το όριο.\n- ${raised.join('\n- ')}\nΧρησιμοποίησε μεταβλητή (node tools/css-color-tokens.ts --write --tokens <αρχείο> <αρχεία>).`)
    process.exit(1)
  }
  console.log(`Έλεγχος χρωμάτων CSS: ${total} χρώματα απευθείας σε ${Object.keys(colorCounts).length} αρχεία, κανένα πάνω από το όριο.`)
  process.exit(0)
}

const rows = Object.entries(counts).filter(([, c]) => c.colors || c.important).sort((a, b) => b[1].colors + b[1].important - (a[1].colors + a[1].important))
for (const [file, c] of rows) console.log(`${String(c.colors).padStart(6)} ${String(c.important).padStart(6)}  ${file}`)
console.log(`${String(total).padStart(6)} ${String(rows.reduce((n, [, c]) => n + c.important, 0)).padStart(6)}  σύνολο (χρώματα απευθείας, !important)`)
