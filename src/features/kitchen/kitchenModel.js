// The kitchen (HACCP) model: vocabularies, new entries, stock per received batch,
// FIFO, traceability, the verification queue and the overview. Pure functions.
import { defrostStatus, itemStatus, pureeingStatus, receiptStatus, resolveLimits, thermalStatuses } from './kitchenLimits'

const L = (el, en) => [el, en]
const pick = (list, value, language) => list.find(item => item.value === value)?.label[language === 'en' ? 1 : 0] || value || '—'

export const CHECK_RESULTS = Object.freeze([{ value: 'compliant', label: L('Συμμόρφωση', 'Compliant') }, { value: 'noncompliant', label: L('Μη συμμόρφωση', 'Nonconforming') }])
export const RECEIPT_CHECK_FIELDS = Object.freeze([
  { field: 'temperatureCheck', label: L('Θερμοκρασία', 'Temperature') },
  { field: 'packagingCheck', label: L('Συσκευασία', 'Packaging') },
  { field: 'expiryCheck', label: L('Ημερομηνίες λήξης', 'Expiry dates') },
  { field: 'vehicleCheck', label: L('Όχημα διανομής', 'Delivery vehicle') },
  { field: 'codingCheck', label: L('Κωδικοποίηση / επισήμανση', 'Coding / labelling') },
])
export const TEMPERATURE_CLASSES = Object.freeze([
  { value: 'chilled', label: L('Ψυχόμενο', 'Chilled') }, { value: 'frozen', label: L('Κατεψυγμένο', 'Frozen') },
  { value: 'hot', label: L('Ζεστό φαγητό', 'Hot food') }, { value: 'ambient', label: L('Θερμοκρασία περιβάλλοντος', 'Ambient') },
])
export const STORAGES = Object.freeze([{ value: 'chilled', label: L('Ψύξη', 'Chilled') }, { value: 'frozen', label: L('Κατάψυξη', 'Frozen') }, { value: 'ambient', label: L('Ξηρή αποθήκη', 'Ambient') }])
export const UNITS = Object.freeze([{ value: 'kg', label: L('Κιλά', 'kg') }, { value: 'pcs', label: L('Τεμάχια', 'Pieces') }, { value: 'l', label: L('Λίτρα', 'Litres') }])
export const PRODUCT_CATEGORIES = Object.freeze([
  { value: 'meat', label: L('Κρέας', 'Meat') }, { value: 'poultry', label: L('Πουλερικά', 'Poultry') }, { value: 'fish', label: L('Ψάρια', 'Fish') },
  { value: 'dairy', label: L('Γαλακτοκομικά', 'Dairy') }, { value: 'eggs', label: L('Αυγά', 'Eggs') }, { value: 'vegetables', label: L('Λαχανικά', 'Vegetables') },
  { value: 'fruit', label: L('Φρούτα', 'Fruit') }, { value: 'dry', label: L('Ξηρά τρόφιμα', 'Dry goods') }, { value: 'bakery', label: L('Αρτοσκευάσματα', 'Bakery') },
  { value: 'frozen', label: L('Κατεψυγμένα', 'Frozen goods') }, { value: 'beverages', label: L('Ποτά', 'Beverages') }, { value: 'other', label: L('Άλλο', 'Other') },
])
export const DEFROST_METHODS = Object.freeze([
  { value: 'refrigerator', label: L('Συντήρηση (ψυγείο)', 'Refrigerator') }, { value: 'microwave', label: L('Φούρνος μικροκυμάτων', 'Microwave') },
  { value: 'running_water', label: L('Τρεχούμενο νερό', 'Running water') }, { value: 'cooking', label: L('Κατά το μαγείρεμα', 'During cooking') },
])
export const PUREE_METHODS = Object.freeze([{ value: 'pureeing', label: L('Πολτοποίηση', 'Pureeing') }, { value: 'sieving', label: L('Σούρωμα', 'Sieving') }])
export const MEALS = Object.freeze([{ value: 'breakfast', label: L('Πρωινό', 'Breakfast') }, { value: 'lunch', label: L('Μεσημεριανό', 'Lunch') }, { value: 'dinner', label: L('Βραδινό', 'Dinner') }, { value: 'snack', label: L('Ενδιάμεσο', 'Snack') }])
export const DIETS = Object.freeze([
  { value: 'normal', label: L('Κανονική', 'Normal') }, { value: 'diabetic', label: L('Διαβητική', 'Diabetic') }, { value: 'low_salt', label: L('Άναλη', 'Low salt') },
  { value: 'soft', label: L('Μαλακή', 'Soft') }, { value: 'puree', label: L('Πολτώδης', 'Puréed') }, { value: 'gluten_free', label: L('Χωρίς γλουτένη', 'Gluten free') },
  { value: 'vegetarian', label: L('Χορτοφαγική', 'Vegetarian') }, { value: 'other', label: L('Άλλη', 'Other') },
])
export const WRITEOFF_REASONS = Object.freeze([
  { value: 'expired', label: L('Λήξη', 'Expired') }, { value: 'spoiled', label: L('Αλλοίωση / απόρριψη', 'Spoiled / discarded') }, { value: 'damaged', label: L('Κατεστραμμένη συσκευασία', 'Damaged packaging') },
  { value: 'temperature', label: L('Εκτός θερμοκρασίας', 'Temperature abuse') }, { value: 'recall', label: L('Ανάκληση', 'Recall') }, { value: 'other', label: L('Άλλο', 'Other') },
])
export const RECEIPT_RESULTS = Object.freeze([
  { value: 'accepted', label: L('Αποδεκτή', 'Accepted'), tone: 'success' }, { value: 'accepted_with_remarks', label: L('Αποδεκτή με παρατηρήσεις', 'Accepted with remarks'), tone: 'warning' },
  { value: 'rejected', label: L('Απορρίφθηκε', 'Rejected'), tone: 'danger' }, { value: 'pending', label: L('Σε εξέλιξη', 'In progress'), tone: 'info' },
])
export const WEEKDAYS = Object.freeze(['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'])
const WEEKDAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const checkLabel = (value, language) => pick(CHECK_RESULTS, value, language)
export const temperatureClassLabel = (value, language) => pick(TEMPERATURE_CLASSES, value, language)
export const storageLabel = (value, language) => pick(STORAGES, value, language)
export const unitLabel = (value, language) => pick(UNITS, value, language)
export const categoryLabel = (value, language) => pick(PRODUCT_CATEGORIES, value, language)
export const defrostMethodLabel = (value, language) => pick(DEFROST_METHODS, value, language)
export const pureeMethodLabel = (value, language) => pick(PUREE_METHODS, value, language)
export const mealLabel = (value, language) => pick(MEALS, value, language)
export const dietLabel = (value, language) => pick(DIETS, value, language)
export const writeoffReasonLabel = (value, language) => pick(WRITEOFF_REASONS, value, language)
export const receiptResultLabel = (value, language) => pick(RECEIPT_RESULTS, value, language)
export const receiptResultTone = value => RECEIPT_RESULTS.find(item => item.value === value)?.tone || 'neutral'
export const weekdayOf = date => { const d = new Date(`${String(date).slice(0, 10)}T12:00:00`); return Number.isNaN(d.getTime()) ? null : ((d.getDay() + 6) % 7) + 1 }
export const weekdayLabel = (weekday, language = 'el') => (weekday >= 1 && weekday <= 7 ? (language === 'en' ? WEEKDAYS_EN : WEEKDAYS)[weekday - 1] : '—')
export const options = (list, language) => list.map(item => ({ value: item.value, label: item.label[language === 'en' ? 1 : 0] }))

