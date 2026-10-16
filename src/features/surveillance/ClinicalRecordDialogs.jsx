import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { advancedAntibioticNames, newTherapyRow, therapiesToSave } from './therapyEntries'
import { Button } from '../../design-system/Button'
import './surveillanceEntryCard.css'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Field } from '../../design-system/Field'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { MultiSelect } from '../../design-system/MultiSelect'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { useLanguage, translate } from '../../core/i18n/LanguageContext'
import { demoLibrarySeed } from '../management/managementData'
import { useLibraries } from '../management/useLibraries'
import { evaluateHaiCriteria, haiCriteriaSetForType } from './haiCriteriaDefinitions'
import { loadHaiCriteriaSets } from './haiCriteriaLibraryService'
import { ChoiceField } from './ChoiceField'
import { listTexts, patientSampleTypeOptions, priorityOptions } from './surveillanceOptions'
import {
  criteriaKeyOf,
  withCriteriaKeys,
  orderCriteriaForAge,
  criteriaAgeWarning,
  SURVEILLANCE_OUTCOMES,
} from './clinicalRecordLabels'

// Dialogs of the clinical record: assessment, devices, samples, HAI criteria,
// therapy, isolation, reassessment, outcome and reasons. Every field is a shared
// design-system control (Field, SearchableSelect, MultiSelect, ModeSwitch, ChoiceChips).
const copy = language => key =>
  translate(`copy.clinicalRecordCopy.${key}`, language === 'el' ? 'el' : 'en')
// A library row ([el, en, meta]) by the screen's language.
const rowLabel = (row, language) => row?.[language === 'el' ? 0 : 1] || row?.[0] || ''
const NEW_ITEM = '__new__'

