/* global console, process */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('src')
const allowlistPath = path.resolve('tools/frontend-parity-allowlist.json')
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'))
const allowed = new Map(allowlist.map(entry => [entry.file, entry]))
const violations = []
const candidates = []

function walk(directory) {
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name)
    const stat = fs.statSync(file)
    if (stat.isDirectory()) walk(file)
    else if (name.endsWith('.jsx')) candidates.push(file)
  }
}

for (const entry of allowlist) {
  if (!entry.file || !entry.owner || !entry.reason || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn || '')) {
    violations.push(`invalid allow-list entry: ${JSON.stringify(entry)}`)
  } else if (!fs.existsSync(path.join(root, entry.file))) {
    violations.push(`${entry.file}: stale allow-list entry; file does not exist`)
  } else if (entry.expiresOn < new Date().toISOString().slice(0, 10)) {
    violations.push(`${entry.file}: legacy split allow-list entry expired on ${entry.expiresOn}`)
  }
}

walk(path.join(root, 'features'))
for (const file of candidates) {
  const source = fs.readFileSync(file, 'utf8')
  const relative = path.relative(root, file).split(path.sep).join('/')
  const hasEnvironmentPageImports = /import\s+.*(?:DemoPage|CloudPage|ProductionPage|DemoRecordPage|CloudRecordPage)/.test(source)
  const branchesAtPageBoundary = /return\s+(?:isDemo\s*\?|isDemo\s*\)|<Suspense)|if\s*\(\s*!?isDemo\s*\)\s*return\s*</s.test(source)
  if (hasEnvironmentPageImports && branchesAtPageBoundary && !allowed.has(relative)) {
    violations.push(`${relative}: page-level Demo/Production branch detected; select a repository instead of JSX`)
  }
}

if (violations.length) {
  console.error(`Frontend parity audit failed:\n- ${violations.join('\n- ')}`)
  process.exit(1)
}
console.log(`Frontend parity audit: OK (${allowed.size} temporary legacy splits)`)