// --- Dates --------------------------------------------------------------------------------
const pad = n => String(n).padStart(2, '0')
export const todayKey = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
export const nowTime = (now = new Date()) => `${pad(now.getHours())}:${pad(now.getMinutes())}`
export const dayOf = value => {
  if (!value) return ''
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? '' : todayKey(date)
}
export const addDays = (day, days) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + days); return todayKey(d) }
export const daysBetween = (from, to) => Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000)
// A date and an HH:MM time as an ISO timestamp (local time).
export const combine = (day, time) => (day ? new Date(`${day}T${time || '00:00'}:00`).toISOString() : '')

// --- New entries --------------------------------------------------------------------------

export const newReceipt = (now = new Date()) => ({ id: '', code: '', supplierId: '', supplierName: '', receivedOn: todayKey(now), receivedTime: nowTime(now), orderReference: '', receiverEmployeeId: '', receiverName: '',
  temperatureCheck: 'compliant', packagingCheck: 'compliant', expiryCheck: 'compliant', vehicleCheck: 'compliant', codingCheck: 'compliant',
  temperatureClass: 'chilled', measuredTemperature: '', accepted: true, status: 'completed', qualityNotes: '', correctiveAction: '', items: [], source: 'app' })
export const newReceiptItem = () => ({ id: '', productId: '', productName: '', batchCode: '', expiryOn: '', quantity: '', unit: 'kg', storage: 'chilled', temperature: '', accepted: true, rejectionReason: '', notes: '' })
export const newProduction = (day = todayKey()) => ({ id: '', productionDate: day, menuId: '', menuText: '', notes: '', disinfectionVegetables: false, disinfectionFruit: false, disinfectionAgent: '', disinfectionConcentrationPpm: '', disinfectionMinutes: '', disinfectionNotes: '', meals: [], source: 'app' })
export const newMeal = () => ({ id: '', meal: 'lunch', diet: 'normal', dish: '', portions: '', notes: '' })
export const newUsage = (production = null) => ({ id: '', productionId: production?.id || '', receiptItemId: '', productId: '', productName: '', lotLabel: '', dishName: '', usedOn: production?.productionDate || todayKey(), quantity: '', unit: 'kg', notes: '', source: 'app' })
export const newThermal = (production = null, now = new Date()) => ({ id: '', productionId: production?.id || '', processDate: production?.productionDate || todayKey(now), processTime: nowTime(now), dishName: '', cookingTemp: '', chillTemp: '', chillMinutes: '', reheatTemp: '', fryingTemp: '', correctiveAction: '', notes: '', source: 'app' })
export const newPureeing = (production = null) => ({ id: '', productionId: production?.id || '', pureedOn: production?.productionDate || todayKey(), method: 'pureeing', productName: '', visualCheck: true, bladeCheck: true, correctiveAction: '', notes: '', source: 'app' })
export const newDefrost = (now = new Date()) => ({ id: '', productId: '', productName: '', receiptItemId: '', quantity: '', unit: 'kg', method: 'refrigerator', startDay: todayKey(now), startTime: nowTime(now), startTemp: '', endDay: '', endTime: '', endTemp: '', correctiveAction: '', notes: '', source: 'app' })
export const newWriteoff = item => ({ id: '', receiptItemId: item?.receiptItemId || item?.id || '', writtenOffOn: todayKey(), quantity: item?.remaining > 0 ? String(Math.round(item.remaining * 1000) / 1000) : '', reason: item?.expired ? 'expired' : 'spoiled', notes: '' })
export const newProduct = () => ({ id: '', name: '', category: 'meat', storage: 'chilled', unit: 'kg', supplierId: '', supplierCode: '', lowStockQuantity: '', active: true, notes: '' })
export const newMenu = () => ({ id: '', name: '', weekday: '', menuText: '', active: true, notes: '' })

