import type { Employee, EmployeeHistoryEntry } from './employeeTypes'

// The rest of the sample staff of the help preview, so that it has the size of the real Demo (106 employees, 292
// vaccinations, 255 certificates, 202 evaluations: tests/fixtures/demoSnapshot.json). Generated from fixed lists, the
// same every time. Dates are fixed and follow today with the others (shiftDemoDatesInPlace).
export const DEMO_STAFF_TOTALS = { employees: 106, vaccinations: 292, certificates: 255, evaluations: 202 }

const FIRST: [string, string, boolean][] = [['Μαρία', 'Maria', false], ['Ιωάννης', 'Ioannis', true], ['Ελένη', 'Eleni', false], ['Γεώργιος', 'Georgios', true], ['Αικατερίνη', 'Aikaterini', false], ['Δημήτριος', 'Dimitrios', true], ['Σοφία', 'Sofia', false], ['Κωνσταντίνος', 'Konstantinos', true], ['Άννα', 'Anna', false], ['Νικόλαος', 'Nikolaos', true], ['Χριστίνα', 'Christina', false], ['Παναγιώτης', 'Panagiotis', true], ['Ευαγγελία', 'Evangelia', false], ['Αθανάσιος', 'Athanasios', true], ['Δήμητρα', 'Dimitra', false], ['Βασίλειος', 'Vasileios', true]]
const LAST: [string, string][] = [['Αναστασίου', 'Anastasiou'], ['Βλάχου', 'Vlachou'], ['Γεωργίου', 'Georgiou'], ['Δρόσου', 'Drosou'], ['Ζαφειρίου', 'Zafeiriou'], ['Θεοδώρου', 'Theodorou'], ['Καλογήρου', 'Kalogirou'], ['Λαμπράκη', 'Lampraki'], ['Μαυρίδου', 'Mavridou'], ['Νικολάου', 'Nikolaou'], ['Οικονόμου', 'Oikonomou'], ['Πετρόπουλου', 'Petropoulou'], ['Ραφαήλ', 'Rafail'], ['Σταμάτη', 'Stamati'], ['Τσιμάρα', 'Tsimara'], ['Φωτίου', 'Fotiou'], ['Χατζή', 'Chatzi'], ['Ψαρρά', 'Psarra']]
// [department, its English name, profession, its English name, positions (nurse / doctor / other)]
const POSTS: [string, string, string, string, string, string][] = [
  ['ΜΕΘ', 'ICU', 'Νοσηλευτικό προσωπικό', 'Nursing staff', 'Νοσηλευτής/τρια ΜΕΘ', 'ICU Nurse'],
  ['Παθολογική', 'Internal Medicine', 'Νοσηλευτικό προσωπικό', 'Nursing staff', 'Νοσηλευτής/τρια', 'Nurse'],
  ['Χειρουργική', 'Surgery', 'Νοσηλευτικό προσωπικό', 'Nursing staff', 'Νοσηλευτής/τρια', 'Nurse'],
  ['ΤΕΠ', 'Emergency Department', 'Νοσηλευτικό προσωπικό', 'Nursing staff', 'Νοσηλευτής/τρια ΤΕΠ', 'ED Nurse'],
  ['Καρδιολογική', 'Cardiology', 'Νοσηλευτικό προσωπικό', 'Nursing staff', 'Νοσηλευτής/τρια', 'Nurse'],
  ['Νεογνολογική / ΜΕΝΝ', 'Neonatology / NICU', 'Νοσηλευτικό προσωπικό', 'Nursing staff', 'Νοσηλευτής/τρια ΜΕΝΝ', 'NICU Nurse'],
  ['Ορθοπαιδική', 'Orthopaedics', 'Νοσηλευτικό προσωπικό', 'Nursing staff', 'Νοσηλευτής/τρια', 'Nurse'],
  ['Μαιευτική', 'Obstetrics', 'Νοσηλευτικό προσωπικό', 'Nursing staff', 'Μαία', 'Midwife'],
  ['Ενδοσκοπικό', 'Endoscopy', 'Νοσηλευτικό προσωπικό', 'Nursing staff', 'Νοσηλευτής/τρια', 'Nurse'],
  ['Παθολογική', 'Internal Medicine', 'Ιατρικό προσωπικό', 'Medical staff', 'Επιμελητής Ιατρός', 'Consultant Physician'],
  ['ΜΕΘ', 'ICU', 'Ιατρικό προσωπικό', 'Medical staff', 'Επιμελητής Ιατρός', 'Consultant Physician'],
  ['Χειρουργική', 'Surgery', 'Ιατρικό προσωπικό', 'Medical staff', 'Ειδικευόμενος Ιατρός', 'Resident Physician'],
  ['Εργαστήριο', 'Laboratory', 'Εργαστηριακό προσωπικό', 'Laboratory staff', 'Τεχνολόγος Εργαστηρίου', 'Laboratory Technologist'],
  ['Αποστείρωση', 'Sterilisation', 'Νοσηλευτικό προσωπικό', 'Nursing staff', 'Νοσηλευτής/τρια Αποστείρωσης', 'Sterilisation Nurse'],
  ['Ποιότητα', 'Quality', 'Διοικητικό προσωπικό', 'Administrative staff', 'Υπάλληλος Ποιότητας', 'Quality Officer'],
]
const VACCINES: [string, string][] = [['Ηπατίτιδα Β', '3η δόση'], ['Γρίπη εποχική', '2025/26'], ['Ιλαρά-παρωτίτιδα-ερυθρά (MMR)', '2η δόση'], ['COVID-19', 'ενισχυτική'], ['Τέτανος-διφθερίτιδα (Td)', 'ενισχυτική'], ['Ανεμευλογιά', '2η δόση']]
const CERTIFICATES: [string, string, string, number][] = [['BLS', 'BLS', 'ERC', 24], ['ALS', 'ALS', 'ERC', 24], ['Πυροπροστασία', 'Fire safety', 'Demo Hospital', 12], ['Ασφαλής χειρισμός βελονών', 'Safe sharps handling', 'Demo Hospital', 24], ['Υγιεινή χεριών', 'Hand hygiene', 'Demo Hospital', 12]]
const EVALUATORS = ['Αικατερίνη Λάμπρου', 'Ιωάννα Σπυροπούλου', 'Δρ. Παναγιώτης Ρήγας', 'Δρ. Μαρίνα Κουτσού']

