import fs from 'node:fs'
import path from 'node:path'

// The `!important` count of every stylesheet is a ceiling, not a target: new CSS must not add to it.
// Lower a file's number in tools/important-baseline.json when its rules are cleaned (run with --write
// to record the current counts); never raise it to make the check pass. The count of a screen's CSS
// is cleaned when that screen is reworked, with before/after screenshots of every state it has.
const root = 'src'
const baselineFile = 'tools/important-baseline.json'
const files = []
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.name.endsWith('.css')) files.push(full.split(path.sep).join('/'))
  }
}
walk(root)
const counts = Object.fromEntries(files.sort().map(file => [file, (fs.readFileSync(file, 'utf8').match(/!important/g) || []).length]).filter(([, n]) => n > 0))

if (process.argv.includes('--write')) {
  fs.writeFileSync(baselineFile, `${JSON.stringify(counts, null, 2)}\n`)
  console.log(`Recorded the !important count of ${Object.keys(counts).length} stylesheets (${Object.values(counts).reduce((a, b) => a + b, 0)} in total).`)
  process.exit(0)
}

const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
const raised = Object.entries(counts).filter(([file, n]) => n > (baseline[file] ?? 0)).map(([file, n]) => `${file}: ${n} (allowed ${baseline[file] ?? 0})`)
if (raised.length) {
  console.error(`!important count audit failed: more !important than the recorded ceiling.\n- ${raised.join('\n- ')}\nWrite the rule without !important (a more specific selector, or a rule in the right stylesheet).`)
  process.exit(1)
}
const total = Object.values(counts).reduce((a, b) => a + b, 0)
const lower = Object.entries(baseline).filter(([file, n]) => (counts[file] ?? 0) < n).length
console.log(`!important count audit passed: ${total} in ${Object.keys(counts).length} stylesheets${lower ? ` (${lower} below their ceiling: run node tools/check-important-count.mjs --write to lower it)` : ''}.`)