// --- Statuses of saved rows (the database marks them; the demo marks them here) ----------

export function withStatuses(state) {
  const limits = resolveLimits(state.limits)
  const products = new Map((state.products || []).map(item => [item.id, item]))
  const receipts = (state.receipts || []).map(receipt => {
    const items = (receipt.items || []).map(item => { const storage = item.storage || products.get(item.productId)?.storage || ''; return { ...item, storage, temperatureStatus: itemStatus(limits, { ...item, storage }) } })
    const { temperature, status, result } = receiptStatus(limits, receipt, items)
    return { ...receipt, items, temperatureStatus: temperature, limitStatus: status, result }
  })
  const thermal = (state.thermal || []).map(entry => { const s = thermalStatuses(limits, entry); return { ...entry, cookingStatus: s.cooking, chillStatus: s.chill, reheatStatus: s.reheat, fryingStatus: s.frying, limitStatus: s.overall } })
  const defrosting = (state.defrosting || []).map(entry => ({ ...entry, limitStatus: defrostStatus(limits, entry) }))
  const pureeing = (state.pureeing || []).map(entry => ({ ...entry, limitStatus: pureeingStatus(entry) }))
  return { ...state, limits, receipts, thermal, defrosting, pureeing }
}

// --- Stock per received batch ---------------------------------------------------------------