export function AdministrationDialog({ t, language, onClose, onSave }) {
  const tr = copy(language)
  const [d, setD] = useState({
    administeredAt: new Date().toISOString().slice(0, 10),
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
export function SimpleDialog({
  title,
  t,
  onClose,
  onSave,
  children,
  disabled = false,
  width = 'standard',
  className = '',
}) {
  return (
    <ObserverDialog
      title={title}
      width={width}
      className={`patient-simple-dialog ${className}`.trim()}
      onClose={onClose}
      footer={
        <SaveButton disabled={disabled} onClick={onSave}>
          {t('save')}
        </SaveButton>
      }
    >
      <div className="entry-grid">{children}</div>
    </ObserverDialog>
  )
}
export function AssessmentDialog({ t, record, symptomRows = [], riskRows = [], onClose, onSave }) {
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
  const [d, setD] = useState({
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
// Symptoms and risk factors come from the central libraries as [el, en, meta]
// rows; the record keeps the row's id or code (its Greek name for local rows).
function LibraryMultiSelect({ label, rows = [], selected = [], onChange, language }) {
  const valueOf = row => row?.[2]?.id || row?.[2]?.code || row?.[0] || row?.[1] || ''
  const texts = listTexts(language)
  return (
    <MultiSelect
      label={label}
      options={rows.map(row => ({ value: valueOf(row), label: rowLabel(row, language) }))}
      selected={selected}
      onChange={onChange}
      placeholder={copy(language)('selectFromList')}
      {...texts}
    />
  )
}
export function DeviceDialog({ t, items = [], onAddLibraryItem, onClose, onSave }) {
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
    insertedAt: new Date().toISOString().slice(0, 10),
    site: '',
    notes: '',
  })
  const [rows, setRows] = useState([blank()])
  // The row whose type is being added to the library (an index), or null.
  const [adding, setAdding] = useState(null),
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
  const update = (i, key, value) =>
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
export function SampleDialog({ t, title, initialType = '', onClose, onSave }) {
  const { language } = useLanguage(),
    tr = copy(language)
  const { libraries } = useLibraries()
  const now = new Date(),
    initialDate = now.toISOString().slice(0, 10),
    initialTime = now.toTimeString().slice(0, 5)
  const [d, setD] = useState({
    type: initialType || 'bloodCulture',
    source: '',
    collectionMethod: '',
    deviceRelated: 'unknown',
    priority: 'routine',
    collectedDate: initialDate,
    collectedTime: initialTime,
  })
  const save = () =>
    onSave({ ...d, collectedAt: `${d.collectedDate}T${d.collectedTime || '00:00'}` })
  return (
    <SimpleDialog
      title={title || t('laboratoryRecords.newSample')}
      t={t}
      onClose={onClose}
      onSave={save}
      disabled={!d.collectedDate}
    >
      <SearchableSelect
        label={t('sampleType')}
        value={d.type}
        options={patientSampleTypeOptions(libraries.sampleTypes || [], language, t)}
        emptyLabel={listTexts(language).emptyLabel}
        onChange={v => v && setD(x => ({ ...x, type: v }))}
      />
      <Field label={tr('anatomicalSiteSource')}>
        <input value={d.source} onChange={e => setD(x => ({ ...x, source: e.target.value }))} />
      </Field>
      <ManualDateField
        label={t('collectedLabel')}
        value={d.collectedDate}
        onChange={v => setD(x => ({ ...x, collectedDate: v }))}
      />
      <TimeField
        label={tr('collectionTime')}
        value={d.collectedTime}
        onChange={v => setD(x => ({ ...x, collectedTime: v }))}
      />
      <Field label={tr('collectionMethod')}>
        <input
          value={d.collectionMethod}
          onChange={e => setD(x => ({ ...x, collectionMethod: e.target.value }))}
          placeholder={
            language === 'el'
              ? d.type === 'bloodCulture'
                ? 'π.χ. περιφερική φλέβα / κεντρική γραμμή'
                : d.type === 'urineCulture'
                  ? 'π.χ. μέσο ρεύμα / ουροκαθετήρας'
                  : 'Προαιρετικό'
              : 'Optional sample-specific metadata'
          }
        />
      </Field>
      <ChoiceField
        label={tr('deviceRelated')}
        value={d.deviceRelated}
        onChange={v => setD(x => ({ ...x, deviceRelated: v }))}
        options={[
          { value: 'unknown', label: tr('unknown') },
          { value: 'yes', label: tr('yes') },
          { value: 'no', label: tr('no') },
        ]}
      />
      <ChoiceField
        label={t('priority')}
        value={d.priority}
        onChange={v => setD(x => ({ ...x, priority: v }))}
        options={priorityOptions(language)}
      />
      <p className="entry-span-2 field-hint">{tr('onlyCollectionMetadataAreRecordedOn')}</p>
    </SimpleDialog>
  )
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
}) {
  const { language } = useLanguage(),
    tr = copy(language)
  const [criteriaSets, setCriteriaSets] = useState(null)
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
  const [d, setD] = useState({
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
  function select(value) {
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
      criteriaKey: criteriaKeyOf(row),
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
  function toggleCriterion(itemId) {
    setD(x => ({
      ...x,
      criteriaEvidence: x.criteriaEvidence.includes(itemId)
        ? x.criteriaEvidence.filter(id => id !== itemId)
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
          {criteriaSet.groups.map(group => (
            <ChoiceChips
              key={group.id}
              className="hai-criteria-group"
              options={group.items.map(item => ({
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
export function TherapyDialog({ t, antibiotics = [], advancedAntibiotics = [], onClose, onSave }) {
  const { language } = useLanguage(),
    tr = copy(language)
  const options = antibiotics.length ? antibiotics : demoLibrarySeed.antibiotics
  const advancedNames = advancedAntibioticNames(
    advancedAntibiotics.length ? advancedAntibiotics : demoLibrarySeed.advancedAntibiotics,
  )
  const [rows, setRows] = useState(() => [newTherapyRow()])
  const update = (i, key, value) =>
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
export function IsolationDialog({ t, onClose, onSave }) {
  const { language } = useLanguage(),
    tr = copy(language)
  const [d, setD] = useState({
    precautions: ['contact'],
    room: '',
    reason: '',
    startedAt: new Date().toISOString().slice(0, 10),
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
export function EndDialog({ title, t, onClose, onSave }) {
  const [d, setD] = useState({ endedAt: new Date().toISOString().slice(0, 10), reason: '' })
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
export function ReassessmentDialog({ t, onClose, onSave }) {
  const { language } = useLanguage(),
    tr = copy(language)
  const [d, setD] = useState({
    date: new Date().toISOString().slice(0, 10),
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
export function OutcomeDialog({ t, onClose, onSave }) {
  const { language } = useLanguage()
  const [d, setD] = useState({
    status: 'resolved',
    date: new Date().toISOString().slice(0, 10),
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
export function ReasonDialog({ title, t, reason, setReason, onClose, onSave }) {
  return (
    <SimpleDialog title={title} t={t} onClose={onClose} onSave={onSave} disabled={!reason.trim()}>
      <label className="field entry-span-2">
        <span className="lo-field-label">{t('reasonRequired')}</span>
        <textarea rows={4} value={reason} onChange={e => setReason(e.target.value)} autoFocus />
      </label>
    </SimpleDialog>
  )
}
