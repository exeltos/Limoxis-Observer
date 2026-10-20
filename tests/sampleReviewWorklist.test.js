import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LAB_RESULT_SCOPES, canReviewSamples, defaultLabScope, isAlertSample, matchesLabScope, needsSurveillanceReview, reviewTag, sampleEpisodeTarget, samplesAwaitingReview } from '../src/features/laboratory/sampleReviewModel'
import { emptySampleRequest, missingRequestFields, sampleRequestPayload } from '../src/features/laboratory/sampleRequestForm'
import { createDemoLaboratoryRepository } from '../src/features/laboratory/repositories/demoLaboratoryRepository'
import { createClinicalRepository } from '../src/features/surveillance/clinicalRepository'
import { clinicalCases } from '../src/features/surveillance/clinicalDemoData'
import { laboratorySamples } from '../src/features/laboratory/laboratoryDemoData'

const read = file => fs.readFileSync(file, 'utf8')
const positive = (extra = {}) => ({ id: 'LAB-1', subjectType: 'patient', status: 'completed', result: 'positive', organism: 'Klebsiella pneumoniae', type: 'urineCulture', ...extra })

describe('«Προς έλεγχο» selection', () => {
  it('lists positive samples with an organism, a resistance flag, a blood culture or a critical result', () => {
    expect(isAlertSample(positive())).toBe(true)
    expect(isAlertSample(positive({ organism: null, resistance: 'MDR' }))).toBe(true)
    expect(isAlertSample(positive({ organism: null, type: 'bloodCulture' }))).toBe(true)
    expect(isAlertSample(positive({ organism: null, critical: true }))).toBe(true)
    // A positive without any of them is not an alert.
    expect(isAlertSample(positive({ organism: null }))).toBe(false)
  })

  it('never lists negatives, pending, contaminated or inconclusive results', () => {
    for (const result of ['negative', 'inconclusive', 'contaminated', null, 'pending']) {
      expect(needsSurveillanceReview(positive({ result, type: 'bloodCulture', critical: true }))).toBe(false)
    }
  })

  it('drops samples with an episode, a decision, a follow-up code or another subject', () => {
    expect(needsSurveillanceReview(positive())).toBe(true)
    expect(needsSurveillanceReview(positive({ surveillanceCase: 'SUR-1' }))).toBe(false)
    expect(needsSurveillanceReview(positive({ surveillanceCaseId: 'uuid' }))).toBe(false)
    expect(needsSurveillanceReview(positive({ surveillanceReviewStatus: 'no_surveillance_needed' }))).toBe(false)
    expect(needsSurveillanceReview(positive({ surveillanceReviewStatus: 'episode_opened' }))).toBe(false)
    expect(needsSurveillanceReview(positive({ id: 'LAB-1-R1' }))).toBe(false)
    expect(needsSurveillanceReview(positive({ subjectType: 'employee' }))).toBe(false)
    expect(needsSurveillanceReview(positive({ subjectType: 'environment' }))).toBe(false)
    expect(needsSurveillanceReview(positive({ status: 'rejected' }))).toBe(false)
  })

  it('says the decision in plain words, in both languages', () => {
    expect(reviewTag({ surveillanceReviewStatus: 'episode_opened' }, 'el')).toBe('Επεισόδιο ανοίχτηκε')
    expect(reviewTag({ surveillanceReviewStatus: 'no_surveillance_needed' }, 'el')).toBe('Αξιολογήθηκε, χωρίς επιτήρηση')
    expect(reviewTag({ surveillanceReviewStatus: 'no_surveillance_needed' }, 'en')).toBe('Reviewed, no surveillance')
    expect(reviewTag({}, 'el')).toBe('')
  })

  it('limits the roles and sets the laboratory list scope by role', () => {
    for (const role of ['infection_control_lead', 'infection_control_member', 'doctor_reviewer', 'hospital_admin']) {
      expect(canReviewSamples(role)).toBe(true)
      expect(defaultLabScope(role)).toBe(LAB_RESULT_SCOPES.POSITIVE)
    }
    expect(canReviewSamples('laboratory')).toBe(false)
    expect(defaultLabScope('laboratory')).toBe(LAB_RESULT_SCOPES.ALL)
    // «Μόνο θετικά» hides negatives from the view only.
    const rows = [positive(), positive({ id: 'LAB-2', result: 'negative' })]
    expect(rows.filter(sample => matchesLabScope(sample, LAB_RESULT_SCOPES.POSITIVE))).toHaveLength(1)
    expect(rows.filter(sample => matchesLabScope(sample, LAB_RESULT_SCOPES.ALL))).toHaveLength(2)
  })

  it('opens the new-episode flow on the patient record with the sample prefilled', () => {
    const target = sampleEpisodeTarget(positive({ patientId: 'PT-260190', recordId: 'uuid-1', collectedAt: '2026-10-01T08:00:00+03:00' }))
    expect(target.path).toBe('/patients/PT-260190')
    expect(target.state.openTab).toBe('surveillanceJourney')
    expect(target.state.createFromSample).toMatchObject({ id: 'LAB-1', recordId: 'uuid-1', organism: 'Klebsiella pneumoniae' })
  })
})

