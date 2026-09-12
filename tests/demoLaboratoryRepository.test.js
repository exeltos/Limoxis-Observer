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

  it('drives the canonical record workflow without cloud calls', async () => {
    const repository = createDemoLaboratoryRepository()
    await repository.create({ draft: { sampleCode: 'LAB-PARITY-002', patient: 'Patient', patientId: 'PT-2', type: 'bloodCulture' } })
    await repository.updateStatus('LAB-PARITY-002', 'received', { receivedAt: '2026-09-12T11:00:00Z' })
    await repository.saveResult('LAB-PARITY-002', { result: 'positive', organism: 'Organism', validationStatus: 'draft', critical: true })
    await repository.addAst('LAB-PARITY-002', { drug: 'Drug', sir: 'S' })
    await repository.communicate('LAB-PARITY-002', { recipientName: 'Clinician', method: 'phone' })
    await repository.markDocumentsReviewed('LAB-PARITY-002')
    await repository.finalize('LAB-PARITY-002')
    const sample = await repository.get('LAB-PARITY-002')
    expect(sample).toEqual(expect.objectContaining({ status: 'completed', finalizedAt: expect.any(String) }))
    expect(sample.microbiologyResults[0].ast).toHaveLength(1)
    expect(sample.microbiologyResults[0].communications).toHaveLength(1)
  })
})
