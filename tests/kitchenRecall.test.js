import fs from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, todayKey } from '../src/features/kitchen/kitchenModel'
import { kitchenDemoState } from '../src/features/kitchen/kitchenDemoData'
import { drillFindings, elapsedMinutes, newRecallDrill, recallProblems, recallSummary, recallTotals, recallTrace, suggestedResult, withinTarget } from '../src/features/kitchen/kitchenRecallModel'
import { recallDrillDocument } from '../src/features/kitchen/kitchenReports'
import { fromRow, loadKitchen, saveRecallDrill, toRow } from '../src/features/kitchen/kitchenService'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'

const state = kitchenDemoState()

describe('Kitchen mock recall drill', () => {
  it('traces a supplier lot forward to days, dishes, meals and portions, with the mass balance', () => {
    // kri-1: 20 kg chicken, used 6 + 5 + 7 on three days, 2 kg left.
    const trace = recallTrace(state, { scenario: 'supplier_lot', receiptItemId: 'kri-1' })
    expect(trace.batches).toHaveLength(1)
    expect(trace.batches[0]).toMatchObject({ supplierName: 'Κρεατεμπορική Θεσσαλίας Α.Ε.', receiptCode: 'PAR-0001', received: 20, used: 18, inStock: 2, writtenOff: 0, counted: false })
    expect(trace).toMatchObject({ received: 20, used: 18, inStock: 2, accounted: 20, percent: 100, balanced: true, unit: 'kg', affectedDays: 3 })
    expect(trace.uses.map(use => use.dishName)).toEqual(['Κοτόπουλο λεμονάτο', 'Κοτόσουπα', 'Κεφτεδάκια κοτόπουλο'])
    // The meal plan names the dish with its diet: normal, diabetic and puréed lunch of that day.
    const lemon = trace.uses[0]
    expect(lemon.meals.map(meal => meal.diet)).toEqual(['normal', 'diabetic', 'puree'])
    expect(trace.affectedPortions).toBeGreaterThanOrEqual(147)
  })

  it('takes the stock counted on the shelf: a missing quantity breaks the balance', () => {
    const trace = recallTrace(state, { scenario: 'supplier_lot', receiptItemId: 'kri-1', stockCounts: { 'kri-1': '0.5' } })
    expect(trace.batches[0]).toMatchObject({ inStock: 0.5, counted: true, accounted: 18.5, percent: 92.5 })
    expect(trace.balanced).toBe(false)
    expect(suggestedResult(trace, 60, 240)).toBe('fail')
    expect(suggestedResult(recallTrace(state, { scenario: 'supplier_lot', receiptItemId: 'kri-1' }), 60, 240)).toBe('pass')
    expect(suggestedResult(recallTrace(state, { scenario: 'supplier_lot', receiptItemId: 'kri-1' }), 300, 240)).toBe('fail')
  })

  it('counts write-offs in the balance and finds every batch of a product', () => {
    // kri-2: 8 kg minced beef, 5 used, 1 written off (expired), 2 left.
    const lot = recallTrace(state, { scenario: 'supplier_lot', receiptItemId: 'kri-2' })
    expect(lot).toMatchObject({ received: 8, used: 5, writtenOff: 1, inStock: 2, percent: 100 })
    expect(lot.writeoffs[0]).toMatchObject({ reason: 'expired', quantity: 1 })
    const product = recallTrace(state, { scenario: 'product', productId: 'kp-1', productName: 'Στήθος κοτόπουλο φιλέτο' })
    expect(product.batches.map(batch => batch.receiptItemId).sort()).toEqual(['kri-1', 'kri-11', 'kri-13'])
    expect(product.received).toBe(54)
  })

  it('traces a dish backward to its batches, then forward from them', () => {
    const trace = recallTrace(state, { scenario: 'dish', dishName: 'ρυζογαλο' })
    expect(trace.batches.map(batch => batch.receiptItemId)).toEqual(['kri-3'])
    expect(trace.backward.every(row => row.dishName === 'Ρυζόγαλο' && row.traced)).toBe(true)
    // The milk went into the rice pudding and the purée too.
    expect(new Set(trace.uses.map(use => use.dishName))).toEqual(new Set(['Ρυζόγαλο', 'Πουρές']))
    // Forward from a lot, the backward trace lists the other materials of the same dishes.
    const potatoes = recallTrace(state, { scenario: 'supplier_lot', receiptItemId: 'kri-9' })
    expect(potatoes.backward.some(row => row.receiptItemId === 'kri-5')).toBe(true)
  })

  it('works the balance per unit and as the mean of the batches when units differ', () => {
    const batches = [{ unit: 'kg', received: 10, used: 9, inStock: 1, writtenOff: 0, percent: 100 }, { unit: 'l', received: 10, used: 5, inStock: 3, writtenOff: 0, percent: 80 }]
    expect(recallTotals(batches, [])).toMatchObject({ unit: 'mixed', percent: 90, balanced: false })
    expect(recallTotals([], [])).toMatchObject({ percent: null, balanced: false, affectedDays: 0 })
  })

  it('times the drill against the target and asks what completing needs', () => {
    expect(elapsedMinutes('2026-10-19T08:00:00Z', '2026-10-19T11:59:59Z')).toBe(239)
    expect(withinTarget(240, 240)).toBe(true)
    expect(withinTarget(241, '240')).toBe(false)
    const drill = newRecallDrill(new Date('2026-10-19T08:00:00Z'))
    expect(drill).toMatchObject({ scenario: 'supplier_lot', targetMinutes: '240', status: 'draft' })
    expect(recallProblems(drill)).toEqual(['η παρτίδα'])
    expect(recallProblems({ ...drill, receiptItemId: 'kri-1' }, 'en', { completing: true })).toEqual(['who was notified', 'actions', 'result'])
    const findings = drillFindings({ ...drill, receiptItemId: 'kri-1', finishedAt: '2026-10-19T09:35:00Z' }, recallTrace(state, { scenario: 'supplier_lot', receiptItemId: 'kri-1' }))
    expect(findings).toMatchObject({ elapsedMinutes: 95, tracedWithinTarget: true, accountedPercent: 100, batchesCount: 1, affectedDays: 3 })
    expect(findings.traceSnapshot.batches).toHaveLength(1)
  })

  it('shows the last drill and warns when none was done within the interval', () => {
    const today = todayKey()
    expect(recallSummary(state, today)).toMatchObject({ overdue: false, months: 12 })
    expect(recallSummary(state, today).last.code).toBe('ANK-0002')
    expect(recallSummary({ ...state, recallDrills: [] }, today).overdue).toBe(true)
    expect(recallSummary({ ...state, recallDrills: state.recallDrills.filter(row => row.code === 'ANK-0001') }, today).overdue).toBe(false)
    expect(recallSummary({ ...state, recallDrills: state.recallDrills.filter(row => row.code === 'ANK-0001') }, addDays(today, 200)).overdue).toBe(true)
  })

  it('prints the drill report on the shared layout', () => {
    const drill = state.recallDrills.find(row => row.code === 'ANK-0002')
    const doc = recallDrillDocument(drill, drill.traceSnapshot)
    expect(doc.kind).toBe('Άσκηση ανάκλησης')
    expect(doc.code).toBe('ANK-0002')
    expect(doc.sections.map(section => section.title)).toContain('Ισοζύγιο μάζας')
    expect(doc.meta.find(([label]) => label === 'Χρόνος ιχνηλάτησης')[1]).toMatch(/^1 ώρ\. 35 λεπ\./)
    expect(recallDrillDocument(drill, drill.traceSnapshot, { language: 'en' }).kind).toBe('Mock recall drill')
  })
})

