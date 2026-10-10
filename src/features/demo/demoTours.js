import { DEMO_TOUR_STOPS } from './demoTourStops'

// Guided tours of the Demo evaluation scenarios (DemoGuidedTour): for each
// scenario, the elements of the real screens to press, one after the other,
// each with a short note. A stop belongs to one step of its scenario (`step`,
// or null for scenarios without steps); once a screen checks that step off,
// its stops are skipped. A stop's `target` is a CSS selector, optionally with
// the text (Greek, English) the element contains, the first match taken.
export const DEMO_TOURS = DEMO_TOUR_STOPS

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('el')

export function findTourTarget(target, language = 'el') {
  if (!target?.sel || typeof document === 'undefined') return null
  let elements
  try {
    elements = [...document.querySelectorAll(target.sel)]
  } catch {
    return null
  }
  const text = target.text ? normalize(target.text[language === 'en' ? 1 : 0]) : ''
  if (!text) return elements[0] || null
  return elements.find((element) => normalize(element.innerText || element.textContent).includes(text) || normalize(element.getAttribute('aria-label')).includes(text)) || null
}

// The stops still ahead: those of steps not yet done, in order.
export function demoTourStops(scenarioKey, stepsDone = {}) {
  return (DEMO_TOURS[scenarioKey] || []).filter((stop) => !stop.step || !stepsDone[stop.step])
}

export const hasDemoTour = (scenarioKey) => Boolean(DEMO_TOURS[scenarioKey]?.length)
