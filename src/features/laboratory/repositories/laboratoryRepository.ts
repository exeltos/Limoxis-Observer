import type { RepositoryResult } from '../../../core/data/repositoryResult'
import type { AnyRecord } from '../../../types/featureTypes'

const REQUIRED_METHODS = ['list', 'get', 'create', 'update']

// One patient's samples: the patient record and its surveillance episodes.
export interface LaboratoryScope { patientRecordId?: string | null, caseIds?: unknown[] | null }
// The infection-control decision on a positive sample.
export interface SampleReviewDecision { status: string, reason?: string | null, note?: string | null, caseId?: string | null }

// The same actions on the demo list and on the database (samples are normalized records).
export interface LaboratoryRepository {
  environment: 'demo' | 'production'
  list(scope?: LaboratoryScope | null, options?: { since?: string | null }): Promise<RepositoryResult<AnyRecord[]>>
  listAll?(): Promise<RepositoryResult<AnyRecord[]>>
  get(sampleCode: string): Promise<AnyRecord | null>
  create(input: { patientRecordId?: string | null, draft: AnyRecord }): Promise<AnyRecord>
  remove(sampleCode: string): Promise<boolean>
  update(sampleCode: string, patch: AnyRecord): Promise<AnyRecord | null>
  updateStatus(sampleCode: string, status: string, patch?: AnyRecord): Promise<AnyRecord | null>
  saveResult(sampleCode: string, draft: AnyRecord): Promise<AnyRecord | null>
  addAst(sampleCode: string, resultId: string, draft: AnyRecord): Promise<AnyRecord | null>
  saveAmr(sampleCode: string, resultId: string, draft: AnyRecord): Promise<AnyRecord | null>
  communicate(sampleCode: string, resultId: string, draft: AnyRecord): Promise<AnyRecord | null>
  markDocumentsReviewed(sampleCode: string): Promise<AnyRecord | null>
  finalize(sampleCode: string): Promise<AnyRecord | null>
  reopen(sampleCode: string, reason?: string | null): Promise<AnyRecord | null>
  loadStandards(): Promise<AnyRecord[]>
  listAwaitingReview(): Promise<AnyRecord[]>
  review(sample: AnyRecord, decision: SampleReviewDecision): Promise<boolean>
}

export function defineLaboratoryRepository(repository: LaboratoryRepository): LaboratoryRepository {
  if (!repository || typeof repository !== 'object') throw new Error('LABORATORY_REPOSITORY_REQUIRED')
  for (const method of REQUIRED_METHODS) {
    if (typeof (repository as unknown as AnyRecord)[method] !== 'function') throw new Error(`LABORATORY_REPOSITORY_METHOD_REQUIRED:${method}`)
  }
  return Object.freeze({ ...repository })
}

export function createLaboratoryRepositorySelector({ demo, production }: { demo: LaboratoryRepository, production: LaboratoryRepository }) {
  const demoRepository = defineLaboratoryRepository(demo)
  const productionRepository = defineLaboratoryRepository(production)
  return ({ isDemo }: { isDemo: boolean }) => isDemo ? demoRepository : productionRepository
}
