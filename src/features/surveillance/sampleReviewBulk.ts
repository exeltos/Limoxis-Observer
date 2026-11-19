import type { ReviewSample } from './surveillanceListTypes'

// «Προς έλεγχο», several decisions at once (owner, 19/11/2026): the samples ticked in the worklist, one episode per
// patient (a neonate with several positive samples gets one episode carrying them all), or one reason for all of
// them. Pure: the page passes the services it already uses for a single decision.

// The patient a sample belongs to: the patient record (production), else the patient code (demo).
export const patientKeyOf = (sample: ReviewSample) => String(sample.patientRecordId || sample.patientId || sample.recordId || sample.id || '')

// Only the possible late-onset infections (ΜΕΝΝ: positive blood culture 72 hours or more after admission).
export function reviewRowsShown(rows: ReviewSample[], { lateOnly = false, lateOnset = {} }: { lateOnly?: boolean, lateOnset?: Record<string, number> } = {}) {
  return lateOnly ? rows.filter(row => row.recordId && lateOnset[String(row.recordId)] != null) : rows
}

export interface PatientGroup { key: string, samples: ReviewSample[] }
// The ticked samples by patient, each patient's samples from the earliest; the patients in the order first seen.
export function groupSamplesByPatient(samples: ReviewSample[]): PatientGroup[] {
  const groups = new Map<string, ReviewSample[]>()
  for (const sample of samples) {
    const key = patientKeyOf(sample)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(sample)
  }
  const when = (sample: ReviewSample) => String(sample.collectedAt || sample.requestedAt || '')
  return [...groups].map(([key, list]) => ({ key, samples: [...list].sort((a, b) => when(a).localeCompare(when(b))) }))
}

// The start of the episode, as «Άνοιγμα επεισοδίου» fills it from a sample: the date of the first sample and
// «Θετική καλλιέργεια: …» with each sample's type, organism and resistance.
export function episodeDraftFor(group: PatientGroup, typeLabel: (type: string) => string, today: string) {
  const first = group.samples[0] || {} as ReviewSample
  const finding = (sample: ReviewSample) => [typeLabel(sample.type || 'other'), sample.organism, sample.resistance].filter(Boolean).join(' · ')
  const findings = [...new Set(group.samples.map(finding).filter(Boolean))].join(' / ')
  return {
    startedAt: String(first.collectedAt || first.requestedAt || '').slice(0, 10) || today,
    reviewDue: '',
    room: '',
    reason: `Θετική καλλιέργεια: ${findings}`,
    reasonEn: `Positive culture: ${findings}`,
    suspectedSource: '',
    departmentId: first.departmentId || null,
    department: first.department || '',
    departmentEn: first.departmentEn || first.department || '',
  }
}

export interface BulkResult { done: number, failed: { label: string, message: string }[] }
const messageOf = (error: unknown) => String((error as Error)?.message || error || '')
const labelOf = (sample: ReviewSample) => [sample.patient, sample.id].filter(Boolean).join(' · ')

// One episode per patient, then each of that patient's samples linked to it through the same decision as
// «Άνοιγμα επεισοδίου» ({ status: 'episode_opened', caseId }), which also records the ΜΕΝΝ late-onset infection.
// A failure is noted and the rest go on; `done` counts the episodes opened.
export async function openEpisodesFor(groups: PatientGroup[], { createCase, link, onProgress }: {
  createCase: (group: PatientGroup) => Promise<{ id: string } | null | undefined>
  link: (sample: ReviewSample, caseId: string) => Promise<unknown>
  onProgress?: (done: number, total: number) => void
}): Promise<BulkResult> {
  const result: BulkResult = { done: 0, failed: [] }
  for (const [index, group] of groups.entries()) {
    try {
      const created = await createCase(group)
      if (!created?.id) throw new Error('no episode')
      result.done += 1
      for (const sample of group.samples) {
        try { await link(sample, created.id) } catch (error) { result.failed.push({ label: labelOf(sample), message: messageOf(error) }) }
      }
    } catch (error) {
      result.failed.push({ label: labelOf(group.samples[0] || {} as ReviewSample), message: messageOf(error) })
    }
    onProgress?.(index + 1, groups.length)
  }
  return result
}

// One reason for every ticked sample, through the same decision as «Δεν χρειάζεται επιτήρηση».
export async function decideAll(samples: ReviewSample[], decision: { status: 'no_surveillance_needed', reason: string, note: string }, review: (sample: ReviewSample, decision: { status: 'no_surveillance_needed', reason: string, note: string }) => Promise<unknown>, onProgress?: (done: number, total: number) => void): Promise<BulkResult> {
  const result: BulkResult = { done: 0, failed: [] }
  for (const [index, sample] of samples.entries()) {
    try {
      await review(sample, decision)
      result.done += 1
    } catch (error) {
      result.failed.push({ label: labelOf(sample), message: messageOf(error) })
    }
    onProgress?.(index + 1, samples.length)
  }
  return result
}
