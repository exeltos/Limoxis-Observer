// «Άσκηση ανάκλησης» (mock recall drill): from a scenario (a supplier's lot, a product
// or a dish) the kitchen traces forward (where the batches went: day, dish, meal,
// portions) and backward (which batches a dish was made from), checks the mass balance
// (received = used + in stock + written off) and the time it took against the target.
// Pure functions; the trace is plain data so it can be kept with the drill.
import { addDays, dayOf, normalize, stockRows, todayKey, traceBatch, traceDish } from './kitchenModel'

const L = (el, en) => [el, en]
const pick = (list, value, language) => list.find(item => item.value === value)?.label[language === 'en' ? 1 : 0] || value || '—'
const round = (n, digits = 3) => { const f = 10 ** digits; return Math.round(n * f) / f }

export const RECALL_SCENARIOS = Object.freeze([
  { value: 'supplier_lot', label: L('Παρτίδα προμηθευτή', 'Supplier lot') },
  { value: 'product', label: L('Προϊόν (όλες οι παρτίδες)', 'Product (every batch)') },
  { value: 'dish', label: L('Πιάτο', 'Dish') },
])
export const RECALL_RESULTS = Object.freeze([{ value: 'pass', label: L('Επιτυχής', 'Pass'), tone: 'success' }, { value: 'fail', label: L('Ανεπιτυχής', 'Fail'), tone: 'danger' }])
export const recallScenarioLabel = (value, language) => pick(RECALL_SCENARIOS, value, language)
export const recallResultLabel = (value, language) => pick(RECALL_RESULTS, value, language)
export const recallResultTone = value => RECALL_RESULTS.find(item => item.value === value)?.tone || 'neutral'
// The usual target: the whole trace in 4 hours. A balance within ±5 % counts as accounted for.
export const RECALL_TARGET_MINUTES = 240
export const BALANCE_TOLERANCE = 5

export const newRecallDrill = (now = new Date()) => ({ id: '', code: '', drillDate: todayKey(now), startedAt: now.toISOString(), finishedAt: '', scenario: 'supplier_lot', triggerText: '', receiptItemId: '', productId: '', productName: '', dishName: '',
  targetMinutes: String(RECALL_TARGET_MINUTES), stockCounts: {}, notified: '', actions: '', result: '', lessons: '', conductedByName: '', conductedByEmployeeId: '', status: 'draft', notes: '' })

