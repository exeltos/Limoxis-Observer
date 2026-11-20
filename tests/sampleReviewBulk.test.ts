// «Προς έλεγχο», several decisions at once (owner, 19/11/2026): one episode per patient, one reason for all, the
// late-onset filter and the summary of what failed.
import { describe, expect, it, vi } from 'vitest'
import { decideAll, episodeDraftFor, groupSamplesByPatient, openEpisodesFor, reviewRowsShown } from '../src/features/surveillance/sampleReviewBulk'
import { bulkSummaryText } from '../src/features/surveillance/SampleReviewWorklist'
import { readSource } from './helpers/readSource'
import type { ReviewSample } from '../src/features/surveillance/surveillanceListTypes'

const sample = (id: string, patient: string, collectedAt: string, extra: Partial<ReviewSample> = {}): ReviewSample => ({ id, recordId: `r-${id}`, patientRecordId: `p-${patient}`, patientId: patient, patient: `Νεογνό ${patient}`, department: 'ΜΕΝΝ', departmentId: 'd-menn', type: 'bloodCulture', organism: 'Klebsiella pneumoniae', collectedAt, ...extra })

describe('several samples at once', () => {
  it('groups the ticked samples by patient, each from its earliest sample', () => {
    const groups = groupSamplesByPatient([sample('3', 'A', '2026-11-10T08:00:00Z'), sample('1', 'B', '2026-11-05T08:00:00Z'), sample('2', 'A', '2026-11-02T08:00:00Z')])
    expect(groups.map(group => [group.key, group.samples.map(item => item.id)])).toEqual([['p-A', ['2', '3']], ['p-B', ['1']]])
  })

  it('starts the episode as «Άνοιγμα επεισοδίου» does: the first sample\'s date and the findings', () => {
    const [group] = groupSamplesByPatient([sample('2', 'A', '2026-11-02T08:00:00Z', { resistance: 'ESBL' }), sample('3', 'A', '2026-11-10T08:00:00Z', { organism: 'Escherichia coli' })])
    const draft = episodeDraftFor(group, type => (type === 'bloodCulture' ? 'Αιμοκαλλιέργεια' : type), '2026-11-19')
    expect(draft.startedAt).toBe('2026-11-02')
    expect(draft.reason).toBe('Θετική καλλιέργεια: Αιμοκαλλιέργεια · Klebsiella pneumoniae · ESBL / Αιμοκαλλιέργεια · Escherichia coli')
    expect(draft.departmentId).toBe('d-menn')
  })

  it('keeps only the possible late-onset infections when asked', () => {
    const rows = [sample('1', 'A', '2026-11-02'), sample('2', 'B', '2026-11-03')]
    expect(reviewRowsShown(rows, { lateOnly: true, lateOnset: { 'r-2': 96 } }).map(row => row.id)).toEqual(['2'])
    expect(reviewRowsShown(rows, { lateOnly: false, lateOnset: { 'r-2': 96 } })).toHaveLength(2)
  })

  it('opens one episode per patient and links each sample through the same decision; a failure does not stop the rest', async () => {
    const groups = groupSamplesByPatient([sample('1', 'A', '2026-11-02'), sample('2', 'A', '2026-11-03'), sample('3', 'B', '2026-11-04'), sample('4', 'C', '2026-11-05')])
    const createCase = vi.fn(async (group: { key: string }) => { if (group.key === 'p-B') throw new Error('denied'); return { id: `case-${group.key}` } })
    const link = vi.fn(async () => undefined)
    const result = await openEpisodesFor(groups, { createCase, link })
    expect(createCase).toHaveBeenCalledTimes(3)
    expect(link.mock.calls.map(call => [(call as unknown as [ReviewSample, string])[0].id, (call as unknown as [ReviewSample, string])[1]])).toEqual([['1', 'case-p-A'], ['2', 'case-p-A'], ['4', 'case-p-C']])
    expect(result.done).toBe(2)
    expect(result.failed).toEqual([{ label: 'Νεογνό B · 3', message: 'denied' }])
    expect(bulkSummaryText(result, 'open', 'el')).toBe('Άνοιξαν 2 επεισόδια. Δεν έγιναν (1): Νεογνό B · 3')
  })

  it('records one reason for every ticked sample', async () => {
    const review = vi.fn(async (item: ReviewSample, _decision: unknown) => { void _decision; if (item.id === '2') throw new Error('x') })
    const decision = { status: 'no_surveillance_needed' as const, reason: 'contamination', note: '' }
    const result = await decideAll([sample('1', 'A', ''), sample('2', 'B', '')], decision, review)
    expect(review).toHaveBeenCalledTimes(2)
    expect(review.mock.calls[0][1]).toBe(decision)
    expect(result.done).toBe(1)
    expect(bulkSummaryText(result, 'decide', 'en')).toBe('1 sample(s) recorded as «No surveillance needed». Not done (1): Νεογνό B · 2')
  })

  it('the page links the samples with «episode_opened», the path that records the NICU late-onset infection', () => {
    // The shared bulk actions (owner, 20/11/2026): «Προς έλεγχο» and «Ασθενείς» use the same ones.
    const actions = readSource('src/features/surveillance/bulkSampleActions.ts')
    expect(actions).toContain("link: (sample, caseId) => awaitingReview.repository.review(sample, { status: 'episode_opened', caseId })")
    const page = readSource('src/features/surveillance/SurveillanceCanonicalPage.tsx')
    expect(page).toContain('onBulkOpen={canReview && canCreate ? bulkReview.openEpisodes : undefined}')
    expect(readSource('src/features/patients/PatientsPage.tsx')).toContain('bulkSampleActions({awaitingReview,clinical,language,t,notify,onDone:reloadFlags})')
    const list = readSource('src/features/surveillance/SampleReviewWorklist.tsx')
    expect(list).toContain("const selectable = !readOnly && Boolean(onBulkDecide)")
  })
})

describe('the patient of a production sample (Codex #668)', () => {
  it('reads the patient record from the laboratory list, which keeps it as subjectId', async () => {
    const { normalizeLaboratorySamples } = await import('../src/features/laboratory/model/laboratoryModel')
    const { patientRecordOf, groupSamplesByPatient } = await import('../src/features/surveillance/sampleReviewBulk')
    const uuid = '3f1c2b7a-9d4e-4c1a-8b2f-1a2b3c4d5e6f'
    const [row] = normalizeLaboratorySamples([{ id: 'a1', code: 'LAB-1', subject_type: 'patient', patient_id: uuid, patient_code: 'P-1', result_status: 'positive' }]) as never[]
    expect(patientRecordOf(row)).toBe(uuid)
    const [twin] = normalizeLaboratorySamples([{ id: 'a2', code: 'LAB-2', subject_type: 'patient', patient_id: uuid, patient_code: 'P-1', result_status: 'positive' }]) as never[]
    expect(groupSamplesByPatient([row, twin])).toHaveLength(1)
    expect(patientRecordOf({ id: 'x', patientId: 'PT-1' } as never)).toBeNull()
  })
})