describe('demo worklist', () => {
  it('has a few unreviewed positives, and a decision removes the sample from the list but not from the laboratory', async () => {
    const repository = createDemoLaboratoryRepository({ actorName: 'Test' })
    const waiting = await repository.listAwaitingReview()
    expect(waiting.length).toBeGreaterThanOrEqual(3)
    expect(waiting.every(sample => sample.result === 'positive')).toBe(true)
    const total = laboratorySamples.length
    const sample = waiting[0]
    await repository.review(sample, { status: 'no_surveillance_needed', reason: 'colonization', note: 'Αποικισμός' })
    expect((await repository.listAwaitingReview()).map(item => item.id)).not.toContain(sample.id)
    expect(laboratorySamples).toHaveLength(total)
    const stored = await repository.get(sample.id)
    expect(stored).toMatchObject({ surveillanceReviewStatus: 'no_surveillance_needed', surveillanceReviewReason: 'colonization' })
    const next = (await repository.listAwaitingReview())[0]
    await repository.review(next, { status: 'episode_opened', caseId: 'SUR-TEST' })
    expect(await repository.get(next.id)).toMatchObject({ surveillanceReviewStatus: 'episode_opened', surveillanceCase: 'SUR-TEST' })
    expect(samplesAwaitingReview(await repository.list().then(result => result.data)).map(item => item.id)).not.toContain(next.id)
  })
})

describe('«Αίτημα δείγματος»', () => {
  it('needs a type and a site, and sends no collection time', () => {
    const draft = emptySampleRequest()
    expect(missingRequestFields(draft)).toEqual(['source'])
    const payload = sampleRequestPayload({ ...draft, source: ' Κεντρική γραμμή ' })
    expect(payload).toEqual({ type: 'bloodCulture', source: 'Κεντρική γραμμή', priority: 'routine', requestQuestions: {} })
    expect(payload).not.toHaveProperty('collectedAt')
  })

  it('asks extra questions that are required', () => {
    const questions = [{ key: 'fever', kind: 'choice', required: true, label: { el: 'Πυρετός', en: 'Fever' }, options: [] }]
    const draft = { ...emptySampleRequest({ questions }), source: 'Ούρα' }
    expect(missingRequestFields(draft, questions)).toEqual(['question:fever'])
    expect(missingRequestFields({ ...draft, requestQuestions: { fever: 'yes' } }, questions)).toEqual([])
  })

  it('creates a requested laboratory row linked to the episode and the patient (demo)', async () => {
    const [episodeId] = Object.keys(clinicalCases)
    const episode = clinicalCases[episodeId]
    const before = laboratorySamples.length
    const repository = createClinicalRepository({ isDemo: true, organizationId: null, actor: { name: 'Test', id: 'u' } })
    const sample = await repository.requestSample(episode, { type: 'bloodCulture', source: 'Κεντρική γραμμή', priority: 'urgent' })
    expect(laboratorySamples).toHaveLength(before + 1)
    const row = laboratorySamples.find(item => item.id === sample.id)
    expect(row).toMatchObject({ status: 'requested', surveillanceCase: episode.id, patientId: episode.patientId, priority: 'urgent', result: null })
    expect(row.collectedAt).toBeNull()
  })

  it('keeps the follow-up code and the shared form validation in source', () => {
    const workspace = read('src/features/surveillance/ClinicalSurveillanceWorkspace.jsx')
    expect(workspace).toContain('sampleCode: `${parent.id}-R${siblings + 1}`')
    expect(workspace).toContain('SampleRequestDialog')
    expect(read('src/features/surveillance/ClinicalRecordDialogs.jsx')).toContain('useFormValidation(')
    // Results are entered only in the Laboratory: the request never writes one.
    expect(read('src/features/surveillance/clinicalCloudService.js')).toMatch(/status: 'requested',\n\s+requested_at/)
  })
})

