export function shouldShowPlatformAnalysisEmptyState({ organizations = [], isDemo = false } = {}) {
  return !isDemo && organizations.length === 0
}

export function platformAnalysisDataMode({ organizations = [], isDemo = false } = {}) {
  if (isDemo) return 'demo'
  return organizations.length ? 'production' : 'empty'
}