// Minutes from the start of the drill to its end (or to now while it runs).
export function elapsedMinutes(startedAt, finishedAt = '', now = new Date()) {
  const start = new Date(startedAt || ''), end = finishedAt ? new Date(finishedAt) : now
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return Math.max(0, Math.floor((end - start) / 60000))
}
export const fmtDuration = (minutes, language = 'el') => {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60), m = minutes % 60
  return language === 'en' ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} ώρ. ${String(m).padStart(2, '0')} λεπ.`
}

// The batches a scenario starts from: one lot, every batch of a product, or (backward)
// every batch that went into the dish.
function startBatches(state, stock, drill) {
  if (drill.scenario === 'supplier_lot') return stock.filter(row => row.receiptItemId === drill.receiptItemId)
  if (drill.scenario === 'product') {
    const name = normalize(drill.productName)
    return stock.filter(row => (drill.productId ? row.productId === drill.productId : name && normalize(row.productName) === name))
  }
  const ids = new Set(traceDish(state, drill.dishName).map(row => row.receiptItemId).filter(Boolean))
  return stock.filter(row => ids.has(row.receiptItemId))
}

// The meals of a production day that served a dish (the meal plan names the dish, often
// with its diet: «Κοτόπουλο λεμονάτο με πατάτες (πολτός)»).
function mealsFor(production, dishName) {
  const needle = normalize(dishName)
  if (!production || !needle) return []
  return (production.meals || []).filter(meal => { const dish = normalize(meal.dish); return dish && (dish.includes(needle) || needle.includes(dish)) })
}

// The whole trace of a drill. `stockCounts` (receiptItemId → quantity) is the stock the
// team counted on the shelf; where nothing was counted the system's remaining is taken.
export function recallTrace(state, drill) {
  const stock = stockRows(state)
  const productions = new Map((state.productions || []).map(item => [item.id, item]))
  const counts = drill.stockCounts || {}
  const selected = startBatches(state, stock, drill)
  const batches = selected.map(row => {
    const counted = counts[row.receiptItemId]
    const hasCount = counted !== '' && counted != null && Number.isFinite(Number(counted))
    const inStock = hasCount ? Number(counted) : Math.max(0, row.remaining)
    const accounted = round(row.used + inStock + row.writtenOff)
    return { receiptItemId: row.receiptItemId, receiptId: row.receiptId, receiptCode: row.receiptCode, receivedOn: row.receivedOn, supplierName: row.supplierName, productId: row.productId, productName: row.productName, batchCode: row.batchCode || row.lotLabel || '', expiryOn: row.expiryOn, unit: row.unit,
      received: row.received, used: row.used, writtenOff: row.writtenOff, remaining: row.remaining, inStock: round(inStock), counted: hasCount, accounted, percent: row.received > 0 ? round((accounted / row.received) * 100, 1) : null }
  })
  // Forward: every use of those batches, with the day's meals that served the dish.
  const uses = [], writeoffs = []
  for (const batch of batches) {
    const forward = traceBatch(state, batch.receiptItemId)
    for (const use of forward.uses) {
      const production = productions.get(use.productionId) || null
      const meals = mealsFor(production, use.dishName)
      uses.push({ id: use.id, receiptItemId: batch.receiptItemId, productName: batch.productName, batchCode: batch.batchCode, usedOn: use.usedOn || production?.productionDate || '', productionId: use.productionId || '', dishName: use.dishName || '', quantity: Number(use.quantity) || 0, unit: use.unit || batch.unit,
        meals: meals.map(meal => ({ id: meal.id, meal: meal.meal, diet: meal.diet, dish: meal.dish, portions: Number(meal.portions) || 0 })) })
    }
    for (const row of forward.writeoffs) writeoffs.push({ id: row.id, receiptItemId: batch.receiptItemId, productName: batch.productName, writtenOffOn: row.writtenOffOn, quantity: Number(row.quantity) || 0, reason: row.reason, notes: row.notes || '' })
  }
  uses.sort((a, b) => String(a.usedOn).localeCompare(String(b.usedOn)) || a.dishName.localeCompare(b.dishName, 'el'))
  // Backward: the other raw materials of the same dishes on the same days (or, for a
  // dish, every batch it was made from), so the recall can widen if needed.
  const dishDays = drill.scenario === 'dish' ? [[drill.dishName, '']] : [...new Map(uses.filter(use => use.dishName).map(use => [`${normalize(use.dishName)}|${use.usedOn}`, [use.dishName, use.usedOn]])).values()]
  const selectedIds = new Set(batches.map(batch => batch.receiptItemId))
  const backward = []
  for (const [dish, day] of dishDays) {
    for (const row of traceDish(state, dish, day)) {
      if (drill.scenario !== 'dish' && selectedIds.has(row.receiptItemId)) continue
      backward.push({ id: row.id, dishName: row.dishName, usedOn: row.usedOn, productName: row.productName, batchCode: row.batch?.batchCode || row.lotLabel || '', supplierName: row.batch?.supplierName || '', receiptCode: row.batch?.receiptCode || '', receiptItemId: row.receiptItemId || '', quantity: Number(row.quantity) || 0, unit: row.unit || row.batch?.unit || 'kg', traced: Boolean(row.batch) })
    }
  }
  // Uses of the product recorded without a batch: they cannot be traced to a receipt.
  const untraced = drill.scenario === 'product' ? (state.usage || []).filter(row => !row.receiptItemId && (drill.productId ? row.productId === drill.productId : normalize(row.productName) === normalize(drill.productName))).length : 0
  return { batches, uses, writeoffs, backward, untraced, ...recallTotals(batches, uses) }
}

// The mass balance and what was affected (days, meals, portions).
export function recallTotals(batches, uses) {
  const units = [...new Set(batches.map(batch => batch.unit))]
  const sum = key => round(batches.reduce((n, batch) => n + (Number(batch[key]) || 0), 0))
  const received = sum('received'), used = sum('used'), inStock = sum('inStock'), writtenOff = sum('writtenOff')
  const accounted = round(used + inStock + writtenOff)
  // One unit: the plain balance. Mixed units (a dish): the mean of the batches' balances.
  const withPercent = batches.filter(batch => batch.percent != null)
  const percent = units.length === 1 ? (received > 0 ? round((accounted / received) * 100, 1) : null) : withPercent.length ? round(withPercent.reduce((n, batch) => n + batch.percent, 0) / withPercent.length, 1) : null
  const days = new Set(uses.map(use => use.productionId || use.usedOn).filter(Boolean))
  const meals = new Map()
  for (const use of uses) for (const meal of use.meals || []) meals.set(meal.id || `${use.productionId}-${meal.meal}-${meal.diet}-${meal.dish}`, meal)
  return {
    unit: units.length === 1 ? units[0] : units.length ? 'mixed' : '',
    received, used, inStock, writtenOff, accounted, percent,
    balanced: percent != null && Math.abs(percent - 100) <= BALANCE_TOLERANCE,
    affectedDays: days.size, affectedMeals: meals.size, affectedPortions: [...meals.values()].reduce((n, meal) => n + (Number(meal.portions) || 0), 0),
  }
}

// Within the target time? null while the drill has no start.
export const withinTarget = (minutes, target = RECALL_TARGET_MINUTES) => (minutes == null ? null : minutes <= (Number(target) || RECALL_TARGET_MINUTES))
// The result the trace suggests: traced within the target and the balance accounted for.
export const suggestedResult = (trace, minutes, target) => (trace.batches.length && trace.balanced && withinTarget(minutes, target) ? 'pass' : 'fail')

// What a drill keeps when saved: the found quantities as columns, the trace as a snapshot.
export function drillFindings(drill, trace, now = new Date()) {
  const minutes = elapsedMinutes(drill.startedAt, drill.finishedAt, now)
  return {
    elapsedMinutes: minutes, receivedQuantity: trace.received, usedQuantity: trace.used, stockQuantity: trace.inStock, writtenOffQuantity: trace.writtenOff, quantityUnit: trace.unit || '', accountedPercent: trace.percent ?? '',
    batchesCount: trace.batches.length, affectedDays: trace.affectedDays, affectedMeals: trace.affectedMeals, affectedPortions: trace.affectedPortions, tracedWithinTarget: withinTarget(minutes, drill.targetMinutes),
    traceSnapshot: { ...trace, stockCounts: drill.stockCounts || {} },
  }
}

// What a drill needs: a subject; to complete, also whom it notified, what was done and a result.
export function recallProblems(drill, language = 'el', { completing = false } = {}) {
  const en = language === 'en'
  const problems = []
  if (drill.scenario === 'supplier_lot' && !drill.receiptItemId) problems.push(en ? 'the lot' : 'η παρτίδα')
  if (drill.scenario === 'product' && !drill.productId && !String(drill.productName || '').trim()) problems.push(en ? 'the product' : 'το προϊόν')
  if (drill.scenario === 'dish' && !String(drill.dishName || '').trim()) problems.push(en ? 'the dish' : 'το πιάτο')
  if (!(Number(drill.targetMinutes) > 0)) problems.push(en ? 'target time' : 'χρόνος στόχος')
  if (completing) {
    if (String(drill.notified || '').trim().length < 3) problems.push(en ? 'who was notified' : 'ποιοι ενημερώθηκαν')
    if (String(drill.actions || '').trim().length < 3) problems.push(en ? 'actions' : 'ενέργειες')
    if (!drill.result) problems.push(en ? 'result' : 'αποτέλεσμα')
  }
  return problems
}

// The subject of a drill in a line: the lot, the product or the dish.
export function drillSubject(drill, state, language = 'el') {
  if (drill.scenario === 'dish') return drill.dishName || '—'
  if (drill.scenario === 'product') return drill.productName || (state?.products || []).find(item => item.id === drill.productId)?.name || '—'
  const batch = drill.traceSnapshot?.batches?.[0] || (state ? stockRows(state).find(row => row.receiptItemId === drill.receiptItemId) : null)
  return batch ? `${batch.productName}${batch.batchCode || batch.lotLabel ? ` · ${batch.batchCode || batch.lotLabel}` : ''}` : (drill.productName || (language === 'en' ? 'Batch' : 'Παρτίδα'))
}

// The overview: the last completed drill, when the next is due, and a warning when no
// drill was done within the interval (12 months unless the settings say otherwise).
export function recallSummary(state, today = todayKey()) {
  const months = Number(state.settings?.recallDrillMonths) || 12
  const done = (state.recallDrills || []).filter(row => row.status === 'completed').sort((a, b) => String(b.drillDate).localeCompare(String(a.drillDate)))
  const last = done[0] || null
  let due = ''
  if (last) { const d = new Date(`${dayOf(last.drillDate)}T12:00:00`); d.setMonth(d.getMonth() + months); due = todayKey(d) }
  return { last, due, months, overdue: !last || due < today, dueSoon: Boolean(last) && due >= today && due <= addDays(today, 30), drafts: (state.recallDrills || []).filter(row => row.status !== 'completed').length }
}