describe('Kitchen recall drill storage', () => {
  beforeEach(() => configureDataEnvironment({ mode: 'demo', demoAccountId: `kitchen-recall-${Math.random()}` }))

  it('maps the drill to its columns, the trace to a json snapshot', () => {
    const row = toRow('kitchen_recall_drills', { scenario: 'product', productId: 'kp-1', productName: ' Γάλα ', targetMinutes: '240', traceSnapshot: { batches: [] }, tracedWithinTarget: true, finishedAt: '' })
    expect(row).toEqual({ scenario: 'product', product_id: null, product_name: 'Γάλα', target_minutes: 240, trace_snapshot: { batches: [] }, traced_within_target: true, finished_at: null })
    expect(fromRow('kitchen_recall_drills', { id: 'x', code: 'ANK-0001', trace_snapshot: null, accounted_percent: 98.5 })).toMatchObject({ code: 'ANK-0001', traceSnapshot: null, accountedPercent: 98.5, dishName: '' })
  })

  it('numbers and keeps a drill in the demo', async () => {
    const before = await loadKitchen(null)
    expect(before.recallDrills).toHaveLength(2)
    const saved = await saveRecallDrill(null, { ...newRecallDrill(), receiptItemId: 'kri-3' })
    expect(saved.code).toBe('ANK-0003')
    const after = await loadKitchen(null)
    expect(after.recallDrills.find(row => row.id === saved.id)).toMatchObject({ code: 'ANK-0003', status: 'draft' })
  })

  it('keeps RLS on the drills table as on the other kitchen records', () => {
    const sql = fs.readFileSync('supabase/migrations/20261128100000_kitchen_recall_drills.sql', 'utf8')
    expect(sql).toContain('alter table public.kitchen_recall_drills enable row level security')
    expect(sql).toContain("private.current_user_kitchen_orgs('view')")
    expect(sql).toContain("private.current_user_kitchen_orgs('record')")
    expect(sql).toContain("private.current_user_kitchen_orgs('manage')")
    expect(sql).toContain('target_minutes integer not null default 240')
  })
})
