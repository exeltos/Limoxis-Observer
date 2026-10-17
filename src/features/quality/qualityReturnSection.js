import { writeSessionValue } from '../../core/storage/browserStorage'

// The Quality Center tab to show when the user comes back from a record.
export const QUALITY_RETURN_KEY = 'limoxis.quality.returnSection'
export const rememberQualitySection = (section) => writeSessionValue(QUALITY_RETURN_KEY, section)

// The Center's tabs; «measure» holds registers, objectives and reviews.
export const QUALITY_TABS = ['overview', 'reports', 'deviations', 'actions', 'audits', 'risks', 'measure']
export const MEASURE_VIEWS = ['registers', 'objectives', 'reviews']

// A remembered section as { tab, view }. Records opened before the five tabs
// (incidents, findings, capas, management) still land on the right one.
export function qualityTabOf(section = '') {
  const [name, view] = String(section || '').split(':')
  if (QUALITY_TABS.includes(name)) return { tab: name, view: MEASURE_VIEWS.includes(view) ? view : null }
  if (name === 'incidents') return { tab: 'reports', view: null }
  if (name === 'findings' || name === 'capas') return { tab: 'actions', view: null }
  if (MEASURE_VIEWS.includes(name)) return { tab: 'measure', view: name }
  if (name === 'management') return { tab: 'measure', view: 'objectives' }
  return null
}
