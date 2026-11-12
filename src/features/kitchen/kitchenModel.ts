// The kitchen (HACCP) model: vocabularies, new entries, stock per received batch,
// FIFO, traceability, the verification queue and the overview. Pure functions.
import { defrostStatus, itemStatus, pureeingStatus, receiptStatus, resolveLimits, thermalStatuses } from './kitchenLimits'
import type { AnyRecord } from '../../types/featureTypes'

const L = (el: string, en: string) => [el, en]
const pick = (list: readonly AnyRecord[], value: unknown, language: string): string => list.find((item: AnyRecord) => item.value === value)?.label[language === 'en' ? 1 : 0] || value || '—'

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

export const checkLabel = (value: unknown, language: string) => pick(CHECK_RESULTS, value, language)
export const temperatureClassLabel = (value: unknown, language: string) => pick(TEMPERATURE_CLASSES, value, language)
export const storageLabel = (value: unknown, language: string) => pick(STORAGES, value, language)
export const unitLabel = (value: unknown, language: string) => pick(UNITS, value, language)
export const categoryLabel = (value: unknown, language: string) => pick(PRODUCT_CATEGORIES, value, language)
export const defrostMethodLabel = (value: unknown, language: string) => pick(DEFROST_METHODS, value, language)
export const pureeMethodLabel = (value: unknown, language: string) => pick(PUREE_METHODS, value, language)
export const mealLabel = (value: unknown, language: string) => pick(MEALS, value, language)
export const dietLabel = (value: unknown, language: string) => pick(DIETS, value, language)
export const writeoffReasonLabel = (value: unknown, language: string) => pick(WRITEOFF_REASONS, value, language)
export const receiptResultLabel = (value: unknown, language: string) => pick(RECEIPT_RESULTS, value, language)
export const receiptResultTone = (value: unknown) => RECEIPT_RESULTS.find(item => item.value === value)?.tone || 'neutral'
// A receipt by its people-readable name («Παραλαβή 20/10 · Προμηθευτής»); the code PAR-0007 stays secondary.
export const shortDay = (value: unknown) => { const [, m, d] = String(value || '').slice(0, 10).split('-'); return m && d ? `${d}/${m}` : '' }
export const receiptTitle = (row: AnyRecord, language = 'el') => `${language === 'en' ? 'Receipt' : 'Παραλαβή'} ${shortDay(row.receivedOn)}${row.supplierName ? ` · ${row.supplierName}` : ''}`.replace(/\s+/g, ' ').trim()
export const weekdayOf = (date: string) => { const d = new Date(`${String(date).slice(0, 10)}T12:00:00`); return Number.isNaN(d.getTime()) ? null : ((d.getDay() + 6) % 7) + 1 }
export const weekdayLabel = (weekday: number | null, language = 'el') => (weekday != null && weekday >= 1 && weekday <= 7 ? (language === 'en' ? WEEKDAYS_EN : WEEKDAYS)[weekday - 1] : '—')
export const options = (list: readonly AnyRecord[], language: string) => list.map((item: AnyRecord) => ({ value: item.value, label: item.label[language === 'en' ? 1 : 0] }))

// --- Dates --------------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0')
export const todayKey = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
export const nowTime = (now = new Date()) => `${pad(now.getHours())}:${pad(now.getMinutes())}`
export const dayOf = (value: unknown) => {
  if (!value) return ''
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? '' : todayKey(date)
}
export const addDays = (day: string, days: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + days); return todayKey(d) }
export const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000)
// A date and an HH:MM time as an ISO timestamp (local time).
export const combine = (day: string, time: string) => (day ? new Date(`${day}T${time || '00:00'}:00`).toISOString() : '')

// --- New entries --------------------------------------------------------------------------

export const newReceipt = (now = new Date()) => ({ id: '', code: '', supplierId: '', supplierName: '', receivedOn: todayKey(now), receivedTime: nowTime(now), orderReference: '', receiverEmployeeId: '', receiverName: '',
  temperatureCheck: 'compliant', packagingCheck: 'compliant', expiryCheck: 'compliant', vehicleCheck: 'compliant', codingCheck: 'compliant',
  temperatureClass: 'chilled', measuredTemperature: '', accepted: true, status: 'completed', qualityNotes: '', correctiveAction: '', items: [], source: 'app' })
