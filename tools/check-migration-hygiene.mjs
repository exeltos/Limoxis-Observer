import fs from 'node:fs'
import path from 'node:path'

const migrationsDir = path.resolve('supabase/migrations')
const reconciliationPath = path.resolve('supabase/migration-reconciliation.json')
const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
const seen = new Map()
const errors = []
const warnings = []

const reconciliation = JSON.parse(fs.readFileSync(reconciliationPath, 'utf8'))
const historical = reconciliation.historicalEquivalents ?? []
const blocked = reconciliation.blockedAuthorizationMigrations ?? []
const reconciliationEntries = [...historical, ...blocked]

if (reconciliation.schemaVersion !== 1) {
  errors.push('migration reconciliation manifest must use schemaVersion 1')
}
if (reconciliation.policy?.productionMutationAllowed !== false) {
  errors.push('migration reconciliation manifest must not authorize production mutation')
}
if (historical.length !== 9 || blocked.length !== 9) {
  errors.push(`migration reconciliation must contain 9 historical equivalents and 9 blocked authorization migrations (found ${historical.length} and ${blocked.length})`)
}

const reconciledFiles = new Set()
for (const entry of reconciliationEntries) {
  if (!entry.file || reconciledFiles.has(entry.file)) {
    errors.push(`invalid or duplicate reconciliation entry: ${entry.file ?? '<missing file>'}`)
    continue
  }
  reconciledFiles.add(entry.file)
  if (!files.includes(entry.file)) errors.push(`${entry.file}: reconciliation entry has no matching migration file`)
}

for (const entry of historical) {
  if (!['state_equivalent', 'superseded', 'consolidation'].includes(entry.classification)) {
    errors.push(`${entry.file}: unsupported historical reconciliation classification`)
  }
  if (entry.deployment !== 'do_not_replay' || !entry.productionEvidence?.trim()) {
    errors.push(`${entry.file}: historical equivalent must be marked do_not_replay with production evidence`)
  }
}

for (const entry of blocked) {
  if (entry.deployment !== 'blocked_pending_rewrite' || !Number.isInteger(entry.rolloutOrder) || !entry.blockedReason?.trim()) {
    errors.push(`${entry.file}: blocked authorization migration requires deployment status, rollout order, and reason`)
  }
}

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
console.log(`Migration reconciliation OK: ${historical.length} historical equivalents, ${blocked.length} blocked authorization migrations.`)
