// @vitest-environment jsdom
// Every Demo scenario has a guided tour whose stops belong to its own steps,
// point at a valid selector and speak both languages.
import { describe, expect, it } from 'vitest'
import { DEMO_ALL_SCENARIOS } from '../src/features/demo/demoScenarios'
import { DEMO_TOURS } from '../src/features/demo/demoTours'

describe('guided tour stops', () => {
  it('cover every scenario', () => {
    expect(Object.keys(DEMO_TOURS).sort()).toEqual(DEMO_ALL_SCENARIOS.map(scenario => scenario.key).sort())
  })

  it('belong to the scenario steps, in step order, with valid selectors and both languages', () => {
    for (const scenario of DEMO_ALL_SCENARIOS) {
      const steps = (scenario.steps || []).map(step => step.id)
      const stops = DEMO_TOURS[scenario.key]
      expect(stops.length, scenario.key).toBeGreaterThan(0)
      let last = -1
      for (const stop of stops) {
        if (steps.length) {
          const at = steps.indexOf(stop.step)
          expect(at, `${scenario.key}: ${stop.step}`).toBeGreaterThanOrEqual(last)
          last = at
        } else expect(stop.step, scenario.key).toBeNull()
        expect(() => document.querySelectorAll(stop.target.sel), stop.target.sel).not.toThrow()
        for (const field of ['titleEl', 'titleEn', 'textEl', 'textEn']) expect(stop[field]?.trim(), `${scenario.key} ${field}`).toBeTruthy()
        if (stop.target.text) expect(stop.target.text).toHaveLength(2)
        expect([undefined, 'click']).toContain(stop.advance)
      }
    }
  })
})
