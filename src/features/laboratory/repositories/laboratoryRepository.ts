import type { RepositoryResult } from '../../../core/data/repositoryResult'
import type { AmrDraft, AstDraft, CommunicationDraft, EnvironmentalStandard, LabSample, ResultDraft, SampleDraft, SamplePatch } from '../laboratoryTypes'

const REQUIRED_METHODS = ['list', 'get', 'create', 'update']

// One patient's samples: the patient record and its surveillance episodes.
export interface LaboratoryScope { patientRecordId?: string | null, caseIds?: unknown[] | null }
// The infection-control decision on a positive sample.
export interface SampleReviewDecision { status: string, reason?: string | null, note?: string | null, caseId?: string | null }

// The same actions on the demo list and on the database (samples are normalized records).
export interface LaboratoryRepository {
  environment: 'demo' | 'production'
  list(scope?: LaboratoryScope | null, options?: { since?: string | null }): Promise<RepositoryResult<LabSample[]>>
  listAll?(): Promise<RepositoryResult<LabSample[]>>
  get(sampleCode: string): Promise<LabSample | null>
  create(input: { patientRecordId?: string | null, draft: SampleDraft }): Promise<LabSample>
  remove(sampleCode: string): Promise<boolean>
  update(sampleCode: string, patch: SamplePatch): Promise<LabSample | null>
  updateStatus(sampleCode: string, status: string, patch?: SamplePatch): Promise<LabSample | null>
  saveResult(sampleCode: string, draft: ResultDraft): Promise<LabSample | null>
  addAst(sampleCode: string, resultId: string, draft: AstDraft): Promise<LabSample | null>
  saveAmr(sampleCode: string, resultId: string, draft: AmrDraft): Promise<LabSample | null>
  communicate(sampleCode: string, resultId: string, draft: CommunicationDraft): Promise<LabSample | null>
  markDocumentsReviewed(sampleCode: string): Promise<LabSample | null>
  finalize(sampleCode: string): Promise<LabSample | null>
  reopen(sampleCode: string, reason?: string | null): Promise<LabSample | null>
  loadStandards(): Promise<EnvironmentalStandard[]>
  listAwaitingReview(): Promise<LabSample[]>
  review(sample: Partial<Pick<LabSample, 'id' | 'recordId'>>, decision: SampleReviewDecision): Promise<boolean>
}

export function defineLaboratoryRepository(repository: LaboratoryRepository): LaboratoryRepository {
  if (!repository || typeof repository !== 'object') throw new Error('LABORATORY_REPOSITORY_REQUIRED')
  for (const method of REQUIRED_METHODS) {
    if (typeof (repository as unknown as Record<string, unknown>)[method] !== 'function') throw new Error(`LABORATORY_REPOSITORY_METHOD_REQUIRED:${method}`)
  }
  return Object.freeze({ ...repository })
}

export function createLaboratoryRepositorySelector({ demo, production }: { demo: LaboratoryRepository, production: LaboratoryRepository }) {
  const demoRepository = defineLaboratoryRepository(demo)
  const productionRepository = defineLaboratoryRepository(production)
  return ({ isDemo }: { isDemo: boolean }) => isDemo ? demoRepository : productionRepository
}
