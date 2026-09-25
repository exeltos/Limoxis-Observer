// Compares the role lists hard-coded in the SQL capability helpers with the
// canonical UI role matrix (src/core/permissions/systemRoleMatrix.js).
//
// A role the UI grants but SQL denies is a functional bug (empty screens and
// RLS-rejected saves — the Link Nurse regression fixed on 2026-09-25). A role
// SQL grants but the UI denies is a silent privilege widening. Both fail CI
// unless listed in KNOWN_DIFFERENCES with a reason.
import fs from 'node:fs'
import path from 'node:path'
import { ROLES, can } from '../src/core/permissions/roles.js'

const MIGRATIONS = 'supabase/migrations'
const HELPERS = ['current_user_has_capability', 'current_user_has_governance_capability']

// Roles whose SQL access is granted by something other than the role list
// (assignment, department scope + dedicated helper, explicit role checks).
const KNOWN_DIFFERENCES = {
  // Committee Secretariat is authorised per committee via work_assignments in
  // current_user_can_manage_committee, not through the role list.
  committee_secretariat: 'assignment-based (current_user_can_manage_committee)',
}
const KNOWN_CAPABILITY_DIFFERENCES = {
  // IPC roles reach prevention records through explicit role checks inside
  // current_user_can_{read,write}_* rather than through these capabilities.
  'record_hand_hygiene:infection_control_lead': 'role check in prevention helpers',
  'record_hand_hygiene:infection_control_member': 'role check in prevention helpers',
  'record_waste:infection_control_lead': 'role check in prevention helpers',
  'record_waste:infection_control_member': 'role check in prevention helpers',
  'record_antiseptic:infection_control_lead': 'role check in prevention helpers',
  'record_antiseptic:infection_control_member': 'role check in prevention helpers',
  'record_prevention_bundle:infection_control_lead': 'role check in prevention helpers',
  'record_prevention_bundle:infection_control_member': 'role check in prevention helpers',
  // Umbrella key referenced by no policy or screen; IPC Lead already holds every
  // granular committee capability in both the UI and SQL.
  'manage_committees:infection_control_lead': 'unused umbrella capability',
}

function latestDefinition(fn) {
  const files = fs.readdirSync(MIGRATIONS).filter(name => name.endsWith('.sql')).sort()
  let found = null
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8')
    const match = sql.match(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?\\$function\\$[\\s\\S]*?\\$function\\$`, 'i'))
    if (match) found = { file, body: match[0] }
  }
  return found
}

function roleCases(body) {
  const cases = {}
  for (const match of body.matchAll(/when '([a-z_]+)' then (om\.role in \(([^)]*)\)|true)/g)) {
    cases[match[1]] = match[2] === 'true' ? 'all' : [...match[3].matchAll(/'([a-z_]+)'/g)].map(item => item[1])
  }
  return cases
}

const roles = Object.values(ROLES).filter(role => !['platform_owner', 'demo'].includes(role))
const problems = []
let checked = 0

const capabilityHelper = latestDefinition('current_user_has_capability')
const adminExcluded = [...(capabilityHelper?.body.match(/capability_key not in \(([^)]*)\)/)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map(item => item[1])

const merged = {}
for (const helper of HELPERS) {
  const definition = latestDefinition(helper)
  if (!definition) { problems.push(`${helper}: definition not found in ${MIGRATIONS}`); continue }
  for (const [capability, list] of Object.entries(roleCases(definition.body))) {
    merged[capability] = list === 'all' || merged[capability] === 'all' ? 'all' : [...new Set([...(merged[capability] || []), ...list])]
  }
}

for (const [capability, list] of Object.entries(merged)) {
  if (list === 'all') continue
  for (const role of roles) {
    const ui = can(role, capability)
    const db = role === 'hospital_admin' ? !adminExcluded.includes(capability) : list.includes(role)
    if (ui === db || KNOWN_DIFFERENCES[role] || KNOWN_CAPABILITY_DIFFERENCES[`${capability}:${role}`]) continue
    problems.push(`${capability}: ${role} is ${ui ? 'granted by the UI but denied by SQL' : 'granted by SQL but denied by the UI'}`)
  }
  checked++
}

if (problems.length) {
  console.error('DB/UI role alignment regression:')
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`DB/UI role alignment passed: ${checked} role-listed capabilities × ${roles.length} roles.`)
