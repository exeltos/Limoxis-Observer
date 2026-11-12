// Dialogs of the clinical record, second part: HAI criteria, therapy, isolation, end, reassessment, outcome and reasons.
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { advancedAntibioticNames, newTherapyRow, therapiesToSave } from './therapyEntries'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Field } from '../../design-system/Field'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { useLanguage, translate } from '../../core/i18n/LanguageContext'
import { demoLibrarySeed } from '../management/managementData'
import { evaluateHaiCriteria, haiCriteriaSetForType } from './haiCriteriaDefinitions'
import { loadHaiCriteriaSets } from './haiCriteriaLibraryService'
import { ChoiceField } from '../../design-system/ChoiceField'
import { listTexts } from './surveillanceOptions'
import {
  criteriaKeyOf,
  withCriteriaKeys,
  orderCriteriaForAge,
  criteriaAgeWarning,
  SURVEILLANCE_OUTCOMES,
} from './clinicalRecordLabels'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { copy, NEW_ITEM, rowLabel } from './clinicalDialogText'
import { SimpleDialog } from './ClinicalSimpleDialog'
import type { AnyRecord } from '../../types/featureTypes'
import type { Handler, Setter } from './surveillanceTypes'

interface HaiDialogProps {
  t: (key: string) => string
  items?: AnyRecord[]
  patientAgeDays?: number | null
  organizationId: string | null | undefined
  isDemo: boolean
  onAddLibraryItem: Handler
  onClose?: Handler | null
  onSave: Handler
}
export function HaiDialog({
  t,
  items = [],
  patientAgeDays: ageDays = null,
  organizationId,
  isDemo,
  onAddLibraryItem,
  onClose,
  onSave,
}: HaiDialogProps) {
  const { language } = useLanguage(),
    tr = copy(language)
  const [criteriaSets, setCriteriaSets] = useState<AnyRecord | null>(null)
  useEffect(() => {
    let alive = true
    loadHaiCriteriaSets(organizationId)
      .then(sets => {
        if (alive) setCriteriaSets(sets)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [organizationId, isDemo])
  // Fallback list shown until the centrally-governed criteria sets (master_library_items,
  // library_key 'hai_criteria') load — kept in sync with the same static baseline used as
  // the demo/offline fallback, so the dialog is never empty on first render.
  const staticDefaults = [
    [
      'CLABSI – Λοίμωξη αιματικής ροής σχετιζόμενη με κεντρικό φλεβικό καθετήρα',
      'CLABSI – Central line-associated bloodstream infection',
      { source: 'ECDC', id: 'clabsi' },
    ],
    [
      'CLABSI (νεογνική/βρεφική ≤1 έτους) – Λοίμωξη αιματικής ροής σχετιζόμενη με κεντρικό καθετήρα',
      'CLABSI (neonatal/infant ≤1 year) – Central line-associated bloodstream infection',
      { source: 'CDC/NHSN', id: 'clabsi_neonatal' },
    ],
    [
      'CAUTI – Ουρολοίμωξη σχετιζόμενη με ουροκαθετήρα',
      'CAUTI – Catheter-associated urinary tract infection',
      { source: 'ECDC', id: 'cauti' },
    ],
    [
      'VAP – Πνευμονία σχετιζόμενη με μηχανικό αερισμό',
      'VAP – Ventilator-associated pneumonia',
      { source: 'ECDC', id: 'vap' },
    ],
    [
      'SSI – Λοίμωξη χειρουργικού πεδίου',
      'SSI – Surgical site infection',
      { source: 'ECDC', id: 'ssi' },
    ],
  ]
  const defaults = criteriaSets
    ? Object.entries(criteriaSets).map(([key, set]) => [
        set.labelEl,
        set.labelEn || set.labelEl,
        { source: set.source || 'CDC/NHSN', id: key },
      ])
    : staticDefaults
  const options = orderCriteriaForAge(withCriteriaKeys(items, defaults), ageDays)
  const first = options[0]
  const [d, setD] = useState<AnyRecord>({
    status: 'suspected',
    type: rowLabel(first, language),
    definitionSet: first?.[2]?.source || 'ECDC',
    definitionVersion: first?.[2]?.version || '',
    criteriaKey: criteriaKeyOf(first),
    criteriaEvidence: [],
    rationale: '',
  })
  const [adding, setAdding] = useState(false),
    [newName, setNewName] = useState(''),
    [customSource, setCustomSource] = useState('Hospital')
  function select(value: string) {
    if (!value) return
    if (value === NEW_ITEM) {
      setAdding(true)
      setD(x => ({
        ...x,
        type: '',
        definitionSet: 'Hospital',
        criteriaKey: null,
        criteriaEvidence: [],
      }))
      return
    }
    setAdding(false)
    const row = options.find(x => rowLabel(x, language) === value)
    setD(x => ({
      ...x,
      type: value,
      definitionSet: row?.[2]?.source || 'ECDC',
      definitionVersion: row?.[2]?.version || '',
      criteriaKey: criteriaKeyOf(row as AnyRecord),
      criteriaEvidence: [],
    }))
  }
  async function add() {
    const name = newName.trim()
    if (!name) return
    const row = [
      name,
      name,
      { system: false, locked: false, source: customSource || 'Hospital', version: 'local' },
    ]
    const saved = (await onAddLibraryItem?.(row)) || row
    setD(x => ({
      ...x,
      type: saved[0],
      definitionSet: customSource || 'Hospital',
      criteriaKey: null,
      criteriaEvidence: [],
    }))
    setAdding(false)
    setNewName('')
  }
  function toggleCriterion(itemId: string) {
    setD(x => ({
      ...x,
      criteriaEvidence: x.criteriaEvidence.includes(itemId)
        ? x.criteriaEvidence.filter((id: string) => id !== itemId)
        : [...x.criteriaEvidence, itemId],
    }))
  }
  const criteriaSet = d.criteriaKey
    ? haiCriteriaSetForType(d.criteriaKey, criteriaSets || undefined)
    : null
  const criteriaMet = criteriaSet
    ? evaluateHaiCriteria(d.criteriaKey, d.criteriaEvidence, criteriaSets || undefined)
    : null
  const ageWarning = criteriaAgeWarning(d.criteriaKey, ageDays)
  // A definition saved before the library had it is still listed, so the field shows it.
  const typeOptions = [
    ...options.map(x => ({ value: rowLabel(x, language), label: rowLabel(x, language) })),
    ...(d.type && !options.some(x => rowLabel(x, language) === d.type)
      ? [{ value: d.type, label: d.type }]
      : []),
    { value: NEW_ITEM, label: tr('newSurveillanceDefinition') },
  ]
  return (
    <SimpleDialog
      title={tr('haiHealthcareAssociatedInfection')}
      t={t}
      className="hai-dialog"
      onClose={onClose}
      onSave={() => onSave({ ...d, criteriaMet })}
      disabled={!d.type}
    >
      <div className="field hai-type-field">
        <SearchableSelect
          label={tr('surveillanceTypeDefinition')}
          value={adding ? NEW_ITEM : d.type}
          options={typeOptions}
          emptyLabel={listTexts(language).emptyLabel}
          onChange={select}
        />
        {ageWarning && (
          <small className="field-warning hai-age-warning" role="status">
            {translate(`copy.neonatalCopy.${ageWarning}`, language === 'el' ? 'el' : 'en')}
          </small>
        )}
      </div>
      <SearchableSelect
        label={tr('status')}
        value={d.status}
        emptyLabel={listTexts(language).emptyLabel}
        onChange={v => v && setD(x => ({ ...x, status: v }))}
        options={['suspected', 'probable', 'confirmed', 'excluded'].map(value => ({
          value,
          label: tr(value),
        }))}
      />
      <Field label={tr('definitionSource')}>
        <input
          value={adding ? customSource : d.definitionSet}
          readOnly={!adding}
          onChange={e => setCustomSource(e.target.value)}
        />
      </Field>
      {adding && (
        <div className="entry-span-2 inline-library-add">
          <Field label={tr('newDefinition')}>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} />
          </Field>
          <Button variant="secondary" onClick={add}>
            {tr('addToLibrary2')}
          </Button>
        </div>
      )}
      {criteriaSet && (
        <div className="entry-span-2 hai-criteria-checklist">
          <p className="hai-criteria-note">
            {language === 'el'
              ? `Απλοποιημένο checklist βάσει ${criteriaSet.source} — ενδεικτικό εργαλείο υποστήριξης, δεν υποκαθιστά την κλινική κρίση.`
              : `Simplified checklist based on ${criteriaSet.source} — an indicative decision-support aid, not a substitute for clinical judgement.`}
          </p>
          {criteriaSet.groups.map((group: AnyRecord) => (
            <ChoiceChips
              key={group.id}
              className="hai-criteria-group"
              options={group.items.map((item: AnyRecord) => ({
                value: item.id,
                label: language === 'el' ? item.textEl : item.textEn,
              }))}
              selected={d.criteriaEvidence}
              onToggle={toggleCriterion}
            />
          ))}
          <div className={`hai-criteria-result ${criteriaMet ? 'is-met' : 'is-pending'}`}>
            {criteriaMet ? tr('criteriaAreMetBasedOnThe') : tr('criteriaAreNotYetMet')}
          </div>
        </div>
      )}
      <label className="field entry-span-2">
        <span className="lo-field-label">{tr('criteriaRationale')}</span>
        <textarea
          rows={3}
          value={d.rationale}
          onChange={e => setD(x => ({ ...x, rationale: e.target.value }))}
        />
      </label>
    </SimpleDialog>
  )
}
interface TherapyDialogProps {
  t: (key: string) => string
  antibiotics?: AnyRecord[]
  advancedAntibiotics?: AnyRecord[]
  onClose?: Handler | null
  onSave: Handler
}
export function TherapyDialog({ t, antibiotics = [], advancedAntibiotics = [], onClose, onSave }: TherapyDialogProps) {
  const { language } = useLanguage(),
    tr = copy(language)
  const options = antibiotics.length ? antibiotics : demoLibrarySeed.antibiotics
  const advancedNames = advancedAntibioticNames(
    advancedAntibiotics.length ? advancedAntibiotics : demoLibrarySeed.advancedAntibiotics,
  )
  const [rows, setRows] = useState(() => [newTherapyRow()])
  const update = (i: number, key: string, value: unknown) =>
    setRows(list => list.map((x, n) => (n === i ? { ...x, [key]: value } : x)))
  const save = async () => {
    for (const therapy of therapiesToSave(rows, advancedNames)) await onSave(therapy)
  }
  const texts = listTexts(language)
  const antimicrobialOptions = options.map(x => ({
    value: rowLabel(x, language),
    label: rowLabel(x, language),
    description:
      advancedNames.has(x[0]) || advancedNames.has(x[1]) ? tr('restrictedAdvanced').replace(/^[\s·]+/, '') : undefined,
    keywords: `${x[0] || ''} ${x[1] || ''}`,
  }))
  const routeOptions = [
    { value: 'IV', label: tr('intravenousIv') },
    { value: 'PO', label: tr('oralPo') },
    { value: 'IM', label: tr('intramuscularIm') },
    { value: 'other', label: tr('other') },
  ]
  return (
    <SimpleDialog
      title={tr('antimicrobialTherapy')}
      t={t}
      onClose={onClose}
      onSave={save}
      disabled={!rows.some(x => x.antimicrobial)}
    >
      {rows.map((d, i) => (
        <div className="entry-span-2 therapy-entry-card" key={i}>
          <div className="entry-grid">
            <SearchableSelect
              label={tr('antimicrobial')}
              value={d.antimicrobial}
              options={antimicrobialOptions}
              placeholder={tr('selectFromLibrary')}
              emptyLabel={texts.emptyLabel}
              clearLabel={texts.clearLabel}
              onChange={v => update(i, 'antimicrobial', v)}
            />
            <Field label={tr('dose')}>
              <input value={d.dose} onChange={e => update(i, 'dose', e.target.value)} />
            </Field>
            <SearchableSelect
              label={tr('route')}
              value={d.route}
              options={routeOptions}
              emptyLabel={texts.emptyLabel}
              onChange={v => v && update(i, 'route', v)}
            />
            <Field label={tr('indication')}>
              <input value={d.indication} onChange={e => update(i, 'indication', e.target.value)} />
            </Field>
            <ManualDateField
              label={tr('startDate')}
              value={d.startedAt}
              onChange={v => update(i, 'startedAt', v)}
            />
            <ManualDateField
              label={tr('plannedEndDate')}
              optional
              value={d.plannedEndAt}
              onChange={v => update(i, 'plannedEndAt', v)}
            />
          </div>
          {advancedNames.has(d.antimicrobial) && (
            <div className="inline-empty">
              {tr('advancedRestrictedAntibioticAutomaticallyFlaggedFor')}
            </div>
          )}
          {rows.length > 1 && (
            <Button variant="ghost" onClick={() => setRows(list => list.filter((_, n) => n !== i))}>
              {tr('remove')}
            </Button>
          )}
        </div>
      ))}
      <div className="entry-span-2">
        <Button variant="secondary" onClick={() => setRows(list => [...list, newTherapyRow()])}>
          <Plus size={14} />
          {tr('addAntimicrobial')}
        </Button>
      </div>
    </SimpleDialog>
  )
}
interface IsolationDialogProps {
  t: (key: string) => string
  onClose?: Handler | null
  onSave: Handler
}
export function IsolationDialog({ t, onClose, onSave }: IsolationDialogProps) {
  const { language } = useLanguage(),
    tr = copy(language)
  const [d, setD] = useState<AnyRecord>({
    precautions: ['contact'],
    room: '',
    reason: '',
    startedAt: hospitalToday(),
    reviewDue: '',
  })
  return (
    <SimpleDialog
      title={tr('isolationTransmissionBasedPrecautions')}
      t={t}
      onClose={onClose}
      onSave={() => onSave(d)}
      disabled={!d.reason}
    >
      <SearchableSelect
        label={tr('precautions')}
        value={d.precautions[0]}
        emptyLabel={listTexts(language).emptyLabel}
        onChange={v => v && setD(x => ({ ...x, precautions: [v] }))}
        options={[
          { value: 'contact', label: tr('contactPrecautions') },
          { value: 'droplet', label: tr('dropletPrecautions') },
          { value: 'airborne', label: tr('airbornePrecautions') },
          { value: 'protective', label: tr('protectiveIsolation') },
        ]}
      />
      <Field label={tr('roomBed')}>
        <input value={d.room} onChange={e => setD(x => ({ ...x, room: e.target.value }))} />
      </Field>
      <ManualDateField
        label={tr('startDate')}
        value={d.startedAt}
        onChange={v => setD(x => ({ ...x, startedAt: v }))}
      />
      <ManualDateField
        label={tr('nextReview')}
        optional
        value={d.reviewDue}
        onChange={v => setD(x => ({ ...x, reviewDue: v }))}
      />
      <label className="field entry-span-2">
        <span className="lo-field-label">{tr('reason')}</span>
        <textarea value={d.reason} onChange={e => setD(x => ({ ...x, reason: e.target.value }))} />
      </label>
    </SimpleDialog>
  )
}
interface EndDialogProps {
  title: string
  t: (key: string) => string
  onClose?: Handler | null
  onSave: Handler
}
export function EndDialog({ title, t, onClose, onSave }: EndDialogProps) {
  const [d, setD] = useState({ endedAt: hospitalToday(), reason: '' })
  return (
    <SimpleDialog title={title} t={t} onClose={onClose} onSave={() => onSave(d)}>
      <ManualDateField
        label={t('endDate')}
        value={d.endedAt}
        onChange={v => setD(x => ({ ...x, endedAt: v }))}
      />
      <label className="field entry-span-2">
        <span className="lo-field-label">{t('reason')}</span>
        <textarea value={d.reason} onChange={e => setD(x => ({ ...x, reason: e.target.value }))} />
      </label>
    </SimpleDialog>
  )
}
interface ReassessmentDialogProps {
  t: (key: string) => string
  onClose?: Handler | null
  onSave: Handler
}
export function ReassessmentDialog({ t, onClose, onSave }: ReassessmentDialogProps) {
  const { language } = useLanguage(),
    tr = copy(language)
  const [d, setD] = useState<AnyRecord>({
    date: hospitalToday(),
    status: 'stable',
    decision: 'continueTreatment',
    notes: '',
    nextReviewDue: '',
  })
  return (
    <SimpleDialog title={tr('reassessment')} t={t} onClose={onClose} onSave={() => onSave(d)}>
      <ManualDateField
        label={tr('date')}
        value={d.date}
        onChange={v => setD(x => ({ ...x, date: v }))}
      />
      <ManualDateField
        label={tr('nextReview')}
        optional
        value={d.nextReviewDue}
        onChange={v => setD(x => ({ ...x, nextReviewDue: v }))}
      />
      <ChoiceField
        className="entry-span-2"
        label={tr('clinicalStatus')}
        value={d.status}
        onChange={v => setD(x => ({ ...x, status: v }))}
        options={[
          { value: 'clinicalImprovement', label: tr('clinicalImprovement') },
          { value: 'stable', label: tr('stable') },
          { value: 'deterioration', label: tr('deterioration') },
        ]}
      />
      <label className="field entry-span-2">
        <span className="lo-field-label">{tr('notes')}</span>
        <textarea value={d.notes} onChange={e => setD(x => ({ ...x, notes: e.target.value }))} />
      </label>
    </SimpleDialog>
  )
}
interface OutcomeDialogProps {
  t: (key: string) => string
  onClose?: Handler | null
  onSave: Handler
}
export function OutcomeDialog({ t, onClose, onSave }: OutcomeDialogProps) {
  const { language } = useLanguage()
  const [d, setD] = useState<AnyRecord>({
    status: 'resolved',
    date: hospitalToday(),
    notes: '',
  })
  return (
    <SimpleDialog title={t('outcome')} t={t} onClose={onClose} onSave={() => onSave(d)}>
      <SearchableSelect
        label={t('status')}
        value={d.status}
        emptyLabel={listTexts(language).emptyLabel}
        onChange={v => v && setD(x => ({ ...x, status: v }))}
        options={SURVEILLANCE_OUTCOMES.map(x => ({ value: x, label: t(x) }))}
      />
      <ManualDateField
        label={t('date')}
        value={d.date}
        onChange={v => setD(x => ({ ...x, date: v }))}
      />
      <label className="field entry-span-2">
        <span className="lo-field-label">{t('notes')}</span>
        <textarea value={d.notes} onChange={e => setD(x => ({ ...x, notes: e.target.value }))} />
      </label>
    </SimpleDialog>
  )
}
interface ReasonDialogProps {
  title: string
  t: (key: string) => string
  reason: string
  setReason: Setter<string>
  onClose?: Handler | null
  onSave: Handler
  saveLabel?: string
  note?: string
  danger?: boolean
}
export function ReasonDialog({ title, t, reason, setReason, onClose, onSave, saveLabel = '', note = '', danger = false }: ReasonDialogProps) {
  return (
    <SimpleDialog title={title} t={t} onClose={onClose} onSave={onSave} disabled={!reason.trim()} saveLabel={saveLabel} danger={danger}>
      {note && <p className="entry-span-2">{note}</p>}
      <label className="field entry-span-2">
        <span className="lo-field-label">{t('reasonRequired')}</span>
        <textarea rows={4} value={reason} onChange={e => setReason(e.target.value)} autoFocus />
      </label>
    </SimpleDialog>
  )
}
