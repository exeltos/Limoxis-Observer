// @vitest-environment jsdom
import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider, translate } from '../src/core/i18n/LanguageContext'
import { FeedbackProvider } from '../src/core/feedback/FeedbackContext'
import {
  EPI_CORE_KEYS,
  EPI_QUESTIONS,
  applyEpiSettings,
  buildEpiPrefill,
  cleanAnswers,
  deriveOrigin,
  epiCounts,
  epiDefinitionVersion,
  isCoreComplete,
  isCultureSampleType,
  missingCoreQuestions,
  riskFactorKeys,
  riskSignal,
  setEpiAnswer,
  startingAnswers,
} from '../src/features/surveillance/epiQuestionnaire/epiQuestionnaireModel'
import { canWriteEpi, rowLine } from '../src/features/surveillance/epiQuestionnaire/epiQuestionnaireText'
import { epiQuestionnaireSection, epiRows } from '../src/features/surveillance/forms/sections/epiQuestionnaireSection'
import { loadEpiQuestionnaires, saveEpiCoreAnswers, saveEpiQuestionnaire } from '../src/features/surveillance/epiQuestionnaire/epiQuestionnaireService'

const t = key => translate(key, 'el')
const yes = (detail = '') => ({ a: 'yes', detail })
const record = { id: 'SUR-T1', startedAt: '2026-10-18', admissionDate: '2026-10-15', department: 'ΜΕΘ', samples: [{ collectedAt: '2026-10-18T08:00:00' }], therapy: [{ antimicrobial: 'Meropenem', startedAt: '2026-10-16' }], devices: [{ name: 'Κεντρικός καθετήρας', status: 'active' }] }
const ctx = { isDemo: true, organizationId: 'org', language: 'el', t, role: 'infection_control_lead', has: () => true, patient: { id: 'PT-1', name: 'Α Β' }, admission: null, record, episodes: [record], samples: [], fmtDate: value => String(value).slice(0, 10), fmtDateTime: String }

