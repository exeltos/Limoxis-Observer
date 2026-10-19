// Kitchen documents on the shared report layout (core/export/reportDocument.js) and the
// Excel files of the lists. Pure: each returns a document description or the rows.
import { exportRegistry } from '../../core/export/registryExports'
import { limitFor, limitText, statusLabel } from './kitchenLimits'
import { RECEIPT_CHECK_FIELDS, checkLabel, dayRecords, defrostMethodLabel, dietLabel, fmtQty, fmtTemp, mealLabel, pureeMethodLabel, receiptResultLabel, storageLabel, unitLabel, weekdayLabel, weekdayOf, writeoffReasonLabel } from './kitchenModel'

const day = value => { if (!value) return '—'; const [y, m, d] = String(value).slice(0, 10).split('-'); return `${d}/${m}/${y}` }
const stamp = (value, language) => { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) }
const time = value => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const status = (value, language) => ({ text: statusLabel(value, language), className: value === 'out' ? 'rd-bad' : '' })
const t = (value, text) => (value !== '' && value != null ? fmtTemp(value) : text || '—')

// The daily HACCP sheet of a production day: receipts, raw materials, heat parameters,
// defrosts, pureeing, disinfection, what was out of limits with its corrective action,
// and the day's verification.
export function dailyHaccpDocument(state, production, { language = 'el' } = {}) {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const records = dayRecords(state, production)
  const limits = state.limits
  const out = [
    ...records.receipts.filter(row => row.limitStatus === 'out').map(row => [L('Παραλαβή', 'Receipt'), `${row.code} · ${row.supplierName || ''}`, row.correctiveAction || row.qualityNotes || '—']),
    ...records.thermal.filter(row => row.limitStatus === 'out').map(row => [L('Θερμική επεξεργασία', 'Heat treatment'), row.dishName, row.correctiveAction || '—']),
    ...records.defrosting.filter(row => row.limitStatus === 'out').map(row => [L('Απόψυξη', 'Defrosting'), row.productName, row.correctiveAction || '—']),
    ...records.pureeing.filter(row => row.limitStatus === 'out').map(row => [L('Πολτοποίηση', 'Pureeing'), row.productName, row.correctiveAction || '—']),
  ]
  return {
    language,
    kind: L('Ημερήσιο φύλλο HACCP κουζίνας', 'Daily kitchen HACCP sheet'),
    title: `${weekdayLabel(weekdayOf(production.productionDate), language)} ${day(production.productionDate)}`,
    code: `HACCP-${production.productionDate}`,
    orientation: 'landscape',
    meta: [
      [L('Ημερομηνία', 'Date'), day(production.productionDate)],
      [L('Καταγραφές', 'Records'), String(records.total)],
      [L('Εκτός ορίων', 'Out of limits'), String(records.outOfLimits)],
      [L('Επαλήθευση', 'Verification'), production.verifiedAt ? `${production.verifiedByName || '—'} · ${stamp(production.verifiedAt, language)}` : L('Εκκρεμεί', 'Pending')],
    ],
    sections: [
      { title: L('Μενού ημέρας', 'Menu of the day'), text: production.menuText || '—' },
      { title: L('Πλάνο γευμάτων', 'Meal plan'), table: { columns: [L('Γεύμα', 'Meal'), L('Δίαιτα', 'Diet'), L('Πιάτο', 'Dish'), { text: L('Μερίδες', 'Portions'), align: 'right' }], rows: (production.meals || []).map(row => [mealLabel(row.meal, language), dietLabel(row.diet, language), row.dish, { text: row.portions || '—', align: 'right' }]), empty: L('Χωρίς πλάνο γευμάτων.', 'No meal plan.') } },
      { title: L('Παραλαβές', 'Receipts'), table: { columns: [L('Κωδικός', 'Code'), L('Ώρα', 'Time'), L('Προμηθευτής', 'Supplier'), L('Έλεγχοι', 'Checks'), L('Θερμοκρασία', 'Temperature'), L('Αποτέλεσμα', 'Result')],
        rows: records.receipts.map(row => [row.code, row.receivedTime || '—', row.supplierName || '—', RECEIPT_CHECK_FIELDS.map(item => `${item.label[en ? 1 : 0]}: ${checkLabel(row[item.field], language)}`).join(' · '), t(row.measuredTemperature, row.measuredTemperatureText), { text: receiptResultLabel(row.result, language), className: row.limitStatus === 'out' ? 'rd-bad' : '' }]), empty: L('Καμία παραλαβή.', 'No receipts.') } },
      { title: L('Πρώτες ύλες (ιχνηλασιμότητα)', 'Raw materials (traceability)'), table: { columns: [L('Προϊόν', 'Product'), L('Παρτίδα', 'Batch'), { text: L('Ποσότητα', 'Quantity'), align: 'right' }, L('Πιάτο', 'Dish')],
        rows: records.usage.map(row => [row.productName, row.lotLabel || '—', { text: `${fmtQty(row.quantity, language)} ${unitLabel(row.unit, language)}`, align: 'right' }, row.dishName || '—']), empty: L('Καμία πρώτη ύλη.', 'No raw materials.') } },
      { title: L('Παράμετροι ζέστης', 'Heat parameters'), table: { columns: [L('Πιάτο', 'Dish'), L('Ώρα', 'Time'), `${L('Πυρήνας', 'Core')} (${limitText(limitFor(limits, 'cooking_core'), language)})`, `${L('Ψύξη', 'Chilling')} (${limitText(limitFor(limits, 'chilling'), language)})`, `${L('Αναθέρμανση', 'Reheating')} (${limitText(limitFor(limits, 'reheating'), language)})`, L('Τηγάνισμα', 'Frying'), L('Αποτέλεσμα', 'Result'), L('Διορθωτική ενέργεια', 'Corrective action')],
        rows: records.thermal.map(row => [row.dishName, row.processTime || '—', t(row.cookingTemp, row.cookingText), row.chillTemp !== '' ? `${fmtTemp(row.chillTemp)}${row.chillMinutes ? ` / ${row.chillMinutes}′` : ''}` : row.chillText || '—', t(row.reheatTemp, row.reheatText), t(row.fryingTemp, row.fryingText), status(row.limitStatus, language), row.correctiveAction || '—']), empty: L('Καμία θερμική επεξεργασία.', 'No heat treatments.') } },
      { title: L('Αποψύξεις', 'Defrosting'), table: { columns: [L('Προϊόν', 'Product'), { text: L('Ποσότητα', 'Quantity'), align: 'right' }, L('Μέθοδος', 'Method'), L('Έναρξη', 'Start'), L('Λήξη', 'End'), L('Αποτέλεσμα', 'Result'), L('Επαλήθευση HACCP', 'HACCP sign-off')],
        rows: records.defrosting.map(row => [row.productName, { text: `${fmtQty(row.quantity, language)} ${unitLabel(row.unit, language)}`, align: 'right' }, defrostMethodLabel(row.method, language), `${stamp(row.startedAt, language)} · ${t(row.startTemp, row.startText)}`, row.endedAt ? `${stamp(row.endedAt, language)} · ${t(row.endTemp, row.endText)}` : L('Σε εξέλιξη', 'In progress'), status(row.limitStatus, language), row.verifiedAt ? `${row.verifiedByName || '—'} · ${stamp(row.verifiedAt, language)}` : '—']), empty: L('Καμία απόψυξη.', 'No defrosting.') } },
      { title: L('Πολτοποίηση / σούρωμα', 'Pureeing / sieving'), table: { columns: [L('Προϊόν', 'Product'), L('Μέθοδος', 'Method'), L('Οπτικός έλεγχος', 'Visual check'), L('Έλεγχος λεπίδας', 'Blade check'), L('Αποτέλεσμα', 'Result')],
        rows: records.pureeing.map(row => [row.productName, pureeMethodLabel(row.method, language), row.visualCheck == null ? '—' : row.visualCheck ? L('Ναι', 'Yes') : L('Όχι', 'No'), row.bladeCheck == null ? '—' : row.bladeCheck ? L('Ναι', 'Yes') : L('Όχι', 'No'), status(row.limitStatus, language)]), empty: L('Καμία πολτοποίηση.', 'No pureeing.') } },
      { title: L('Απολύμανση λαχανικών και φρούτων', 'Disinfection of vegetables and fruit'), facts: [
        [L('Λαχανικά', 'Vegetables'), production.disinfectionVegetables ? L('Ναι', 'Yes') : L('Όχι', 'No')], [L('Φρούτα', 'Fruit'), production.disinfectionFruit ? L('Ναι', 'Yes') : L('Όχι', 'No')],
        [L('Απολυμαντικό', 'Agent'), production.disinfectionAgent || '—'], [L('Συγκέντρωση', 'Concentration'), production.disinfectionConcentrationPpm ? `${production.disinfectionConcentrationPpm} ppm` : '—'], [L('Χρόνος επαφής', 'Contact time'), production.disinfectionMinutes ? `${production.disinfectionMinutes}′` : '—']] },
      { title: L('Εκτός ορίων και διορθωτικές ενέργειες', 'Out of limits and corrective actions'), table: { columns: [L('Είδος', 'Kind'), L('Καταγραφή', 'Record'), L('Διορθωτική ενέργεια', 'Corrective action')], rows: out, empty: L('Όλες οι μετρήσεις εντός ορίων.', 'Every measurement within limits.') } },
      { title: L('Σημειώσεις', 'Notes'), text: [production.notes, production.verificationNotes].filter(Boolean).join('\n') || '—' },
    ],
    signatures: [{ role: L('Συντάχθηκε (μάγειρας βάρδιας)', 'Recorded by (shift cook)'), name: production.recordedByName || '' }, { role: L('Επαληθεύτηκε (υπεύθυνος κουζίνας / ποιότητας)', 'Verified by (kitchen / quality manager)'), name: production.verifiedByName || '', date: production.verifiedAt ? stamp(production.verifiedAt, language) : '' }],
    filename: `HACCP_${production.productionDate}`,
  }
}

