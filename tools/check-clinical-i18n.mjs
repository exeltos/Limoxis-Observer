import fs from 'node:fs'
import path from 'node:path'

const files = [
  'src/features/surveillance/PatientClinicalCanonicalPage.jsx',
  'src/features/surveillance/SurveillanceCanonicalPage.jsx',
  'src/features/patients/PatientsPage.jsx',
]

// Phase-0 regression baseline. Existing i18n debt is tracked without allowing
// the CI gate to hide newly introduced hard-coded Greek in these clinical UIs.
// Lower this number whenever debt is removed; never raise it to make CI pass.
const baseline = {
  'src/features/surveillance/PatientClinicalCanonicalPage.jsx': 21,
  'src/features/surveillance/SurveillanceCanonicalPage.jsx': 1,
  'src/features/patients/PatientsPage.jsx': 0,
}

const greek = /[Α-Ωα-ωΆ-ώ]/
const problems = []
const regressions = []

for (const file of files) {
  const source = fs.readFileSync(path.resolve(file), 'utf8')
  const matches = []
  source.split('\n').forEach((line, index) => {
    if (greek.test(line)) matches.push(`${file}:${index + 1}: ${line.trim()}`)
  })
  problems.push(...matches)
  const allowed = baseline[file] ?? 0
  if (matches.length > allowed) {
    regressions.push(`${file}: ${matches.length} hard-coded Greek lines (baseline ${allowed})`)
  }
}

if (regressions.length) {
  console.error('Clinical i18n regression detected:')
  console.error(regressions.join('\n'))
  console.error('New hard-coded Greek must be moved to the translation layer.')
  process.exit(1)
}

const remaining = problems.length
console.log(`Clinical i18n regression audit passed (${files.length} UI files; ${remaining} pre-existing hard-coded Greek lines, no increase).`)
