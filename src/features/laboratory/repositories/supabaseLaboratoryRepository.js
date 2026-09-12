import { repositoryResult } from '../../../core/data/repositoryResult'
import { addAstResult, communicateCriticalResult, createLaboratorySample, finalizeLaboratorySample, loadEnvironmentalStandards, loadLaboratorySample, loadLaboratorySamples, markDocumentsReviewed, reopenLaboratorySample, saveMicrobiologyResult, updateLaboratorySampleStatus } from '../laboratoryCloudService'
import { normalizeLaboratorySample, normalizeLaboratorySamples } from '../model/laboratoryModel'
import { defineLaboratoryRepository } from './laboratoryRepository'

export function createSupabaseLaboratoryRepository({ organizationId } = {}) {
  return defineLaboratoryRepository({
    environment: 'production',
    async list() {
      const rows = await loadLaboratorySamples(organizationId)
      return repositoryResult(normalizeLaboratorySamples(rows))
    },
    async get(sampleCode) {
      const sample = await loadLaboratorySample(organizationId, sampleCode)
      return sample ? normalizeLaboratorySample(sample) : null
    },
    async create({ patientRecordId, draft }) {
      const sample = await createLaboratorySample(organizationId, patientRecordId, draft)
      return normalizeLaboratorySample(sample)
    },
    async update(sampleCode, patch) {
      const current = await loadLaboratorySample(organizationId, sampleCode)
      if (!current) return null
      const status = patch.status || current.status
      await updateLaboratorySampleStatus(organizationId, current.recordId, status, patch)
      const updated = await loadLaboratorySample(organizationId, sampleCode)
      return updated ? normalizeLaboratorySample(updated) : null
    },
    async updateStatus(sampleCode, status, patch = {}) {
      const current = await loadLaboratorySample(organizationId, sampleCode)
      if (!current) return null
      await updateLaboratorySampleStatus(organizationId, current.recordId, status, patch)
      return this.get(sampleCode)
    },
    async saveResult(sampleCode, draft) {
      const current = await loadLaboratorySample(organizationId, sampleCode)
      if (!current) return null
      await saveMicrobiologyResult(organizationId, current.recordId, draft)
      return this.get(sampleCode)
    },
    async addAst(sampleCode, resultId, draft) { await addAstResult(organizationId, resultId, draft);return this.get(sampleCode) },
    async communicate(sampleCode, resultId, draft) { await communicateCriticalResult(organizationId, resultId, draft);return this.get(sampleCode) },
    async markDocumentsReviewed(sampleCode) { const current=await loadLaboratorySample(organizationId,sampleCode);if(!current)return null;await markDocumentsReviewed(organizationId,current.recordId);return this.get(sampleCode) },
    async finalize(sampleCode) { const current=await loadLaboratorySample(organizationId,sampleCode);if(!current)return null;await finalizeLaboratorySample(organizationId,current.recordId);return this.get(sampleCode) },
    async reopen(sampleCode, reason) { const current=await loadLaboratorySample(organizationId,sampleCode);if(!current)return null;await reopenLaboratorySample(organizationId,current.recordId,reason);return this.get(sampleCode) },
    async loadStandards() { return loadEnvironmentalStandards(organizationId) },
  })
}