describe('epidemiological questionnaire model', () => {
  it('has 11 questions, 3 core, with the design wording', () => {
    expect(EPI_QUESTIONS).toHaveLength(11)
    expect(EPI_CORE_KEYS).toEqual(['antibiotics_90d', 'icu_stay', 'transfer_from_facility'])
    expect(EPI_QUESTIONS[0].label.el).toBe('Πήρε αντιβιοτικά τις τελευταίες 90 ημέρες;')
    expect(EPI_QUESTIONS[1].label.el).toBe('Νοσηλεύτηκε σε ΜΕΘ (τώρα ή σε προηγούμενη νοσηλεία);')
    expect(EPI_QUESTIONS[2].label.el).toBe('Ήρθε από άλλο νοσοκομείο ή μονάδα φροντίδας;')
    for (const question of EPI_QUESTIONS) expect(question.label.en).toMatch(/[A-Za-z]/)
  })

  it('«Άγνωστο» counts as an answer for the core questions: nobody is blocked', () => {
    expect(missingCoreQuestions({})).toEqual(EPI_CORE_KEYS)
    const unknown = { a: 'unknown' }
    expect(isCoreComplete({ antibiotics_90d: unknown, icu_stay: unknown, transfer_from_facility: unknown })).toBe(true)
    expect(isCoreComplete({ antibiotics_90d: unknown, icu_stay: yes() })).toBe(false)
    expect(epiCounts({ antibiotics_90d: unknown, icu_stay: yes() })).toMatchObject({ answered: 2, unknown: 1, coreAnswered: 2, total: 11 })
  })

  it('works out the origin from the admission and the first sample (admission day = day 1, day 3 = more than 48 hours)', () => {
    expect(deriveOrigin({ admissionDate: '2026-10-15', record })).toMatchObject({ kind: 'hospital', hospitalDay: 4 })
    expect(deriveOrigin({ admissionDate: '2026-10-17', record })).toMatchObject({ kind: 'community', hospitalDay: 2 })
    expect(deriveOrigin({ admissionDate: '2026-10-16', record: { ...record, samples: [], startedAt: '2026-10-18' } })).toMatchObject({ kind: 'hospital', hospitalDay: 3 })
    expect(deriveOrigin({ record: { startedAt: '2026-10-18' } })).toBeNull()
  })

  it('lists the risk factors in words and raises the advisory signal for a known MDRO or two factors', () => {
    const answers = { antibiotics_90d: yes(), icu_stay: yes(), transfer_from_facility: { a: 'no' } }
    expect(riskFactorKeys(answers)).toEqual(['antibiotics_90d', 'icu_stay'])
    expect(riskSignal(answers)).toBe(true)
    expect(riskSignal({ antibiotics_90d: yes() })).toBe(false)
    expect(riskSignal({ known_mdro: yes() })).toBe(true)
    expect(riskSignal({ antibiotics_90d: { a: 'unknown' }, icu_stay: { a: 'unknown' } })).toBe(false)
  })

  it('prefills from therapy, ICU, devices and the admission source, and marks an edited prefill', () => {
    const prefill = buildEpiPrefill({ record, admission: { admissionSource: 'other_hospital', sourceFacility: 'Γ.Ν. Πατρών', admissionDate: '2026-10-15' }, today: '2026-10-20' })
    expect(prefill.antibiotics_90d).toMatchObject({ a: 'yes', source: 'therapy' })
    expect(prefill.icu_stay).toMatchObject({ a: 'yes', source: 'icu' })
    expect(prefill.transfer_from_facility).toMatchObject({ a: 'yes', detail: 'Γ.Ν. Πατρών' })
    expect(prefill.invasive_device_48h).toMatchObject({ a: 'yes', source: 'devices' })
    // absence of a therapy is NOT a «Όχι»
    expect(buildEpiPrefill({ record: { ...record, therapy: [] }, today: '2026-10-20' }).antibiotics_90d).toBeUndefined()
    let answers = startingAnswers(null, prefill)
    expect(answers.icu_stay.src).toBe('prefill')
    answers = setEpiAnswer(answers, 'icu_stay', { a: 'no' }, prefill.icu_stay)
    expect(answers.icu_stay.src).toBe('prefill_edited')
    expect(setEpiAnswer({}, 'dialysis', { a: 'yes' }).dialysis.src).toBe('manual')
  })

  it('prefills the core answers from a culture entered before the episode (sample clinical context)', () => {
    const prefill = buildEpiPrefill({ record: { id: 'x' }, samples: [{ clinicalContext: { antibiotics_90d: { a: 'no' } } }], today: '2026-10-20' })
    expect(prefill.antibiotics_90d).toMatchObject({ a: 'no', source: 'sample' })
  })

  it('keeps the wording of the hospital, never switches a core question off, and versions the definition', () => {
    const settings = [{ questionKey: 'icu_stay', labelEl: 'Νέα διατύπωση', labelEn: 'New', isActive: false, version: 2 }, { questionKey: 'dialysis', isActive: false, version: 1 }]
    const applied = applyEpiSettings(settings)
    expect(applied.find(q => q.key === 'icu_stay')).toMatchObject({ active: true, edited: true, label: { el: 'Νέα διατύπωση', en: 'New' } })
    expect(applied.find(q => q.key === 'dialysis').active).toBe(false)
    expect(epiDefinitionVersion(settings)).toBe(4)
  })

  it('stores only answered questions and shows the mini version for cultures only', () => {
    expect(cleanAnswers({ icu_stay: { a: 'yes', detail: ' x ' }, bogus: { a: 'yes' }, dialysis: { a: null } })).toEqual({ icu_stay: { a: 'yes', detail: 'x', src: 'manual' } })
    expect(isCultureSampleType('bloodCulture')).toBe(true)
    expect(isCultureSampleType('environmental')).toBe(false)
    expect(canWriteEpi('infection_control_lead')).toBe(true)
    expect(canWriteEpi('laboratory')).toBe(false)
  })
})

