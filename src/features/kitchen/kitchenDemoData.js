// The demo kitchen: a week of receipts, production days, heat parameters, defrosts and
// pureeing, with dates set from today, so the screens always show today's work, an
// entry out of limits, a batch close to expiry and days waiting for the HACCP sign-off.
// The same picture is seeded in the Demo organizations of the database
// (20261123110200_kitchen_demo.sql). Names are made up.
import { demoResources } from '../quality/resources/resourceDemoData'
import { DEFAULT_LIMITS } from './kitchenLimits'
import { drillFindings, recallTrace } from './kitchenRecallModel'

const day = offset => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const at = (offset, time) => new Date(`${day(offset)}T${time}:00`).toISOString()
const COOK = 'Μαρία Παπαδοπούλου', CHEF = 'Γιώργος Νικολάου', MANAGER = 'Ελένη Γεωργίου'

// The HACCP plan's process steps, the same as the database's defaults (kitchen_seed_defaults).
export const DEFAULT_HACCP_STEPS = Object.freeze([
  ['receipt', 'Παραλαβή πρώτων υλών', [1, 1, 1, 1], 'Ανάπτυξη μικροβίων από σπασμένη ψυχρή αλυσίδα, ληγμένα ή αλλοιωμένα προϊόντα, ξένα σώματα, ελλιπής επισήμανση αλλεργιογόνων.', true, 'Εγκεκριμένοι προμηθευτές· έλεγχος οχήματος, θερμοκρασίας, συσκευασίας, λήξης και κωδικοποίησης σε κάθε παραλαβή.', 'receipt_chilled', 'Θερμόμετρο διείσδυσης ή υπέρυθρο σε ψυχόμενα και κατεψυγμένα· οπτικός έλεγχος.', 'Κάθε παραλαβή', 'Απόρριψη ή διαχωρισμός της παρτίδας, ενημέρωση προμηθευτή, μη συμμόρφωση προμηθευτή.', 'Εβδομαδιαία ανασκόπηση των παραλαβών από τον υπεύθυνο κουζίνας.', 'Παραλαβές, αρχεία προμηθευτή.', 'Υπεύθυνος παραλαβής'],
  ['storage_chilled', 'Αποθήκευση σε ψύξη', [1, 0, 0, 0], 'Ανάπτυξη μικροβίων σε θερμοκρασία πάνω από 5 °C.', false, 'Ψυκτικοί θάλαμοι ≤ 5 °C, διαχωρισμός ωμών και μαγειρεμένων, FIFO.', '', 'Θερμοκρασία θαλάμων (Έλεγχοι).', 'Δύο φορές την ημέρα', 'Μεταφορά των προϊόντων, αξιολόγηση ή απόρριψη, κλήση συντήρησης.', 'Μηνιαίος έλεγχος των θερμομέτρων.', 'Έλεγχοι θερμοκρασίας ψυγείων.', 'Μάγειρας βάρδιας'],
  ['storage_frozen', 'Αποθήκευση σε κατάψυξη', [1, 0, 0, 0], 'Απόψυξη και επαναψύξη από βλάβη.', false, 'Καταψύκτες ≤ −18 °C, ημερομηνία κατάψυξης στη συσκευασία.', '', 'Θερμοκρασία καταψυκτών (Έλεγχοι).', 'Δύο φορές την ημέρα', 'Αξιολόγηση των προϊόντων, απόρριψη όσων αποψύχθηκαν.', 'Μηνιαίος έλεγχος των θερμομέτρων.', 'Έλεγχοι θερμοκρασίας καταψυκτών.', 'Μάγειρας βάρδιας'],
  ['defrosting', 'Απόψυξη', [1, 0, 0, 0], 'Πολλαπλασιασμός μικροβίων στην επιφάνεια κατά την απόψυξη.', true, 'Απόψυξη στο ψυγείο (ή σε τρεχούμενο νερό / φούρνο μικροκυμάτων για άμεσο μαγείρεμα), όχι σε θερμοκρασία δωματίου.', 'defrost', 'Θερμοκρασία και ώρα στην αρχή και στο τέλος.', 'Κάθε απόψυξη', 'Επέκταση του χρόνου στο ψυγείο ή απόρριψη αν ξεπεράστηκε ο χρόνος / η θερμοκρασία.', 'Επαλήθευση HACCP κάθε απόψυξης από τον υπεύθυνο.', 'Αποψύξεις.', 'Μάγειρας'],
  ['preparation', 'Προετοιμασία', [1, 1, 1, 1], 'Επιμόλυνση από χέρια, επιφάνειες, σκεύη· διασταυρούμενη επιμόλυνση αλλεργιογόνων.', false, 'Υγιεινή χεριών, χρωματική κωδικοποίηση επιφανειών κοπής, καθαρισμός και απολύμανση.', '', 'Οπτικός έλεγχος.', 'Κάθε βάρδια', 'Επανακαθαρισμός, εκπαίδευση προσωπικού.', 'Επιθεωρήσεις υγιεινής.', 'Πρόγραμμα καθαρισμού.', 'Υπεύθυνος κουζίνας'],
  ['disinfection', 'Απολύμανση λαχανικών και φρούτων', [1, 1, 1, 0], 'Παθογόνα στην επιφάνεια ωμών λαχανικών και φρούτων· υπολείμματα απολυμαντικού.', true, 'Πλύσιμο και εμβάπτιση σε εγκεκριμένο απολυμαντικό στη σωστή συγκέντρωση και χρόνο, ξέβγαλμα.', '', 'Συγκέντρωση και χρόνος επαφής.', 'Κάθε ημέρα παραγωγής', 'Επανάληψη της απολύμανσης.', 'Ημερήσια επαλήθευση της ημέρας.', 'Παραγωγή ημέρας (απολύμανση).', 'Μάγειρας'],
  ['cooking', 'Μαγείρεμα', [1, 0, 0, 0], 'Επιβίωση παθογόνων (Salmonella, Listeria, Campylobacter).', true, 'Μαγείρεμα ώσπου ο πυρήνας να φτάσει τουλάχιστον 75 °C.', 'cooking_core', 'Θερμόμετρο διείσδυσης στον πυρήνα του πιο χοντρού κομματιού.', 'Κάθε παρτίδα φαγητού', 'Συνέχιση του μαγειρέματος ώσπου να φτάσει το όριο· απόρριψη αν δεν είναι δυνατό.', 'Ημερήσια επαλήθευση, βαθμονόμηση θερμομέτρων.', 'Θερμικές επεξεργασίες.', 'Μάγειρας'],
  ['chilling', 'Ψύξη μαγειρεμένου', [1, 0, 0, 0], 'Βλάστηση σπόρων (Clostridium perfringens, Bacillus cereus) κατά την αργή ψύξη.', true, 'Ταχεία ψύξη (blast chiller) ώστε ο πυρήνας να πέσει στους 10 °C μέσα σε 2 ώρες.', 'chilling', 'Θερμοκρασία πυρήνα και χρόνος στον ψύκτη.', 'Κάθε παρτίδα που ψύχεται', 'Απόρριψη αν δεν έφτασε το όριο στον χρόνο.', 'Ημερήσια επαλήθευση.', 'Θερμικές επεξεργασίες (ψύξη).', 'Μάγειρας'],
  ['reheating', 'Αναθέρμανση', [1, 0, 0, 0], 'Επιβίωση μικροβίων που αναπτύχθηκαν μετά το μαγείρεμα.', true, 'Αναθέρμανση ώσπου ο πυρήνας να φτάσει τουλάχιστον 75 °C, μία φορά.', 'reheating', 'Θερμόμετρο διείσδυσης.', 'Κάθε αναθέρμανση', 'Συνέχιση ώσπου να φτάσει το όριο· απόρριψη αν δεν είναι δυνατό.', 'Ημερήσια επαλήθευση.', 'Θερμικές επεξεργασίες (αναθέρμανση).', 'Μάγειρας'],
  ['frying', 'Τηγάνισμα', [1, 1, 0, 0], 'Ακρυλαμίδιο και πολικές ενώσεις από υπερθέρμανση ή παλιό λάδι· άψητο εσωτερικό.', false, 'Λάδι έως 180 °C, αλλαγή λαδιού κατά πρόγραμμα· πυρήνας ≥ 75 °C.', 'frying_oil', 'Θερμοκρασία λαδιού / πυρήνα.', 'Κάθε τηγάνισμα', 'Ρύθμιση θερμοκρασίας, αλλαγή λαδιού.', 'Ημερήσια επαλήθευση.', 'Θερμικές επεξεργασίες (τηγάνισμα).', 'Μάγειρας'],
  ['pureeing', 'Πολτοποίηση / σούρωμα', [1, 0, 1, 0], 'Επιμόλυνση από το μηχάνημα· ξένα σώματα από φθαρμένη λεπίδα.', false, 'Καθαρό και απολυμασμένο μηχάνημα, έλεγχος λεπίδας πριν και μετά, οπτικός έλεγχος του πολτού.', '', 'Οπτικός έλεγχος, έλεγχος λεπίδας.', 'Κάθε πολτοποίηση', 'Απόρριψη του πολτού, αντικατάσταση της λεπίδας.', 'Ημερήσια επαλήθευση.', 'Πολτοποιήσεις.', 'Μάγειρας'],
  ['serving', 'Διανομή', [1, 0, 1, 1], 'Ανάπτυξη μικροβίων σε θερμοκρασία μεταξύ 5 και 63 °C· λάθος δίαιτα / αλλεργιογόνο.', false, 'Ζεστά ≥ 63 °C, κρύα ≤ 5 °C, ετικέτα δίαιτας στον δίσκο.', '', 'Θερμοκρασία στη διανομή (Έλεγχοι).', 'Κάθε γεύμα', 'Αναθέρμανση ή απόρριψη, διόρθωση του δίσκου.', 'Μηνιαία επιθεώρηση.', 'Έλεγχοι διανομής.', 'Υπεύθυνος διανομής'],
].map(([stepKey, name, [b, c, p, a], hazards, isCcp, controlMeasure, limitKey, monitoring, frequency, correctiveAction, verification, records, responsible], index) => ({
  id: `step-${stepKey}`, position: index + 1, stepKey, name, hazardBiological: Boolean(b), hazardChemical: Boolean(c), hazardPhysical: Boolean(p), hazardAllergen: Boolean(a), hazards, isCcp, controlMeasure, limitKey, monitoring, frequency, correctiveAction, verification, records, responsible, active: true,
})))

