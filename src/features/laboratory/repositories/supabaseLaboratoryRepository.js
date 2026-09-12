import { repositoryResult } from '../../../core/data/repositoryResult'
import { createLaboratorySample, loadLaboratorySample, loadLaboratorySamples, updateLaboratorySampleStatus } from '../laboratoryCloudService'
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
  })
}