// The receipts log of a period: one line per received product.
export function receiptsLogDocument(receipts, { from = '', to = '', language = 'el' } = {}) {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const rows = receipts.flatMap(receipt => (receipt.items?.length ? receipt.items : [null]).map((item, index) => [
    index ? '' : `${day(receipt.receivedOn)} ${receipt.receivedTime || ''}`.trim(), index ? '' : receipt.code, index ? '' : receipt.supplierName || '—',
    item ? item.productName : '—', item ? item.batchCode || item.lotLabel || '—' : '', item ? day(item.expiryOn) : '', item ? { text: `${fmtQty(item.quantity, language)} ${unitLabel(item.unit, language)}`, align: 'right' } : '',
    item ? t(item.temperature, item.temperatureText) : '', item ? (item.accepted === false ? { text: `${L('Απορρίφθηκε', 'Rejected')}: ${item.rejectionReason || ''}`, className: 'rd-bad' } : L('Αποδεκτό', 'Accepted')) : '',
    index ? '' : { text: receiptResultLabel(receipt.result, language), className: receipt.limitStatus === 'out' ? 'rd-bad' : '' },
  ]))
  return {
    language, kind: L('Βιβλίο παραλαβών κουζίνας', 'Kitchen receipts log'), title: L('Παραλαβές πρώτων υλών', 'Raw material receipts'), code: 'KIT-PAR', orientation: 'landscape',
    meta: [[L('Περίοδος', 'Period'), `${day(from)} – ${day(to)}`], [L('Παραλαβές', 'Receipts'), String(receipts.length)], [L('Με μη συμμόρφωση', 'Nonconforming'), String(receipts.filter(row => row.limitStatus === 'out').length)], [L('Απορρίφθηκαν', 'Rejected'), String(receipts.filter(row => row.result === 'rejected').length)]],
    sections: [{ title: L('Παραλαβές', 'Receipts'), table: { columns: [L('Ημερομηνία', 'Date'), L('Κωδικός', 'Code'), L('Προμηθευτής', 'Supplier'), L('Προϊόν', 'Product'), L('Παρτίδα', 'Batch'), L('Λήξη', 'Expiry'), { text: L('Ποσότητα', 'Quantity'), align: 'right' }, L('Θερμοκρασία', 'Temperature'), L('Προϊόν δεκτό', 'Product accepted'), L('Αποτέλεσμα', 'Result')], rows, empty: L('Καμία παραλαβή στην περίοδο.', 'No receipts in the period.') } }],
    signatures: [L('Υπεύθυνος κουζίνας', 'Kitchen manager'), L('Υπεύθυνος Ποιότητας', 'Quality manager')],
    filename: `${en ? 'receipts' : 'paralaves'}_${from}_${to}`,
  }
}