// Every received batch with what was used, written off and what remains. A rejected
// receipt or item adds no stock. Sorted FIFO: the oldest receipt first, then expiry.
// In the cloud `state.balances` (kitchen_batch_balances) carries each batch's uses and
// write-offs over its whole life, since the loaded uses cover a window only.
export function stockRows(state, today = todayKey()) {
  const used = new Map(), uses = new Map(), off = new Map()
  for (const row of state.usage || []) if (row.receiptItemId) { used.set(row.receiptItemId, (used.get(row.receiptItemId) || 0) + (Number(row.quantity) || 0)); uses.set(row.receiptItemId, (uses.get(row.receiptItemId) || 0) + 1) }
  for (const row of state.writeoffs || []) off.set(row.receiptItemId, (off.get(row.receiptItemId) || 0) + (Number(row.quantity) || 0))
  const products = new Map((state.products || []).map(item => [item.id, item]))
  const suppliers = new Map((state.suppliers || []).map(item => [item.id, item.name]))
  const warn = Number(state.settings?.expiryWarningDays ?? 2)
  const rows = []
  for (const receipt of state.receipts || []) {
    for (const item of receipt.items || []) {
      const inStock = receipt.accepted !== false && item.accepted !== false
      const received = Number(item.quantity) || 0
      const balance = state.balances?.[item.id]
      const usedQty = round(balance ? balance.used : used.get(item.id) || 0), offQty = round(balance ? balance.writtenOff : off.get(item.id) || 0)
      const remaining = inStock ? round(received - usedQty - offQty) : 0
      const daysLeft = item.expiryOn ? daysBetween(today, item.expiryOn) : null
      const product = products.get(item.productId)
      rows.push({
        receiptItemId: item.id, receiptId: receipt.id, receiptCode: receipt.code, receivedOn: receipt.receivedOn, supplierId: receipt.supplierId, supplierName: suppliers.get(receipt.supplierId) || receipt.supplierName || '',
        productId: item.productId, productName: item.productName, category: product?.category || '', storage: item.storage || product?.storage || '', batchCode: item.batchCode || '', lotLabel: item.lotLabel || '', expiryOn: item.expiryOn || '', unit: item.unit || 'kg',
        received, used: usedQty, writtenOff: offQty, remaining, uses: balance ? balance.uses : uses.get(item.id) || 0, inStock,
        expired: inStock && remaining > 0 && daysLeft != null && daysLeft < 0, expiring: inStock && remaining > 0 && daysLeft != null && daysLeft >= 0 && daysLeft <= warn, daysLeft,
        overused: inStock && remaining < -0.0005,
        low: inStock && remaining > 0 && product?.lowStockQuantity !== '' && product?.lowStockQuantity != null && remaining <= Number(product.lowStockQuantity),
      })
    }
  }
  return rows.sort(fifo)
}
const round = n => Math.round(n * 1000) / 1000
export const fifo = (a, b) => String(a.receivedOn).localeCompare(String(b.receivedOn)) || String(a.expiryOn || '9999').localeCompare(String(b.expiryOn || '9999')) || String(a.receiptCode).localeCompare(String(b.receiptCode))

