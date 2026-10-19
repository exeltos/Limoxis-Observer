// The demo applications: one at every step of the pipeline, with languages, previous
// employers, a scheduled interview and evaluated ones, dates set from today. Names are made up.
const day = offset => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const at = (offset, time) => new Date(`${day(offset)}T${time}:00`).toISOString()
const HR = 'Ελένη Γεωργίου', HEAD_NURSE = 'Μαρία Παπαδοπούλου', DIRECTOR = 'Νίκος Αλεξίου'
const panel = (...names) => names.map(([name, role = 'evaluator']) => ({ employeeId: '', name, role }))

const candidate = (id, code, offset, fields) => ({
  id, code, gender: '', fatherName: '', motherName: '', birthDate: '', birthPlace: '', nationality: 'Ελληνική', citizenship: 'Ελληνική', idNumber: '', idAuthority: '', idIssuedOn: '',
  address: '', area: '', postcode: '', phoneLandline: '', phoneMobile: '', email: '', requestedPosition: '', employmentType: 'full_time', militaryService: '', workPermit: null, practiceLicence: null, smoker: false,
  maritalStatus: '', children: '', educationLevel: '', education: [], itSkills: '', activities: '', whyUs: '', applicationReason: '', appliedOn: day(offset), consentGiven: true, consentAt: at(offset, '10:00'), consentText: 'Έντυπο συναίνεσης GDPR',
  status: 'new', decision: '', decisionOn: '', decisionByName: '', decisionNotes: '', employeeId: '', source: 'demo', notes: '', languages: [], employers: [], interviews: [],
  createdAt: at(offset, '10:00'), updatedAt: at(offset, '10:00'), ...fields,
})
const interview = (id, fields) => ({ id, scheduledAt: '', location: 'Γραφείο Προσωπικού', status: 'scheduled', interviewers: [], scores: {}, overallRating: null, outcome: '', recommendation: '', strengths: '', weaknesses: '', salaryExpectation: '', offeredSalary: '', benefits: '', availableFrom: '', evaluatedAt: '', evaluatedByName: '', notes: '', source: 'demo', ...fields })

export function interviewsDemoState() {
  return {
    candidates: [
      candidate('demo-cand-1', 'ΥΠ-0001', -2, { fullName: 'Κωνσταντίνου Δήμητρα', gender: 'female', birthDate: '1996-04-12', area: 'Λάρισα', phoneMobile: '6900000101', email: 'd.konstantinou@example.org', requestedPosition: 'ΤΕ Νοσηλευτική', maritalStatus: 'single', educationLevel: 'Λύκειο', education: [{ level: 'ΤΕΙ', school: 'Νοσηλευτική ΤΕΙ Λάρισας', year: '2019', completed: true }], practiceLicence: true, itSkills: 'Office, ηλεκτρονικός φάκελος ασθενούς', whyUs: 'Κοντά στο σπίτι και καλή φήμη της κλινικής.',
        languages: [{ id: 'demo-lang-1', language: 'en', reading: 'good', writing: 'good', speaking: 'fair', certificate: true, certificateName: 'B2' }] }),
      candidate('demo-cand-2', 'ΥΠ-0002', -6, { fullName: 'Ιωάννου Πέτρος', gender: 'male', birthDate: '1990-09-03', area: 'Τρίκαλα', phoneMobile: '6900000102', email: 'p.ioannou@example.org', requestedPosition: 'Τραυματιοφορέας', militaryService: 'done', maritalStatus: 'married', children: 2, status: 'screening', educationLevel: 'Λύκειο',
        employers: [{ id: 'demo-emp-1', employer: 'Ιδιωτική κλινική (παράδειγμα)', fromOn: '2016-02-01', toOn: '2024-12-31', jobTitle: 'Τραυματιοφορέας', salary: 900, leavingReason: 'Μετακόμιση' }] }),
      candidate('demo-cand-3', 'ΥΠ-0003', -9, { fullName: 'Μιχαηλίδου Άννα', gender: 'female', birthDate: '1993-01-25', area: 'Λάρισα', phoneMobile: '6900000103', email: 'a.michailidou@example.org', requestedPosition: 'ΤΕ Νοσηλευτική', status: 'interview_scheduled', educationLevel: 'Λύκειο', practiceLicence: true,
        education: [{ level: 'ΑΕΙ', school: 'Νοσηλευτική Πανεπιστημίου Θεσσαλίας', year: '2016', completed: true }, { level: 'Μεταπτυχιακό', school: 'ΜΕΘ — Πανεπιστήμιο Θεσσαλίας', year: '2021', completed: true }],
        languages: [{ id: 'demo-lang-2', language: 'en', reading: 'fluent', writing: 'fluent', speaking: 'good', certificate: true, certificateName: 'C1' }, { id: 'demo-lang-3', language: 'de', reading: 'basic', writing: 'basic', speaking: 'basic', certificate: false, certificateName: '' }],
        employers: [{ id: 'demo-emp-2', employer: 'Γενικό Νοσοκομείο (παράδειγμα)', fromOn: '2017-03-01', toOn: '2025-06-30', jobTitle: 'Νοσηλεύτρια ΜΕΘ', salary: 1150, leavingReason: 'Λήξη σύμβασης' }],
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
