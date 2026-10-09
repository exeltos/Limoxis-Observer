import { describe, expect, it } from 'vitest'
import { demoSurveillanceList, getClinicalCase } from '../src/features/surveillance/clinicalDemoData.js'

describe('Demo surveillance history', () => {
  it('gives every Demo record a history tab with events', () => {
    for (const row of demoSurveillanceList()) expect(getClinicalCase(row.id).timeline.length, row.id).toBeGreaterThan(0)
  })

  it('derives the history of a record written without one from its contents', () => {
    const types = getClinicalCase('SUR-260045').timeline.map(event => event.type)
    expect(types).toEqual(expect.arrayContaining(['surveillance_start', 'clinical_assessment', 'sample_collected', 'sample_result', 'therapy_started']))
  })
})