describe('review_laboratory_sample (SECURITY DEFINER)', () => {
  const sql = read('supabase/migrations/20261204200100_review_laboratory_sample_rpc.sql')
  const columns = read('supabase/migrations/20261204200000_sample_surveillance_review_columns.sql')

  it('checks the caller, the four roles, the Surveillance module and the organisation', () => {
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('auth.uid()')
    expect(sql).toContain("array['hospital_admin', 'infection_control_lead', 'infection_control_member', 'doctor_reviewer']")
    expect(sql).not.toMatch(/'laboratory'/)
    expect(sql).toContain("current_user_has_capability(p_organization_id, 'view_surveillance')")
    expect(sql).toContain('where id = p_sample_id and organization_id = p_organization_id')
    expect(sql).toContain('The episode does not belong to the sample')
  })

  it('writes only the review columns, the link and the audit stamps', () => {
    const sets = [...sql.matchAll(/update public.laboratory_samples\s+set ([\s\S]*?)\n\s+where id = p_sample_id/g)].map(match => match[1])
    expect(sets).toHaveLength(2)
    const allowed = new Set(['surveillance_case_id', 'surveillance_review_status', 'surveillance_review_reason', 'surveillance_review_note', 'surveillance_reviewed_by', 'surveillance_reviewed_at', 'updated_by', 'updated_at'])
    for (const block of sets) {
      for (const column of block.matchAll(/^\s*(\w+) = /gm)) expect(allowed.has(column[1])).toBe(true)
    }
    expect(sets[1]).not.toContain('surveillance_case_id')
    expect(sql).not.toMatch(/\b(delete|drop|alter policy)\b/i)
  })

  it('requires a reason for «no surveillance needed» in the function and the table', () => {
    expect(sql).toContain("p_reason not in ('contamination', 'colonization', 'known_case', 'other')")
    expect(columns).toContain("surveillance_review_reason in ('contamination', 'colonization', 'known_case', 'other')")
    expect(columns).toContain('add column if not exists surveillance_review_status text')
    expect(columns).not.toMatch(/\b(drop|alter policy)\b/i)
  })

  it('is declared in the manifest, closed to anon, and used by the production repository', () => {
    expect(JSON.parse(read('supabase/security-definer-manifest.json')).functions.review_laboratory_sample).toMatchObject({ category: 'rpc', authenticated: true })
    expect(read('supabase/migrations/20261204200150_review_laboratory_sample_revoke.sql')).toContain('from public, anon')
    expect(read('src/features/laboratory/laboratoryCloudService.js')).toContain("supabase.rpc('review_laboratory_sample'")
    expect(read('src/features/laboratory/repositories/supabaseLaboratoryRepository.js')).toContain('reviewLaboratorySample(organizationId, sample.recordId, decision)')
  })
})

describe('one action, one place', () => {
  it('keeps «Άνοιγμα επεισοδίου» in the worklist and in the sample header only', () => {
    expect(read('src/features/surveillance/SampleReviewWorklist.jsx')).toContain("'Άνοιγμα επεισοδίου'")
    const record = read('src/features/laboratory/LaboratorySampleRecordFunctionalView.jsx')
    expect(record).toContain('sample-open-episode')
    expect(record.match(/'Άνοιγμα επεισοδίου'/g)).toHaveLength(1)
    expect(read('src/features/laboratory/LaboratoryWorkspace.jsx')).not.toContain('Άνοιγμα επεισοδίου')
    // The home card only leads to the list view.
    expect(read('src/features/dashboard/DashboardPage.jsx')).toContain("navigate('/surveillance?tab=episodes&review=1')")
  })
})
