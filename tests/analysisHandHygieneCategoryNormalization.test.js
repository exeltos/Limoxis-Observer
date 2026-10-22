import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { mergeDomainMetrics } from '../src/features/analysis/analysisDomainMerge'

describe('hand hygiene professional category normalization', () => {
  it('combines legacy and current nursing labels for one hospital', () => {
    const result = mergeDomainMetrics([
      {
        handHygiene: {
          sessions: 2,
          observations: 22,
          compliant: 19,
          byCategory: [
            ['Νοσηλευτής/τρια', 14, 12],
            ['Νοσηλευτής / Νοσηλεύτρια', 8, 7],
          ],
        },
      },
    ])

    expect(result.handHygiene.byCategory).toEqual([['Νοσηλευτής/τρια', 22, 19]])
  })

  it('keeps unrelated professional categories separate', () => {
    const result = mergeDomainMetrics([
      {
        handHygiene: {
          byCategory: [
            ['Ιατρός', 10, 8],
            ['Μαία/Μαιευτής', 9, 8],
            ['Νοσηλευτής / Νοσηλεύτρια', 7, 6],
          ],
        },
      },
      {
        handHygiene: {
          byCategory: [
            ['Νοσηλευτής/τρια', 5, 4],
            ['Ιατρός', 2, 2],
          ],
        },
      },
    ])

    expect(result.handHygiene.byCategory).toEqual([
      ['Ιατρός', 12, 10],
      ['Νοσηλευτής/τρια', 12, 10],
      ['Μαία/Μαιευτής', 9, 8],
    ])
  })

  it('normalizes the single-hospital production analytics path before returning domains', () => {
    const source = fs.readFileSync(
      new URL('../src/features/platform/platformService.js', import.meta.url),
      'utf8',
    )
    expect(source).toContain(
      'domains:mergeDomainMetrics(scopedDomains?[scopedDomains]:[])',
    )
  })
})
