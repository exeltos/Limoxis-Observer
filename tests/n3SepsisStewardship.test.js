import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { calculateClinicalScale } from '../src/features/clinical-scales/clinicalScaleEngine'
import { clinicalScaleFields, clinicalScaleReady, scoreBand } from '../src/features/clinical-scales/clinicalScaleForms'
import { demoClinicalScaleDefinitions } from '../src/features/clinical-scales/clinicalScaleDemoDefinitions'
import { sepsisPromptFor } from '../src/features/clinical-scales/sepsisThreshold'
import { CLINICAL_PROTOCOLS, pendingSteps, protocolByKey, visibleSteps } from '../src/features/surveillance/protocols/protocolCatalogue'
import { formatElapsed, runSummary, stepState } from '../src/features/surveillance/protocols/protocolTiming'
import { reviewWindow, showsReviewCard } from '../src/features/surveillance/protocols/therapyReview'
import { protocolCues, protocolStages } from '../src/features/surveillance/protocols/useEpisodeProtocols'
import { stringsEl } from '../src/core/i18n/stringsEl'
import { stringsEn } from '../src/core/i18n/stringsEn'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261203300000_clinical_protocols_and_therapy_reviews.sql')
const qsofaMigration = read('supabase/migrations/20261203300100_qsofa_scale_definition.sql')
const at = (zero, minutes) => new Date(new Date(zero).getTime() + minutes * 60000).toISOString()
const ZERO = '2026-10-15T14:05:00.000Z'
const t = key => key.split('.').reduce((acc, part) => acc?.[part], stringsEl) ?? key

describe('qSOFA is a scale of the existing clinical scales system', () => {
  it('scores RR ≥ 22, altered mentation (GCS < 15) and SBP ≤ 100, 0–3', () => {
    expect(calculateClinicalScale('qsofa', { respiratoryRate: 24, systolicBp: 92, gcs: 13 })).toMatchObject({ score: 3, risk: 'high', complete: true })
    expect(calculateClinicalScale('qsofa', { respiratoryRate: 21, systolicBp: 101, gcs: 15 })).toMatchObject({ score: 0, risk: 'low' })
    expect(calculateClinicalScale('qsofa', { respiratoryRate: 22, systolicBp: 100, alteredMentation: false })).toMatchObject({ score: 2, risk: 'high' })
    expect(calculateClinicalScale('qsofa', { respiratoryRate: 18, systolicBp: 130, alteredMentation: true }).score).toBe(1)
    expect(calculateClinicalScale('qsofa', { respiratoryRate: 18 }).complete).toBe(false)
  })
  it('has form fields, ≥ 2 band and a demo + cloud definition; SOFA stays the existing one', () => {
    expect(clinicalScaleFields('qsofa').map(([key]) => key)).toEqual(['respiratoryRate', 'systolicBp', 'gcs'])
    expect(scoreBand('qsofa', 2)[3]).toBe('danger')
    expect(scoreBand('qsofa', 1)[3]).toBe('good')
    const demo = demoClinicalScaleDefinitions.find(row => row.scale_key === 'qsofa')
    expect(clinicalScaleReady(demo)).toBe(true)
    expect(demoClinicalScaleDefinitions.filter(row => row.scale_key === 'sofa')).toHaveLength(1)
    expect(qsofaMigration).toContain("'qsofa', 'QSOFA-2016'")
    expect(qsofaMigration).toContain("'scoringStatus', 'ready'")
    expect(qsofaMigration).toContain('on conflict (scale_key, version) do nothing')
  })
})

