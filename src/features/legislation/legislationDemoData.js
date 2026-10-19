// The demo's legislation: a few texts every hospital knows, with requirements
// written as a hospital would check them (a summary, not the text of the law),
// one of them updated after the hospital reviewed it. The candidates are marked
// as examples: the real ones come from the automatic check of the sources.

const day = (offset, from = new Date().toISOString().slice(0, 10)) => { const date = new Date(`${from}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10) }
const req = (id, text) => ({ id, text })

const WASTE_V1 = [
  req('w1', 'Εσωτερικό σχέδιο διαχείρισης αποβλήτων της μονάδας, εγκεκριμένο και επικαιροποιημένο.'),
  req('w2', 'Διαλογή των αποβλήτων στην πηγή, σε κατάλληλους και σημασμένους περιέκτες ανά κατηγορία.'),
  req('w3', 'Χώρος προσωρινής αποθήκευσης με τις προβλεπόμενες προδιαγραφές, τήρηση των χρόνων αποθήκευσης.'),
  req('w4', 'Μητρώο αποβλήτων και παραστατικά μεταφοράς και επεξεργασίας για κάθε παραλαβή.'),
  req('w5', 'Εκπαίδευση του προσωπικού στη διαχείριση των αποβλήτων, με αρχείο συμμετοχής.'),
]
const WASTE_V2 = WASTE_V1.map(item => (item.id === 'w4' ? req('w4', 'Μητρώο αποβλήτων, καταχωρίσεις στο Ηλεκτρονικό Μητρώο Αποβλήτων (ΗΜΑ) και παραστατικά μεταφοράς και επεξεργασίας για κάθε παραλαβή.') : item))

const TEXTS = [
  { id: 'leg-demo-1', code: 'LEG-001', title: 'Μέτρα και όροι για τη διαχείριση αποβλήτων υγειονομικών μονάδων', kind: 'ministerial_decision', reference: 'ΚΥΑ 146163/2012 · ΦΕΚ Β΄ 1537/08.05.2012', issuer: 'Συναρμόδια Υπουργεία', issuedOn: '2012-05-08', topics: ['waste'], summary: 'Διαλογή, συσκευασία, αποθήκευση, μεταφορά και επεξεργασία των αποβλήτων υγειονομικών μονάδων, με εσωτερικό σχέδιο διαχείρισης και μητρώο.', url: '', status: 'in_force' },
  { id: 'leg-demo-2', code: 'LEG-002', title: 'Ποιότητα του νερού ανθρώπινης κατανάλωσης σε συμμόρφωση με την Οδηγία (ΕΕ) 2020/2184', kind: 'ministerial_decision', reference: 'ΚΥΑ Δ1(δ)/ΓΠ οικ. 27829/2023 · ΦΕΚ Β΄ 3525/2023', issuer: 'Συναρμόδια Υπουργεία', issuedOn: '', topics: ['water'], summary: 'Τα νοσοκομεία είναι κτίρια προτεραιότητας για την εκτίμηση κινδύνου των εσωτερικών δικτύων και την παρακολούθηση της Legionella.', url: '', status: 'in_force',
    requirements: [req('n1', 'Εκτίμηση και διαχείριση κινδύνου του εσωτερικού δικτύου ύδρευσης, ιδίως για τη Legionella.'), req('n2', 'Παρακολούθηση της Legionella στα σημεία κινδύνου του δικτύου, με αρχείο αποτελεσμάτων.'), req('n3', 'Συντήρηση δεξαμενών, θερμαντήρων και δικτύου, με αρχείο εργασιών.')] },
  { id: 'leg-demo-3', code: 'LEG-003', title: 'Υγιεινή των τροφίμων', kind: 'eu_regulation', reference: 'Κανονισμός (ΕΚ) 852/2004', issuer: 'Ευρωπαϊκό Κοινοβούλιο και Συμβούλιο', issuedOn: '2004-04-29', topics: ['food'], summary: 'Γενικοί κανόνες υγιεινής για τις επιχειρήσεις τροφίμων, με διαδικασίες βασισμένες στις αρχές HACCP.', url: '', status: 'in_force',
    requirements: [req('f1', 'Σύστημα αυτοελέγχου με βάση τις αρχές HACCP για το μαγειρείο και τη διανομή γευμάτων.'), req('f2', 'Εκπαίδευση των χειριστών τροφίμων στην υγιεινή.'), req('f3', 'Αρχεία θερμοκρασιών ψυγείων, θαλάμων και διανομής.')] },
  { id: 'leg-demo-4', code: 'LEG-004', title: 'Συστήματα διαχείρισης της ποιότητας: απαιτήσεις', kind: 'standard', reference: 'ΕΛΟΤ EN ISO 9001:2015', issuer: 'ISO / ΕΛΟΤ', issuedOn: '2015-09-15', topics: ['quality'], summary: 'Οι απαιτήσεις για ένα σύστημα διαχείρισης της ποιότητας, όπου πιστοποιείται η μονάδα ή τμήμα της.', url: '', status: 'in_force',
    requirements: [req('q1', 'Πολιτική και στόχοι ποιότητας, γνωστοποιημένοι στο προσωπικό (§5.2, §6.2).'), req('q2', 'Πρόγραμμα εσωτερικών επιθεωρήσεων (§9.2).'), req('q3', 'Ανασκόπηση από τη Διοίκηση σε προγραμματισμένα διαστήματα (§9.3).'), req('q4', 'Αξιολόγηση και επαναξιολόγηση εξωτερικών παρόχων (§8.4).'), req('q5', 'Διορθωτικές ενέργειες με έλεγχο αποτελεσματικότητας (§10.2).')] },
  { id: 'leg-demo-5', code: 'LEG-005', title: 'Μέτρα εφαρμογής του Γενικού Κανονισμού για την Προστασία Δεδομένων', kind: 'law', reference: 'Ν. 4624/2019 · ΦΕΚ Α΄ 137/2019', issuer: 'Βουλή των Ελλήνων', issuedOn: '2019-08-29', topics: ['data'], summary: 'Η εφαρμογή του Κανονισμού (ΕΕ) 2016/679 στην Ελλάδα, με ειδικές διατάξεις για τα δεδομένα υγείας.', url: '', status: 'in_force',
    requirements: [req('d1', 'Ορισμός Υπεύθυνου Προστασίας Δεδομένων.'), req('d2', 'Αρχείο δραστηριοτήτων επεξεργασίας.'), req('d3', 'Διαδικασία για την παραβίαση δεδομένων και την ενημέρωση της Αρχής.')] },
]

export function demoLegislation() {
  const snapshot = (text, requirements) => ({ code: text.code, title: text.title, titleEn: '', kind: text.kind, reference: text.reference, issuer: text.issuer, issuedOn: text.issuedOn, topics: text.topics, summary: text.summary, url: text.url, status: text.status, requirements })
  const versions = [
    { textId: 'leg-demo-1', version: 1, snapshot: snapshot(TEXTS[0], WASTE_V1), changeNote: '', changedRequirements: WASTE_V1.map(item => item.id), publishedAt: `${day(-320)}T09:00:00Z` },
    { textId: 'leg-demo-1', version: 2, snapshot: snapshot(TEXTS[0], WASTE_V2), changeNote: 'Η απαίτηση για το μητρώο περιλαμβάνει πλέον τις καταχωρίσεις στο Ηλεκτρονικό Μητρώο Αποβλήτων (ΗΜΑ).', changedRequirements: ['w4'], publishedAt: `${day(-6)}T09:00:00Z` },
    ...TEXTS.slice(1).map((text, index) => ({ textId: text.id, version: 1, snapshot: snapshot(text, text.requirements), changeNote: '', changedRequirements: text.requirements.map(item => item.id), publishedAt: `${day(index === 0 ? -3 : -300 + index * 10)}T09:00:00Z` })),
  ]
  const library = TEXTS.map((text, index) => ({ ...text, titleEn: '', requirements: index === 0 ? WASTE_V2 : text.requirements, version: index === 0 ? 2 : 1, publishedAt: versions.filter(item => item.textId === text.id).at(-1).publishedAt }))
  const mark = (status, extra = {}) => ({ status, evidence: '', note: '', checkedOn: day(-40), ...extra })
  const rows = [
    { id: 'ol-demo-1', textId: 'leg-demo-1', applicable: true, acceptedVersion: 1, responsible: 'Υπεύθυνη Ποιότητας', nextReviewOn: day(200), notes: '', compliance: { w1: mark('compliant', { evidence: 'Σχέδιο διαχείρισης αποβλήτων, έκδοση 3' }), w2: mark('compliant'), w3: mark('partial', { note: 'Ο χώρος δεν έχει ψύξη για αποθήκευση πέραν των 5 ημερών.' }), w4: mark('compliant', { evidence: 'Μητρώο αποβλήτων, παραστατικά αναδόχου' }), w5: mark('compliant') } },
    { id: 'ol-demo-3', textId: 'leg-demo-3', applicable: true, acceptedVersion: 1, responsible: 'Προϊστάμενος Διατροφής', nextReviewOn: day(120), notes: '', compliance: { f1: mark('compliant', { evidence: 'Εγχειρίδιο HACCP' }), f2: mark('compliant'), f3: mark('compliant') } },
    { id: 'ol-demo-4', textId: 'leg-demo-4', applicable: true, acceptedVersion: 1, responsible: 'Υπεύθυνη Ποιότητας', nextReviewOn: day(-12), notes: '', compliance: { q1: mark('compliant'), q2: mark('compliant', { evidence: 'Πρόγραμμα επιθεωρήσεων έτους' }), q3: mark('partial', { note: 'Η τελευταία ανασκόπηση έγινε πριν από 14 μήνες.' }), q4: mark('non_compliant', { note: 'Δεν έχουν αξιολογηθεί οι προμηθευτές καθαριότητας και σίτισης.' }), q5: mark('compliant') } },
    { id: 'ol-demo-5', textId: 'leg-demo-5', applicable: true, acceptedVersion: 1, responsible: 'Υπεύθυνος Προστασίας Δεδομένων', nextReviewOn: day(300), notes: '', compliance: { d1: mark('compliant'), d2: mark('compliant') } },
  ]
  const candidates = [
    { id: 'lc-demo-1', sourceName: 'e-nomothesia.gr · νέα νομοθεσία', title: 'Παράδειγμα: Υπουργική Απόφαση για τα μέτρα πρόληψης των λοιμώξεων που συνδέονται με τη φροντίδα υγείας', url: '', excerpt: 'Παράδειγμα ευρήματος του αυτόματου ελέγχου. Τα πραγματικά έρχονται από τις πηγές που ελέγχονται κάθε 2 ώρες.', matchedKeywords: ['λοιμωξ', 'υγειας'], status: 'pending', detectedAt: `${day(-1)}T07:23:00Z` },
    { id: 'lc-demo-2', sourceName: 'Υπουργείο Υγείας · ανακοινώσεις', title: 'Παράδειγμα: Εγκύκλιος για τη διαχείριση των αποβλήτων υγειονομικών μονάδων', url: '', excerpt: '', matchedKeywords: ['εγκυκλι', 'αποβλητ'], status: 'pending', detectedAt: `${day(-2)}T11:23:00Z` },
  ]
  const sources = [
    { id: 'ls-demo-1', name: 'e-nomothesia.gr · νέα νομοθεσία', url: 'https://www.e-nomothesia.gr/rss.xml', kind: 'rss', keywords: ['λοιμωξ', 'νοσοκομει', 'αποβλητ', 'λεγιονελλ', 'αποστειρωσ'], active: true, lastCheckedAt: `${day(0)}T07:23:00Z`, lastStatus: 200, lastError: '', consecutiveFailures: 0 },
    { id: 'ls-demo-2', name: 'Υπουργείο Υγείας · ανακοινώσεις', url: 'https://www.moh.gov.gr/articles/news', kind: 'page', keywords: ['λοιμωξ', 'εγκυκλι', 'αποβλητ'], active: true, lastCheckedAt: `${day(0)}T07:23:00Z`, lastStatus: 200, lastError: '', consecutiveFailures: 0 },
    { id: 'ls-demo-3', name: 'ΕΟΔΥ · ανακοινώσεις', url: 'https://eody.gov.gr/', kind: 'page', keywords: ['λοιμωξ', 'εγκυκλι', 'οδηγι'], active: true, lastCheckedAt: `${day(0)}T07:23:00Z`, lastStatus: 200, lastError: '', consecutiveFailures: 0 },
    { id: 'ls-demo-4', name: 'WHO · news', url: 'https://www.who.int/rss-feeds/news-english.xml', kind: 'rss', keywords: ['infection prevention', 'antimicrobial resistance'], active: true, lastCheckedAt: `${day(0)}T07:23:00Z`, lastStatus: 200, lastError: '', consecutiveFailures: 0 },
  ]
  return { library, versions, rows, candidates, sources }
}