export const newReceiptItem = () => ({ id: '', productId: '', productName: '', batchCode: '', expiryOn: '', quantity: '', unit: 'kg', storage: 'chilled', temperature: '', accepted: true, rejectionReason: '', notes: '' })
export const newProduction = (day = todayKey()) => ({ id: '', productionDate: day, menuId: '', menuText: '', notes: '', disinfectionVegetables: false, disinfectionFruit: false, disinfectionAgent: '', disinfectionConcentrationPpm: '', disinfectionMinutes: '', disinfectionNotes: '', meals: [], source: 'app' })
export const newMeal = () => ({ id: '', meal: 'lunch', diet: 'normal', dish: '', portions: '', notes: '' })
export const newUsage = (production: AnyRecord | null = null) => ({ id: '', productionId: production?.id || '', receiptItemId: '', productId: '', productName: '', lotLabel: '', dishName: '', usedOn: production?.productionDate || todayKey(), quantity: '', unit: 'kg', notes: '', source: 'app' })
export const newThermal = (production: AnyRecord | null = null, now = new Date()) => ({ id: '', productionId: production?.id || '', processDate: production?.productionDate || todayKey(now), processTime: nowTime(now), dishName: '', cookingTemp: '', chillTemp: '', chillMinutes: '', reheatTemp: '', fryingTemp: '', correctiveAction: '', notes: '', source: 'app' })
export const newPureeing = (production: AnyRecord | null = null) => ({ id: '', productionId: production?.id || '', pureedOn: production?.productionDate || todayKey(), method: 'pureeing', productName: '', visualCheck: true, bladeCheck: true, correctiveAction: '', notes: '', source: 'app' })
export const newDefrost = (now = new Date()) => ({ id: '', productId: '', productName: '', receiptItemId: '', quantity: '', unit: 'kg', method: 'refrigerator', startDay: todayKey(now), startTime: nowTime(now), startTemp: '', endDay: '', endTime: '', endTemp: '', correctiveAction: '', notes: '', source: 'app' })
export const newWriteoff = (item: AnyRecord) => ({ id: '', receiptItemId: item?.receiptItemId || item?.id || '', writtenOffOn: todayKey(), quantity: item?.remaining > 0 ? String(Math.round(item.remaining * 1000) / 1000) : '', reason: item?.expired ? 'expired' : 'spoiled', notes: '' })
export const newProduct = () => ({ id: '', name: '', category: 'meat', storage: 'chilled', unit: 'kg', supplierId: '', supplierCode: '', lowStockQuantity: '', active: true, notes: '' })
export const newMenu = () => ({ id: '', name: '', weekday: '', menuText: '', active: true, notes: '' })

// --- Statuses of saved rows (the database marks them; the demo marks them here) ----------

export function withStatuses(state: AnyRecord) {
  const limits = resolveLimits(state.limits)
  const products = new Map<string, AnyRecord>((state.products || []).map((item: AnyRecord) => [item.id, item]))
  const receipts = (state.receipts || []).map((receipt: AnyRecord) => {
    const items = (receipt.items || []).map((item: AnyRecord) => { const storage = item.storage || products.get(item.productId)?.storage || ''; return { ...item, storage, temperatureStatus: itemStatus(limits, { ...item, storage }) } })
    const { temperature, status, result } = receiptStatus(limits, receipt, items)
    return { ...receipt, items, temperatureStatus: temperature, limitStatus: status, result }
  })
  const thermal = (state.thermal || []).map((entry: AnyRecord) => { const s = thermalStatuses(limits, entry); return { ...entry, cookingStatus: s.cooking, chillStatus: s.chill, reheatStatus: s.reheat, fryingStatus: s.frying, limitStatus: s.overall } })
  const defrosting = (state.defrosting || []).map((entry: AnyRecord) => ({ ...entry, limitStatus: defrostStatus(limits, entry) }))
  const pureeing = (state.pureeing || []).map((entry: AnyRecord) => ({ ...entry, limitStatus: pureeingStatus(entry) }))
  return { ...state, limits, receipts, thermal, defrosting, pureeing }
}

// --- Stock per received batch ---------------------------------------------------------------