// Batches a production may take from: in stock, something left, not expired on the day; FIFO.
export function availableBatches(stock, day = todayKey(), productId = '') {
  return stock.filter(row => row.inStock && row.remaining > 0.0005 && !(row.expiryOn && row.expiryOn < day) && (!productId || row.productId === productId)).sort(fifo)
}
// Why a batch cannot be used on a day (the database refuses the same): '' when it can.
export function batchProblem(row, day, quantity, language = 'el') {
  const en = language === 'en'
  if (!row) return ''
  if (!row.inStock) return en ? 'The batch was rejected at receipt.' : 'Η παρτίδα απορρίφθηκε στην παραλαβή.'
  if (row.expiryOn && row.expiryOn < day) return en ? 'The batch has expired: it cannot be used.' : 'Η παρτίδα έχει λήξει: δεν χρησιμοποιείται.'
  if (Number(quantity) > row.remaining + 0.0005) return en ? `Only ${fmtQty(row.remaining, language)} ${unitLabel(row.unit, language)} left in this batch.` : `Στην παρτίδα έχουν μείνει μόνο ${fmtQty(row.remaining, language)} ${unitLabel(row.unit, language)}.`
  return ''
}
// The older batch of the same product that FIFO would use first, when one exists.
export function fifoAdvice(stock, row, day) {
  if (!row) return null
  const older = availableBatches(stock, day, row.productId).find(other => other.receiptItemId !== row.receiptItemId && fifo(other, row) < 0)
  return older || null
}
export const fmtQty = (value, language = 'el') => (value == null || value === '' ? '—' : new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: 3 }).format(Number(value)))
export const fmtTemp = (value, language = 'el') => (value == null || value === '' || !Number.isFinite(Number(value)) ? '' : `${new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(Number(value))} °C`)

// --- Traceability -------------------------------------------------------------------------

// Forward: a batch → its receipt and supplier → where it was used (day, dish) → write-offs.
export function traceBatch(state, receiptItemId) {
  const stock = stockRows(state).find(row => row.receiptItemId === receiptItemId) || null
  const productions = new Map((state.productions || []).map(item => [item.id, item]))
  const uses = (state.usage || []).filter(row => row.receiptItemId === receiptItemId).map(row => ({ ...row, production: productions.get(row.productionId) || null })).sort((a, b) => String(a.usedOn).localeCompare(String(b.usedOn)))
  const writeoffs = (state.writeoffs || []).filter(row => row.receiptItemId === receiptItemId)
  const days = [...new Set(uses.map(row => row.productionId).filter(Boolean))]
  const thermal = (state.thermal || []).filter(row => days.includes(row.productionId))
  return { batch: stock, uses, writeoffs, thermal }
}
// Backward: a dish (by name, optionally on one day) → the batches used for it → their suppliers.
export function traceDish(state, dishName, day = '') {
  const needle = normalize(dishName)
  const stock = new Map(stockRows(state).map(row => [row.receiptItemId, row]))
  const uses = (state.usage || []).filter(row => normalize(row.dishName) === needle && (!day || row.usedOn === day))
  return uses.map(row => ({ ...row, batch: stock.get(row.receiptItemId) || null }))
}
export const normalize = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// --- Production days -------------------------------------------------------------------------

// What a day holds: its materials, heat parameters, pureeing, the defrosts that ended
// that day and the receipts of the day; with the out-of-limits count.
export function dayRecords(state, production) {
  if (!production) return { usage: [], thermal: [], pureeing: [], defrosting: [], receipts: [], outOfLimits: 0, total: 0 }
  const day = production.productionDate
  const usage = (state.usage || []).filter(row => row.productionId === production.id)
  const thermal = (state.thermal || []).filter(row => row.productionId === production.id)
  const pureeing = (state.pureeing || []).filter(row => row.productionId === production.id)
  const defrosting = (state.defrosting || []).filter(row => row.productionId === production.id || (!row.productionId && dayOf(row.endedAt || row.startedAt) === day))
  const receipts = (state.receipts || []).filter(row => row.receivedOn === day)
  const outOfLimits = [...thermal, ...pureeing, ...defrosting, ...receipts].filter(row => row.limitStatus === 'out').length
  return { usage, thermal, pureeing, defrosting, receipts, outOfLimits, total: usage.length + thermal.length + pureeing.length + defrosting.length + receipts.length }
}
export const productionForDay = (state, day) => (state.productions || []).find(item => item.productionDate === day) || null
export const menuForDay = (state, day) => { const weekday = weekdayOf(day); return (state.menus || []).find(menu => menu.active !== false && Number(menu.weekday) === weekday) || null }

