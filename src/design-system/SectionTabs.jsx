import { createContext, useContext } from 'react'
import { CanonicalTabs } from './CanonicalTabs'

// A section that brings several screens under one menu entry (see
// core/navigation/sectionTabs.js) gives its screens this context: the page
// shows the section's name and its tabs under the header, whichever screen is open.
// value: { title, ariaLabel, items: [{ value, label, icon }], value, onChange }
const SectionTabsContext = createContext(null)

export function SectionTabsProvider({ value, children }) {
  return <SectionTabsContext.Provider value={value}>{children}</SectionTabsContext.Provider>
}

export function useSectionTabs() {
  return useContext(SectionTabsContext)
}

export function SectionTabStrip({ section }) {
  if (!section || section.items.length < 2) return null
  return <CanonicalTabs className="section-tabs" items={section.items} value={section.value} onChange={section.onChange} ariaLabel={section.ariaLabel || section.title} />
}