// Every received batch with what was used, written off and what remains. A rejected
// receipt or item adds no stock. Sorted FIFO: the oldest receipt first, then expiry.
// In the cloud `state.balances` (kitchen_batch_balances) carries each batch's uses and
// write-offs over its whole life, since the loaded uses cover a window only.
export function stockRows(state: AnyRecord, today = todayKey()) {
  const used = new Map(), uses = new Map(), off = new Map()
  for (const row of state.usage || []) if (row.receiptItemId) { used.set(row.receiptItemId, (used.get(row.receiptItemId) || 0) + (Number(row.quantity) || 0)); uses.set(row.receiptItemId, (uses.get(row.receiptItemId) || 0) + 1) }
  for (const row of state.writeoffs || []) off.set(row.receiptItemId, (off.get(row.receiptItemId) || 0) + (Number(row.quantity) || 0))
  const products = new Map<string, AnyRecord>((state.products || []).map((item: AnyRecord) => [item.id, item]))
  const suppliers = new Map((state.suppliers || []).map((item: AnyRecord) => [item.id, item.name]))
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
const round = (n: number) => Math.round(n * 1000) / 1000
export const fifo = (a: AnyRecord, b: AnyRecord) => String(a.receivedOn).localeCompare(String(b.receivedOn)) || String(a.expiryOn || '9999').localeCompare(String(b.expiryOn || '9999')) || String(a.receiptCode).localeCompare(String(b.receiptCode))

// Batches a production may take from: in stock, something left, not expired on the day; FIFO.
export function availableBatches(stock: AnyRecord[], day = todayKey(), productId = '') {
  return stock.filter((row: AnyRecord) => row.inStock && row.remaining > 0.0005 && !(row.expiryOn && row.expiryOn < day) && (!productId || row.productId === productId)).sort(fifo)
}
// Why a batch cannot be used on a day (the database refuses the same): '' when it can.
export function batchProblem(row: AnyRecord | null, day: string, quantity: unknown, language = 'el') {
  const en = language === 'en'
  if (!row) return ''
  if (!row.inStock) return en ? 'The batch was rejected at receipt.' : 'Η παρτίδα απορρίφθηκε στην παραλαβή.'
  if (row.expiryOn && row.expiryOn < day) return en ? 'The batch has expired: it cannot be used.' : 'Η παρτίδα έχει λήξει: δεν χρησιμοποιείται.'
  if (Number(quantity) > row.remaining + 0.0005) return en ? `Only ${fmtQty(row.remaining, language)} ${unitLabel(row.unit, language)} left in this batch.` : `Στην παρτίδα έχουν μείνει μόνο ${fmtQty(row.remaining, language)} ${unitLabel(row.unit, language)}.`
  return ''
}
// The older batch of the same product that FIFO would use first, when one exists.
export function fifoAdvice(stock: AnyRecord[], row: AnyRecord | null, day: string) {
  if (!row) return null
  const older = availableBatches(stock, day, row.productId).find((other: AnyRecord) => other.receiptItemId !== row.receiptItemId && fifo(other, row) < 0)
  return older || null
}
export const fmtQty = (value: unknown, language = 'el') => (value == null || value === '' ? '—' : new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: 3 }).format(Number(value)))
export const fmtTemp = (value: unknown, language = 'el') => (value == null || value === '' || !Number.isFinite(Number(value)) ? '' : `${new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(Number(value))} °C`)

// --- Traceability -------------------------------------------------------------------------

// Forward: a batch → its receipt and supplier → where it was used (day, dish) → write-offs.
export function traceBatch(state: AnyRecord, receiptItemId: string) {
  const stock = stockRows(state).find(row => row.receiptItemId === receiptItemId) || null
  const productions = new Map((state.productions || []).map((item: AnyRecord) => [item.id, item]))
  const uses = (state.usage || []).filter((row: AnyRecord) => row.receiptItemId === receiptItemId).map((row: AnyRecord) => ({ ...row, production: productions.get(row.productionId) || null })).sort((a: AnyRecord, b: AnyRecord) => String(a.usedOn).localeCompare(String(b.usedOn)))
  const writeoffs = (state.writeoffs || []).filter((row: AnyRecord) => row.receiptItemId === receiptItemId)
  const days = [...new Set(uses.map((row: AnyRecord) => row.productionId).filter(Boolean))]
  const thermal = (state.thermal || []).filter((row: AnyRecord) => days.includes(row.productionId))
  return { batch: stock, uses, writeoffs, thermal }
}
// Backward: a dish (by name, optionally on one day) → the batches used for it → their suppliers.
export function traceDish(state: AnyRecord, dishName: string, day = '') {
  const needle = normalize(dishName)
  const stock = new Map(stockRows(state).map(row => [row.receiptItemId, row]))
  const uses = (state.usage || []).filter((row: AnyRecord) => normalize(row.dishName) === needle && (!day || row.usedOn === day))
  return uses.map((row: AnyRecord) => ({ ...row, batch: stock.get(row.receiptItemId) || null }))
}
export const normalize = (value: unknown) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// --- Production days -------------------------------------------------------------------------

