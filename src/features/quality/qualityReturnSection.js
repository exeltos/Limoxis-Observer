import { writeSessionValue } from '../../core/storage/browserStorage'

// The Quality Center tab to show when the user comes back from a record.
export const QUALITY_RETURN_KEY = 'limoxis.quality.returnSection'
export const rememberQualitySection = (section) => writeSessionValue(QUALITY_RETURN_KEY, section)

// The Center's tabs; «indicators» holds the registers, the objectives and the
// satisfaction surveys, «resources» the equipment and the suppliers.
export const QUALITY_TABS = ['overview', 'reports', 'deviations', 'actions', 'audits', 'risks', 'indicators', 'resources']
export const INDICATOR_VIEWS = ['registers', 'objectives', 'surveys']
export const RESOURCE_VIEWS = ['equipment', 'suppliers']

// A remembered section as { tab, view }. Sections remembered before the tabs
// were split (incidents, findings, capas, management, measure:…) still land on the right one.
// The meetings and the management review are in «Meetings & decisions» (/meetings) now: none.
export function qualityTabOf(section = '') {
  const [name, view] = String(section || '').split(':')
  if (name === 'indicators') return { tab: 'indicators', view: INDICATOR_VIEWS.includes(view) ? view : null }
  if (name === 'resources') return { tab: 'resources', view: RESOURCE_VIEWS.includes(view) ? view : null }
  if (QUALITY_TABS.includes(name)) return { tab: name, view: null }
  if (name === 'incidents') return { tab: 'reports', view: null }
  if (name === 'findings' || name === 'capas') return { tab: 'actions', view: null }
  if (name === 'review' || name === 'reviews' || name === 'meetings' || (name === 'measure' && view === 'reviews')) return null
  if (INDICATOR_VIEWS.includes(name)) return { tab: 'indicators', view: name }
  if (name === 'measure') return { tab: 'indicators', view: INDICATOR_VIEWS.includes(view) ? view : null }
  if (name === 'management') return { tab: 'indicators', view: 'objectives' }
  return null
}
