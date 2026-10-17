import { writeSessionValue } from '../../core/storage/browserStorage'

// The Quality Center tab to show when the user comes back from a record.
export const QUALITY_RETURN_KEY = 'limoxis.quality.returnSection'
export const rememberQualitySection = (section) => writeSessionValue(QUALITY_RETURN_KEY, section)

// The Center's tabs; «indicators» holds the registers and the objectives.
export const QUALITY_TABS = ['overview', 'reports', 'deviations', 'actions', 'audits', 'risks', 'indicators', 'review']
export const INDICATOR_VIEWS = ['registers', 'objectives']

// A remembered section as { tab, view }. Sections remembered before the tabs
// were split (incidents, findings, capas, management, measure:…) still land on the right one.
export function qualityTabOf(section = '') {
  const [name, view] = String(section || '').split(':')
  if (name === 'indicators') return { tab: 'indicators', view: INDICATOR_VIEWS.includes(view) ? view : null }
  if (QUALITY_TABS.includes(name)) return { tab: name, view: null }
  if (name === 'incidents') return { tab: 'reports', view: null }
  if (name === 'findings' || name === 'capas') return { tab: 'actions', view: null }
  if (name === 'reviews' || (name === 'measure' && view === 'reviews')) return { tab: 'review', view: null }
  if (INDICATOR_VIEWS.includes(name)) return { tab: 'indicators', view: name }
  if (name === 'measure') return { tab: 'indicators', view: INDICATOR_VIEWS.includes(view) ? view : null }
  if (name === 'management') return { tab: 'indicators', view: 'objectives' }
  return null
}
