import { Plus } from 'lucide-react'
import { useContext, useState } from 'react'
import { Button } from '../../design-system/Button'
import './surveillanceEntryCard.css'
import { useFormValidation } from '../../design-system/FormValidation'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Field } from '../../design-system/Field'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { MultiSelect } from '../../design-system/MultiSelect'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useLibraries } from '../management/useLibraries'
import { ChoiceField } from '../../design-system/ChoiceField'
import { listTexts, patientSampleTypeOptions, priorityOptions } from './surveillanceOptions'
import { ReadOnlyField } from '../../design-system/ReadOnlyField'
import { SAMPLE_REQUEST_QUESTIONS, emptySampleRequest, sampleRequestPayload } from '../laboratory/sampleRequestForm'
import { TenantContext } from '../../core/tenant/TenantContext'
import { useOptionalFeedback } from '../../core/feedback/FeedbackContext'
import { EpiMiniQuestions, useEpiMini } from './epiQuestionnaire/EpiQuestionnaireViews'
import { isCultureSampleType } from './epiQuestionnaire/epiQuestionnaireModel'
import { canWriteEpi } from './epiQuestionnaire/epiQuestionnaireText'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { copy, NEW_ITEM, rowLabel } from './clinicalDialogText'
import { SimpleDialog } from './ClinicalSimpleDialog'
import type { AnyRecord } from '../../types/featureTypes'
import type { Handler } from './surveillanceTypes'
export { SimpleDialog } from './ClinicalSimpleDialog'
export { HaiDialog, TherapyDialog, IsolationDialog, EndDialog, ReassessmentDialog, OutcomeDialog, ReasonDialog } from './ClinicalCareDialogs'

interface AdministrationDialogProps {
  t: (key: string) => string
  language: string
  onClose?: Handler | null
  onSave: Handler
}
// Dialogs of the clinical record: assessment, devices, samples, HAI criteria,
// therapy, isolation, reassessment, outcome and reasons. Every field is a shared
// design-system control (Field, SearchableSelect, MultiSelect, ModeSwitch, ChoiceChips).