describe('threshold prompt «Πιθανή σήψη — έναρξη πρωτοκόλλου;»', () => {
  it('fires for qSOFA ≥ 2 and for a SOFA rise ≥ 2 within the same admission', () => {
    expect(sepsisPromptFor({ id: 'a', scale_key: 'qsofa', score: 2 }, [])).toMatchObject({ kind: 'qsofa', score: 2 })
    expect(sepsisPromptFor({ id: 'a', scale_key: 'qsofa', score: 1 }, [])).toBeNull()
    const previous = { id: 'p', scale_key: 'sofa', score: 3, admission_id: 'A1', assessed_at: '2026-10-14T08:00:00Z' }
    const other = { id: 'o', scale_key: 'sofa', score: 0, admission_id: 'A2', assessed_at: '2026-10-14T09:00:00Z' }
    const saved = { id: 's', scale_key: 'sofa', score: 5, admission_id: 'A1', assessed_at: '2026-10-15T08:00:00Z' }
    expect(sepsisPromptFor(saved, [saved, previous, other])).toMatchObject({ kind: 'sofa', delta: 2, previousScore: 3 })
    expect(sepsisPromptFor({ ...saved, score: 4 }, [previous])).toBeNull()
    expect(sepsisPromptFor(saved, [])).toBeNull()
  })
  it('the panel words it as decision support, never as a diagnosis', () => {
    const panel = read('src/features/clinical-scales/PatientClinicalScalesPanel.jsx')
    expect(panel).toContain("'Πιθανή σήψη — έναρξη πρωτοκόλλου;'")
    expect(panel).toContain('Υποστήριξη απόφασης, όχι διάγνωση.')
    expect(panel).toContain('setSepsisPrompt(sepsisPromptFor(row,rows))')
  })
})

describe('protocols are data-driven and timed against the hour', () => {
  it('lists the Hour-1 bundle and the septic shock variant, each with the five steps', () => {
    expect(CLINICAL_PROTOCOLS.map(p => p.key)).toEqual(['sepsis_hour1', 'septic_shock'])
    for (const protocol of CLINICAL_PROTOCOLS) {
      const keys = protocol.steps.filter(step => !step.followUp).map(step => step.key)
      expect(keys.sort()).toEqual(['antibiotic', 'blood_cultures', 'fluids', 'lactate', 'vasopressor'])
      expect(stringsEl.sepsis.protocols[protocol.key].name).toBeTruthy()
      expect(stringsEn.sepsis.protocols[protocol.key].name).toBeTruthy()
    }
    expect(stringsEl.sepsis.protocols.sepsis_hour1.name).toBe('Bundle Σήψης 1ης ώρας')
    expect(stringsEl.sepsis.protocols.septic_shock.name).toBe('Σηπτικό shock')
    expect(protocolByKey('septic_shock').steps.find(step => step.key === 'vasopressor').emphasis).toBe(true)
  })
  it('green within 60 min, amber pending in the hour, red after it or cultures after the antibiotic', () => {
    const run = {
      protocolKey: 'sepsis_hour1',
      recognizedAt: ZERO,
      status: 'open',
      steps: [
        { key: 'lactate', status: 'done', doneAt: at(ZERO, 13), value: '4.2' },
        { key: 'antibiotic', status: 'done', doneAt: at(ZERO, 53) },
        { key: 'blood_cultures', status: 'done', doneAt: at(ZERO, 58) },
        { key: 'fluids', status: 'not_indicated', notIndicatedReason: 'Χωρίς υπόταση' },
      ],
    }
    const step = key => protocolByKey('sepsis_hour1').steps.find(item => item.key === key)
    expect(stepState(run, step('lactate'), new Date(at(ZERO, 30))).tone).toBe('g')
    expect(stepState(run, step('blood_cultures'), new Date(at(ZERO, 70))).code).toBe('afterDependency')
    expect(stepState(run, step('fluids'), new Date(at(ZERO, 70))).tone).toBe('n')
    expect(stepState(run, step('vasopressor'), new Date(at(ZERO, 40))).tone).toBe('a')
    expect(stepState(run, step('vasopressor'), new Date(at(ZERO, 72))).tone).toBe('r')
    // lactate > 2 brings the repeat lactate (2–4 h) in, scheduled (grey) until 4 hours
    expect(visibleSteps(run).map(item => item.key)).toContain('lactate_repeat')
    expect(stepState(run, step('lactate_repeat'), new Date(at(ZERO, 90))).tone).toBe('n')
    expect(pendingSteps(run).map(item => item.key)).toEqual(['vasopressor'])
    expect(runSummary(run, new Date(at(ZERO, 72))).tone).toBe('r')
    expect(formatElapsed(72, 'el')).toBe('1 ώρα 12΄')
    expect(formatElapsed(72, 'en')).toBe('1 h 12′')
  })
  it('a tab appears only for a started protocol, with the open protocol as a cue', () => {
    expect(protocolStages([], t, 'el')).toEqual([])
    const run = { id: 'R1', protocolKey: 'sepsis_hour1', recognizedAt: ZERO, status: 'open', steps: [] }
    const [tab] = protocolStages([run], t, 'el', new Date(at(ZERO, 42)))
    expect(tab).toMatchObject({ id: 'protocol:R1', label: 'Σήψη', meta: '1η ώρα · 42΄', protocol: true })
    const cues = protocolCues([run], { therapy: [] }, [], t, { canProtocol: true, canTherapy: true, now: new Date(at(ZERO, 42)) })
    expect(cues[0]).toMatchObject({ id: 'protocol:R1', title: '1η ώρα: εκκρεμεί γαλακτικό' })
  })
})

