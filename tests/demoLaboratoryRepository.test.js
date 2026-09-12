import { afterEach, describe, expect, it } from 'vitest'
import { laboratorySamples } from '../src/features/laboratory/laboratoryDemoData'
import { createDemoLaboratoryRepository } from '../src/features/laboratory/repositories/demoLaboratoryRepository'

describe('Demo laboratory repository adapter', () => {
  const originalLength = laboratorySamples.length
  afterEach(() => laboratorySamples.splice(0, laboratorySamples.length - originalLength))

  it('returns the canonical repository result and normalized rows', async () => {
    const repository = createDemoLaboratoryRepository()
    const result = await repository.list()
    expect(result.readiness).toBe('ready')
    expect(result.data[0]).toEqual(expect.objectContaining({ code: expect.any(String), subjectType: 'patient' }))
  })

  it('creates through the shared contract and exposes the new sample', async () => {
    const repository = createDemoLaboratoryRepository({ actorName: 'Test actor' })
    const created = await repository.create({ draft: { sampleCode: 'LAB-PARITY-001', patient: 'Patient', patientId: 'PT-1', type: 'bloodCulture', collectedAt: '2026-09-12T10:00:00Z' } })
    expect(created).toEqual(expect.objectContaining({ code: 'LAB-PARITY-001', sampleType: 'bloodCulture', status: 'collected' }))
    expect(await repository.get('LAB-PARITY-001')).toEqual(created)
  })
})