export function AdministrationDialog({ t, language, onClose, onSave }: AdministrationDialogProps) {
  const tr = copy(language)
  const [d, setD] = useState<AnyRecord>({
    administeredAt: hospitalToday(),
    dose: '',
    route: '',
    status: 'administered',
    withheldReason: '',
    notes: '',
  })
  const valid = d.status === 'administered' || d.withheldReason.trim()
  return (
    <SimpleDialog
      title={tr('recordAdministration')}
      t={t}
      onClose={onClose}
      onSave={() => onSave(d)}
      disabled={!valid}
    >
      <ManualDateField
        label={tr('administrationDate')}
        value={d.administeredAt}
        onChange={v => setD(x => ({ ...x, administeredAt: v }))}
      />
      <Field label={tr('dose')}>
        <input value={d.dose} onChange={e => setD(x => ({ ...x, dose: e.target.value }))} />
      </Field>
      <Field label={tr('route2')}>
        <input value={d.route} onChange={e => setD(x => ({ ...x, route: e.target.value }))} />
      </Field>
      <ChoiceField
        className="entry-span-2"
        label={tr('status')}
        value={d.status}
        onChange={status =>
          setD(x => ({
            ...x,
            status,
            withheldReason: status === 'administered' ? '' : x.withheldReason,
          }))
        }
        options={[
          { value: 'administered', label: tr('administered') },
          { value: 'withheld', label: tr('withheld') },
          { value: 'refused', label: tr('refusedByPatient') },
        ]}
      />
      {d.status !== 'administered' && (
        <label className="field entry-span-2">
          <span className="lo-field-label">{tr('reasonRequired')}</span>
          <textarea
            value={d.withheldReason}
            onChange={e => setD(x => ({ ...x, withheldReason: e.target.value }))}
          />
        </label>
      )}
      <label className="field entry-span-2">
        <span className="lo-field-label">{tr('notes')}</span>
        <textarea value={d.notes} onChange={e => setD(x => ({ ...x, notes: e.target.value }))} />
      </label>
    </SimpleDialog>
  )
}
interface AssessmentDialogProps {
  t: (key: string) => string
  record: AnyRecord
  symptomRows?: AnyRecord[]
  riskRows?: AnyRecord[]
  onClose?: Handler | null
  onSave: Handler
}
export function AssessmentDialog({ t, record, symptomRows = [], riskRows = [], onClose, onSave }: AssessmentDialogProps) {
  const { language } = useLanguage(),
    tr = copy(language),
    a = record.assessment || {}
  const symptomOptions = symptomRows.length
    ? symptomRows
    : [
        ['Πυρετός', 'Fever'],
        ['Ρίγος', 'Chills'],
        ['Υπόταση', 'Hypotension'],
        ['Βήχας', 'Cough'],
        ['Δύσπνοια', 'Dyspnea'],
        ['Δυσουρία', 'Dysuria'],
        ['Άλγος', 'Pain'],
        ['Ερύθημα / εκροή', 'Erythema / drainage'],
      ]
  const riskOptions = riskRows.filter(
    row =>
      !/(καθετήρ|catheter|device|αερισμ|ventilat|γραμμή|line)/i.test(
        String(row[0] || '') + ' ' + String(row[1] || ''),
      ),
  )
  const questions = [
    ['recentSurgery', tr('recentSurgery')],
    ['currentAntibiotics', tr('currentOrRecentAntimicrobialTherapy')],
    ['recentHospitalization', tr('recentHospitalization')],
    ['transferFromFacility', tr('transferFromAnotherHealthcareFacility')],
    ['knownMdro', tr('knownMultidrugResistantOrganismMdroHistory')],
    ['immunosuppression', tr('immunosuppression')],
    ['recentProcedure', tr('recentInvasiveProcedure')],
  ]
  const [d, setD] = useState<AnyRecord>({
    date: String(a.date || new Date().toISOString()).slice(0, 10),
    classification: a.classification || 'undetermined',
    summary: a.summary || '',
    signsSymptoms: a.signsSymptoms || a.symptoms || [],
    riskFactors: a.riskFactors || [],
    screening: {
      ...Object.fromEntries(questions.map(([id]) => [id, 'unknown'])),
      ...(a.screening || {}),
    },
  })
  const answers = [
    { value: 'unknown', label: tr('unknown') },
    { value: 'yes', label: tr('yes') },
    { value: 'no', label: tr('no') },
  ]
  return (
    <SimpleDialog
      title={tr('surveillanceClinicalAssessment')}
      t={t}
      width="wide"
      className="assessment-dialog"
      onClose={onClose}
      onSave={() => onSave(d)}
    >
      <ManualDateField
        label={tr('assessmentDate')}
        value={d.date}
        onChange={v => setD(x => ({ ...x, date: v }))}
      />
      <SearchableSelect
        label={tr('clinicalClassification')}
        value={d.classification}
        onChange={v => v && setD(x => ({ ...x, classification: v }))}
        emptyLabel={listTexts(language).emptyLabel}
        options={[
          { value: 'infection', label: tr('infection') },
          { value: 'colonization', label: tr('colonization') },
          { value: 'no_infection', label: tr('noEvidenceOfInfection') },
          { value: 'undetermined', label: tr('notYetDetermined') },
        ]}
      />
      <div className="entry-span-2 library-clinical-grid">
        <LibraryMultiSelect
          label={tr('signsSymptoms')}
          rows={symptomOptions}
          selected={d.signsSymptoms}
          onChange={v => setD(x => ({ ...x, signsSymptoms: v }))}
          language={language}
        />
        <LibraryMultiSelect
          label={tr('riskFactors')}
          rows={riskOptions}
          selected={d.riskFactors}
          onChange={v => setD(x => ({ ...x, riskFactors: v }))}
          language={language}
        />
      </div>
      <section className="entry-span-2 screening-questionnaire">
        <span className="lo-field-label">{tr('initialSurveillanceQuestionnaire')}</span>
        <div className="questionnaire-grid">
          {questions.map(([id, label]) => (
            <div key={id} className="questionnaire-item">
              <span>{label}</span>
              <ModeSwitch
                ariaLabel={label}
                value={d.screening[id]}
                onChange={v => setD(x => ({ ...x, screening: { ...x.screening, [id]: v } }))}
                options={answers}
              />
            </div>
          ))}
        </div>
      </section>
      <label className="field entry-span-2">
        <span className="lo-field-label">{tr('clinicalSummary')}</span>
        <textarea
          rows={4}
          value={d.summary}
          onChange={e => setD(x => ({ ...x, summary: e.target.value }))}
        />
      </label>
    </SimpleDialog>
  )
}
interface LibraryMultiSelectProps {
  label: string
  rows?: AnyRecord[]
  selected?: string[]
  onChange: Handler
  language: string
}
// Symptoms and risk factors come from the central libraries as [el, en, meta]
// rows; the record keeps the row's id or code (its Greek name for local rows).
function LibraryMultiSelect({ label, rows = [], selected = [], onChange, language }: LibraryMultiSelectProps) {
  const valueOf = (row: AnyRecord) => row?.[2]?.id || row?.[2]?.code || row?.[0] || row?.[1] || ''
  const texts = listTexts(language)
  // A stored value no longer in the list (older record, retired entry) stays visible and selected.
  const options = rows.map(row => ({ value: valueOf(row), label: rowLabel(row, language) }))
  for (const value of selected)
    if (value && !options.some(option => option.value === value)) options.push({ value, label: value })
  return (
    <MultiSelect
      label={label}
      // Every choice is shown by name, never «3 selected» (owner, 8/11/2026).
      tags
      options={options}
      selected={selected}
      onChange={onChange}
      placeholder={copy(language)('selectFromList')}
      {...texts}
    />
  )
}
interface DeviceDialogProps {
  t: (key: string) => string
  items?: AnyRecord[]
  onAddLibraryItem: Handler
  onClose?: Handler | null
  onSave: Handler
}
export function DeviceDialog({ t, items = [], onAddLibraryItem, onClose, onSave }: DeviceDialogProps) {
  const { language } = useLanguage(),
    tr = copy(language)
  const defaults = [
    ['Κεντρικός φλεβικός καθετήρας (CVC)', 'Central venous catheter (CVC)'],
    ['Ουροκαθετήρας', 'Urinary catheter'],
    ['Μηχανικός αερισμός', 'Mechanical ventilation'],
    ['Περιφερικός φλεβικός καθετήρας', 'Peripheral venous catheter'],
  ]
  const options = items.length ? items : defaults
  const blank = () => ({
    type: rowLabel(options[0], language),
    insertedAt: hospitalToday(),
    site: '',
    notes: '',
  })
  const [rows, setRows] = useState([blank()])
  // The row whose type is being added to the library (an index), or null.
  const [adding, setAdding] = useState<number | null>(null),
    [newName, setNewName] = useState('')
  async function add() {
    const name = newName.trim()
    if (!name) return
    const row = [name, name, { system: false, locked: false, source: 'Hospital', version: 'local' }]
    const saved = (await onAddLibraryItem?.(row)) || row
    setRows(list =>
      list.map((x, i) => (i === (adding ?? 0) ? { ...x, type: rowLabel(saved, language) } : x)),
    )
    setNewName('')
    setAdding(null)
  }
  const update = (i: number, key: string, value: unknown) =>
    setRows(list => list.map((x, n) => (n === i ? { ...x, [key]: value } : x)))
  const save = async () => {
    for (const row of rows.filter(x => x.type)) await onSave(row)
  }
  const typeOptions = [
    ...options.map(x => ({ value: rowLabel(x, language), label: rowLabel(x, language) })),
    { value: NEW_ITEM, label: tr('addToLibrary') },
  ]
  return (
    <SimpleDialog
      title={tr('invasiveDevicesRiskFactors')}
      t={t}
      onClose={onClose}
      onSave={save}
      disabled={!rows.some(x => x.type && x.insertedAt)}
    >
      {rows.map((d, i) => (
        <div className="entry-span-2 therapy-entry-card" key={i}>
          <div className="entry-grid">
            <SearchableSelect
              label={tr('deviceType')}
              value={adding === i ? NEW_ITEM : d.type}
              options={typeOptions}
              emptyLabel={listTexts(language).emptyLabel}
              onChange={v => {
                if (v === NEW_ITEM) setAdding(i)
                else if (v) update(i, 'type', v)
              }}
            />
            <ManualDateField
              label={tr('insertionStartDate')}
              value={d.insertedAt}
              onChange={v => update(i, 'insertedAt', v)}
            />
            <Field label={tr('site')}>
              <input value={d.site} onChange={e => update(i, 'site', e.target.value)} />
            </Field>
          </div>
          <Field label={tr('notes')}>
            <textarea rows={2} value={d.notes} onChange={e => update(i, 'notes', e.target.value)} />
          </Field>
          {rows.length > 1 && (
            <Button variant="ghost" onClick={() => setRows(list => list.filter((_, n) => n !== i))}>
              {tr('remove')}
            </Button>
          )}
        </div>
      ))}
      {adding != null && (
        <div className="entry-span-2 inline-library-add">
          <Field label={tr('newDevice')}>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} />
          </Field>
          <Button variant="secondary" onClick={add}>
            {tr('addToLibrary2')}
          </Button>
        </div>
      )}
      <div className="entry-span-2">
        <Button variant="secondary" onClick={() => setRows(list => [...list, blank()])}>
          <Plus size={14} />
          {tr('addDevice')}
        </Button>
      </div>
    </SimpleDialog>
  )
}
interface SampleRequestDialogProps {
  t: (key: string) => string
  title?: string | null
  initialType?: string
  context?: AnyRecord | null
  epi?: AnyRecord | null
  inSheet?: boolean
  onClose?: Handler | null
  onSave: Handler
}
// Sample request: a request to the laboratory, not a sample entry. It names the
// patient, the episode, the department, the sample type and site and the priority; the
// laboratory receives and completes it, and the result is entered only there.
// `context` ({ patient, episode, department }) is shown read-only; the extra questions
// of sampleRequestForm.js are rendered after the core fields.
// inSheet: on the surveillance sheet the patient, episode and department are its header and the questionnaire is
// its own step, so they are not repeated here (owner, 8/11/2026).
export function SampleRequestDialog({ t, title, initialType = '', context = null, epi = null, inSheet = false, onClose, onSave }: SampleRequestDialogProps) {
  const { language } = useLanguage(),
    tr = copy(language)
  const en = language === 'en'
  const { libraries } = useLibraries()
  const [d, setD] = useState<AnyRecord>(() => emptySampleRequest({ type: initialType }))
  const answer = (key: string) => d.requestQuestions?.[key] ?? ''
  const setAnswer = (key: string, value: unknown) => setD(x => ({ ...x, requestQuestions: { ...x.requestQuestions, [key]: value } }))
  // The mini version (3 core questions) of the epidemiological questionnaire: for cultures only, and
  // written to the episode's one questionnaire (or to the sample when there is no episode).
  const role = useContext(TenantContext)?.role
  const notify = useOptionalFeedback()?.notify
  const miniOn = !inSheet && (epi?.episode ? canWriteEpi(role) : true) && isCultureSampleType(d.type)
  const mini = useEpiMini({ episode: epi?.episode || null, admission: epi?.admission || null, samples: epi?.samples || [], enabled: true })
  const form = useFormValidation([
    { key: 'type', label: t('sampleType'), valid: Boolean(d.type) },
    { key: 'source', label: tr('anatomicalSiteSource'), valid: Boolean(d.source.trim()) },
    ...(miniOn ? mini.rules : []),
    ...SAMPLE_REQUEST_QUESTIONS.map(question => ({
      key: `question:${question.key}`,
      label: question.label[en ? 'en' : 'el'],
      valid: !question.required || Boolean(String(answer(question.key)).trim()),
    })),
  ])
  return (
    <SimpleDialog
      title={title || tr('sampleRequest')}
      t={t}
      onClose={onClose}
      onSave={() => {
        const result = onSave({ ...sampleRequestPayload(d), ...(miniOn && !epi?.episode ? { clinicalContext: mini.context() } : {}) })
        if (miniOn && epi?.episode) mini.save().catch(() => notify?.(t('epiQuestionnaire.miniSaveFailed'), 'danger'))
        return result
      }}
      saveLabel={tr('sendRequest')}
      form={form}
    >
      {!inSheet && context?.patient && <ReadOnlyField className="entry-span-2" label={t('patient')} value={context.patient} />}
      {!inSheet && context?.episode && <ReadOnlyField label={tr('episodeWord')} value={context.episode} />}
      {!inSheet && context?.department && <ReadOnlyField label={t('department')} value={context.department} />}
      <SearchableSelect
        label={t('sampleType')}
        {...form.field('type')}
        value={d.type}
        options={patientSampleTypeOptions(libraries.sampleTypes || [], language, t)}
        emptyLabel={listTexts(language).emptyLabel}
        onChange={v => v && setD(x => ({ ...x, type: v }))}
      />
      <Field
        label={tr('anatomicalSiteSource')}
        hint={tr('collectionMethodHintBlood')}
        {...form.field('source')}
      >
        <input value={d.source} onChange={e => setD(x => ({ ...x, source: e.target.value }))} />
      </Field>
      <ChoiceField
        label={t('priority')}
        value={d.priority}
        onChange={v => setD(x => ({ ...x, priority: v }))}
        options={priorityOptions(language)}
      />
      {SAMPLE_REQUEST_QUESTIONS.map(question =>
        question.kind === 'choice' ? (
          <ChoiceField
            key={question.key}
            label={question.label[en ? 'en' : 'el']}
            {...form.field(`question:${question.key}`)}
            value={answer(question.key)}
            onChange={v => setAnswer(question.key, v)}
            options={question.options!.map(option => ({ value: option.value, label: option.label[en ? 'en' : 'el'] }))}
          />
        ) : (
          <Field key={question.key} label={question.label[en ? 'en' : 'el']} {...form.field(`question:${question.key}`)}>
            <input value={answer(question.key)} onChange={e => setAnswer(question.key, e.target.value)} />
          </Field>
        ),
      )}
      {miniOn && mini.loaded && (
        <div className="entry-span-2">
          <EpiMiniQuestions mini={mini} form={form} episodeCode={epi?.episode?.id || ''} />
        </div>
      )}
      <p className="entry-span-2 field-hint">{tr('sampleRequestNote')}</p>
    </SimpleDialog>
  )
}