describe('48–72 h antimicrobial review', () => {
  const therapy = { id: 'T1', antimicrobial: 'Μεροπενέμη', startedAt: '2026-10-15T14:58:00.000Z', status: 'active' }
  const hoursAfter = h => new Date(new Date(therapy.startedAt).getTime() + h * 3600000)
  it('appears from 48 h, is overdue after 72 h and closes once a decision is recorded', () => {
    expect(reviewWindow(therapy, [], hoursAfter(30)).state).toBe('upcoming')
    expect(showsReviewCard(reviewWindow(therapy, [], hoursAfter(30)))).toBe(false)
    expect(reviewWindow(therapy, [], hoursAfter(52))).toMatchObject({ state: 'due', hours: 52 })
    expect(reviewWindow(therapy, [], hoursAfter(80)).state).toBe('overdue')
    const review = { therapyId: 'T1', reviewedAt: hoursAfter(52).toISOString(), decision: 'deescalate', reasons: ['susceptibility'] }
    expect(reviewWindow(therapy, [review], hoursAfter(90))).toMatchObject({ state: 'reviewed', reviewedHours: 52 })
    expect(reviewWindow({ ...therapy, status: 'completed' }, [], hoursAfter(90)).state).toBe('closed')
  })
})

describe('database: new objects only, RLS like the episode and the therapy, module gate', () => {
  it('creates the protocol and review tables with RLS', () => {
    for (const table of ['clinical_protocol_runs', 'clinical_protocol_steps', 'clinical_protocol_events', 'antimicrobial_therapy_reviews']) {
      expect(migration).toContain(`create table if not exists public.${table}`)
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(`create policy ${table}_module_gate on public.${table} as restrictive for all to authenticated`)
    }
    expect(migration).not.toMatch(/\balter table public\.(antimicrobial_therapies|surveillance_cases)\b/)
    expect(migration).not.toMatch(/\b(drop|revoke)\b/i)
    expect(migration).toContain("private.current_user_locked_module_orgs('{surveillance,pharmacy}'::text[])")
  })
  it('scopes department roles like isolation_episodes and keeps reviews with the therapy managers', () => {
    expect(migration).toContain("array['department_manager','link_nurse']::public.app_role[]")
    expect(migration).toContain('private.current_user_department_scopes()')
    expect(migration).toContain("array['hospital_admin','infection_control_lead','doctor_reviewer','pharmacy']::public.app_role[]")
    expect(migration).toContain("check (event_type <> 'recognition_changed' or length(trim(coalesce(reason, ''))) > 0)")
    expect(migration).toContain("check (decision in ('continue', 'deescalate', 'iv_to_oral', 'stop'))")
  })
})

describe('wiring', () => {
  it('the episode starts protocols from a picker and shows the review inside the therapy section', () => {
    const journey = read('src/features/surveillance/ClinicalJourney.jsx')
    expect(journey).toContain("dialog === 'protocolPicker'")
    expect(journey).toContain('<TherapyReviewCard')
    expect(journey).toContain('extraStages={extraStages}')
    const workspace = read('src/features/surveillance/ClinicalSurveillanceWorkspace.jsx')
    expect(workspace).toContain("t('sepsis.startProtocol')")
    expect(workspace).toContain('<ProtocolBadge entry={openRunFor(ep)}')
    expect(read('src/features/surveillance/SurveillanceCanonicalPage.jsx')).toContain('<ProtocolBadge entry={openRunOf(x)}')
    expect(read('src/features/surveillance/PatientClinicalCanonicalPage.jsx')).toContain('canProtocol:')
  })
})
