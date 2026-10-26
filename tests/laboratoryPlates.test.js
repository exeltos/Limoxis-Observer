import { describe, expect, it, vi } from 'vitest'
import { groupPlates, needsReceipt, plateKey, receivePlate } from '../src/features/laboratory/laboratoryPlates'

const sample = (id, extra = {}) => ({ id, subjectType: 'environment', type: 'surface', department: 'ΜΕΘ', departmentId: 'd1', environmentalBatchId: 'ENV-B-1', environmentalPlate: 'Α', environmentalPosition: '1', collectedAt: '2026-10-01T08:00:00+03:00', status: 'collected', microbiologyResults: [], ...extra })

describe('culture plates in the laboratory', () => {
  it('groups the samples of one plate of one sampling, by position', () => {
    const plates = groupPlates([sample('S3', { environmentalPosition: '10' }), sample('S1', { environmentalPosition: '2' }), sample('S2', { environmentalPosition: '1' }), sample('X', { environmentalPlate: 'Β' })])
    expect(plates.map(plate => [plate.plate, plate.samples.map(s => s.id)])).toEqual(expect.arrayContaining([['Α', ['S2', 'S1', 'S3']], ['Β', ['X']]]))
    expect(plates.find(plate => plate.plate === 'Α').counts.total).toBe(3)
  })

  it('keeps plates of another department, batch or letter apart, and ignores samples without a plate', () => {
    expect(plateKey(sample('a'))).not.toBe(plateKey(sample('b', { departmentId: 'd2' })))
    expect(plateKey(sample('a'))).not.toBe(plateKey(sample('b', { environmentalBatchId: 'ENV-B-2' })))
    expect(plateKey(sample('a'))).toBe(plateKey(sample('b', { environmentalPlate: 'α' })))
    expect(plateKey(sample('a', { environmentalPlate: '' }))).toBeNull()
    expect(groupPlates([sample('a', { environmentalPlate: '' })])).toEqual([])
  })

  it('waits for receipt until every open position is received; rejected ones never wait', () => {
    expect(needsReceipt(sample('a'))).toBe(true)
    expect(needsReceipt(sample('a', { receivedAt: '2026-10-01T09:00:00+03:00', status: 'processing' }))).toBe(false)
    expect(needsReceipt(sample('a', { status: 'rejected' }))).toBe(false)
    const mixed = groupPlates([sample('a'), sample('b', { receivedAt: '2026-10-01T09:00:00+03:00', status: 'processing' })])[0]
    expect(mixed.status).toBe('awaiting')
    expect(mixed.counts.awaiting).toBe(1)
    const received = groupPlates([sample('a', { receivedAt: 'x', status: 'processing' }), sample('b', { status: 'rejected' })])[0]
    expect(received.status).toBe('processing')
    const done = groupPlates([sample('a', { status: 'completed', receivedAt: 'x' })])[0]
    expect(done.status).toBe('completed')
  })

  it('counts the positions outside the limits', () => {
    const plate = groupPlates([sample('a', { microbiologyResults: [{ withinLimit: false }] }), sample('b', { microbiologyResults: [{ withinLimit: true }] })])[0]
    expect(plate.counts.outside).toBe(1)
    expect(plate.outside.map(s => s.id)).toEqual(['a'])
  })

  it('receives every waiting position like a single sample is received, and reports a failure with how far it got', async () => {
    const plate = groupPlates([sample('a'), sample('b'), sample('c', { status: 'processing', receivedAt: 'x' })])[0]
    const updateStatus = vi.fn().mockResolvedValue(null)
    const now = new Date('2026-10-02T07:00:00Z')
    expect(await receivePlate({ updateStatus }, plate, now)).toBe(2)
    expect(updateStatus.mock.calls).toEqual([['a', 'processing', { receivedAt: now }], ['b', 'processing', { receivedAt: now }]])
    const failing = vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('boom'))
    await expect(receivePlate({ updateStatus: failing }, plate, now)).rejects.toMatchObject({ received: 1, message: 'boom' })
  })
})
