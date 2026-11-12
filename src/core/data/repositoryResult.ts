export const READINESS = Object.freeze({
  READY: 'ready',
  NOT_CONFIGURED: 'not_configured',
  EMPTY: 'empty',
})

export type Readiness = typeof READINESS[keyof typeof READINESS]

export interface RepositoryResult<T> {
  data: T
  readiness: Readiness
  missingConfiguration: string[]
}

const validReadiness = new Set<unknown>(Object.values(READINESS))

export function repositoryResult<T>(data: T, { readiness, missingConfiguration = [] }: { readiness?: Readiness, missingConfiguration?: string[] } = {}): RepositoryResult<T> {
  const resolvedReadiness = readiness ?? (Array.isArray(data) && data.length === 0 ? READINESS.EMPTY : READINESS.READY)
  if (!validReadiness.has(resolvedReadiness)) throw new Error(`INVALID_REPOSITORY_READINESS:${resolvedReadiness}`)
  if (!Array.isArray(missingConfiguration)) throw new Error('INVALID_MISSING_CONFIGURATION')
  if (resolvedReadiness === READINESS.NOT_CONFIGURED && missingConfiguration.length === 0) {
    throw new Error('MISSING_CONFIGURATION_DETAILS_REQUIRED')
  }
  return { data, readiness: resolvedReadiness, missingConfiguration: [...missingConfiguration] }
}

export function notConfiguredResult<T>(data: T, missingConfiguration: string[]): RepositoryResult<T> {
  return repositoryResult(data, { readiness: READINESS.NOT_CONFIGURED, missingConfiguration })
}

export function isRepositoryResult(value: unknown): value is RepositoryResult<unknown> {
  return Boolean(value && typeof value === 'object' && 'data' in value && validReadiness.has((value as RepositoryResult<unknown>).readiness) && Array.isArray((value as RepositoryResult<unknown>).missingConfiguration))
}
