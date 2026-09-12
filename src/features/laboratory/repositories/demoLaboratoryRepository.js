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
  })
}
