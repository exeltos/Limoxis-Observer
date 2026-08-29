import fs from 'node:fs'
import path from 'node:path'

const files = [
  'src/features/surveillance/PatientClinicalRecordPage.jsx',
  'src/features/surveillance/SurveillancePage.jsx',
  'src/features/patients/PatientsPage.jsx',
]
const greek = /[Α-Ωα-ωΆ-ώ]/
const problems = []
for (const file of files) {
  const text = fs.readFileSync(path.resolve(file), 'utf8')
  text.split('\n').forEach((line, index) => {
    if (greek.test(line)) problems.push(`${file}:${index + 1}: ${line.trim()}`)
  })
}
if (problems.length) {
  console.error('Hard-coded Greek detected in clinical UI:')
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`Clinical i18n audit passed (${files.length} UI files, 0 hard-coded Greek strings).`)
