// The culture plate («τρυβλίο») as the laboratory's unit of work. Every sampled point stays its own
// sample (its own result and CFU count), but the samples of one plate in one sampling (same batch,
// department and plate letter) are read and received together: the plate groups them by position.
// Pure: the plates tab and the tests read it.
import { sampleProgress } from './laboratorySampleProgress'
import { isOutsideLimit } from './environmentalLimit'

const CLOSED_STATUSES = ['cancelled', 'rejected', 'voided']
const clean = value => String(value ?? '').trim()
const day = value => String(value || '').slice(0, 10)

export const isPlateSample = sample => Boolean(clean(sample?.environmentalPlate))

// One plate of one sampling: the batch (or, without one, the sampling day), the department and the letter.
export function plateKey(sample) {
  if (!isPlateSample(sample)) return null
  const where = clean(sample.environmentalBatchId) || day(sample.collectedAt || sample.requestedAt)
  return [where, clean(sample.departmentId || sample.department), clean(sample.environmentalPlate).toLowerCase()].join('|')
}

// Waiting for the laboratory to receive it: not received yet and not rejected or cancelled.
export const needsReceipt = sample => Boolean(sample) && !CLOSED_STATUSES.includes(sample.status) && !sampleProgress(sample).received

const byPosition = (a, b) => {
  const x = Number(a.environmentalPosition)
  const y = Number(b.environmentalPosition)
  if (Number.isFinite(x) && Number.isFinite(y) && x !== y) return x - y
  return clean(a.environmentalPosition).localeCompare(clean(b.environmentalPosition), 'el', { numeric: true })
}

export const isOutsideLimits = sample => (sample?.microbiologyResults || []).some(result => isOutsideLimit(result))

// status: 'awaiting' (something still to receive) · 'processing' · 'completed' (every open position done) · 'rejected'.
export function groupPlates(samples = []) {
  const groups = new Map()
  for (const sample of samples) {
    const key = plateKey(sample)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(sample)
  }
  return [...groups.entries()]
    .map(([key, items]) => {
      const sorted = [...items].sort(byPosition)
      const open = sorted.filter(sample => !CLOSED_STATUSES.includes(sample.status))
      const awaiting = sorted.filter(needsReceipt)
      const done = open.filter(sample => sample.status === 'completed' || sampleProgress(sample).finalized)
      const outside = sorted.filter(isOutsideLimits)
      const status = awaiting.length ? 'awaiting' : open.length && done.length === open.length ? 'completed' : open.length ? 'processing' : 'rejected'
      const first = sorted[0]
      return {
        key,
        plate: clean(first.environmentalPlate),
        batchId: first.environmentalBatchId || '',
        department: first.department || '',
        departmentEn: first.departmentEn || first.department || '',
        collectedAt: sorted.map(sample => sample.collectedAt).filter(Boolean).sort()[0] || null,
        samples: sorted,
        awaiting,
        outside,
        status,
        counts: { total: sorted.length, awaiting: awaiting.length, outside: outside.length, done: done.length },
      }
    })
    .sort((a, b) => String(b.collectedAt || '').localeCompare(String(a.collectedAt || '')) || a.plate.localeCompare(b.plate, 'el'))
}

// «Παραλαβή τρυβλίου»: every position still waiting is received like a single sample is (it starts processing).
// Returns how many positions were received; stops at the first failure and says how far it got.
export async function receivePlate(repository, plate, now = new Date()) {
  let received = 0
  try {
    for (const sample of plate.awaiting) {
      await repository.updateStatus(sample.id, 'processing', { receivedAt: now })
      received += 1
    }
  } catch (error) {
    error.received = received
    throw error
  }
  return received
}
