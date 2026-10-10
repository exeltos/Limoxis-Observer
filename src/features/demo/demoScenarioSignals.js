import { DEMO_SCENARIOS } from './demoScenarios'

// Completion of the Demo evaluation guide's scenarios. A screen calls
// signalDemoScenario when the scenario's task is done (a patient admitted, an
// observation saved, a CAPA created, a report downloaded); scenarios that only
// ask to look at a record are done once that record opens. Only a Demo
// evaluator's guide listens (useDemoEvaluation): elsewhere nothing happens.
export const DEMO_SCENARIO_EVENT = 'lo:demo-scenario-done'

export function signalDemoScenario(key) {
  if (typeof window === 'undefined' || !DEMO_SCENARIOS.some((scenario) => scenario.key === key)) return
  window.dispatchEvent(new CustomEvent(DEMO_SCENARIO_EVENT, { detail: { key } }))
}

const RECORD_ROUTES = [
  ['clabsi_classification', /^\/surveillance\/(?!new(?:\/|$))[^/]+\/?$/],
  ['microbiology_mdro', /^\/laboratory\/(?!new(?:\/|$))[^/]+\/?$/],
]

export function demoScenarioForPath(pathname) {
  const path = String(pathname || '')
  return RECORD_ROUTES.find(([, pattern]) => pattern.test(path))?.[0] || null
}

// The scenario to suggest after `key`: the next one not done, wrapping round.
export function nextDemoScenario(key, progress = {}) {
  const start = DEMO_SCENARIOS.findIndex((scenario) => scenario.key === key)
  for (let step = 1; step <= DEMO_SCENARIOS.length; step++) {
    const scenario = DEMO_SCENARIOS[(start + step + DEMO_SCENARIOS.length) % DEMO_SCENARIOS.length]
    if (scenario.key !== key && !progress[scenario.key]) return scenario
  }
  return null
}
