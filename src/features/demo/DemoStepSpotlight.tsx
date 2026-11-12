import { useEffect } from 'react'

const HIGHLIGHT = 'demo-step-highlight'

// Demo evaluation guide: outlines the element where the active scenario's next
// step happens. Screens mark those elements with data-demo-step="scenario:step";
// the outline follows them as they mount and unmount, and is removed once the
// step is done or the scenario closes. Rendered only for a Demo evaluator.
export function DemoStepSpotlight({ target }) {
  useEffect(() => {
    if (!target || typeof document === 'undefined') return undefined
    let marked = []
    const apply = () => {
      const found = [...document.querySelectorAll(`[data-demo-step="${target}"]`)]
      for (const element of marked) if (!found.includes(element)) element.classList.remove(HIGHLIGHT)
      for (const element of found) element.classList.add(HIGHLIGHT)
      marked = found
    }
    apply()
    // Only additions and removals are watched, so adding the class cannot loop.
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      for (const element of marked) element.classList.remove(HIGHLIGHT)
    }
  }, [target])
  return null
}
