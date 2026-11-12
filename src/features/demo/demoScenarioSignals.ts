import { DEMO_ALL_SCENARIOS, DEMO_SCENARIOS } from './demoScenarios'

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

// A step of a scenario is done (an AST saved, an AMR classified, a stage
// reviewed). Only the guide's active scenario counts it.
export const DEMO_STEP_EVENT = 'lo:demo-step-done'

export function signalDemoStep(key, step) {
  if (typeof window === 'undefined') return
  const scenario = DEMO_ALL_SCENARIOS.find((item) => item.key === key)
  if (!scenario?.steps?.some((item) => item.id === step)) return
  window.dispatchEvent(new CustomEvent(DEMO_STEP_EVENT, { detail: { key, step } }))
}

const RECORD_ROUTES = [
  ['clabsi_classification', /^\/surveillance\/(?!new(?:\/|$))[^/]+\/?$/],
  ['microbiology_mdro', /^\/laboratory\/(?!new(?:\/|$))[^/]+\/?$/],
]

export function demoScenarioForPath(pathname) {
  const path = String(pathname || '')
  return RECORD_ROUTES.find(([, pattern]) => pattern.test(path))?.[0] || null
}

// The scenario to suggest after `key` among the role's scenarios: the next
// one not done, wrapping round.
export function nextDemoScenario(key, progress = {}, scenarios = DEMO_SCENARIOS) {
  const start = scenarios.findIndex((scenario) => scenario.key === key)
  for (let step = 1; step <= scenarios.length; step++) {
    const scenario = scenarios[(start + step + scenarios.length) % scenarios.length]
    if (scenario.key !== key && !progress[scenario.key]) return scenario
  }
  return null
}