// --- Verification (HACCP principle 6) ---------------------------------------------------------

// The days whose records wait for the sign-off of the kitchen manager / quality office,
// newest first; `since` limits the queue (imported history stays out of the daily queue).
export function verificationQueue(state, { today = todayKey(), since = addDays(today, -30) } = {}) {
  return (state.productions || [])
    .filter(item => !item.verifiedAt && item.productionDate <= today && (!since || item.productionDate >= since))
    .map(item => { const records = dayRecords(state, item); return { production: item, ...records, pendingDefrosts: records.defrosting.filter(row => !row.verifiedAt).length } })
    .filter(row => row.total > 0 || row.production.productionDate === today)
    .sort((a, b) => b.production.productionDate.localeCompare(a.production.productionDate))
}

// --- Overview ------------------------------------------------------------------------------

export function overview(state, today = todayKey()) {
  const stock = stockRows(state, today)
  const since = addDays(today, -30)
  const recent = row => dayOf(row.date) >= since
  const out = [
    ...(state.receipts || []).filter(row => row.limitStatus === 'out').map(row => ({ kind: 'receipt', id: row.id, date: row.receivedOn, title: row.code, detail: row.supplierName, action: row.correctiveAction || row.qualityNotes, row })),
    ...(state.thermal || []).filter(row => row.limitStatus === 'out').map(row => ({ kind: 'thermal', id: row.id, date: row.processDate, title: row.dishName, detail: '', action: row.correctiveAction, row })),
    ...(state.defrosting || []).filter(row => row.limitStatus === 'out').map(row => ({ kind: 'defrost', id: row.id, date: dayOf(row.endedAt || row.startedAt), title: row.productName, detail: '', action: row.correctiveAction, row })),
    ...(state.pureeing || []).filter(row => row.limitStatus === 'out').map(row => ({ kind: 'pureeing', id: row.id, date: row.pureedOn, title: row.productName, detail: '', action: row.correctiveAction, row })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  return {
    today,
    production: productionForDay(state, today),
    receipts: (state.receipts || []).filter(row => row.receivedOn === today),
    thermal: (state.thermal || []).filter(row => row.processDate === today),
    defrosting: (state.defrosting || []).filter(row => dayOf(row.startedAt) === today || dayOf(row.endedAt) === today || (!row.endedAt && dayOf(row.startedAt) >= addDays(today, -3))),
    pureeing: (state.pureeing || []).filter(row => row.pureedOn === today),
    outOfLimits: out.filter(recent),
    outOfLimitsAll: state.outOfLimitsTotal ?? out.length,
    expiring: stock.filter(row => row.expiring || row.expired),
    lowStock: stock.filter(row => row.low),
    inStock: stock.filter(row => row.inStock && row.remaining > 0.0005).length,
    toVerify: verificationQueue(state, { today }).length,
  }
}

// --- Calendar ------------------------------------------------------------------------------

// The kitchen in the shared calendar: planned production days (with their menu), the days
// waiting for sign-off, out-of-limits entries without a corrective action, batches that
// expire, and the yearly review of the HACCP plan.
export function kitchenCalendarItems(state, { today = todayKey(), language = 'el' } = {}) {
  const en = language === 'en'
  const list = []
  for (const item of state.productions || []) {
    if (item.productionDate > today) list.push({ id: `kit-day:${item.id}`, kind: 'kitchen', date: item.productionDate, title: en ? 'Production day' : 'Παραγωγή κουζίνας', detail: (item.menuText || '').split('\n').filter(Boolean).slice(0, 2).join(' · '), department: '', path: `/kitchen/days/${item.id}`, state: 'planned' })
  }
  for (const row of verificationQueue(state, { today, since: addDays(today, -14) })) {
    if (row.production.productionDate < today) list.push({ id: `kit-verify:${row.production.id}`, kind: 'kitchen', date: row.production.productionDate, title: en ? 'HACCP verification of the day' : 'Επαλήθευση HACCP ημέρας', detail: `${row.total} ${en ? 'records' : 'καταγραφές'}${row.outOfLimits ? ` · ${row.outOfLimits} ${en ? 'out of limits' : 'εκτός ορίων'}` : ''}`, department: '', path: `/kitchen/days/${row.production.id}`, state: 'overdue' })
  }
  for (const item of overview(state, today).outOfLimits) {
    if (!String(item.action || '').trim() && item.row.source !== 'filemaker') list.push({ id: `kit-out:${item.kind}:${item.id}`, kind: 'kitchen', date: item.date, title: `${en ? 'Out of limits' : 'Εκτός ορίων'}: ${item.title}`, detail: en ? 'Corrective action missing' : 'Χωρίς διορθωτική ενέργεια', department: '', path: item.kind === 'receipt' ? `/kitchen/receipts/${item.id}` : '/kitchen', state: 'overdue' })
  }
  for (const row of stockRows(state, today)) {
    if ((row.expiring || row.expired) && row.expiryOn) list.push({ id: `kit-exp:${row.receiptItemId}`, kind: 'kitchen', date: row.expiryOn, title: `${en ? 'Batch expires' : 'Λήξη παρτίδας'}: ${row.productName}`, detail: `${fmtQty(row.remaining, language)} ${unitLabel(row.unit, language)} · ${row.receiptCode}`, department: '', path: `/kitchen/receipts/${row.receiptId}`, state: row.expired ? 'overdue' : 'due' })
  }
  const review = haccpReviewDue(state.settings)
  if (review) list.push({ id: 'kit-review', kind: 'kitchen', date: review, title: en ? 'HACCP plan review' : 'Ανασκόπηση σχεδίου HACCP', detail: en ? 'Hazards, CCPs and limits' : 'Κίνδυνοι, CCP και όρια', department: '', path: '/kitchen', state: review < today ? 'overdue' : 'due' })
  return list
}
export function haccpReviewDue(settings) {
  if (!settings?.haccpLastReviewOn) return ''
  const d = new Date(`${settings.haccpLastReviewOn}T12:00:00`)
  d.setMonth(d.getMonth() + (Number(settings.haccpReviewMonths) || 12))
  return todayKey(d)
}

// --- Checks before saving ------------------------------------------------------------------

export function receiptProblems(receipt, language = 'el', status = null) {
  const en = language === 'en'
  const problems = []
  if (!receipt.receivedOn) problems.push(en ? 'date' : 'ημερομηνία')
  if (!receipt.supplierId && !String(receipt.supplierName || '').trim()) problems.push(en ? 'supplier' : 'προμηθευτής')
  for (const item of receipt.items || []) {
    if (!String(item.productName || '').trim()) { problems.push(en ? 'product of every line' : 'προϊόν σε κάθε γραμμή'); break }
  }
  if ((receipt.items || []).some(item => item.accepted === false && !String(item.rejectionReason || '').trim())) problems.push(en ? 'reason of each rejected product' : 'αιτία για κάθε προϊόν που απορρίπτεται')
  if (status === 'out' && String(receipt.correctiveAction || '').trim().length < 3 && String(receipt.qualityNotes || '').trim().length < 3) problems.push(en ? 'note or corrective action for the nonconformity' : 'παρατήρηση ή διορθωτική ενέργεια για τη μη συμμόρφωση')
  return problems
}
