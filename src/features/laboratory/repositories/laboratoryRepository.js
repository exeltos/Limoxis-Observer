const REQUIRED_METHODS = ['list', 'get', 'create', 'update']

export function defineLaboratoryRepository(repository) {
  if (!repository || typeof repository !== 'object') throw new Error('LABORATORY_REPOSITORY_REQUIRED')
  for (const method of REQUIRED_METHODS) {
    if (typeof repository[method] !== 'function') throw new Error(`LABORATORY_REPOSITORY_METHOD_REQUIRED:${method}`)
  }
  return Object.freeze({ ...repository })
}

export function createLaboratoryRepositorySelector({ demo, production }) {
  const demoRepository = defineLaboratoryRepository(demo)
  const productionRepository = defineLaboratoryRepository(production)
  return ({ isDemo }) => isDemo ? demoRepository : productionRepository
}