const MENUS = [
  'Μεσημεριανό\nΚοτόπουλο λεμονάτο με πατάτες\nΣαλάτα εποχής\n\nΒραδινό\nΡύζι με λαχανικά\nΓιαούρτι',
  'Μεσημεριανό\nΜοσχάρι κοκκινιστό με κριθαράκι\nΣαλάτα λάχανο-καρότο\n\nΒραδινό\nΚοτόσουπα\nΦρούτο',
  'Μεσημεριανό\nΨάρι φιλέτο φούρνου με λαχανικά\nΣαλάτα εποχής\n\nΒραδινό\nΜακαρόνια με σάλτσα ντομάτας\nΓιαούρτι',
  'Μεσημεριανό\nΚεφτεδάκια κοτόπουλο με πουρέ\nΣαλάτα εποχής\n\nΒραδινό\nΧορτόσουπα\nΦρούτο',
  'Μεσημεριανό\nΧοιρινή μπριζόλα σχάρας με ρύζι\nΣαλάτα λάχανο\n\nΒραδινό\nΟμελέτα με λαχανικά\nΓιαούρτι',
  'Μεσημεριανό\nΚοτόπουλο φούρνου με πατάτες\nΣαλάτα εποχής\n\nΒραδινό\nΦακές σούπα\nΦρούτο',
  'Μεσημεριανό\nΜοσχάρι λεμονάτο με πουρέ\nΣαλάτα εποχής\n\nΒραδινό\nΚοτόσουπα\nΓιαούρτι',
]

