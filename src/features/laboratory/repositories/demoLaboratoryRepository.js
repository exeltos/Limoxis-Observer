import { repositoryResult } from '../../../core/data/repositoryResult'
import { createDemoLabSample, getLabSample, laboratorySamples, updateLabSample } from '../laboratoryDemoData'
import { normalizeLaboratorySample, normalizeLaboratorySamples } from '../model/laboratoryModel'
import { defineLaboratoryRepository } from './laboratoryRepository'

function nextSampleCode() {
  return `LAB-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${String(laboratorySamples.length + 1).padStart(3, '0')}`
}

export function createDemoLaboratoryRepository({ actorName = 'Demo user' } = {}) {
  return defineLaboratoryRepository({
    environment: 'demo',
    async list() {
      return repositoryResult(normalizeLaboratorySamples(laboratorySamples))
    },
    async get(sampleCode) {
      const sample = getLabSample(sampleCode)
      return sample ? normalizeLaboratorySample(sample) : null
    },
    async create({ draft }) {
      const now = new Date().toISOString()
      const sample = createDemoLabSample({
        id: draft.sampleCode || nextSampleCode(),
        ...draft,
        status: draft.collectedAt ? 'collected' : 'requested',
        result: null,
        resultStatus: 'draft',
        organism: null,
        resistance: null,
        critical: false,
        ast: [],
        communications: [],
        attachments: [],
        timeline: [{ at: now, type: 'sampleRequested', actor: actorName }],
      })
      return normalizeLaboratorySample(sample)
    },
    async update(sampleCode, patch) {
      const sample = updateLabSample(sampleCode, current => ({ ...current, ...patch }))
      return sample ? normalizeLaboratorySample(sample) : null
    },
    async updateStatus(sampleCode, status, patch = {}) {
      return this.update(sampleCode, { ...patch, status })
    },
    async saveResult(sampleCode, draft) {
      const result = { ...draft, id: draft.id || `${sampleCode}-result`, resultStatus: draft.validationStatus || draft.resultStatus || 'draft', ast: draft.ast || [], communications: draft.communications || [] }
      return this.update(sampleCode, { result: result.result, resultStatus: result.resultStatus, organism: result.organism, resistance: result.resistance, critical: result.critical, resultedAt: result.resultedAt || new Date().toISOString(), microbiologyResults: [result] })
    },
    async addAst(sampleCode, draft) {
      const current = getLabSample(sampleCode)
      const result = normalizeLaboratorySample(current).microbiologyResults[0]
      const ast = [...(result?.ast || current?.ast || []), { ...draft, id: draft.id || `AST-${Date.now()}` }]
      return this.update(sampleCode, { ast, microbiologyResults: result ? [{ ...result, ast }] : [] })
    },
    async communicate(sampleCode, draft) {
      const current = getLabSample(sampleCode)
      const result = normalizeLaboratorySample(current).microbiologyResults[0]
      const communication = { ...draft, id: `COMM-${Date.now()}`, at: draft.at || new Date().toISOString(), to: draft.recipientName }
      const communications = [...(result?.communications || current?.communications || []), communication]
      return this.update(sampleCode, { communications, microbiologyResults: result ? [{ ...result, communications }] : [] })
    },
    async markDocumentsReviewed(sampleCode) { return this.update(sampleCode, { documentsReviewedAt: new Date().toISOString() }) },
    async finalize(sampleCode) { return this.update(sampleCode, { finalizedAt: new Date().toISOString(), status: 'completed' }) },
    async reopen(sampleCode, reason) { return this.update(sampleCode, { finalizedAt: null, documentsReviewedAt: null, correctionReason: reason, status: 'processing' }) },
    async loadStandards() { return [] },
  })
}