const pad = (n: number, size = 3) => String(n).padStart(size, '0')
const day = (year: number, month: number, d: number) => `${year}-${pad(month, 2)}-${pad(d, 2)}`
const addMonths = (date: string, months: number) => { const [y, m, d] = date.split('-').map(Number); const total = y * 12 + (m - 1) + months; return day(Math.floor(total / 12), (total % 12) + 1, d) }

export type BulkEvaluation = (id: string, employeeId: string, period: string, date: string, evaluator: string, scores: number[], status: string, notes: string) => unknown

export function bulkEmployeeDemo(existing: Employee[], evaluation: BulkEvaluation) {
  const employees: Employee[] = []
  for (let i = existing.length; i < DEMO_STAFF_TOTALS.employees; i += 1) {
    const [first, firstEn] = FIRST[(i * 7) % FIRST.length]
    const [last, lastEn] = LAST[(i * 5 + Math.floor(i / FIRST.length)) % LAST.length]
    const [department, departmentEn, profession, professionEn, position, positionEn] = POSTS[i % POSTS.length]
    const code = `EMP-${pad(i + 1)}`
    employees.push({
      id: code, position, positionEn, firstName: first, firstNameEn: firstEn, lastName: last, lastNameEn: lastEn,
      fatherName: FIRST[(i * 3) % FIRST.length][0], fatherNameEn: FIRST[(i * 3) % FIRST.length][1],
      department, departmentEn, profession, professionEn, employmentStatus: 'active',
      email: `${firstEn[0].toLowerCase()}.${lastEn.toLowerCase()}${i}@example.org`, phone: `210 555 ${pad(100 + i, 4)}`,
      hireDate: day(2012 + (i % 13), 1 + (i % 12), 1 + (i % 27)),
    })
  }
  const all = [...existing, ...employees]
  const vaccinations = []
  for (let n = 0; vaccinations.length < DEMO_STAFF_TOTALS.vaccinations - 84; n += 1) {
    const employee = all[n % all.length]
    const [vaccine, dose] = VACCINES[(n + Math.floor(n / all.length)) % VACCINES.length]
    const date = day(2025, 1 + (n % 12), 1 + ((n * 3) % 27))
    const flu = vaccine.startsWith('Γρίπη')
    vaccinations.push({ id: `VAC-G${pad(n + 1)}`, employeeId: employee.id, vaccine, dose, date, validUntil: flu ? addMonths(date, 12) : null, status: flu ? 'renewSoon' : 'complete' })
  }
  const certificates = []
  for (let n = 0; certificates.length < DEMO_STAFF_TOTALS.certificates - 22; n += 1) {
    const employee = all[n % all.length]
    const [titleEl, titleEn, issuer, months] = CERTIFICATES[(n + Math.floor(n / all.length)) % CERTIFICATES.length]
    const issueDate = day(2025, 1 + (n % 12), 1 + ((n * 5) % 27))
    certificates.push({ id: `CERT-G${pad(n + 1)}`, employeeId: employee.id, titleEl, titleEn, issuer, issueDate, validUntil: addMonths(issueDate, months), certificateNumber: `${titleEn.slice(0, 4).toUpperCase().replace(/\W/g, '')}-2025-G${pad(n + 1)}`, attachments: [] })
  }
  const evaluations = []
  for (let n = 0; evaluations.length < DEMO_STAFF_TOTALS.evaluations - 65; n += 1) {
    const employee = all[n % all.length]
    const period = n < all.length ? '2025' : '2024'
    const scores = Array.from({ length: 8 }, (_, k) => 3 + ((n + k * 2) % 3))
    evaluations.push(evaluation(`EV-G${pad(n + 1)}`, employee.id, period, day(period === '2025' ? 2026 : 2025, 1 + (n % 6), 1 + ((n * 7) % 27)), EVALUATORS[n % EVALUATORS.length], scores, 'finalized', 'Συνεπής απόδοση και τήρηση των πρωτοκόλλων του τμήματος.'))
  }
  // Every new employee has a visit, an exposure report and a history, like the first ones (tests/demoPeopleData.test.ts).
  const visits: Record<string, unknown>[] = []
  const exposures: Record<string, unknown>[] = []
  const history: EmployeeHistoryEntry[] = []
  employees.forEach((employee, k) => {
    const date = day(2026, 1 + (k % 8), 1 + ((k * 3) % 27))
    visits.push({ id: `OHV-G${pad(k + 1)}`, employeeId: employee.id, date, type: 'periodic', status: 'completed', followUpDate: addMonths(date, 12), fitStatus: 'fit', clinicalNotes: 'Περιοδική εξέταση χωρίς ευρήματα.' })
    exposures.push({ id: `EXP-G${pad(k + 1)}`, employeeId: employee.id, incidentDate: day(2026, 1 + (k % 9), 2 + ((k * 5) % 26)), exposureType: 'needlestick', deviceOrSource: 'Βελόνα ενδοφλέβιας γραμμής', bodySite: 'Αριστερός δείκτης', sourcePatientStatus: 'negative', reportedAt: `${day(2026, 1 + (k % 9), 2 + ((k * 5) % 26))}T10:00:00`, pepAdministered: false, pepDetails: '', followUpStatus: 'completed', followUpDueAt: day(2026, 1 + (k % 9), 2 + ((k * 5) % 26)), notes: 'Πηγή ασθενής αρνητική σε ορολογικό έλεγχο.' })
    history.push({ id: `EH-G${pad(k + 1)}`, employeeId: employee.id, at: `${employee.hireDate}T09:00:00Z`, action: 'insert', changedFields: [] as string[], actorName: 'Διαχειριστής Demo', actorRole: '' })
  })
  return { employees, vaccinations, certificates, evaluations, visits, exposures, history }
}
