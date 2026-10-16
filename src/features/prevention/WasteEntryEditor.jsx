import { SectionHeader } from '../../design-system/SectionHeader'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { RecordMetricStrip } from '../../design-system/RecordMetricStrip'
import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ActionButton } from '../../design-system/ActionButton'
import { Field } from '../../design-system/Field'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { formatDateTime, formatDay } from '../../core/i18n/formatDay'
import { PreventionDepartmentField, selectTexts, usePreventionDepartments, usePreventionLibrary } from './PreventionFields'

export function WasteEntryEditor({
  onSave,
  fixedDepartment = '',
  initialRecord = null,
  departments = [],
  wasteTypes: loadedWasteTypes = [],
  findPatientDays,
  readOnly = false,
}) {
  // Waste categories from the central library (the screen's list until it loads).
  const wasteTypes = usePreventionLibrary('wasteTypes', loadedWasteTypes)
  const { profile, user } = useAuth()
  const { language, locale } = useLanguage()
  const en = language === 'en'
  const actor = useMemo(() => controlActorFromAuth({ profile, user }), [profile, user])
  const initialDepartment = initialRecord?.departmentEl || fixedDepartment || ''
  const initialWasteType =
    initialRecord?.wasteType || initialRecord?.type || wasteTypes[0]?.el || ''
  const initialPeriodStart = initialRecord?.periodStart || initialRecord?.date || ''
  const initialPeriodEnd = initialRecord?.periodEnd || initialRecord?.date || ''
  const [draft, setDraft] = useState(() =>
    initialRecord
      ? {
          ...JSON.parse(JSON.stringify(initialRecord)),
          periodStart: initialPeriodStart,
          periodEnd: initialPeriodEnd,
        }
      : {
          date: '',
          periodStart: '',
          periodEnd: '',
          departmentEl: initialDepartment,
          wasteType: initialWasteType,
          wasteTypeId: wasteTypes.find(x => x.el === initialWasteType)?.id || '',
          weight: '',
          containers: '',
          patientDays: '',
          patientDaysSource: '',
          responsible: actor.name,
          documentNumber: '',
          collectionCompany: '',
          notes: '',
        },
  )
  const [suggestedPatientDays, setSuggestedPatientDays] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (key, value) => {
    if (!readOnly) setDraft(state => ({ ...state, [key]: value }))
  }
  const departmentRows = usePreventionDepartments(departments)
  const departmentInfo =
    departments.find(item => item.el === draft.departmentEl) ||
    departmentRows.find(item => item.el === draft.departmentEl)
  const typeInfo = wasteTypes.find(
    item => item.id === draft.wasteTypeId || item.el === draft.wasteType,
  )
  const departmentEn = departmentInfo?.en || draft.departmentEl
  const typeEn = typeInfo?.en || draft.wasteType
  const validPeriod = Boolean(
    draft.periodStart && draft.periodEnd && draft.periodEnd >= draft.periodStart,
  )

  useEffect(() => {
    if (readOnly || initialRecord) return
    setDraft(state => {
      const selectedType =
        wasteTypes.find(item => item.id === state.wasteTypeId || item.el === state.wasteType) ||
        wasteTypes[0]
      const wasteTypeId = selectedType?.id || ''
      const wasteType = selectedType?.el || ''
      if (state.wasteTypeId === wasteTypeId && state.wasteType === wasteType) return state
      return { ...state, wasteTypeId, wasteType, type: wasteType, typeEn: selectedType?.en || '' }
    })
  }, [readOnly, initialRecord, wasteTypes])

  useEffect(() => {
    if (readOnly) return
    let active = true
    async function load() {
      if (!findPatientDays || !departmentInfo?.id || !validPeriod) {
        setSuggestedPatientDays(null)
        return
      }
      try {
        const value = await findPatientDays(departmentInfo.id, draft.periodStart, draft.periodEnd)
        if (active) setSuggestedPatientDays(value || null)
      } catch {
        if (active) setSuggestedPatientDays(null)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [
    readOnly,
    findPatientDays,
    departmentInfo?.id,
    draft.periodStart,
    draft.periodEnd,
    validPeriod,
  ])

  const patientDays = Number(draft.patientDays) || 0
  const suggestedValue = Number(suggestedPatientDays?.patientDays) || 0
  const usingSuggestedPatientDays =
    Boolean(suggestedValue) &&
    Number(draft.patientDays) === suggestedValue &&
    draft.patientDaysSource === 'library'
  const weight = Number(draft.weight) || 0
  const indicator =
    patientDays > 0 ? Number(((weight / patientDays) * 1000).toFixed(2)) : (draft.indicator ?? null)
  const valid = Boolean(
    validPeriod &&
    draft.departmentEl &&
    draft.wasteType &&
    weight > 0 &&
    Number(draft.containers) >= 0,
  )

  if (readOnly)
    return (
      <WasteRecordDetails record={{ ...draft, indicator }} language={language} locale={locale} />
    )

  function changeWasteType(value) {
    const selected = wasteTypes.find(item => item.id === value)
    if (!selected) return
    setDraft(state => ({
      ...state,
      wasteTypeId: value,
      wasteType: selected?.el || '',
      type: selected?.el || '',
      typeEn: selected?.en || '',
    }))
  }
  async function submit() {
    if (!valid || saving) return
    const selectedType = wasteTypes.find(
      item => item.id === draft.wasteTypeId || item.el === draft.wasteType,
    )
    const now = new Date().toISOString()
    const record = {
      ...draft,
      date: draft.periodEnd,
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd,
      wasteTypeId: selectedType?.id || draft.wasteTypeId || '',
      wasteType: selectedType?.el || draft.wasteType,
      departmentEn,
      type: selectedType?.el || draft.wasteType,
      typeEn: selectedType?.en || typeEn,
      weight,
      containers: Number(draft.containers) || 0,
      patientDays: patientDays || null,
      indicator,
      responsible: draft.responsible || actor.name,
      createdAt: initialRecord?.createdAt || now,
      createdBy: initialRecord?.createdBy || actor.name,
      createdById: initialRecord?.createdById || actor.id,
      updatedAt: initialRecord ? now : null,
      updatedBy: initialRecord ? actor.name : null,
      updatedById: initialRecord ? actor.id : null,
      status: 'completed',
      lifecycleStatus: 'finalized',
    }
    try {
      setSaving(true)
      await onSave(record)
    } finally {
      setSaving(false)
    }
  }

  const sourceLabel =
    draft.patientDaysSource === 'library'
      ? en
        ? 'Source: Bed-days Library — exact same reporting period'
        : 'Πηγή: Βιβλιοθήκη νοσηλευτικών ημερών — ίδια ακριβώς περίοδος'
      : draft.patientDays
        ? en
          ? 'Source: Manual entry'
          : 'Πηγή: Χειροκίνητη καταχώριση'
        : en
          ? 'No denominator selected'
          : 'Δεν έχει επιλεγεί παρονομαστής'

  return (
    <div className="prevention-entry-body waste-page-editor waste-smart-editor">
      <div className="waste-smart-layout">
        <main className="waste-smart-main">
          <section className="waste-form-section waste-smart-section">
            <div className="waste-form-section-title">
              <strong>{en ? 'Measurement' : 'Μέτρηση'}</strong>
              <small>
                {en
                  ? 'Record the total waste quantity for one reporting period. The denominator must cover the same period.'
                  : 'Καταγράψτε τη συνολική ποσότητα αποβλήτων για μία περίοδο αναφοράς. Ο παρονομαστής πρέπει να αφορά την ίδια περίοδο.'}
              </small>
            </div>
            <div className="entry-grid waste-smart-measurement-grid">
              <div className="waste-date-field">
                <ManualDateField
                  label={en ? 'Period start *' : 'Έναρξη περιόδου *'}
                  value={draft.periodStart}
                  onChange={value => set('periodStart', value)}
                />
              </div>
              <div className="waste-date-field">
                <ManualDateField
                  label={en ? 'Period end *' : 'Λήξη περιόδου *'}
                  value={draft.periodEnd}
                  onChange={value => set('periodEnd', value)}
                />
              </div>
              <div className="waste-department-field">
                <PreventionDepartmentField
                  value={draft.departmentEl}
                  onChange={value => set('departmentEl', value)}
                  departments={departments}
                  fixed={Boolean(fixedDepartment)}
                />
              </div>
              <SearchableSelect
                className="waste-category-select"
                label={en ? 'Waste category *' : 'Κατηγορία αποβλήτου *'}
                value={draft.wasteTypeId || typeInfo?.id || ''}
                options={[
                  ...wasteTypes.map(item => ({ value: item.id, label: en ? item.en || item.el : item.el, keywords: `${item.el} ${item.en || ''} ${item.code || ''}` })),
                  ...(draft.wasteType && !typeInfo ? [{ value: draft.wasteTypeId || draft.wasteType, label: en ? draft.typeEn || draft.wasteType : draft.wasteType }] : []),
                ]}
                onChange={value => value && changeWasteType(value)}
                placeholder={en ? 'Select category' : 'Επιλέξτε κατηγορία'}
                {...selectTexts(en)}
              />
              <Field label={en ? 'Total weight in period (kg) *' : 'Συνολικό βάρος περιόδου (kg) *'}>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={draft.weight}
                  onChange={event => set('weight', event.target.value)}
                  placeholder="0,0"
                />
              </Field>
              <Field label={en ? 'Containers' : 'Περιέκτες'}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.containers}
                  onChange={event => set('containers', event.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
            {!validPeriod && draft.periodStart && draft.periodEnd && (
              <div className="waste-period-warning">
                {en
                  ? 'Period end must be the same as or later than period start.'
                  : 'Η λήξη της περιόδου πρέπει να είναι ίδια ή μεταγενέστερη της έναρξης.'}
              </div>
            )}
          </section>

          <section className="waste-form-section waste-smart-section">
            <div className="waste-form-section-title">
              <strong>{en ? 'Document & collection' : 'Παραστατικό & παραλαβή'}</strong>
              <small>
                {en
                  ? 'Traceability details stay secondary to the measurement.'
                  : 'Τα στοιχεία ιχνηλασιμότητας παραμένουν διακριτά από τη βασική μέτρηση.'}
              </small>
            </div>
            <div className="entry-grid waste-receipt-grid">
              <Field label={en ? 'Responsible person' : 'Υπεύθυνος'}>
                <input
                  value={draft.responsible || ''}
                  onChange={event => set('responsible', event.target.value)}
                  placeholder={actor.name}
                />
              </Field>
              <Field label={en ? 'Document number' : 'Αριθμός παραστατικού'}>
                <input
                  value={draft.documentNumber || ''}
                  onChange={event => set('documentNumber', event.target.value)}
                  placeholder={en ? 'e.g. 112233' : 'π.χ. 112233'}
                />
              </Field>
              <Field label={en ? 'Collection company' : 'Εταιρεία συλλογής'}>
                <input
                  value={draft.collectionCompany || ''}
                  onChange={event => set('collectionCompany', event.target.value)}
                  placeholder={en ? 'Company name' : 'Επωνυμία εταιρείας'}
                />
              </Field>
              <label className="field entry-span-2">
                <span className="lo-field-label">{en ? 'Notes' : 'Σημειώσεις'}</span>
                <textarea
                  rows="2"
                  value={draft.notes || ''}
                  onChange={event => set('notes', event.target.value)}
                  placeholder={en ? 'Optional notes' : 'Προαιρετικές παρατηρήσεις'}
                />
              </label>
            </div>
          </section>
        </main>

        <aside className="waste-smart-rail">
          <section className="waste-form-section waste-smart-indicator">
            <div className="waste-form-section-title">
              <strong>{en ? 'Indicator' : 'Δείκτης'}</strong>
              <small>
                {en
                  ? 'kg per 1,000 patient-days for the same reporting period'
                  : 'kg ανά 1.000 νοσηλευτικές ημέρες της ίδιας περιόδου'}
              </small>
            </div>
            <div className="waste-indicator-hero">
              <strong>{indicator === null ? '—' : Number(indicator).toLocaleString(locale)}</strong>
              <span>{en ? 'kg / 1,000 patient-days' : 'kg / 1.000 νοσηλευτικές ημέρες'}</span>
            </div>
            <label className="field waste-patient-days-control">
              <span className="lo-field-label">
                {en ? 'Patient-days for this period' : 'Νοσηλευτικές ημέρες περιόδου'}
              </span>
              <input
                type="number"
                min="0"
                value={draft.patientDays || ''}
                onChange={event =>
                  setDraft(state => ({
                    ...state,
                    patientDays: event.target.value,
                    patientDaysSource: 'manual',
                  }))
                }
                placeholder={
                  suggestedValue
                    ? String(suggestedValue)
                    : en
                      ? 'No approved matching period'
                      : 'Δεν βρέθηκε εγκεκριμένη ίδια περίοδος'
                }
              />
            </label>
            {suggestedValue > 0 && (
              <button
                type="button"
                className={`waste-library-source ${usingSuggestedPatientDays ? 'applied' : ''}`}
                onClick={() =>
                  setDraft(state => ({
                    ...state,
                    patientDays: suggestedValue,
                    patientDaysSource: 'library',
                  }))
                }
              >
                {usingSuggestedPatientDays
                  ? en
                    ? '✓ Using Library value'
                    : '✓ Χρήση τιμής Βιβλιοθήκης'
                  : en
                    ? `Use Library value: ${suggestedValue}`
                    : `Χρήση τιμής Βιβλιοθήκης: ${suggestedValue}`}
              </button>
            )}
            <div className="waste-source-note">
              <span>{sourceLabel}</span>
            </div>
          </section>
        </aside>
      </div>

      <div className="who-editor-page-actions prevention-editor-page-actions">
        <ActionButton
          label={
            initialRecord
              ? en
                ? 'Save changes'
                : 'Αποθήκευση αλλαγών'
              : en
                ? 'Save measurement'
                : 'Αποθήκευση μέτρησης'
          }
          tone="primary"
          disabled={!valid || saving}
          onClick={submit}
        >
          <Save size={16} />
          <span>
            {saving
              ? en
                ? 'Saving…'
                : 'Αποθήκευση…'
              : initialRecord
                ? en
                  ? 'Save changes'
                  : 'Αποθήκευση αλλαγών'
                : en
                  ? 'Save measurement'
                  : 'Αποθήκευση μέτρησης'}
          </span>
        </ActionButton>
      </div>
    </div>
  )
}

function WasteRecordDetails({ record, language, locale }) {
  const en = language === 'en'
  const fmtDate = value => formatDay(value, language)
  const fmtNumber = (value, digits = 1) =>
    Number(value || 0).toLocaleString(locale, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    })
  const start = record.periodStart || record.date
  const end = record.periodEnd || record.date
  const period = start === end ? fmtDate(start) : `${fmtDate(start)} — ${fmtDate(end)}`
  const patientDays = Number(record.patientDays) || 0
  const weight = Number(record.weight) || 0
  const indicator =
    record.indicator != null
      ? Number(record.indicator)
      : patientDays > 0
        ? (weight / patientDays) * 1000
        : null
  const source =
    record.patientDaysSource === 'library'
      ? en
        ? 'Bed-days Library'
        : 'Βιβλιοθήκη νοσηλευτικών ημερών'
      : record.patientDaysSource === 'manual'
        ? en
          ? 'Manual entry'
          : 'Χειροκίνητη καταχώριση'
        : '—'
  const fmtDateTime = value => formatDateTime(value, language)
  // Same layout as every prevention record: details sheet, key figures, notes.
  return (
    <div className="record-view-stack waste-record-view">
      <section>
        <SectionHeader title={en ? 'Waste measurement' : 'Μέτρηση αποβλήτων'} />
        <RecordDetailsGrid
          fields={[
            { id: 'period', label: en ? 'Reporting period' : 'Περίοδος αναφοράς', value: period },
            { id: 'department', label: en ? 'Department' : 'Τμήμα', value: record.departmentEl },
            {
              id: 'category',
              label: en ? 'Waste category' : 'Κατηγορία αποβλήτου',
              value: en
                ? record.typeEn || record.wasteType || record.type
                : record.wasteType || record.type,
            },
            { id: 'source', label: en ? 'Denominator source' : 'Πηγή παρονομαστή', value: source },
            {
              id: 'document',
              label: en ? 'Document number' : 'Αριθμός παραστατικού',
              value: record.documentNumber,
            },
            {
              id: 'company',
              label: en ? 'Collection company' : 'Εταιρεία συλλογής',
              value: record.collectionCompany,
            },
            {
              id: 'responsible',
              label: en ? 'Responsible' : 'Υπεύθυνος',
              value: record.responsible,
            },
            {
              id: 'recorded',
              label: en ? 'Recorded by' : 'Καταχώρηση από',
              value: record.createdBy || record.responsible,
              meta: record.createdAt
                ? `${fmtDateTime(record.createdAt)}${record.updatedAt && record.updatedAt !== record.createdAt ? ` · ${en ? 'updated' : 'ενημέρωση'} ${fmtDateTime(record.updatedAt)}` : ''}`
                : null,
            },
            {
              id: 'notes',
              className: 'is-wide',
              label: en ? 'Notes' : 'Σημειώσεις',
              value: record.notes,
              hidden: !record.notes,
            },
          ]}
        />
      </section>
      <RecordMetricStrip
        items={[
          {
            id: 'weight',
            label: en ? 'Total weight' : 'Συνολικό βάρος',
            value: fmtNumber(weight),
            unit: 'kg',
          },
          {
            id: 'containers',
            label: en ? 'Containers' : 'Περιέκτες',
            value: record.containers ?? '—',
          },
          {
            id: 'days',
            label: en ? 'Patient-days' : 'Νοσηλευτικές ημέρες',
            value: patientDays || '—',
          },
          {
            id: 'indicator',
            primary: true,
            label: en ? 'Waste indicator' : 'Δείκτης αποβλήτων',
            value: indicator == null ? '—' : fmtNumber(indicator, 2),
            note: en ? 'kg / 1,000 patient-days' : 'kg / 1.000 ημέρες νοσηλείας',
          },
        ]}
      />
    </div>
  )
}
