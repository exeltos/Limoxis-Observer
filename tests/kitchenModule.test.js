import fs from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_LIMITS, checkLimit, defrostStatus, fryingStatus, limitText, needsCorrectiveAction, parseChill, parseTemperature, pureeingStatus, receiptStatus, resolveLimits, statusLabel, thermalStatuses } from '../src/features/kitchen/kitchenLimits'
import { addDays, availableBatches, batchProblem, dayRecords, fifoAdvice, kitchenCalendarItems, overview, receiptProblems, stockRows, todayKey, traceBatch, traceDish, verificationQueue, withStatuses } from '../src/features/kitchen/kitchenModel'
import { kitchenDemoState, DEFAULT_HACCP_STEPS } from '../src/features/kitchen/kitchenDemoData'
import { dailyHaccpDocument, receiptsLogDocument, traceabilityDocument } from '../src/features/kitchen/kitchenReports'
import { fromRow, kitchenErrorMessage, loadKitchen, reopen, saveEntry, saveProduction, saveReceipt, signOff, toRow } from '../src/features/kitchen/kitchenService'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { CAPABILITIES, ROLES, can } from '../src/core/permissions/roles'
import { navigationFor } from '../src/app/navigation'
import { buildCalendarEvents } from '../src/features/calendar/calendarEvents'

const limits = resolveLimits()