// What a day holds: its materials, heat parameters, pureeing, the defrosts that ended
// that day and the receipts of the day; with the out-of-limits count.
export function dayRecords(state: AnyRecord, production: AnyRecord) {
  if (!production) return { usage: [], thermal: [], pureeing: [], defrosting: [], receipts: [], outOfLimits: 0, total: 0 }
  const day = production.productionDate
  const usage = (state.usage || []).filter((row: AnyRecord) => row.productionId === production.id)
  const thermal = (state.thermal || []).filter((row: AnyRecord) => row.productionId === production.id)
  const pureeing = (state.pureeing || []).filter((row: AnyRecord) => row.productionId === production.id)
  const defrosting = (state.defrosting || []).filter((row: AnyRecord) => row.productionId === production.id || (!row.productionId && dayOf(row.endedAt || row.startedAt) === day))
  const receipts = (state.receipts || []).filter((row: AnyRecord) => row.receivedOn === day)
  const outOfLimits = [...thermal, ...pureeing, ...defrosting, ...receipts].filter(row => row.limitStatus === 'out').length
  return { usage, thermal, pureeing, defrosting, receipts, outOfLimits, total: usage.length + thermal.length + pureeing.length + defrosting.length + receipts.length }
}
export const productionForDay = (state: AnyRecord, day: string) => (state.productions || []).find((item: AnyRecord) => item.productionDate === day) || null
export const menuForDay = (state: AnyRecord, day: string) => { const weekday = weekdayOf(day); return (state.menus || []).find((menu: AnyRecord) => menu.active !== false && Number(menu.weekday) === weekday) || null }

// --- Verification (HACCP principle 6) ---------------------------------------------------------

// The days whose records wait for the sign-off of the kitchen manager / quality office,
// newest first; `since` limits the queue (imported history stays out of the daily queue).
export function verificationQueue(state: AnyRecord, { today = todayKey(), since = addDays(today, -30) } = {}) {
  return (state.productions || [])
    .filter((item: AnyRecord) => !item.verifiedAt && item.productionDate <= today && (!since || item.productionDate >= since))
    .map((item: AnyRecord) => { const records = dayRecords(state, item); return { production: item, ...records, pendingDefrosts: records.defrosting.filter((row: AnyRecord) => !row.verifiedAt).length } })
    .filter((row: AnyRecord) => row.total > 0 || row.production.productionDate === today)
    .sort((a: AnyRecord, b: AnyRecord) => b.production.productionDate.localeCompare(a.production.productionDate))
}

// --- Overview ------------------------------------------------------------------------------

