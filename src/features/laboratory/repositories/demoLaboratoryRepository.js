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
    async remove(sampleCode) {
      const index = laboratorySamples.findIndex(item => String(item.id) === String(sampleCode))
      if (index >= 0) laboratorySamples.splice(index, 1)
      return index >= 0
    },
    async update(sampleCode, patch) {
      const sample = updateLabSample(sampleCode, current => ({ ...current, ...patch }))
      return sample ? normalizeLaboratorySample(sample) : null
    },
    async updateStatus(sampleCode, status, patch = {}) {
      return this.update(sampleCode, { ...patch, status })
    },
    async saveResult(sampleCode, draft) {
      const current = getLabSample(sampleCode)
      const previous = current ? normalizeLaboratorySample(current).microbiologyResults[0] : null
      const result = { ...draft, id: draft.id || previous?.id || `${sampleCode}-result`, resultStatus: draft.validationStatus || draft.resultStatus || 'draft', ast: draft.ast || previous?.ast || [], amr: draft.amr || previous?.amr || [], communications: draft.communications || previous?.communications || [] }
      const patch = { result: result.result, resultStatus: result.resultStatus, organism: result.organism, resistance: result.resistance ?? previous?.resistance ?? null, method: result.method, ast: result.ast, communications: result.communications, critical: result.critical, resultedAt: result.resultedAt || new Date().toISOString(), microbiologyResults: [result] }
      if (['validated', 'amended'].includes(result.resultStatus)) patch.status = 'completed'
      return this.update(sampleCode, patch)
    },
    async addAst(sampleCode, resultId, draft) {
      const current = getLabSample(sampleCode)
      const result = current ? normalizeLaboratorySample(current).microbiologyResults[0] : null
      const ast = [...(result?.ast || current?.ast || []), { ...draft, id: draft.id || `AST-${Date.now()}` }]
      return this.update(sampleCode, { ast, microbiologyResults: result ? [{ ...result, ast }] : [] })
    },
    async saveAmr(sampleCode, resultId, draft) { const current=await this.get(sampleCode);if(!current)return null;const result=(current.microbiologyResults||[]).find(x=>x.id===resultId)||(current.microbiologyResults||[])[0];if(!result)return current;const amr=[...(result.amr||[]),{...draft,id:'AMR-'+Date.now(),classifiedAt:new Date().toISOString()}];return this.update(sampleCode,{microbiologyResults:(current.microbiologyResults||[]).map(x=>x.id===result.id?{...x,amr,resistance:draft.classification}:x),resistance:draft.classification}) },
    async communicate(sampleCode, resultId, draft) {
      const current = getLabSample(sampleCode)
      const result = current ? normalizeLaboratorySample(current).microbiologyResults[0] : null
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