// Traceability of a batch: supplier → receipt → where it was used → write-offs.
export function traceabilityDocument(trace, { language = 'el' } = {}) {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const b = trace.batch
  return {
    language, kind: L('Ιχνηλασιμότητα παρτίδας', 'Batch traceability'), title: b?.productName || '—', code: b?.receiptCode || '',
    meta: [[L('Προμηθευτής', 'Supplier'), b?.supplierName || '—'], [L('Παραλαβή', 'Received'), day(b?.receivedOn)], [L('Παρτίδα', 'Batch'), b?.batchCode || b?.lotLabel || '—'], [L('Λήξη', 'Expiry'), day(b?.expiryOn)],
      [L('Παραλήφθηκε', 'Received qty'), `${fmtQty(b?.received, language)} ${unitLabel(b?.unit, language)}`], [L('Χρησιμοποιήθηκε', 'Used'), fmtQty(b?.used, language)], [L('Απόσυρση', 'Written off'), fmtQty(b?.writtenOff, language)], [L('Υπόλοιπο', 'Remaining'), fmtQty(b?.remaining, language)], [L('Αποθήκευση', 'Storage'), storageLabel(b?.storage, language)]],
    sections: [
      { title: L('Πού χρησιμοποιήθηκε', 'Where it was used'), table: { columns: [L('Ημέρα', 'Day'), L('Πιάτο', 'Dish'), { text: L('Ποσότητα', 'Quantity'), align: 'right' }, L('Από', 'By')], rows: trace.uses.map(row => [day(row.usedOn), row.dishName || '—', { text: `${fmtQty(row.quantity, language)} ${unitLabel(row.unit, language)}`, align: 'right' }, row.recordedByName || '—']), empty: L('Δεν χρησιμοποιήθηκε.', 'Not used.') } },
      { title: L('Θερμική επεξεργασία των ημερών', 'Heat treatment on those days'), table: { columns: [L('Ημέρα', 'Day'), L('Πιάτο', 'Dish'), L('Πυρήνας', 'Core'), L('Αποτέλεσμα', 'Result')], rows: trace.thermal.map(row => [day(row.processDate), row.dishName, t(row.cookingTemp, row.cookingText), status(row.limitStatus, language)]), empty: '—' } },
      { title: L('Αποσύρσεις / απορρίψεις', 'Write-offs'), table: { columns: [L('Ημέρα', 'Day'), { text: L('Ποσότητα', 'Quantity'), align: 'right' }, L('Αιτία', 'Reason'), L('Σημειώσεις', 'Notes')], rows: trace.writeoffs.map(row => [day(row.writtenOffOn), { text: fmtQty(row.quantity, language), align: 'right' }, writeoffReasonLabel(row.reason, language), row.notes || '—']), empty: L('Καμία.', 'None.') } },
    ],
    signatures: [L('Υπεύθυνος κουζίνας', 'Kitchen manager')],
    filename: `${en ? 'traceability' : 'ichnilasimotita'}_${b?.receiptCode || ''}`,
  }
}

