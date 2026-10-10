import fs from 'node:fs'
import path from 'node:path'

// The patient clinical record page is split across the first seven files.
const files = [
  'src/features/surveillance/PatientClinicalCanonicalPage.jsx',
  'src/features/surveillance/ClinicalAdmissions.jsx',
  'src/features/surveillance/ClinicalSurveillanceWorkspace.jsx',
  'src/features/surveillance/ClinicalJourney.jsx',
  'src/features/surveillance/clinicalRecordLabels.js',
  'src/features/surveillance/ClinicalRecordViews.jsx',
  'src/features/surveillance/ClinicalRecordDialogs.jsx',
  'src/features/surveillance/SurveillanceCanonicalPage.jsx',
  'src/features/patients/PatientsPage.jsx',
]

// Phase-0 regression baseline. Existing i18n debt is tracked without allowing
// the CI gate to hide newly introduced hard-coded Greek in these clinical UIs.
// The unit is Greek letters, not lines, so reformatting a file (which splits
// lines but never changes text) cannot move the count; any new hard-coded
// Greek word raises it.
// Lower this number whenever debt is removed; never raise it to make CI pass.
const baseline = {
  'src/features/surveillance/PatientClinicalCanonicalPage.jsx': 0,
  'src/features/surveillance/ClinicalAdmissions.jsx': 0,
  'src/features/surveillance/ClinicalSurveillanceWorkspace.jsx': 83,
  'src/features/surveillance/ClinicalJourney.jsx': 0,
  'src/features/surveillance/clinicalRecordLabels.js': 1165,
  'src/features/surveillance/ClinicalRecordViews.jsx': 0,
  'src/features/surveillance/ClinicalRecordDialogs.jsx': 533,
  'src/features/surveillance/SurveillanceCanonicalPage.jsx': 22,
  'src/features/patients/PatientsPage.jsx': 0,
}

const greek = /[Α-Ωα-ωΆ-ώ]/
const greekLetters = /[Α-Ωα-ωΆ-ώ]/g
const problems = []
const regressions = []
let letters = 0

for (const file of files) {
  const source = fs.readFileSync(path.resolve(file), 'utf8')
  const count = (source.match(greekLetters) || []).length
  const matches = []
  source.split('\n').forEach((line, index) => {
    if (greek.test(line)) matches.push(`${file}:${index + 1}: ${line.trim()}`)
  })
  problems.push(...matches)
  letters += count
  const allowed = baseline[file] ?? 0
  if (count > allowed) {
    regressions.push(`${file}: ${count} hard-coded Greek letters (baseline ${allowed})\n  ${matches.join('\n  ')}`)
  }
}

if (regressions.length) {
  console.error('Clinical i18n regression detected:')
  console.error(regressions.join('\n'))
  console.error('New hard-coded Greek must be moved to the translation layer.')
  process.exit(1)
}

console.log(`Clinical i18n regression audit passed (${files.length} UI files; ${problems.length} pre-existing hard-coded Greek lines, ${letters} letters, no increase).`)
