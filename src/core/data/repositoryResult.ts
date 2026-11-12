export const READINESS = Object.freeze({
  READY: 'ready',
  NOT_CONFIGURED: 'not_configured',
  EMPTY: 'empty',
})

const validReadiness = new Set(Object.values(READINESS))

export function repositoryResult(data, { readiness, missingConfiguration = [] } = {}) {
  const resolvedReadiness = readiness ?? (Array.isArray(data) && data.length === 0 ? READINESS.EMPTY : READINESS.READY)
  if (!validReadiness.has(resolvedReadiness)) throw new Error(`INVALID_REPOSITORY_READINESS:${resolvedReadiness}`)
  if (!Array.isArray(missingConfiguration)) throw new Error('INVALID_MISSING_CONFIGURATION')
  if (resolvedReadiness === READINESS.NOT_CONFIGURED && missingConfiguration.length === 0) {
    throw new Error('MISSING_CONFIGURATION_DETAILS_REQUIRED')
  }
  return { data, readiness: resolvedReadiness, missingConfiguration: [...missingConfiguration] }
}

export function notConfiguredResult(data, missingConfiguration) {
  return repositoryResult(data, { readiness: READINESS.NOT_CONFIGURED, missingConfiguration })
}

export function isRepositoryResult(value) {
  return Boolean(value && typeof value === 'object' && 'data' in value && validReadiness.has(value.readiness) && Array.isArray(value.missingConfiguration))
}
