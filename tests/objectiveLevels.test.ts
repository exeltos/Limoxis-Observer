import { describe, expect, it } from 'vitest'
import { monthlyMean, objectiveLevel, objectiveSource } from '../src/features/quality/review/objectiveSources'
import { TARGETS, executiveKpis, indicatorRates, targetsFromObjectives } from '../src/features/executive/executiveModel'
import { readSource } from './helpers/readSource'

describe('objectives on three levels, measured three ways', () => {
  it('reads the level from the objective, else from its department, register or committee', () => {
    expect(objectiveLevel({ level: 'committee' })).toBe('committee')
    expect(objectiveLevel({ registerId: 'r1' })).toBe('department')
    expect(objectiveLevel({ departmentId: 'd1' })).toBe('department')
    expect(objectiveLevel({ committeeId: 'c1' })).toBe('committee')
    expect(objectiveLevel({})).toBe('hospital')
  })
  it('is measured by a register, a platform indicator or a value per month', () => {
    expect(objectiveSource({ registerId: 'r1', indicatorKey: 'los' } as never)).toBe('register')
    expect(objectiveSource({ platformIndicatorKey: 'who-hh' })).toBe('indicator')
    expect(objectiveSource({})).toBe('monthly')
    expect(monthlyMean([{ value: 90 }, { value: 93 }, { value: 88 }])).toBe(90.3)
    expect(monthlyMean([])).toBeNull()
  })
  it('gives the hospital overview the targets of the objectives on its indicators', () => {
    const year = new Date().getFullYear()
    const targets = targetsFromObjectives([{ platformIndicatorKey: 'who-hh', year, status: 'active', target: 85 }, { platformIndicatorKey: 'training', year: year - 1, status: 'active', target: 70 }], year)
    expect(targets.handHygiene).toBe(85)
    expect(targets.training).toBe(TARGETS.training)
    // The hospital's own keys count too.
    expect(targetsFromObjectives([{ platformIndicatorKey: 'bundle-compliance', year, status: 'active', target: 95 }], year).bundles).toBe(95)
  })
  it('shows on the overview the same hand hygiene as the platform indicator', () => {
    const rates = indicatorRates([{ id: 'hh-compliance' }, { id: 'training-completion' }], def => (def.id === 'hh-compliance' ? 79.1 : 88))
    expect(rates).toEqual({ handHygiene: 79.1, bundles: null, training: 88 })
    const snapshot = { domains: { handHygiene: { compliant: 803, observations: 1000 }, bundles: { averageScore: 90.2 }, training: { completed: 9, assignments: 10 } } }
    const kpis = executiveKpis(snapshot, null, TARGETS, rates)
    expect(kpis.find(item => item.id === 'handHygiene').value).toBe(79.1)
    expect(kpis.find(item => item.id === 'training').value).toBe(88)
    // Without the indicator the overview keeps its own figure.
    expect(kpis.find(item => item.id === 'bundles').value).toBe(90.2)
  })
  it('keeps the monthly values in their own table, closed with the Quality module', () => {
    const sql = readSource('supabase/migrations/20261231220000_quality_objective_levels_values.sql')
    expect(sql).toContain('create table if not exists public.quality_objective_values')
    expect(sql).toContain('quality_objective_values_module_gate')
    expect(sql).toContain("check (level is null or level in ('hospital','department','committee'))")
  })
})