const products = [
  ['kp-1', 'Στήθος κοτόπουλο φιλέτο', 'poultry', 'chilled', 'kg', 'sup-demo-9', 15],
  ['kp-2', 'Μπούτι κοτόπουλο κατεψυγμένο', 'poultry', 'frozen', 'kg', 'sup-demo-9', 10],
  ['kp-3', 'Κιμάς μόσχου', 'meat', 'chilled', 'kg', 'sup-demo-9', 5],
  ['kp-4', 'Χοιρινή μπριζόλα', 'meat', 'chilled', 'kg', 'sup-demo-9', ''],
  ['kp-5', 'Φιλέτο γλώσσας κατεψυγμένο', 'fish', 'frozen', 'kg', 'sup-demo-9', ''],
  ['kp-6', 'Γάλα φρέσκο', 'dairy', 'chilled', 'l', 'sup-demo-7', 10],
  ['kp-7', 'Γιαούρτι αγελάδος', 'dairy', 'chilled', 'pcs', 'sup-demo-7', 40],
  ['kp-8', 'Ντομάτες', 'vegetables', 'ambient', 'kg', 'sup-demo-8', ''],
  ['kp-9', 'Μήλα', 'fruit', 'ambient', 'kg', 'sup-demo-8', ''],
  ['kp-10', 'Πατάτες', 'vegetables', 'ambient', 'kg', 'sup-demo-8', ''],
].map(([id, name, category, storage, unit, supplierId, lowStockQuantity]) => ({ id, name, category, storage, unit, supplierId, supplierCode: '', lowStockQuantity, active: true, notes: '', source: 'demo' }))
const product = id => products.find(item => item.id === id)

