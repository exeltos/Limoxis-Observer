// The demo applications: one at every step of the pipeline, with languages, previous
// employers, a scheduled interview and evaluated ones, dates set from today. Names are made up.
import { CONSENTS, CONSENT_VERSION, DEMO_SIGNATURE } from './applicationModel'
import type { AnyRecord } from '../../types/featureTypes'
const day = (offset: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const at = (offset: number, time: string) => new Date(`${day(offset)}T${time}:00`).toISOString()
const HR = 'Ελένη Γεωργίου', HEAD_NURSE = 'Μαρία Παπαδοπούλου', DIRECTOR = 'Νίκος Αλεξίου'
const panel = (...names: [string, string?][]) => names.map(([name, role = 'evaluator']) => ({ employeeId: '', name, role }))

const candidate = (id: string, code: string, offset: number, fields: AnyRecord): AnyRecord => ({
  id, code, gender: '', fatherName: '', motherName: '', birthDate: '', birthPlace: '', nationality: 'Ελληνική', citizenship: 'Ελληνική', idNumber: '', idAuthority: '', idIssuedOn: '',
  address: '', area: '', postcode: '', phoneLandline: '', phoneMobile: '', email: '', requestedPosition: '', employmentType: 'full_time', militaryService: '', workPermit: null, practiceLicence: null, smoker: false,
  maritalStatus: '', children: '', educationLevel: '', education: [], itSkills: '', activities: '', whyUs: '', applicationReason: '', appliedOn: day(offset), consentGiven: true, consentAt: at(offset, '10:00'), consentText: 'Έντυπο συναίνεσης GDPR',
  status: 'new', decision: '', decisionOn: '', decisionByName: '', decisionNotes: '', employeeId: '', source: 'demo', notes: '', languages: [], employers: [], interviews: [],
  createdAt: at(offset, '10:00'), updatedAt: at(offset, '10:00'), ...fields,
})
const interview = (id: string, fields: AnyRecord): AnyRecord => ({ id, scheduledAt: '', location: 'Γραφείο Προσωπικού', status: 'scheduled', interviewers: [], scores: {}, overallRating: null, outcome: '', recommendation: '', strengths: '', weaknesses: '', salaryExpectation: '', offeredSalary: '', benefits: '', availableFrom: '', evaluatedAt: '', evaluatedByName: '', notes: '', source: 'demo', ...fields })

export function interviewsDemoState() {
  const state = demoCandidatesAndDivisions()
  state.candidates.push(...historyCandidates())
  const category = (text: string) => (/Νοσηλ|Μαία/.test(text) ? 'nursing' : /Μάγειρ|Κουζίν|Τραυματιοφ/.test(text) ? 'support' : '')
  return { ...state, candidates: state.candidates.map(item => ({ ...item, professionalCategory: item.professionalCategory || category(item.requestedPosition || '') })) }
}

function demoCandidatesAndDivisions() {
  return {
    divisions: [
      { id: 'demo-div-1', name: 'Νοσηλευτική Υπηρεσία', categories: ['nursing', 'medical', 'paramedical'], members: [] },
      { id: 'demo-div-2', name: 'Διεύθυνση Λειτουργιών', categories: ['technical', 'support', 'administrative'], members: [] },
    ],
    opinions: {},
    candidates: [
      candidate('demo-cand-1', 'ΥΠ-0001', -2, { fullName: 'Κωνσταντίνου Δήμητρα', gender: 'female', birthDate: '1996-04-12', area: 'Λάρισα', phoneMobile: '6900000101', email: 'd.konstantinou@example.org', requestedPosition: 'ΤΕ Νοσηλευτική', maritalStatus: 'single', educationLevel: 'Λύκειο', education: [{ level: 'ΤΕΙ', school: 'Νοσηλευτική ΤΕΙ Λάρισας', year: '2019', completed: true }], practiceLicence: true, itSkills: 'Office, ηλεκτρονικός φάκελος ασθενούς', whyUs: 'Κοντά στο σπίτι και καλή φήμη της κλινικής.',
        languages: [{ id: 'demo-lang-1', language: 'en', reading: 'good', writing: 'good', speaking: 'fair', certificate: true, certificateName: 'B2' }],
        source: 'tablet', consentText: 'Υπογράφηκε στο tablet, έκδοση ' + CONSENT_VERSION, consentFuture: true, consentReferences: false, declarationTruth: true, consentVersion: CONSENT_VERSION, signedAt: at(-2, '10:00'), signature: DEMO_SIGNATURE,
        consentTexts: { language: 'el', ...Object.fromEntries(CONSENTS.map(consent => [consent.key, consent.text.el])) } }),
      candidate('demo-cand-2', 'ΥΠ-0002', -6, { fullName: 'Ιωάννου Πέτρος', gender: 'male', birthDate: '1990-09-03', area: 'Τρίκαλα', phoneMobile: '6900000102', email: 'p.ioannou@example.org', requestedPosition: 'Τραυματιοφορέας', militaryService: 'done', maritalStatus: 'married', children: 2, status: 'screening', educationLevel: 'Λύκειο',
        employers: [{ id: 'demo-emp-1', employer: 'Ιδιωτική κλινική (παράδειγμα)', fromOn: '2016-02-01', toOn: '2024-12-31', jobTitle: 'Τραυματιοφορέας', salary: 900, leavingReason: 'Μετακόμιση' }] }),
      candidate('demo-cand-3', 'ΥΠ-0003', -9, { fullName: 'Μιχαηλίδου Άννα', gender: 'female', birthDate: '1993-01-25', area: 'Λάρισα', phoneMobile: '6900000103', email: 'a.michailidou@example.org', requestedPosition: 'ΤΕ Νοσηλευτική', status: 'interview_scheduled', educationLevel: 'Λύκειο', practiceLicence: true,
        education: [{ level: 'ΑΕΙ', school: 'Νοσηλευτική Πανεπιστημίου Θεσσαλίας', year: '2016', completed: true }, { level: 'Μεταπτυχιακό', school: 'ΜΕΘ — Πανεπιστήμιο Θεσσαλίας', year: '2021', completed: true }],
        languages: [{ id: 'demo-lang-2', language: 'en', reading: 'fluent', writing: 'fluent', speaking: 'good', certificate: true, certificateName: 'C1' }, { id: 'demo-lang-3', language: 'de', reading: 'basic', writing: 'basic', speaking: 'basic', certificate: false, certificateName: '' }],
        employers: [{ id: 'demo-emp-2', employer: 'Γενικό Νοσοκομείο (παράδειγμα)', fromOn: '2017-03-01', toOn: '2025-06-30', jobTitle: 'Νοσηλευτής/τρια ΜΕΘ', salary: 1150, leavingReason: 'Λήξη σύμβασης' }],
        interviews: [interview('demo-int-1', { scheduledAt: at(2, '11:00'), interviewers: panel([HEAD_NURSE], [HR, 'hr']) })] }),
      candidate('demo-cand-4', 'ΥΠ-0004', -14, { fullName: 'Σταματίου Γεώργιος', gender: 'male', birthDate: '1988-06-17', area: 'Λάρισα', phoneMobile: '6900000104', email: 'g.stamatiou@example.org', requestedPosition: 'Μάγειρας', militaryService: 'done', status: 'interviewed', educationLevel: 'ΙΕΚ Μαγειρικής',
        employers: [{ id: 'demo-emp-3', employer: 'Ξενοδοχείο (παράδειγμα)', fromOn: '2012-05-01', toOn: '2025-09-30', jobTitle: 'Μάγειρας Β΄', salary: 1050, leavingReason: 'Εποχική εργασία' }],
        interviews: [interview('demo-int-2', { scheduledAt: at(-5, '10:00'), status: 'completed', interviewers: panel(['Γιώργος Νικολάου'], [HR, 'hr']), scores: { presentation: 4, knowledge: 4, experience: 5, motivation: 3, teamwork: 4, availability: 3 }, overallRating: 3.8, outcome: 'reserve', recommendation: 'Πολύ καλός επαγγελματίας· διαθέσιμος μόνο πρωινές βάρδιες.', salaryExpectation: 1200, evaluatedAt: at(-5, '11:00'), evaluatedByName: HR })] }),
      candidate('demo-cand-5', 'ΥΠ-0005', -21, { fullName: 'Αθανασίου Ελένη', gender: 'female', birthDate: '1995-11-08', area: 'Λάρισα', phoneMobile: '6900000105', email: 'e.athanasiou@example.org', requestedPosition: 'ΤΕ Νοσηλευτική', status: 'offer', decision: 'hire', decisionOn: day(-3), decisionByName: DIRECTOR, decisionNotes: 'Έναρξη την 1η του επόμενου μήνα.', practiceLicence: true,
        education: [{ level: 'ΑΕΙ', school: 'Νοσηλευτική ΕΚΠΑ', year: '2018', completed: true }],
        languages: [{ id: 'demo-lang-4', language: 'en', reading: 'fluent', writing: 'good', speaking: 'fluent', certificate: true, certificateName: 'Proficiency' }],
        interviews: [interview('demo-int-3', { scheduledAt: at(-10, '12:00'), status: 'completed', interviewers: panel([HEAD_NURSE], [DIRECTOR], [HR, 'hr']), scores: { presentation: 5, knowledge: 4, experience: 4, motivation: 5, teamwork: 5, availability: 4 }, overallRating: 4.5, outcome: 'recommend', recommendation: 'Πρόταση συνεργασίας για τη Χειρουργική Κλινική.', strengths: 'Επικοινωνία, εμπειρία σε ΜΕΘ.', salaryExpectation: 1250, offeredSalary: 1200, benefits: 'Κουπόνια σίτισης', availableFrom: day(12), evaluatedAt: at(-10, '13:00'), evaluatedByName: HR })] }),
      candidate('demo-cand-6', 'ΥΠ-0006', -40, { fullName: 'Παππά Χριστίνα', gender: 'female', birthDate: '1999-02-14', area: 'Λάρισα', phoneMobile: '6900000106', email: 'c.pappa@example.org', requestedPosition: 'Διοικητική υπάλληλος', status: 'rejected', decision: 'reject', decisionOn: day(-30), decisionByName: HR, decisionNotes: 'Δεν καλύπτει την απαιτούμενη εμπειρία στη λογιστική.',
        interviews: [interview('demo-int-4', { scheduledAt: at(-33, '09:30'), status: 'completed', interviewers: panel([HR, 'hr']), scores: { presentation: 3, knowledge: 2, experience: 2, motivation: 3, teamwork: 3, availability: 4 }, overallRating: 2.8, outcome: 'not_recommend', evaluatedAt: at(-33, '10:30'), evaluatedByName: HR })] }),
      candidate('demo-cand-7', 'ΥΠ-0007', -25, { fullName: 'Δημητρίου Σοφία', gender: 'female', area: 'Βόλος', phoneMobile: '6900000107', requestedPosition: 'Μαία', status: 'withdrawn', decisionNotes: 'Αποδέχθηκε θέση σε άλλο νοσοκομείο.' }),
    ],
  }
}

// The applications of 2025 and 2026 before the current ones (owner, 9/11/2026: the Demo shows
// the whole of 2025): spread evenly from January 2025 to six weeks ago, each with its
// interview, evaluation and decision. The same every time; only their dates follow today.
const HISTORY: [string, string, string, string, number[], string][] = [
  ['Ρήγα Αικατερίνη', 'female', 'ΤΕ Νοσηλευτική', 'hired', [5, 4, 4, 5, 5, 4], 'Ανέλαβε στη ΜΕΘ.'],
  ['Καλογεράκης Μανώλης', 'male', 'Τραυματιοφορέας', 'hired', [4, 3, 4, 4, 4, 5], 'Ανέλαβε στο ΤΕΠ.'],
  ['Ζαφειρίου Ναταλία', 'female', 'Διοικητική υπάλληλος', 'rejected', [3, 3, 2, 3, 3, 3], 'Δεν διαθέτει εμπειρία σε μισθοδοσία.'],
  ['Μπούρας Αλέξανδρος', 'male', 'Μάγειρας', 'hired', [4, 4, 5, 4, 4, 4], 'Ανέλαβε στην κουζίνα.'],
  ['Σταυροπούλου Ευγενία', 'female', 'ΔΕ Βοηθός Νοσηλευτή', 'hired', [4, 4, 3, 5, 4, 4], 'Ανέλαβε στην Παθολογική.'],
  ['Χριστοδούλου Θανάσης', 'male', 'Τεχνολόγος Εργαστηρίων', 'withdrawn', [4, 5, 4, 3, 4, 2], 'Αποδέχθηκε θέση σε ιδιωτικό εργαστήριο.'],
  ['Λαμπροπούλου Βασιλεία', 'female', 'Μαία', 'hired', [5, 5, 4, 5, 4, 4], 'Ανέλαβε στη Νεογνολογική.'],
  ['Αντωνίου Στέλιος', 'male', 'ΤΕ Νοσηλευτική', 'rejected', [2, 3, 2, 3, 3, 3], 'Δεν έχει ακόμη άδεια άσκησης επαγγέλματος.'],
  ['Παπαδάκη Ελισάβετ', 'female', 'ΤΕ Νοσηλευτική', 'hired', [4, 5, 4, 4, 5, 4], 'Ανέλαβε στη Χειρουργική.'],
  ['Γεωργαντάς Φώτης', 'male', 'Τραυματιοφορέας', 'interviewed', [4, 3, 3, 4, 4, 4], 'Σε λίστα αναμονής για την επόμενη θέση.'],
  ['Νικολοπούλου Ιφιγένεια', 'female', 'Διοικητική υπάλληλος', 'hired', [5, 4, 4, 4, 5, 5], 'Ανέλαβε στο Γραφείο Προσωπικού.'],
  ['Κυριακίδης Παύλος', 'male', 'Μάγειρας', 'rejected', [3, 2, 3, 2, 3, 4], 'Δεν διαθέτει πιστοποίηση HACCP.'],
  ['Ξενοφώντος Μυρτώ', 'female', 'ΔΕ Βοηθός Νοσηλευτή', 'withdrawn', [4, 4, 3, 4, 4, 3], 'Μετακόμισε σε άλλη πόλη.'],
  ['Θεοχάρης Ορέστης', 'male', 'Τεχνολόγος Εργαστηρίων', 'hired', [4, 5, 5, 4, 4, 4], 'Ανέλαβε στο Μικροβιολογικό.'],
  ['Βλάχου Κατερίνα', 'female', 'ΤΕ Νοσηλευτική', 'interviewed', [4, 4, 3, 4, 4, 4], 'Σε λίστα αναμονής για την Καρδιολογική.'],
  ['Μελετίου Σπύρος', 'male', 'Διοικητική υπάλληλος', 'rejected', [3, 3, 3, 2, 3, 3], 'Επιλέχθηκε υποψήφιος με εμπειρία σε προμήθειες.'],
]
const CRITERIA_KEYS = ['presentation', 'knowledge', 'experience', 'motivation', 'teamwork', 'availability']
function historyCandidates() {
  const start = -Math.round((new Date(`${day(0)}T12:00:00`).getTime() - new Date('2025-01-10T12:00:00').getTime()) / 86400000)
  const end = -45
  return HISTORY.map(([fullName, gender, requestedPosition, status, marks, outcomeText], index) => {
    const applied = Math.round(start + ((end - start) * index) / (HISTORY.length - 1))
    const n = index + 8, rating = Math.round((marks.reduce((sum, mark) => sum + mark, 0) / marks.length) * 10) / 10
    const outcome = status === 'hired' ? 'recommend' : status === 'interviewed' ? 'reserve' : status === 'rejected' ? 'not_recommend' : 'recommend'
    const decided = status === 'hired' || status === 'rejected'
    const nursing = /Νοσηλ|Μαία/.test(requestedPosition)
    return candidate(`demo-cand-${n}`, `ΥΠ-${String(n).padStart(4, '0')}`, applied, {
      fullName, gender, birthDate: `${1984 + (index % 13)}-${String(1 + (index * 5) % 12).padStart(2, '0')}-${String(3 + (index * 7) % 25).padStart(2, '0')}`, area: ['Λάρισα', 'Τρίκαλα', 'Καρδίτσα', 'Βόλος'][index % 4], phoneMobile: `69000002${String(n).padStart(2, '0')}`,
      email: `candidate${n}@example.org`, requestedPosition, status, educationLevel: nursing ? 'ΑΕΙ' : 'Λύκειο', practiceLicence: nursing ? status !== 'rejected' || index % 2 === 0 : null,
      decision: decided ? (status === 'hired' ? 'hire' : 'reject') : '', decisionOn: decided ? day(applied + 14) : '', decisionByName: decided ? DIRECTOR : '', decisionNotes: outcomeText,
      interviews: [interview(`demo-int-h${n}`, { scheduledAt: at(applied + 8, `${10 + (index % 4)}:00`), status: 'completed', interviewers: panel(nursing ? [HEAD_NURSE] : ['Γιώργος Νικολάου'], [HR, 'hr']), scores: Object.fromEntries(CRITERIA_KEYS.map((key, i) => [key, marks[i]])), overallRating: rating, outcome, recommendation: outcomeText, salaryExpectation: 950 + (index % 5) * 75, evaluatedAt: at(applied + 8, '13:00'), evaluatedByName: HR })],
      createdAt: at(applied, '10:00'), updatedAt: at(decided ? applied + 14 : applied + 8, '12:00'),
    })
  })
}
