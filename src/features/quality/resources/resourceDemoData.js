import { applyTemplate, presetTemplates } from './supplierTemplates'

// The demo's suppliers and equipment: dates are set from today, so the figures
// always show something overdue, something due soon and a device out of service.
// Names are made up.

const day = (offset, from = new Date().toISOString().slice(0, 10)) => { const date = new Date(`${from}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10) }

const scores = (quality, delivery, specs, documents, support, price) => ({ quality, delivery, specs, documents, support, price })

// An evaluation on one of the demo's templates, a score per criterion in order.
function onTemplate(templates, key, id, offset, values, extra = {}) {
  const template = templates.find(item => item.id === `tpl-demo-${key}`)
  const evaluation = { ...applyTemplate({ id, evaluatedOn: day(offset), evaluator: 'Υπεύθυνος Ποιότητας', notes: '', source: 'app' }, template), ...extra }
  evaluation.criteria = evaluation.criteria.map((item, index) => ({ ...item, score: values[index] ?? '' }))
  return evaluation
}

export function demoResources() {
  const templates = presetTemplates('tpl-demo')
  const suppliers = [
    { id: 'sup-demo-1', departmentIds: ['Χειρουργική'], code: 'SUP-001', name: 'Ιατροτεχνική Θεσσαλίας Α.Ε.', category: 'medical_devices', criticality: 'high', status: 'active', taxId: '099999001', contactName: 'Τμήμα εξυπηρέτησης', phone: '2410 000001', email: 'service@example.com', address: 'Λάρισα', website: '', products: 'Απινιδωτές, monitors, αντλίες έγχυσης· τεχνική υποστήριξη', contractEndsOn: day(240), notes: '',
      certifications: [{ id: 'c1', type: 'ISO 13485', number: 'MD-4471', issuer: 'Φορέας πιστοποίησης', expiresOn: day(420) }, { id: 'c2', type: 'ISO 9001', number: 'QM-1180', issuer: 'Φορέας πιστοποίησης', expiresOn: day(35) }],
      evaluations: [{ id: 'e1', evaluatedOn: day(-300), evaluator: 'Υπεύθυνος Ποιότητας', scores: scores(5, 4, 5, 4, 5, 3), notes: '' }, { id: 'e0', evaluatedOn: day(-665), evaluator: 'Υπεύθυνος Ποιότητας', scores: scores(4, 4, 4, 4, 4, 3), notes: '' }],
      nonconformities: [] },
    { id: 'sup-demo-2', departmentIds: ['Χειρουργική', 'ΜΕΘ'], code: 'SUP-002', name: 'Υγειονομικά Αναλώσιμα Κεντρικής Ελλάδας', category: 'consumables', criticality: 'high', status: 'active', taxId: '099999002', contactName: 'Πωλήσεις', phone: '2410 000002', email: 'orders@example.com', address: 'Βόλος', website: '', products: 'Γάντια, μάσκες, σύριγγες, καθετήρες', contractEndsOn: day(45), notes: '',
      certifications: [{ id: 'c3', type: 'ISO 9001', number: 'QM-2290', issuer: 'Φορέας πιστοποίησης', expiresOn: day(-20) }, { id: 'c3b', type: 'ISO 14001', number: 'EM-2291', issuer: 'Φορέας πιστοποίησης', expiresOn: day(-45) }, { id: 'c3c', type: 'ISO 45001', number: 'OH-2292', issuer: 'Φορέας πιστοποίησης', expiresOn: day(-8) }, { id: 'c4', type: 'CE', number: '', issuer: '', expiresOn: '' }],
      evaluations: [{ id: 'e2', evaluatedOn: day(-390), evaluator: 'Υπεύθυνος Ποιότητας', scores: scores(4, 2, 4, 3, 3, 4), notes: 'Καθυστερήσεις στις παραδόσεις του χειμώνα.' }],
      nonconformities: [{ id: 'n1', date: day(-60), description: 'Παρτίδα γαντιών νιτριλίου με σχισίματα κατά τη χρήση (ΜΕΘ).', severity: 'major', status: 'open', capaCode: '', closedOn: '' }, { id: 'n2', date: day(-150), description: 'Παράδοση 9 ημέρες εκτός χρόνου.', severity: 'minor', status: 'closed', capaCode: '', closedOn: day(-120) }] },
    { id: 'sup-demo-3', code: 'SUP-003', name: 'Βιοϊατρική Συντήρηση Ο.Ε.', category: 'maintenance', criticality: 'high', status: 'active', taxId: '099999003', contactName: 'Τεχνικός υπεύθυνος', phone: '2410 000003', email: 'tech@example.com', address: 'Λάρισα', website: '', products: 'Προληπτική συντήρηση, διακριβώσεις, ηλεκτρολογικοί έλεγχοι ασφάλειας', contractEndsOn: day(150), notes: '',
      certifications: [{ id: 'c5', type: 'ISO 9001', number: 'QM-3301', issuer: 'Φορέας πιστοποίησης', expiresOn: day(510) }, { id: 'c5b', type: 'ISO 13485', number: 'MD-3302', issuer: 'Φορέας πιστοποίησης', expiresOn: day(-3) }],
      evaluations: [onTemplate(templates, 'services', 'e3', -90, [4, 4, 4, 5, 4, 4])],
      contacts: [{ id: 'ct3', fullName: 'Τεχνικός υπεύθυνος', jobTitle: 'Βάρδια βλαβών', phone: '2410 000013', email: 'service@example.com', notes: '' }],
      nonconformities: [] },
    { id: 'sup-demo-4', departmentIds: ['Εργαστήριο'], code: 'SUP-004', name: 'Εργαστηριακά Αντιδραστήρια Α.Ε.', category: 'laboratory', criticality: 'medium', status: 'active', taxId: '099999004', contactName: '', phone: '', email: '', address: 'Αθήνα', website: '', products: 'Αντιδραστήρια μικροβιολογικού, καλλιεργητικά υλικά', contractEndsOn: '', notes: '',
      certifications: [{ id: 'c6', type: 'ISO 13485', number: 'MD-8812', issuer: 'Φορέας πιστοποίησης', expiresOn: day(300) }, { id: 'c6b', type: 'CE-IVD', number: 'IVD-2201', issuer: 'Κοινοποιημένος οργανισμός', expiresOn: day(500) }],
      evaluations: [onTemplate(templates, 'laboratory', 'e4', -200, [3, 4, 3, 2, 4, 3, 3], { evaluator: 'Υπεύθυνος Εργαστηρίου', notes: 'Παράδοση με θερμοκρασία εκτός ορίων· αλλαγή συσκευασίας χωρίς ενημέρωση.' })],
      nonconformities: [{ id: 'n3', date: day(-30), description: 'Παράδοση με θερμοκρασία μεταφοράς εκτός ορίων.', severity: 'minor', status: 'open', capaCode: '', closedOn: '' }] },
    { id: 'sup-demo-5', code: 'SUP-005', name: 'Καθαριότητα & Υγιεινή Ι.Κ.Ε.', category: 'cleaning', criticality: 'medium', status: 'active', taxId: '099999005', contactName: '', phone: '', email: '', address: 'Λάρισα', website: '', products: 'Συνεργείο καθαριότητας, απολυμαντικά επιφανειών', contractEndsOn: day(-10), notes: '',
      certifications: [], evaluations: [], nonconformities: [], contacts: [] },
    { id: 'sup-demo-6', code: 'SUP-006', name: 'Διαχείριση Αποβλήτων Υγειονομικών Μονάδων', category: 'waste', criticality: 'high', status: 'active', taxId: '099999006', contactName: '', phone: '', email: '', address: 'Θεσσαλονίκη', website: '', products: 'Συλλογή και μεταφορά ΕΑΑΜ', contractEndsOn: day(600), notes: '',
      certifications: [{ id: 'c7', type: 'ISO 14001', number: 'EM-5550', issuer: 'Φορέας πιστοποίησης', expiresOn: day(700) }],
      evaluations: [{ id: 'e6', evaluatedOn: day(-150), evaluator: 'Υπεύθυνος Ποιότητας', scores: scores(3, 2, 3, 3, 2, 3), notes: 'Παραλείψεις στα συνοδευτικά έντυπα.' }],
      nonconformities: [] },
    { id: 'sup-demo-7', code: 'SUP-007', name: 'Γαλακτοκομικά Κάμπου Α.Ε.', category: 'kitchen', criticality: 'high', status: 'active', taxId: '099999007', contactName: 'Πωλήσεις', phone: '2410 000007', email: 'orders-food@example.com', address: 'Λάρισα', city: 'Λάρισα', country: 'Ελλάδα', website: '', products: 'Γάλα, γιαούρτι, τυριά· καθημερινή διανομή με ψυγείο', contractEndsOn: day(200), notes: '',
      certifications: [{ id: 'c8', type: 'ISO 22000 / HACCP', number: 'FS-7781', issuer: 'Φορέας πιστοποίησης', expiresOn: day(25) }, { id: 'c8b', type: 'Βεβαίωση καταχώρισης ΕΦΕΤ', number: 'EFET-4410', issuer: 'ΕΦΕΤ', expiresOn: day(-12) }],
      evaluations: [onTemplate(templates, 'kitchen', 'e7', -350, [5, 4, 4, 4, 4, 5, 4, 3])],
      contacts: [{ id: 'ct7', fullName: 'Υπεύθυνος διανομής', jobTitle: 'Διανομή Λάρισας', phone: '2410 000017', email: 'orders-food@example.com', notes: '' }],
      nonconformities: [] },
    { id: 'sup-demo-8', code: 'SUP-008', name: 'Οπωροπωλείο Θεσσαλίας Ο.Ε.', category: 'kitchen', criticality: 'medium', status: 'active', taxId: '099999008', contactName: '', phone: '', email: '', address: 'Λάρισα', city: 'Λάρισα', country: 'Ελλάδα', website: '', products: 'Φρούτα και λαχανικά', contractEndsOn: '', notes: '',
      certifications: [],
      evaluations: [onTemplate(templates, 'kitchen', 'e8', -40, [3, 3, 2, 3, 3, 4, 3, 4], { notes: 'Λαχανικά χωρίς επισήμανση προέλευσης σε δύο παραδόσεις.' })],
      nonconformities: [] },
  ].map(item => ({ city: '', country: '', legalName: '', approvalStatus: '', evaluationMonths: '', contacts: [], ...item }))

  const device = (id, code, name, equipmentType, departmentId, extra = {}) => ({ id, code, name, equipmentType, departmentId, location: '', manufacturer: '', model: '', serialNumber: '', inventoryNumber: '', supplierId: 'sup-demo-1', criticality: 'medium', status: 'in_service', installedOn: day(-1400), warrantyEndsOn: '', maintenanceMonths: 12, calibrationMonths: '', safetyMonths: 12, notes: '', ...extra })
  const equipment = [
    device('eq-demo-1', 'EQ-0001', 'Απινιδωτής', 'Απινιδωτής', 'ΜΕΘ', { manufacturer: 'Κατασκευαστής Α', model: 'D-300', serialNumber: 'DF30-11872', inventoryNumber: 'ΑΠ-1021', location: 'Σταθμός νοσηλευτών', criticality: 'high', maintenanceMonths: 6, safetyMonths: 12 }),
    device('eq-demo-2', 'EQ-0002', 'Απινιδωτής', 'Απινιδωτής', 'ΤΕΠ', { manufacturer: 'Κατασκευαστής Α', model: 'D-300', serialNumber: 'DF30-11990', inventoryNumber: 'ΑΠ-1022', location: 'Αίθουσα ανάνηψης', criticality: 'high', maintenanceMonths: 6, safetyMonths: 12 }),
    device('eq-demo-3', 'EQ-0003', 'Ψυγείο φαρμάκων', 'Ψυγείο φαρμάκων', 'Παθολογική', { manufacturer: 'Κατασκευαστής Β', model: 'MR-140', serialNumber: 'MR140-5521', inventoryNumber: 'ΑΠ-2210', location: 'Φαρμακείο τμήματος', criticality: 'high', maintenanceMonths: 12, calibrationMonths: 12, safetyMonths: '' }),
    device('eq-demo-4', 'EQ-0004', 'Ψυγείο εμβολίων', 'Ψυγείο εμβολίων', 'Παιδιατρική', { manufacturer: 'Κατασκευαστής Β', model: 'VR-90', serialNumber: 'VR90-0042', location: 'Ιατρείο', criticality: 'high', maintenanceMonths: 12, calibrationMonths: 12, safetyMonths: '' }),
    device('eq-demo-5', 'EQ-0005', 'Κλίβανος αποστείρωσης ατμού', 'Κλίβανος αποστείρωσης', 'Κεντρική Αποστείρωση', { manufacturer: 'Κατασκευαστής Γ', model: 'ST-600', serialNumber: 'ST6-2019-07', inventoryNumber: 'ΑΠ-0100', criticality: 'high', supplierId: 'sup-demo-3', maintenanceMonths: 3, calibrationMonths: 12, safetyMonths: 12 }),
    device('eq-demo-6', 'EQ-0006', 'Πλυντήριο-απολυμαντής ενδοσκοπίων', 'Πλυντήριο-απολυμαντής ενδοσκοπίων', 'Χειρουργική', { manufacturer: 'Κατασκευαστής Δ', model: 'EW-2', serialNumber: 'EW2-7781', criticality: 'high', supplierId: 'sup-demo-3', maintenanceMonths: 6, calibrationMonths: 12, safetyMonths: 12 }),
    device('eq-demo-7', 'EQ-0007', 'Αναρροφητήρας', 'Αναρροφητήρας', 'Χειρουργική', { manufacturer: 'Κατασκευαστής Ε', model: 'SU-10', serialNumber: 'SU10-334', criticality: 'medium' }),
    device('eq-demo-8', 'EQ-0008', 'Θερμοκοιτίδα', 'Θερμοκοιτίδα', 'Νεογνολογική / ΜΕΝΝ', { manufacturer: 'Κατασκευαστής Ζ', model: 'IN-5', serialNumber: 'IN5-0912', criticality: 'high', maintenanceMonths: 6, calibrationMonths: 12, safetyMonths: 12, warrantyEndsOn: day(200), installedOn: day(-165) }),
    device('eq-demo-9', 'EQ-0009', 'Θάλαμος βιολογικής ασφάλειας', 'Θάλαμος βιολογικής ασφάλειας', 'Εργαστήριο', { manufacturer: 'Κατασκευαστής Η', model: 'BSC-II', serialNumber: 'BSC2-118', criticality: 'high', supplierId: 'sup-demo-3', maintenanceMonths: 12, calibrationMonths: 12, safetyMonths: 12 }),
    device('eq-demo-10', 'EQ-0010', 'Παρασκευαστής πάγου', 'Παρασκευαστής πάγου', 'Καρδιολογική', { criticality: 'low', supplierId: '', maintenanceMonths: 6, safetyMonths: '' }),
    device('eq-demo-11', 'EQ-0011', 'Τροχήλατο ανάνηψης', 'Τροχήλατο ανάνηψης', 'Ορθοπαιδική', { criticality: 'high', supplierId: '', maintenanceMonths: 1, safetyMonths: '' }),
    device('eq-demo-12', 'EQ-0012', 'Αναρροφητήρας', 'Αναρροφητήρας', 'ΜΕΘ', { status: 'retired', criticality: 'medium', notes: 'Αντικαταστάθηκε από το EQ-0007.' }),
  ]

  const event = (id, equipmentId, kind, offset, result = 'pass', extra = {}) => ({ id, equipmentId, kind, happenedOn: day(offset), result, performedBy: 'Βιοϊατρική Συντήρηση Ο.Ε.', description: '', certificate: '', capaCode: '', recordedAt: `${day(offset)}T10:00:00Z`, ...extra })
  const events = [
    event('ev-1', 'eq-demo-1', 'maintenance', -150), event('ev-2', 'eq-demo-1', 'safety', -150),
    event('ev-3', 'eq-demo-2', 'maintenance', -200), event('ev-4', 'eq-demo-2', 'safety', -200),
    event('ev-5', 'eq-demo-3', 'maintenance', -340), event('ev-6', 'eq-demo-3', 'calibration', -340, 'pass', { certificate: 'ΠΔ-2291' }),
    event('ev-7', 'eq-demo-4', 'maintenance', -100), event('ev-8', 'eq-demo-4', 'calibration', -100, 'pass', { certificate: 'ΠΔ-2302' }),
    event('ev-9', 'eq-demo-5', 'maintenance', -70), event('ev-10', 'eq-demo-5', 'calibration', -250), event('ev-11', 'eq-demo-5', 'safety', -250),
    event('ev-12', 'eq-demo-5', 'failure', -12, 'out_of_service', { performedBy: 'Προσωπικό Κεντρικής Αποστείρωσης', description: 'Ο κύκλος διακόπτεται με σφάλμα πίεσης· οι δείκτες Bowie-Dick απέτυχαν.' }),
    event('ev-13', 'eq-demo-6', 'maintenance', -160), event('ev-14', 'eq-demo-6', 'calibration', -330), event('ev-15', 'eq-demo-6', 'safety', -330),
    event('ev-16', 'eq-demo-7', 'maintenance', -380), event('ev-17', 'eq-demo-7', 'safety', -380),
    event('ev-18', 'eq-demo-7', 'failure', -40, 'out_of_service', { performedBy: 'Προσωπικό τμήματος', description: 'Δεν δημιουργεί αναρρόφηση.' }), event('ev-19', 'eq-demo-7', 'repair', -35, 'returned', { description: 'Αντικατάσταση φίλτρου και σωλήνωσης.' }),
    event('ev-20', 'eq-demo-9', 'maintenance', -20), event('ev-21', 'eq-demo-9', 'calibration', -20, 'pass', { certificate: 'ΠΔ-2410' }), event('ev-22', 'eq-demo-9', 'safety', -20),
    event('ev-23', 'eq-demo-10', 'maintenance', -175, 'pass', { performedBy: 'Τεχνική υπηρεσία' }),
    event('ev-24', 'eq-demo-11', 'maintenance', -20, 'pass', { performedBy: 'Προϊσταμένη τμήματος', description: 'Μηνιαίος έλεγχος περιεχομένου και λήξεων.' }),
  ]
  return { suppliers, equipment, events, templates }
}