describe('epidemiological questionnaire storage (demo)', () => {
  it('keeps ONE questionnaire per episode: the mini version merges only the three core answers into it', async () => {
    const options = { isDemo: true }
    await saveEpiQuestionnaire('org', 'SUR-T2', { answers: { dialysis: yes('3 φορές/εβδ.'), icu_stay: { a: 'no' } } }, options)
    await saveEpiCoreAnswers('org', 'SUR-T2', { antibiotics_90d: { a: 'yes' }, icu_stay: { a: 'yes' }, transfer_from_facility: { a: 'unknown' }, dialysis: { a: 'no' } }, options)
    const row = (await loadEpiQuestionnaires('org', ['SUR-T2'], options))['SUR-T2']
    expect(row.answers.dialysis.a).toBe('yes')
    expect(row.answers.icu_stay.a).toBe('yes')
    expect(row.coreComplete).toBe(true)
  })

  it('seeds a few answered and unanswered episodes for the demo', async () => {
    const rows = await loadEpiQuestionnaires('org', ['SUR-260041', 'SUR-260039', 'SUR-260023', 'SUR-260032'], { isDemo: true })
    expect(rows['SUR-260041'].coreComplete).toBe(true)
    expect(rows['SUR-260023'].coreComplete).toBe(false)
    expect(rows['SUR-260032']).toBeUndefined()
  })
})

describe('epidemiological questionnaire section', () => {
  it('is a registered section seen by those who see the surveillance, one row with the common words and one «Άνοιγμα»', async () => {
    expect(epiQuestionnaireSection.canSee(ctx)).toBe(true)
    expect(epiQuestionnaireSection.canSee({ ...ctx, has: () => false })).toBe(false)
    expect(epiQuestionnaireSection.canSee({ ...ctx, episodes: [] })).toBe(false)
    const Section = epiQuestionnaireSection.Component
    render(
      <MemoryRouter>
        <LanguageProvider>
          <FeedbackProvider>
            <Section ctx={ctx} section={{ value: { rows: {}, settings: [] } }} reload={vi.fn()} />
          </FeedbackProvider>
        </LanguageProvider>
      </MemoryRouter>,
    )
    const list = screen.getByRole('list', { name: 'Επιδημιολογικό ιστορικό' })
    expect(within(list).getByText('Εκκρεμεί')).toBeInTheDocument()
    fireEvent.click(within(list).getByRole('button', { name: 'Άνοιγμα' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    // prefilled from the record and the three core questions carry the required mark
    expect(screen.getAllByText(/Προσυμπληρώθηκε από/).length).toBeGreaterThan(0)
    expect(screen.getByText('Πήρε αντιβιοτικά τις τελευταίες 90 ημέρες;')).toBeInTheDocument()
  })

  it('shows «Ολοκληρώθηκε» once the core is answered and prints origin, risk factors and answers in words', () => {
    const value = { rows: { 'SUR-T1': { answers: { antibiotics_90d: yes('Meropenem'), icu_stay: yes(), transfer_from_facility: { a: 'unknown' } }, definitionVersion: 2, updatedAt: '2026-10-19T10:00:00Z' } }, settings: [] }
    const [item] = epiRows(ctx, value)
    expect(item.summary).toMatchObject({ status: 'done', factorCount: 2, signal: true })
    expect(rowLine(item.summary, t)).toContain('2 παράγοντες κινδύνου')
    const report = epiQuestionnaireSection.buildReport(ctx, { value })
    const pairs = report.items[0].pairs
    expect(pairs.find(([label]) => label === 'Παράγοντες κινδύνου')[1]).toBe('πρόσφατα αντιβιοτικά · ΜΕΘ')
    expect(pairs.find(([label]) => label === 'Αντιβιοτικά (90 ημέρες)')[1]).toBe('Ναι · Meropenem')
    expect(pairs.find(([label]) => label === 'Μεταφορά από άλλη δομή υγείας')[1]).toBe('Άγνωστο')
  })
})

describe('epidemiological questionnaire migration', () => {
  const sql = fs.readFileSync('supabase/migrations/20261206100000_epi_questionnaire.sql', 'utf8').replace(/--[^\n]*/g, '')
  it('is additive and has organization_id, composite FK, RLS and the restrictive module gates', () => {
    expect(sql).not.toMatch(/\bdrop\b|\brevoke\b|\balter\s+policy\b|\bdelete\s+from\b/i)
    expect(sql).toMatch(/foreign key \(surveillance_case_id, organization_id\)\s+references public\.surveillance_cases \(id, organization_id\)/)
    for (const table of ['surveillance_case_questionnaires', 'epi_questionnaire_question_settings']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
      expect(sql).toContain(`create policy ${table}_module_gate on public.${table} as restrictive for all to authenticated`)
    }
    expect(sql).toMatch(/current_user_has_department_scope\(c\.organization_id, c\.department_id\)/)
  })
})
