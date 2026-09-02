import fs from 'node:fs'
import path from 'node:path'

const migrationsDir = path.resolve('supabase/migrations')
const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
const seen = new Map()
const errors = []
const warnings = []

for (const file of files) {
  const match = /^(\d+)_/.exec(file)
  if (!match) {
    errors.push(`${file}: migration filename must start with a numeric timestamp prefix`)
    continue
  }

  const version = match[1]
  if (![12, 14].includes(version.length)) {
    errors.push(`${file}: timestamp prefix must be 14 digits (legacy 12-digit files are grandfathered)`)
  }

  if (seen.has(version)) {
    errors.push(`duplicate migration timestamp ${version}: ${seen.get(version)} and ${file}`)
  } else {
    seen.set(version, file)
  }

  // Historical migrations contain 12-digit prefixes. Do not rewrite deployed history,
  // but require all new work from 2026-09-03 onward to use YYYYMMDDHHMMSS.
  if (version.startsWith('20260903') || version > '20260903') {
    if (version.length !== 14) {
      errors.push(`${file}: migrations created on/after 2026-09-03 must use YYYYMMDDHHMMSS`)
    }
  } else if (version.length === 12) {
    warnings.push(`${file}: legacy 12-digit timestamp retained for historical compatibility`)
  }
}

if (warnings.length) {
  console.warn(`Migration hygiene: ${warnings.length} legacy timestamp(s) grandfathered.`)
}

if (errors.length) {
  console.error('Migration hygiene check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Migration hygiene OK: ${files.length} migration files, ${seen.size} unique timestamp prefixes.`)