const ok = { temperatureCheck: 'compliant', packagingCheck: 'compliant', expiryCheck: 'compliant', vehicleCheck: 'compliant', codingCheck: 'compliant' }
const item = (id, productId, quantity, { batch = '', expiry = 4, temperature = '', accepted = true, rejectionReason = '', notes = '', base = 0 } = {}) => {
  const p = product(productId)
  return { id, productId, productName: p.name, batchCode: batch, lotLabel: '', expiryOn: expiry == null ? '' : day(base + expiry), quantity: String(quantity), unit: p.unit, storage: p.storage, temperature: temperature === '' ? '' : String(temperature), accepted, rejectionReason, notes }
}

export function kitchenDemoState() {
  const suppliers = [...demoResources().suppliers.filter(row => row.category === 'kitchen').map(row => ({ id: row.id, name: row.name, category: row.category, status: row.status })),
    { id: 'sup-demo-9', name: 'Κρεατεμπορική Θεσσαλίας Α.Ε.', category: 'kitchen', status: 'active' }]
  const receipts = [
    { id: 'kr-1', code: 'PAR-0001', supplierId: 'sup-demo-9', receivedOn: day(-6), receivedTime: '07:40', orderReference: '1042', receiverName: CHEF, ...ok, temperatureClass: 'chilled', measuredTemperature: '3', accepted: true, status: 'completed', qualityNotes: '', correctiveAction: '',
      items: [item('kri-1', 'kp-1', 20, { batch: 'L2410-118', expiry: 6, temperature: 3, base: -6 }), item('kri-2', 'kp-3', 8, { batch: 'K-5521', expiry: 4, temperature: 2.5, base: -6 })] },
    { id: 'kr-2', code: 'PAR-0002', supplierId: 'sup-demo-7', receivedOn: day(-5), receivedTime: '06:55', orderReference: '1043', receiverName: COOK, ...ok, temperatureClass: 'chilled', measuredTemperature: '4', accepted: true, status: 'completed', qualityNotes: '', correctiveAction: '',
      items: [item('kri-3', 'kp-6', 30, { batch: 'G-0911', expiry: 6, temperature: 4, base: -5 }), item('kri-4', 'kp-7', 60, { batch: 'Y-3307', expiry: 18, temperature: 4, base: -5 })] },
    { id: 'kr-3', code: 'PAR-0003', supplierId: 'sup-demo-9', receivedOn: day(-4), receivedTime: '08:10', orderReference: '1044', receiverName: CHEF, ...ok, temperatureClass: 'frozen', measuredTemperature: '-19', accepted: true, status: 'completed', qualityNotes: '', correctiveAction: '',
      items: [item('kri-5', 'kp-2', 25, { batch: 'FR-7781', expiry: 120, temperature: -19, base: -4 }), item('kri-6', 'kp-5', 12, { batch: 'FS-2210', expiry: 180, temperature: -20, base: -4 })] },
    { id: 'kr-4', code: 'PAR-0004', supplierId: 'sup-demo-8', receivedOn: day(-3), receivedTime: '07:20', orderReference: '1045', receiverName: COOK, ...ok, temperatureClass: 'ambient', measuredTemperature: '', accepted: true, status: 'completed', qualityNotes: '', correctiveAction: '',
      items: [item('kri-7', 'kp-8', 15, { expiry: null }), item('kri-8', 'kp-9', 20, { expiry: null }), item('kri-9', 'kp-10', 40, { expiry: null })] },
    { id: 'kr-5', code: 'PAR-0005', supplierId: 'sup-demo-9', receivedOn: day(-2), receivedTime: '07:35', orderReference: '1046', receiverName: CHEF, ...ok, temperatureClass: 'chilled', measuredTemperature: '3', accepted: true, status: 'completed', qualityNotes: '', correctiveAction: '',
      items: [item('kri-10', 'kp-4', 14, { batch: 'P-0419', expiry: 3, temperature: 3, base: -2 }), item('kri-11', 'kp-1', 18, { batch: 'L2410-131', expiry: 5, temperature: 2, base: -2 })] },
    { id: 'kr-6', code: 'PAR-0006', supplierId: 'sup-demo-7', receivedOn: day(-1), receivedTime: '06:50', orderReference: '1047', receiverName: COOK, ...ok, vehicleCheck: 'noncompliant', temperatureClass: 'chilled', measuredTemperature: '5', accepted: true, status: 'completed',
      qualityNotes: 'Το ψυγείο του οχήματος έδειχνε 8 °C· τα προϊόντα μετρήθηκαν στους 5 °C.', correctiveAction: 'Ενημερώθηκε ο προμηθευτής· καταγράφηκε μη συμμόρφωση και ζητήθηκε έλεγχος του οχήματος.',
      items: [item('kri-12', 'kp-6', 30, { batch: 'G-0918', expiry: 6, temperature: 5, base: -1 })] },
    // Today: the meat delivery with one batch out of limits (rejected) and one accepted.
    { id: 'kr-7', code: 'PAR-0007', supplierId: 'sup-demo-9', receivedOn: day(0), receivedTime: '07:30', orderReference: '1048', receiverName: CHEF, ...ok, temperatureCheck: 'noncompliant', temperatureClass: 'chilled', measuredTemperature: '6.5', accepted: true, status: 'completed',
      qualityNotes: 'Ο κιμάς μετρήθηκε στους 7,5 °C στον πυρήνα.', correctiveAction: 'Ο κιμάς επιστράφηκε στον προμηθευτή· το κοτόπουλο (3 °C) έγινε δεκτό. Αναφορά μη συμμόρφωσης προμηθευτή.',
      items: [item('kri-13', 'kp-1', 16, { batch: 'L2410-140', expiry: 6, temperature: 3 }), item('kri-14', 'kp-3', 6, { batch: 'K-5590', expiry: 4, temperature: 7.5, accepted: false, rejectionReason: 'Θερμοκρασία 7,5 °C (όριο ≤ 5 °C): επιστροφή στον προμηθευτή.' })] },
  ].map(receipt => ({ ...receipt, supplierName: suppliers.find(row => row.id === receipt.supplierId)?.name || '', source: 'demo' }))

  const weekday = offset => { const d = new Date(`${day(offset)}T12:00:00`); return ((d.getDay() + 6) % 7) + 1 }
  // The n-th menu is the one cooked n − 7 days from today, so the week's records match their menus.
  const menus = MENUS.map((menuText, index) => ({ id: `km-${index + 1}`, name: ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'][weekday(index - 6) - 1], weekday: weekday(index - 6), menuText, active: true, notes: '', source: 'demo' }))
    .sort((a, b) => a.weekday - b.weekday)
  const productions = []
  for (let offset = -6; offset <= 3; offset += 1) {
    const menu = menus[weekday(offset) - 1]
    const verified = offset <= -2
    productions.push({
      id: `kd-${offset + 7}`, productionDate: day(offset), menuId: menu.id, menuText: menu.menuText, notes: offset === -1 ? 'Δύο επιπλέον μερίδες άναλης δίαιτας για την Παθολογική.' : '',
      disinfectionVegetables: offset <= 0, disinfectionFruit: offset <= 0, disinfectionAgent: offset <= 0 ? 'Διάλυμα χλωρίου' : '', disinfectionConcentrationPpm: offset <= 0 ? '100' : '', disinfectionMinutes: offset <= 0 ? '5' : '', disinfectionNotes: '',
      recordedByName: CHEF, source: 'demo',
      verifiedAt: verified ? at(offset, '15:30') : null, verifiedByName: verified ? MANAGER : null, verificationNotes: verified ? 'Όλες οι καταγραφές πλήρεις.' : '',
      meals: [
        { id: `kme-${offset + 7}-1`, meal: 'lunch', diet: 'normal', dish: menu.menuText.split('\n')[1], portions: '120', notes: '' },
        { id: `kme-${offset + 7}-2`, meal: 'lunch', diet: 'diabetic', dish: `${menu.menuText.split('\n')[1]} (χωρίς σάλτσα)`, portions: '18', notes: '' },
        { id: `kme-${offset + 7}-3`, meal: 'lunch', diet: 'puree', dish: `${menu.menuText.split('\n')[1]} (πολτός)`, portions: '9', notes: '' },
        { id: `kme-${offset + 7}-4`, meal: 'dinner', diet: 'normal', dish: menu.menuText.split('\n')[5] || '', portions: '110', notes: '' },
      ].filter(meal => meal.dish),
    })
  }
  const dayId = offset => `kd-${offset + 7}`
  const usage = [
    [-6, 'kri-1', 6, 'Κοτόπουλο λεμονάτο'], [-6, 'kri-3', 4, 'Ρυζόγαλο'], [-5, 'kri-2', 5, 'Μοσχάρι κοκκινιστό με κριθαράκι'], [-5, 'kri-1', 5, 'Κοτόσουπα'],
    [-4, 'kri-6', 6, 'Ψάρι φιλέτο φούρνου'], [-4, 'kri-3', 6, 'Πουρές'], [-3, 'kri-1', 7, 'Κεφτεδάκια κοτόπουλο'], [-3, 'kri-10', 0, ''], [-3, 'kri-9', 12, 'Πουρές'],
    [-2, 'kri-10', 9, 'Χοιρινή μπριζόλα σχάρας'], [-2, 'kri-7', 6, 'Σαλάτα εποχής'], [-1, 'kri-5', 12, 'Κοτόπουλο φούρνου με πατάτες'], [-1, 'kri-9', 15, 'Κοτόπουλο φούρνου με πατάτες'], [-1, 'kri-3', 8, 'Ρυζόγαλο'],
    [0, 'kri-11', 10, 'Μοσχάρι λεμονάτο με πουρέ'], [0, 'kri-9', 8, 'Πουρές'], [0, 'kri-12', 6, 'Γιαούρτι'],
  ].filter(([, , quantity]) => quantity > 0).map(([offset, receiptItemId, quantity, dishName], index) => {
    const found = receipts.flatMap(receipt => receipt.items).find(row => row.id === receiptItemId)
    return { id: `ku-${index + 1}`, productionId: dayId(offset), receiptItemId, productId: found.productId, productName: found.productName, lotLabel: found.batchCode, dishName, usedOn: day(offset), quantity: String(quantity), unit: found.unit, notes: '', recordedByName: COOK, source: 'demo' }
  })
  const thermal = [
    [-6, 'Κοτόπουλο λεμονάτο', 86, '', '', '', '12:10'], [-6, 'Ρυζόγαλο', 88, 6, 75, '', '10:30'], [-5, 'Μοσχάρι κοκκινιστό', 89, '', '', '', '12:00'], [-5, 'Κοτόσουπα', 92, '', 84, '', '18:20'],
    [-4, 'Ψάρι φιλέτο φούρνου', 82, '', '', '', '12:15'], [-3, 'Κεφτεδάκια κοτόπουλο', 84, 5, 90, '', '11:40'], [-3, 'Πατάτες τηγανητές', '', '', '', 175, '12:05'],
    [-2, 'Χοιρινή μπριζόλα σχάρας', 80, '', '', '', '12:20'], [-1, 'Κοτόπουλο φούρνου με πατάτες', 71, '', '', '', '12:10', 'Το μαγείρεμα συνεχίστηκε 15′ ως τους 84 °C και ξαναμετρήθηκε πριν τη διανομή.'],
    [-1, 'Ρυζόγαλο', 87, 7, 60, '', '10:20'], [0, 'Μοσχάρι λεμονάτο', 85, '', '', '', '11:55'], [0, 'Κοτόσουπα (αναθέρμανση)', '', '', '', '', '18:10', '', 79],
  ].map(([offset, dishName, cookingTemp, chillTemp, chillMinutes, fryingTemp, processTime, correctiveAction = '', reheatTemp = ''], index) => ({
    id: `kt-${index + 1}`, productionId: dayId(offset), processDate: day(offset), processTime, dishName, productId: '', cookingTemp: String(cookingTemp), chillTemp: String(chillTemp), chillMinutes: String(chillMinutes), reheatTemp: String(reheatTemp), fryingTemp: String(fryingTemp),
    correctiveAction, notes: '', recordedByName: COOK, source: 'demo' }))
  const pureeing = [-6, -5, -4, -3, -2, -1, 0].map((offset, index) => ({ id: `kpu-${index + 1}`, productionId: dayId(offset), pureedOn: day(offset), method: index % 3 === 2 ? 'sieving' : 'pureeing', productName: ['Κοτόπουλο λεμονάτο', 'Μοσχάρι κοκκινιστό', 'Ψάρι φιλέτο', 'Κεφτεδάκια κοτόπουλο', 'Χοιρινό με πουρέ', 'Κοτόπουλο φούρνου', 'Μοσχάρι λεμονάτο'][index], visualCheck: true, bladeCheck: true, correctiveAction: '', notes: '', recordedByName: COOK, source: 'demo' }))
  const defrosting = [
    { id: 'kf-1', productId: 'kp-2', productName: product('kp-2').name, receiptItemId: 'kri-5', quantity: '12', unit: 'kg', method: 'refrigerator', startedAt: at(-3, '20:00'), startTemp: '-18', endedAt: at(-2, '08:30'), endTemp: '-1', verifiedAt: at(-2, '09:10'), verifiedByName: MANAGER },
    { id: 'kf-2', productId: 'kp-5', productName: product('kp-5').name, receiptItemId: 'kri-6', quantity: '6', unit: 'kg', method: 'refrigerator', startedAt: at(-5, '20:10'), startTemp: '-19', endedAt: at(-4, '08:00'), endTemp: '0', verifiedAt: at(-4, '09:00'), verifiedByName: MANAGER },
    { id: 'kf-3', productId: 'kp-2', productName: product('kp-2').name, receiptItemId: 'kri-5', quantity: '10', unit: 'kg', method: 'refrigerator', startedAt: at(-1, '20:15'), startTemp: '-17', endedAt: at(0, '08:00'), endTemp: '-2', verifiedAt: null, verifiedByName: null },
    { id: 'kf-4', productId: 'kp-5', productName: product('kp-5').name, receiptItemId: 'kri-6', quantity: '5', unit: 'kg', method: 'running_water', startedAt: at(0, '09:30'), startTemp: '-18', endedAt: at(0, '11:00'), endTemp: '7', verifiedAt: null, verifiedByName: null, correctiveAction: 'Μαγειρεύτηκε αμέσως (πυρήνας 82 °C)· η απόψυξη σε νερό γίνεται μόνο για άμεσο μαγείρεμα.' },
    { id: 'kf-5', productId: 'kp-2', productName: product('kp-2').name, receiptItemId: 'kri-5', quantity: '8', unit: 'kg', method: 'refrigerator', startedAt: at(0, '20:00'), startTemp: '-18', endedAt: '', endTemp: '', verifiedAt: null, verifiedByName: null },
  ].map(row => ({ correctiveAction: '', notes: '', productionId: '', recordedByName: COOK, source: 'demo', ...row }))
  const writeoffs = [{ id: 'kw-1', receiptItemId: 'kri-2', writtenOffOn: day(-2), quantity: '1', reason: 'expired', notes: 'Το υπόλοιπο έληξε· απορρίφθηκε.', recordedByName: CHEF }]
  const state = {
    settings: { expiryWarningDays: 2, haccpReviewMonths: 12, haccpLastReviewOn: day(-340), haccpDocumentId: '', haccpTeam: `${MANAGER} (υπεύθυνη κουζίνας), Υπεύθυνος Ποιότητας, Νοσηλεύτρια Επιτήρησης Λοιμώξεων`, recallDrillMonths: 12, notes: '' },
    limits: DEFAULT_LIMITS.map(item => ({ limitKey: item.limitKey, minValue: item.minValue, maxValue: item.maxValue, withinMinutes: item.withinMinutes, active: true })),
    steps: DEFAULT_HACCP_STEPS.map(step => ({ ...step })),
    products, menus, receipts, writeoffs, productions, usage, thermal, pureeing, defrosting, suppliers,
  }
  return { ...state, recallDrills: recallDemoDrills(state) }
}

// Two recall drills: a passed one this week (a supplier's chicken lot, traced in 95′) and
// an older failed one (a dish, traced in 290′ against the 4-hour target).
function recallDemoDrills(state) {
  return [
    { id: 'krd-1', code: 'ANK-0001', drillDate: day(-220), startedAt: at(-220, '09:00'), finishedAt: at(-220, '13:50'), scenario: 'dish', triggerText: 'Κρούσμα γαστρεντερίτιδας σε δύο ασθενείς μετά το βραδινό· έλεγχος του ρυζόγαλου.', receiptItemId: '', productId: '', productName: '', dishName: 'Ρυζόγαλο', targetMinutes: '240', stockCounts: {},
      notified: 'Υπεύθυνος Ποιότητας, Επιτροπή Λοιμώξεων, προμηθευτής γάλακτος.', actions: 'Ιχνηλατήθηκαν οι παρτίδες γάλακτος· δεν βρέθηκαν οι μερίδες της πολτώδους δίαιτας στο πλάνο.', result: 'fail', lessons: 'Το πλάνο γευμάτων να γράφει πάντα τις μερίδες ανά δίαιτα· οι καταναλώσεις να καταχωρίζονται με την παρτίδα την ίδια ώρα.', conductedByName: MANAGER, status: 'completed', notes: '' },
    { id: 'krd-2', code: 'ANK-0002', drillDate: day(-2), startedAt: at(-2, '10:00'), finishedAt: at(-2, '11:35'), scenario: 'supplier_lot', triggerText: 'Ειδοποίηση προμηθευτή για μολυσμένη παρτίδα (Salmonella) στο στήθος κοτόπουλο L2410-118.', receiptItemId: 'kri-1', productId: 'kp-1', productName: 'Στήθος κοτόπουλο φιλέτο', dishName: '', targetMinutes: '240', stockCounts: { 'kri-1': '2' },
      notified: 'Υπεύθυνος Ποιότητας, Διοίκηση, Ομάδα Πρόληψης Λοιμώξεων, προμηθευτής (Κρεατεμπορική Θεσσαλίας).', actions: 'Το υπόλοιπο (2 kg) απομονώθηκε στον θάλαμο ψύξης με σήμανση «ΔΕΣΜΕΥΜΕΝΟ»· βρέθηκαν οι ημέρες και τα γεύματα που σερβιρίστηκε.', result: 'pass', lessons: 'Η ιχνηλάτηση ολοκληρώθηκε εντός στόχου· να προστεθεί στη διαδικασία το τηλέφωνο του προμηθευτή εκτός ωραρίου.', conductedByName: MANAGER, status: 'completed', notes: '' },
  ].map(drill => ({ ...drill, conductedByEmployeeId: '', ...drillFindings(drill, recallTrace(state, drill)) }))
}
