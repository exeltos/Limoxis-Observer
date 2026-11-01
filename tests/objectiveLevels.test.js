import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { monthlyMean, objectiveLevel, objectiveSource } from '../src/features/quality/review/objectiveSources'
import { TARGETS, targetsFromObjectives } from '../src/features/executive/executiveModel'

describe('objectives on three levels, measured three ways', () => {
  it('reads the level from the objective, else from its department, register or committee', () => {
    expect(objectiveLevel({ level: 'committee' })).toBe('committee')
    expect(objectiveLevel({ registerId: 'r1' })).toBe('department')
    expect(objectiveLevel({ departmentId: 'd1' })).toBe('department')
    expect(objectiveLevel({ committeeId: 'c1' })).toBe('committee')
    expect(objectiveLevel({})).toBe('hospital')
  })
  it('is measured by a register, a platform indicator or a value per month', () => {
    expect(objectiveSource({ registerId: 'r1', indicatorKey: 'los' })).toBe('register')
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
  })
  it('keeps the monthly values in their own table, closed with the Quality module', () => {
    const sql = fs.readFileSync('supabase/migrations/20261231220000_quality_objective_levels_values.sql', 'utf8')
    expect(sql).toContain('create table if not exists public.quality_objective_values')
    expect(sql).toContain('quality_objective_values_module_gate')
    expect(sql).toContain("check (level is null or level in ('hospital','department','committee'))")
  })
})