describe('Kitchen critical limits', () => {
  it('marks receipts, cooking, chilling, reheating, frying and defrosting within / out of limits', () => {
    expect(checkLimit(limits, 'receipt_chilled', 5)).toBe('in')
    expect(checkLimit(limits, 'receipt_chilled', 5.1)).toBe('out')
    expect(checkLimit(limits, 'receipt_frozen', -18)).toBe('in')
    expect(checkLimit(limits, 'receipt_frozen', -17)).toBe('out')
    expect(checkLimit(limits, 'receipt_hot', 62)).toBe('out')
    expect(checkLimit(limits, 'cooking_core', 75)).toBe('in')
    expect(checkLimit(limits, 'cooking_core', 74.9)).toBe('out')
    expect(checkLimit(limits, 'chilling', 9, 120)).toBe('in')
    expect(checkLimit(limits, 'chilling', 9, 121)).toBe('out')
    expect(checkLimit(limits, 'chilling', 11)).toBe('out')
    expect(checkLimit(limits, 'reheating', 80)).toBe('in')
    expect(checkLimit(limits, 'cooking_core', '')).toBeNull()
    // Up to 120 °C a frying value is the core, above it the oil.
    expect(fryingStatus(limits, 87)).toBe('in')
    expect(fryingStatus(limits, 70)).toBe('out')
    expect(fryingStatus(limits, 180)).toBe('in')
    expect(fryingStatus(limits, 190)).toBe('out')
    expect(defrostStatus(limits, { endTemp: 4, startedAt: '2026-10-18T20:00:00Z', endedAt: '2026-10-19T08:00:00Z' })).toBe('in')
    expect(defrostStatus(limits, { endTemp: 6, startedAt: '2026-10-18T20:00:00Z', endedAt: '2026-10-19T08:00:00Z' })).toBe('out')
    expect(defrostStatus(limits, { endTemp: -1, startedAt: '2026-10-10T20:00:00Z', endedAt: '2026-10-19T08:00:00Z' })).toBe('out')
    expect(pureeingStatus({ visualCheck: true, bladeCheck: false })).toBe('out')
    expect(pureeingStatus({ visualCheck: null, bladeCheck: null })).toBeNull()
    expect(thermalStatuses(limits, { cookingTemp: 86, chillTemp: 5, chillMinutes: 60 }).overall).toBe('in')
    expect(thermalStatuses(limits, { cookingTemp: 71 }).overall).toBe('out')
    expect(statusLabel('out')).toBe('Εκτός ορίων')
    expect(statusLabel('in')).toBe('Εντός ορίων')
  })

  it('takes the organization\'s own limits over the defaults, and a switched-off limit checks nothing', () => {
    const own = resolveLimits([{ limitKey: 'cooking_core', minValue: 80, maxValue: null, withinMinutes: null, active: true }, { limitKey: 'reheating', minValue: 75, active: false }])
    expect(checkLimit(own, 'cooking_core', 78)).toBe('out')
    expect(checkLimit(own, 'reheating', 10)).toBeNull()
    expect(limitText(own.find(item => item.limitKey === 'cooking_core'))).toBe('≥ 80 °C')
    expect(limitText(limits.find(item => item.limitKey === 'chilling'))).toBe('≤ 10 °C σε 2 ώρες')
    expect(DEFAULT_LIMITS).toHaveLength(8)
  })

  it('reads temperatures as FileMaker wrote them; what cannot be read stays as text with a flag', () => {
    expect(parseTemperature('-16,5')).toEqual({ value: -16.5, text: '', unparsed: false })
    expect(parseTemperature('852')).toMatchObject({ value: null, text: '852', unparsed: true })
    expect(parseTemperature('70 -3 λεπτα')).toMatchObject({ value: null, unparsed: true })
    expect(parseChill('5-60')).toMatchObject({ value: 5, minutes: 60 })
    expect(parseChill('5/60')).toMatchObject({ value: 5, minutes: 60 })
    expect(parseChill('4')).toMatchObject({ value: 4, minutes: null })
    expect(parseChill('60-70 / 5 λεπτά')).toMatchObject({ value: null, unparsed: true })
  })

  it('needs a corrective action only when out of limits', () => {
    expect(needsCorrectiveAction('out', '')).toBe(true)
    expect(needsCorrectiveAction('out', 'Συνέχιση μαγειρέματος')).toBe(false)
    expect(needsCorrectiveAction('in', '')).toBe(false)
  })

  it('works out a receipt\'s result from the checks, its temperature and its products', () => {
    const base = { temperatureCheck: 'compliant', packagingCheck: 'compliant', expiryCheck: 'compliant', vehicleCheck: 'compliant', codingCheck: 'compliant', temperatureClass: 'chilled', measuredTemperature: '4', accepted: true }
    expect(receiptStatus(limits, base, [])).toMatchObject({ status: 'in', result: 'accepted' })
    expect(receiptStatus(limits, { ...base, vehicleCheck: 'noncompliant' }, [])).toMatchObject({ status: 'out', result: 'accepted_with_remarks' })
    expect(receiptStatus(limits, base, [{ storage: 'chilled', temperature: '7.5', accepted: false }])).toMatchObject({ status: 'out' })
    expect(receiptStatus(limits, { ...base, accepted: false }, []).result).toBe('rejected')
    expect(receiptProblems({ ...base, receivedOn: '2026-10-19', supplierName: 'Χ', items: [] }, 'el', 'out')).toContain('παρατήρηση ή διορθωτική ενέργεια για τη μη συμμόρφωση')
  })

  it('keeps the same defaults as the database', () => {
    const sql = fs.readFileSync('supabase/migrations/20261123110000_kitchen_module.sql', 'utf8')
    for (const item of DEFAULT_LIMITS) {
      const row = sql.match(new RegExp(`\\('${item.limitKey}', '[^']+', ([^,]+), ([^,]+), ([^)]+)\\)`))
      expect(row, item.limitKey).not.toBeNull()
      const value = text => (/null/.test(text) ? null : Number(text.replace(/::\w+/, '')))
      expect([value(row[1]), value(row[2]), value(row[3])]).toEqual([item.minValue, item.maxValue, item.withinMinutes])
    }
    expect(DEFAULT_HACCP_STEPS.map(step => step.stepKey)).toEqual([...sql.matchAll(/\(p_organization_id, \d+, '([a-z_]+)'/g)].map(match => match[1]))
  })
})

describe('Kitchen stock, FIFO and traceability', () => {
  const state = withStatuses(kitchenDemoState())
  const today = todayKey()
  const stock = stockRows(state, today)

  it('keeps stock per received batch: received − used − written off; rejected adds none', () => {
    const chicken = stock.find(row => row.receiptItemId === 'kri-1')
    expect(chicken).toMatchObject({ received: 20, used: 18, remaining: 2, inStock: true })
    const mince = stock.find(row => row.receiptItemId === 'kri-2')
    expect(mince).toMatchObject({ used: 5, writtenOff: 1, remaining: 2, expired: true })
    const rejected = stock.find(row => row.receiptItemId === 'kri-14')
    expect(rejected).toMatchObject({ inStock: false, remaining: 0 })
    expect(stock.find(row => row.receiptItemId === 'kri-3').low).toBe(false)
  })

  it('offers batches oldest first, never an expired or rejected one, and says why a batch cannot be used', () => {
    const offered = availableBatches(stock, today)
    expect(offered.some(row => row.receiptItemId === 'kri-2')).toBe(false)
    expect(offered.some(row => row.receiptItemId === 'kri-14')).toBe(false)
    const dates = offered.map(row => row.receivedOn)
    expect([...dates].sort()).toEqual(dates)
    const mince = stock.find(row => row.receiptItemId === 'kri-2')
    expect(batchProblem(mince, today, 1)).toMatch(/έχει λήξει/)
    const chicken = stock.find(row => row.receiptItemId === 'kri-11')
    expect(batchProblem(chicken, today, 999)).toMatch(/μόνο/)
    expect(batchProblem(chicken, today, 1)).toBe('')
    expect(fifoAdvice(stock, stock.find(row => row.receiptItemId === 'kri-13'), today)?.receiptItemId).toBe('kri-1')
  })

  it('traces a batch to the days and dishes it went into, and a dish back to its batches', () => {
    const trace = traceBatch(state, 'kri-1')
    expect(trace.batch.supplierName).toBe('Κρεατεμπορική Θεσσαλίας Α.Ε.')
    expect(trace.uses.map(row => row.dishName)).toEqual(['Κοτόπουλο λεμονάτο', 'Κοτόσουπα', 'Κεφτεδάκια κοτόπουλο'])
    expect(traceDish(state, 'κοτοσουπα').map(row => row.receiptItemId)).toEqual(['kri-1'])
    const doc = traceabilityDocument(trace)
    expect(doc.sections[0].table.rows).toHaveLength(3)
  })

  it('queues the unsigned days and puts the kitchen in the calendar', () => {
    const queue = verificationQueue(state, { today })
    expect(queue.map(row => row.production.productionDate)).toEqual([today, addDays(today, -1)])
    expect(queue[1].outOfLimits).toBeGreaterThan(0)
    const items = kitchenCalendarItems(state, { today })
    expect(items.filter(item => item.state === 'planned')).toHaveLength(3)
    expect(items.some(item => item.id.startsWith('kit-verify:'))).toBe(true)
    expect(items.some(item => item.id.startsWith('kit-exp:'))).toBe(true)
    const events = buildCalendarEvents({ kitchen: items }, { from: addDays(today, -7), to: addDays(today, 7), today })
    expect(events.every(event => event.kind === 'kitchen')).toBe(true)
    const summary = overview(state, today)
    expect(summary.receipts).toHaveLength(1)
    expect(summary.outOfLimits.length).toBeGreaterThanOrEqual(3)
  })

  it('prints the daily HACCP sheet and the receipts log on the shared layout', () => {
    const production = state.productions.find(item => item.productionDate === addDays(today, -1))
    const doc = dailyHaccpDocument(state, production)
    expect(doc.kind).toBe('Ημερήσιο φύλλο HACCP κουζίνας')
    expect(doc.sections.map(section => section.title)).toContain('Παράμετροι ζέστης')
    const out = doc.sections.find(section => section.title === 'Εκτός ορίων και διορθωτικές ενέργειες')
    expect(out.table.rows.length).toBeGreaterThan(0)
    expect(dayRecords(state, production).thermal.length).toBe(2)
    const log = receiptsLogDocument(state.receipts, { from: addDays(today, -7), to: today })
    expect(log.sections[0].table.rows.length).toBe(state.receipts.reduce((n, r) => n + r.items.length, 0))
  })
})

describe('Kitchen access', () => {
  it('gives the kitchen to Hospital Admin and Quality Manager, reading to the IPC Lead, none to departments', () => {
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.MANAGE_KITCHEN)).toBe(true)
    expect(can(ROLES.QUALITY_MANAGER, CAPABILITIES.MANAGE_KITCHEN)).toBe(true)
    expect(can(ROLES.INFECTION_CONTROL_LEAD, CAPABILITIES.VIEW_KITCHEN)).toBe(true)
    expect(can(ROLES.INFECTION_CONTROL_LEAD, CAPABILITIES.RECORD_KITCHEN)).toBe(false)
    expect(can(ROLES.DEPARTMENT_USER, CAPABILITIES.VIEW_KITCHEN)).toBe(false)
    // A kitchen manager is a custom role with record + manage.
    expect(can(ROLES.STAFF_USER, CAPABILITIES.RECORD_KITCHEN, [], [CAPABILITIES.RECORD_KITCHEN])).toBe(true)
    expect(navigationFor({ role: ROLES.QUALITY_MANAGER }).some(item => item.key === 'kitchen')).toBe(true)
    expect(navigationFor({ role: ROLES.HOSPITAL_ADMIN }).some(item => item.key === 'kitchen')).toBe(true)
    expect(navigationFor({ role: ROLES.DEPARTMENT_USER }).some(item => item.key === 'kitchen')).toBe(false)
    expect(navigationFor({ role: ROLES.STAFF_USER, customCapabilities: [CAPABILITIES.RECORD_KITCHEN] }).some(item => item.key === 'kitchen')).toBe(true)
  })

  it('has the same role lists in the database helper', () => {
    const sql = fs.readFileSync('supabase/migrations/20261123110000_kitchen_module.sql', 'utf8')
    for (const [key, roles] of [['view_kitchen', ['hospital_admin', 'infection_control_lead', 'quality_manager']], ['record_kitchen', ['hospital_admin', 'quality_manager']], ['manage_kitchen', ['hospital_admin', 'quality_manager']]]) {
      const listed = sql.match(new RegExp(`when '${key}' then om\\.role in \\(([^)]*)\\)`))[1].match(/'[a-z_]+'/g).map(item => item.slice(1, -1))
      expect(listed.sort()).toEqual(roles.sort())
    }
  })
})