export function overview(state: AnyRecord, today = todayKey()) {
  const stock = stockRows(state, today)
  const since = addDays(today, -30)
  const recent = (row: AnyRecord) => dayOf(row.date) >= since
  const out = [
    ...(state.receipts || []).filter((row: AnyRecord) => row.limitStatus === 'out').map((row: AnyRecord) => ({ kind: 'receipt', id: row.id, date: row.receivedOn, title: row.code, detail: row.supplierName, action: row.correctiveAction || row.qualityNotes, row })),
    ...(state.thermal || []).filter((row: AnyRecord) => row.limitStatus === 'out').map((row: AnyRecord) => ({ kind: 'thermal', id: row.id, date: row.processDate, title: row.dishName, detail: '', action: row.correctiveAction, row })),
    ...(state.defrosting || []).filter((row: AnyRecord) => row.limitStatus === 'out').map((row: AnyRecord) => ({ kind: 'defrost', id: row.id, date: dayOf(row.endedAt || row.startedAt), title: row.productName, detail: '', action: row.correctiveAction, row })),
    ...(state.pureeing || []).filter((row: AnyRecord) => row.limitStatus === 'out').map((row: AnyRecord) => ({ kind: 'pureeing', id: row.id, date: row.pureedOn, title: row.productName, detail: '', action: row.correctiveAction, row })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  return {
    today,
    production: productionForDay(state, today),
    receipts: (state.receipts || []).filter((row: AnyRecord) => row.receivedOn === today),
    thermal: (state.thermal || []).filter((row: AnyRecord) => row.processDate === today),
    defrosting: (state.defrosting || []).filter((row: AnyRecord) => dayOf(row.startedAt) === today || dayOf(row.endedAt) === today || (!row.endedAt && dayOf(row.startedAt) >= addDays(today, -3))),
    pureeing: (state.pureeing || []).filter((row: AnyRecord) => row.pureedOn === today),
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
export function kitchenCalendarItems(state: AnyRecord, { today = todayKey(), language = 'el' } = {}) {
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
export function haccpReviewDue(settings: AnyRecord) {
  if (!settings?.haccpLastReviewOn) return ''
  const d = new Date(`${settings.haccpLastReviewOn}T12:00:00`)
  d.setMonth(d.getMonth() + (Number(settings.haccpReviewMonths) || 12))
  return todayKey(d)
}

// --- Checks before saving ------------------------------------------------------------------

export function receiptProblems(receipt: AnyRecord, language = 'el', status: string | null = null) {
  const en = language === 'en'
  const problems = []
  if (!receipt.receivedOn) problems.push(en ? 'date' : 'ημερομηνία')
  if (!receipt.supplierId && !String(receipt.supplierName || '').trim()) problems.push(en ? 'supplier' : 'προμηθευτής')
  for (const item of receipt.items || []) {
    if (!String(item.productName || '').trim()) { problems.push(en ? 'product of every line' : 'προϊόν σε κάθε γραμμή'); break }
  }
  if ((receipt.items || []).some((item: AnyRecord) => item.accepted === false && !String(item.rejectionReason || '').trim())) problems.push(en ? 'reason of each rejected product' : 'αιτία για κάθε προϊόν που απορρίπτεται')
  if (status === 'out' && String(receipt.correctiveAction || '').trim().length < 3 && String(receipt.qualityNotes || '').trim().length < 3) problems.push(en ? 'note or corrective action for the nonconformity' : 'παρατήρηση ή διορθωτική ενέργεια για τη μη συμμόρφωση')
  return problems
}

// Two levels of tabs: four groups, each with its own tabs. ?tab= keeps naming the inner tab
// (old links still open the same place); a group name opens that group's first tab.
// The five tabs of the kitchen. Storage and Safety hold more than one list: `view` says which.
export const KITCHEN_TABS = ['today', 'days', 'storage', 'safety', 'haccp']
export const KITCHEN_VIEWS: Record<string, string[]> = { storage: ['receipts', 'stock', 'products'], safety: ['verification', 'recall'] }
// The tabs of earlier versions (and the old group names) still open: each lands on its new tab and view.
const OLD_KITCHEN_TABS: Record<string, { tab: string, view?: string }> = {
  overview: { tab: 'today' },
  plan: { tab: 'days' }, production: { tab: 'days' }, thermal: { tab: 'days' }, defrost: { tab: 'days' }, pureeing: { tab: 'days' },
  receipts: { tab: 'storage', view: 'receipts' }, stock: { tab: 'storage', view: 'stock' }, usage: { tab: 'storage', view: 'stock' },
  verification: { tab: 'safety', view: 'verification' }, recall: { tab: 'safety', view: 'recall' },
}
export function resolveKitchenLocation(tab: string | null, view?: string | null) {
  const target = tab && KITCHEN_TABS.includes(tab) ? { tab } as { tab: string, view?: string } : OLD_KITCHEN_TABS[tab as string] || { tab: 'today' }
  const views = KITCHEN_VIEWS[target.tab]
  return { tab: target.tab, view: views ? (views.includes(view as string) ? view : target.view || views[0]) : '' }
}
export const resolveKitchenTab = (value: string, view?: string | null) => resolveKitchenLocation(value, view).tab
// The one primary button of the top bar for each tab (Export is always beside it).
export const KITCHEN_PRIMARY_ACTION: Record<string, string | null> = { today: 'production', days: 'day', storage: 'receipt', safety: 'drill', haccp: null }