// --- Excel ----------------------------------------------------------------------------------
const yes = (value, en) => (value == null ? '' : value ? (en ? 'Yes' : 'Ναι') : (en ? 'No' : 'Όχι'))
export function exportKitchenList(kind, rows, language = 'el') {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const sheets = {
    receipts: { name: L('paralaves', 'receipts'), headers: [L('Κωδικός', 'Code'), L('Ημερομηνία', 'Date'), L('Ώρα', 'Time'), L('Προμηθευτής', 'Supplier'), L('Αρ. παραγγελίας', 'Order no.'), L('Παρέλαβε', 'Received by'), ...RECEIPT_CHECK_FIELDS.map(item => item.label[en ? 1 : 0]), L('Θερμοκρασία °C', 'Temperature °C'), L('Προϊόντα', 'Products'), L('Αποτέλεσμα', 'Result'), L('Όρια', 'Limits'), L('Παρατηρήσεις', 'Notes'), L('Διορθωτική ενέργεια', 'Corrective action')],
      row: r => [r.code, r.receivedOn, r.receivedTime, r.supplierName, r.orderReference, r.receiverName, ...RECEIPT_CHECK_FIELDS.map(item => checkLabel(r[item.field], language)), r.measuredTemperature, (r.items || []).length, receiptResultLabel(r.result, language), statusLabel(r.limitStatus, language), r.qualityNotes, r.correctiveAction] },
    stock: { name: L('apothema', 'stock'), headers: [L('Ημ/νία παραλαβής', 'Received'), L('Παραλαβή', 'Receipt'), L('Προϊόν', 'Product'), L('Προμηθευτής', 'Supplier'), L('Παρτίδα', 'Batch'), L('Λήξη', 'Expiry'), L('Μονάδα', 'Unit'), L('Ποσότητα', 'Quantity'), L('Καταναλώσεις', 'Used'), L('Αποσύρσεις', 'Written off'), L('Υπόλοιπο', 'Remaining')],
      row: r => [r.receivedOn, r.receiptCode, r.productName, r.supplierName, r.batchCode || r.lotLabel, r.expiryOn, unitLabel(r.unit, language), r.received, r.used, r.writtenOff, r.remaining] },
    thermal: { name: L('thermikes', 'heat-treatments'), headers: [L('Ημερομηνία', 'Date'), L('Ώρα', 'Time'), L('Πιάτο', 'Dish'), L('Πυρήνας °C', 'Core °C'), L('Ψύξη °C', 'Chilling °C'), L('Ψύξη λεπτά', 'Chilling min'), L('Αναθέρμανση °C', 'Reheating °C'), L('Τηγάνισμα °C', 'Frying °C'), L('Μη αναγνώσιμη τιμή', 'Unparsed value'), L('Αποτέλεσμα', 'Result'), L('Διορθωτική ενέργεια', 'Corrective action'), L('Από', 'By')],
      row: r => [r.processDate, r.processTime, r.dishName, r.cookingTemp, r.chillTemp, r.chillMinutes, r.reheatTemp, r.fryingTemp, [r.cookingText, r.chillText, r.reheatText, r.fryingText].filter(Boolean).join(' · '), statusLabel(r.limitStatus, language), r.correctiveAction, r.recordedByName] },
    defrosting: { name: L('apopsyxeis', 'defrosting'), headers: [L('Προϊόν', 'Product'), L('Ποσότητα', 'Quantity'), L('Μέθοδος', 'Method'), L('Έναρξη', 'Start'), L('Θερμ. έναρξης', 'Start temp'), L('Λήξη', 'End'), L('Θερμ. λήξης', 'End temp'), L('Αποτέλεσμα', 'Result'), L('Διορθωτική ενέργεια', 'Corrective action'), L('Επαλήθευση HACCP', 'HACCP sign-off'), L('Επαληθεύτηκε', 'Signed at')],
      row: r => [r.productName, r.quantity, defrostMethodLabel(r.method, language), `${String(r.startedAt || '').slice(0, 10)} ${time(r.startedAt)}`, r.startTemp, r.endedAt ? `${String(r.endedAt).slice(0, 10)} ${time(r.endedAt)}` : '', r.endTemp, statusLabel(r.limitStatus, language), r.correctiveAction, r.verifiedByName, r.verifiedAt ? stamp(r.verifiedAt, language) : ''] },
    pureeing: { name: L('poltopoiiseis', 'pureeing'), headers: [L('Ημερομηνία', 'Date'), L('Προϊόν', 'Product'), L('Μέθοδος', 'Method'), L('Οπτικός έλεγχος', 'Visual check'), L('Έλεγχος λεπίδας', 'Blade check'), L('Αποτέλεσμα', 'Result'), L('Διορθωτική ενέργεια', 'Corrective action'), L('Από', 'By')],
      row: r => [r.pureedOn, r.productName, pureeMethodLabel(r.method, language), yes(r.visualCheck, en), yes(r.bladeCheck, en), statusLabel(r.limitStatus, language), r.correctiveAction, r.recordedByName] },
    usage: { name: L('ylika-se-xrisi', 'materials-used'), headers: [L('Ημέρα', 'Day'), L('Προϊόν', 'Product'), L('Παρτίδα', 'Batch'), L('Παραλαβή', 'Receipt'), L('Προμηθευτής', 'Supplier'), L('Ποσότητα', 'Quantity'), L('Μονάδα', 'Unit'), L('Πιάτο', 'Dish'), L('Από', 'By')],
      row: r => [r.usedOn, r.productName, r.lotLabel, r.batch?.receiptCode || '', r.batch?.supplierName || '', r.quantity, unitLabel(r.unit, language), r.dishName, r.recordedByName] },
    products: { name: L('proionta', 'products'), headers: [L('Προϊόν', 'Product'), L('Κατηγορία', 'Category'), L('Αποθήκευση', 'Storage'), L('Μονάδα', 'Unit'), L('Προμηθευτής', 'Supplier'), L('Κωδικός προμηθευτή', 'Supplier code'), L('Όριο αποθέματος', 'Low stock at'), L('Ενεργό', 'Active')],
      row: r => [r.name, r.categoryLabel, storageLabel(r.storage, language), unitLabel(r.unit, language), r.supplierName, r.supplierCode, r.lowStockQuantity, yes(r.active !== false, en)] },
  }
  const sheet = sheets[kind]
  exportRegistry({ name: `${en ? 'kitchen' : 'kouzina'}-${sheet.name}`, headers: sheet.headers, rows: rows.map(sheet.row) })
}