describe('Kitchen service', () => {
  beforeEach(() => configureDataEnvironment({ mode: 'demo', demoAccountId: `kitchen-${Math.random()}` }))

  it('maps every field to its own column and back', () => {
    const row = toRow('kitchen_thermal_processes', { dishName: ' Κοτόσουπα ', cookingTemp: '86,5', chillTemp: '', chillMinutes: '60', productionId: 'kd-1', correctiveAction: '' })
    expect(row).toEqual({ dish_name: 'Κοτόσουπα', cooking_temp: 86.5, chill_temp: null, chill_minutes: 60, production_id: null, corrective_action: null })
    const back = fromRow('kitchen_receipts', { id: 'x', code: 'PAR-0001', received_time: '07:30:00', accepted: false, limit_status: 'out', measured_temperature: 6.5 })
    expect(back).toMatchObject({ code: 'PAR-0001', receivedTime: '07:30', accepted: false, limitStatus: 'out', measuredTemperature: 6.5, supplierName: '' })
  })

  it('applies the database rules in the demo: corrective action, expired batch, signed-off day, reopen reason', async () => {
    const state = await loadKitchen(null)
    const today = todayKey()
    await expect(saveEntry(null, 'kitchen_thermal_processes', { productionId: 'kd-7', processDate: today, dishName: 'Δοκιμή', cookingTemp: '60' })).rejects.toMatchObject({ code: 'KITCHEN_CORRECTIVE_ACTION_REQUIRED' })
    await expect(saveEntry(null, 'kitchen_thermal_processes', { productionId: 'kd-7', processDate: today, dishName: 'Δοκιμή', cookingTemp: '60', correctiveAction: 'Συνέχιση μαγειρέματος' })).resolves.toBeTruthy()
    await expect(saveEntry(null, 'kitchen_material_usage', { productionId: 'kd-7', receiptItemId: 'kri-2', usedOn: today, quantity: '1' })).rejects.toMatchObject({ code: 'KITCHEN_BATCH_EXPIRED' })
    await expect(saveEntry(null, 'kitchen_material_usage', { productionId: 'kd-7', receiptItemId: 'kri-14', usedOn: today, quantity: '1' })).rejects.toMatchObject({ code: 'KITCHEN_BATCH_REJECTED' })
    await expect(saveEntry(null, 'kitchen_material_usage', { productionId: 'kd-7', receiptItemId: 'kri-11', usedOn: today, quantity: '999' })).rejects.toMatchObject({ code: 'KITCHEN_STOCK_INSUFFICIENT' })
    const day = state.productions.find(item => item.id === 'kd-7')
    await signOff(null, 'kitchen_productions', day.id, { actor: { name: 'Υπεύθυνη κουζίνας' } })
    await expect(saveEntry(null, 'kitchen_pureeing', { productionId: day.id, pureedOn: today, productName: 'Π', visualCheck: true, bladeCheck: true })).rejects.toMatchObject({ code: 'KITCHEN_DAY_VERIFIED' })
    await expect(saveProduction(null, { ...day, notes: 'αλλαγή' })).rejects.toMatchObject({ code: 'KITCHEN_RECORD_VERIFIED' })
    await expect(reopen(null, 'kitchen_productions', day.id, '')).rejects.toMatchObject({ code: 'KITCHEN_REOPEN_REASON_REQUIRED' })
    await reopen(null, 'kitchen_productions', day.id, 'Διόρθωση θερμοκρασίας')
    const after = await loadKitchen(null)
    expect(after.productions.find(item => item.id === day.id)).toMatchObject({ verifiedAt: null, reopenReason: 'Διόρθωση θερμοκρασίας' })
    expect(kitchenErrorMessage({ message: 'KITCHEN_BATCH_EXPIRED' })).toMatch(/έχει λήξει/)
  })

  it('numbers a new receipt and refuses a nonconforming one without a note', async () => {
    const receipt = { receivedOn: todayKey(), supplierName: 'Νέος προμηθευτής', temperatureClass: 'chilled', measuredTemperature: '9', accepted: true, items: [] }
    await expect(saveReceipt(null, receipt)).rejects.toMatchObject({ code: 'KITCHEN_CORRECTIVE_ACTION_REQUIRED' })
    const id = await saveReceipt(null, { ...receipt, correctiveAction: 'Επιστροφή στον προμηθευτή' })
    const state = await loadKitchen(null)
    const saved = state.receipts.find(item => item.id === id)
    expect(saved.code).toBe('PAR-0008')
    expect(saved).toMatchObject({ limitStatus: 'out', result: 'accepted_with_remarks' })
  })
})
