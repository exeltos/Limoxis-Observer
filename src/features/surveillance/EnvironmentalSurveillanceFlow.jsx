import { useState } from 'react'
import {
  Building2,
  Droplets,
  Layers3,
  ListChecks,
  MapPin,
  Plus,
  Trash2,
  Wind,
} from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import {
  FieldLabelText,
  FieldMessage,
  FormSubmit,
  useFormValidation,
} from '../../design-system/FormValidation'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { StatusBadge } from '../../design-system/StatusBadge'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { environmentalMethodLabel, sampleTypeLabel } from '../laboratory/laboratoryCloudService'
import { libraryOptions, useLibraries } from '../management/useLibraries'
import { environmentalSubjectCatalog } from './environmentalSurveillanceData'
import { listTexts } from './surveillanceOptions'
import './surveillanceRegistry.css'
import './surveillanceEntryCard.css'

const icons = { surface: Layers3, room: Building2, air: Wind, water: Droplets }
const sourceByType = {
  surface: ['surfaceSwab', 'contactPlate', 'other'],
  room: ['roomSampling', 'surfaceSwab', 'contactPlate', 'other'],
  air: ['activeAir', 'passiveAir', 'airSampling', 'other'],
  water: ['tapWater', 'showerWater', 'waterSampling', 'other'],
}
const inProgressStatuses = ['requested', 'collected', 'received', 'processing']
const closedStatuses = ['cancelled', 'rejected', 'voided']

// A result outside the acceptable limits is not "done": the point needs action
// (remediation and a new sampling), whatever the laboratory status says.
export const environmentalNeedsAction = row =>
  !closedStatuses.includes(row?.status) &&
  (row?.microbiologyResults || []).some(result => result?.withinLimit === false)

// The registry status shown for an environmental sample, with its badge tone.
export function environmentalStatusDisplay(row, t) {
  if (environmentalNeedsAction(row))
    return { label: t('surveillanceList.actionNeeded'), tone: 'warning' }
  if (inProgressStatuses.includes(row?.status)) return { label: t(row.status), tone: 'info' }
  return { label: t(row?.status), tone: '' }
}

// Prefill for a new sampling at the same point as an earlier sample.
export function environmentalResampleInitial(row, departmentOptions = []) {
  const department = departmentOptions.find(
    item =>
      (row.departmentId && item.value === row.departmentId) ||
      (row.department && item.label === row.department) ||
      (row.departmentEn && item.labelEn === row.departmentEn),
  )
  const type = environmentalSubjectCatalog.some(item => item.id === row.type) ? row.type : 'surface'
  const method = (sourceByType[type] || []).includes(row.environmentalMethod)
    ? row.environmentalMethod
    : environmentalSubjectCatalog.find(item => item.id === type)?.defaultSource || 'other'
  return {
    resampleOf: row.code || row.id,
    subjectType: type,
    sourceCode: method,
    departmentValue: department?.value || '',
    location: row.location || '',
    point: row.point || '',
  }
}

export function EnvironmentalSurveillanceFlow({
  isDemo,
  departmentOptions = [],
  initial = null,
  createSample,
  onClose,
  onCreated,
}) {
  const { t, language } = useLanguage(),
    { notify, notifyError, confirm } = useFeedback()
  const [subjectType, setSubjectType] = useState(initial?.subjectType || 'surface'),
    [mode, setMode] = useState('single'),
    [departmentValue, setDepartmentValue] = useState(initial?.departmentValue || ''),
    [location, setLocation] = useState(initial?.location || ''),
    [point, setPoint] = useState(initial?.point || ''),
    [sourceCode, setSourceCode] = useState(initial?.sourceCode || 'surfaceSwab'),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [notes, setNotes] = useState(
      initial?.resampleOf ? `${t('surveillanceList.resampleOf')} ${initial.resampleOf}` : '',
    ),
    [batchRows, setBatchRows] = useState([{ id: 1, location: '', point: '' }]),
    [saving, setSaving] = useState(false)
  // Locations and points come from the central libraries; a new one can be typed.
  const { libraries } = useLibraries()
  const texts = listTexts(language)
  const locationOptions = libraryOptions(libraries.environmentalLocations || [], language),
    pointOptions = libraryOptions(libraries.surfacePoints || [], language)
  function chooseType(type) {
    setSubjectType(type)
    setSourceCode(environmentalSubjectCatalog.find(x => x.id === type)?.defaultSource || 'other')
  }
  function departmentFields() {
    const dep = departmentOptions.find(x => x.value === departmentValue)
    if (!dep) return isDemo ? { department: '', departmentEn: '' } : { departmentId: null }
    return isDemo
      ? { department: dep.label, departmentEn: dep.labelEn || dep.label }
      : { departmentId: dep.value }
  }
  function buildDraft(entryLocation, entryPoint, batchId) {
    const subjectName = [entryLocation, entryPoint].filter(Boolean).join(' · ')
    return {
      subjectType: 'environment',
      type: subjectType,
      environmentalMethod: sourceCode,
      subjectName,
      subjectNameEn: subjectName,
      subjectCode: 'ENV',
      location: entryLocation,
      point: entryPoint,
      environmentalBatchId: batchId || null,
      collectedAt: date,
      priority: 'routine',
      notes,
      ...departmentFields(),
    }
  }
  async function save() {
    if (!date || saving) return
    setSaving(true)
    try {
      if (mode === 'single') {
        if (!location.trim() && !point.trim()) return
        await createSample({
          patientRecordId: null,
          draft: buildDraft(location.trim(), point.trim()),
        })
        notify(t('clinicalRecords.environmentalSurveillanceCreated'), 'success')
        onCreated?.()
        onClose()
        return
      }
      const items = batchRows.filter(x => x.location.trim() || x.point.trim())
      if (!items.length) return
      const batchId = items.length > 1 ? `ENVB-${Date.now()}` : null
      for (const item of items)
        await createSample({
          patientRecordId: null,
          draft: buildDraft(item.location.trim(), item.point.trim(), batchId),
        })
      notify(
        t('clinicalRecords.environmentalBatchCreated').replace('{count}', String(items.length)),
        'success',
      )
      onCreated?.()
      onClose()
    } catch (error) {
      notifyError(error, 'save', { operation: 'environmental_surveillance_create' })
    } finally {
      setSaving(false)
    }
  }
  const updateRow = (id, key, value) =>
    setBatchRows(rows => rows.map(row => (row.id === id ? { ...row, [key]: value } : row)))
  const removeRow = async id => {
    const ok = await confirm({
      title: language === 'el' ? 'Αφαίρεση σημείου' : 'Remove sampling point',
      message:
        language === 'el'
          ? 'Το σημείο δειγματοληψίας θα αφαιρεθεί από την τρέχουσα καταχώρηση. Θέλετε να συνεχίσετε;'
          : 'The sampling point will be removed from the current entry. Do you want to continue?',
      confirmLabel: language === 'el' ? 'Αφαίρεση' : 'Remove',
      danger: true,
    })
    if (ok) setBatchRows(rows => rows.filter(row => row.id !== id))
  }
  const addRow = () => setBatchRows(rows => [...rows, { id: Date.now(), location: '', point: '' }]),
    sources = sourceByType[subjectType] || ['other']
  const form = useFormValidation([
    { key: 'department', label: t('department'), valid: Boolean(departmentValue) },
    { key: 'date', label: t('samplingDate'), valid: Boolean(date) },
    { key: 'method', label: t('samplingMethod'), valid: Boolean(sourceCode) },
    mode === 'single' && {
      key: 'location',
      label: `${t('locationArea')} / ${t('samplingPoint')}`,
      valid: Boolean(location.trim() || point.trim()),
    },
    mode === 'batch' && {
      key: 'points',
      label: t('samplingPoints'),
      valid: batchRows.some(x => x.location.trim() || x.point.trim()),
    },
  ])
  return (
    <ObserverDialog
      width="standard"
      fixedHeight
      className="surveillance-entry environmental-surveillance-entry"
      eyebrow={initial?.resampleOf ? t('environmentalSurveillance') : t('newSurveillance')}
      title={
        initial?.resampleOf ? t('surveillanceList.resampleTitle') : t('environmentalSurveillance')
      }
      subtitle={
        initial?.resampleOf
          ? `${t('surveillanceList.resampleOf')} ${initial.resampleOf}`
          : t('clinicalRecords.environmentalSurveillanceHelp')
      }
      onClose={onClose}
      footer={
        <FormSubmit form={form} icon={false} disabled={saving} onSubmit={save}>
          {t('createSurveillance')}
        </FormSubmit>
      }
    >
      <div className="environmental-type-grid">
        {environmentalSubjectCatalog.map(item => {
          const Icon = icons[item.id]
          return (
            <button
              type="button"
              key={item.id}
              className={subjectType === item.id ? 'active' : ''}
              onClick={() => chooseType(item.id)}
            >
              <Icon size={18} />
              <strong>{sampleTypeLabel(item.id, t)}</strong>
            </button>
          )
        })}
      </div>
      <ModeSwitch
        ariaLabel={t('samplingPoints')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'single', label: t('clinicalRecords.singleSampling'), icon: MapPin },
          { value: 'batch', label: t('clinicalRecords.bulkSampling'), icon: ListChecks },
        ]}
      />
      <div className="entry-grid">
        <SearchableSelect
          label={t('department')}
          {...form.field('department')}
          value={departmentValue}
          options={departmentOptions.map(item => ({
            value: item.value,
            label: language === 'el' ? item.label : item.labelEn || item.label,
          }))}
          placeholder={t('select')}
          emptyLabel={texts.emptyLabel}
          clearLabel={texts.clearLabel}
          onChange={setDepartmentValue}
        />
        <ManualDateField
          label={t('samplingDate')}
          {...form.field('date')}
          value={date}
          onChange={setDate}
        />
        <SearchableSelect
          label={t('samplingMethod')}
          {...form.field('method')}
          value={sourceCode}
          options={sources.map(code => ({ value: code, label: environmentalMethodLabel(code, t) }))}
          emptyLabel={texts.emptyLabel}
          onChange={v => v && setSourceCode(v)}
        />
      </div>
      {mode === 'single' ? (
        <div className="entry-grid environmental-point-fields">
          {/* Either one is enough; the examples go under the field, the placeholder is the same «Επιλέξτε» as every select. */}
          <SearchableSelect
            label={t('locationArea')}
            {...form.field('location')}
            value={location}
            options={locationOptions}
            allowCustom
            customLabel={texts.customLabel}
            placeholder={t('select')}
            hint={t('clinicalRecords.locationAreaPlaceholder')}
            emptyLabel=""
            clearLabel={texts.clearLabel}
            onChange={setLocation}
          />
          <SearchableSelect
            label={t('samplingPoint')}
            required
            error={form.errorFor('location')}
            hint={t('clinicalRecords.samplingPointPlaceholder')}
            value={point}
            options={pointOptions}
            allowCustom
            customLabel={texts.customLabel}
            placeholder={t('select')}
            emptyLabel=""
            clearLabel={texts.clearLabel}
            onChange={setPoint}
          />
        </div>
      ) : (
        <div
          className="environmental-batch-points"
          data-field-key="points"
          data-invalid={form.errorFor('points') ? 'true' : undefined}
        >
          <div className="batch-point-head">
            <strong>
              <FieldLabelText label={t('samplingPoints')} required />
            </strong>
            <Button variant="secondary" onClick={addRow}>
              <Plus size={14} />
              {t('clinicalRecords.addPoint')}
            </Button>
          </div>
          <div className="batch-point-columns">
            <span>#</span>
            <span>{t('locationArea')}</span>
            <span>{t('samplingPoint')}</span>
            <span></span>
          </div>
          {batchRows.map((row, index) => (
            <div className="batch-point-row" key={row.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <SearchableSelect
                hideLabel
                label={t('locationArea')}
                value={row.location}
                options={locationOptions}
                allowCustom
                customLabel={texts.customLabel}
                placeholder={t('locationArea')}
                emptyLabel=""
                onChange={v => updateRow(row.id, 'location', v)}
              />
              <SearchableSelect
                hideLabel
                label={t('samplingPoint')}
                value={row.point}
                options={pointOptions}
                allowCustom
                customLabel={texts.customLabel}
                placeholder={t('samplingPoint')}
                emptyLabel=""
                onChange={v => updateRow(row.id, 'point', v)}
              />
              {batchRows.length > 1 && (
                <button
                  type="button"
                  className="danger icon-action"
                  aria-label={language === 'el' ? 'Αφαίρεση σημείου' : 'Remove sampling point'}
                  title={language === 'el' ? 'Αφαίρεση σημείου' : 'Remove sampling point'}
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          <FieldMessage error={form.errorFor('points')} />
        </div>
      )}
      <label className="environmental-notes">
        <span className="lo-field-label">{t('notes')}</span>
        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
      </label>
      <div className="source-truth-note">
        {t('clinicalRecords.environmentalCreatesLabRequests')}
      </div>
    </ObserverDialog>
  )
}

export function EnvironmentalRegistry({
  loading = false,
  rows,
  empty,
  t,
  language,
  fmt,
  onOpenSample,
  highlightId = '',
  scrollRef,
}) {
  // Date, department and batch are the secondary columns: on a narrow screen (tablet)
  // they move under the sample code, so the list never scrolls sideways.
  const columns = [
    { key: 'surveillance', label: t('surveillance') },
    { key: 'department', label: t('department'), className: 'env-col-secondary' },
    { key: 'point', label: t('samplingPoint') },
    { key: 'date', label: t('samplingDate'), className: 'env-col-secondary' },
    { key: 'batch', label: t('batch'), className: 'env-col-secondary' },
    { key: 'result', label: t('result') },
    { key: 'status', label: t('status') },
  ]
  const departmentName = row => (language === 'el' ? row.department : row.departmentEn)
  return (
    <section className="environmental-registry workspace-fill">
      <div className="scroll-table" ref={scrollRef}>
      <RegistryTable
        loading={loading}
        bare
        className="environment-table"
        columns={columns}
        rows={rows}
        rowKey={row => row.code || row.id}
        emptyTitle={empty?.title}
        emptyText={empty?.text}
        emptyFiltered={Boolean(empty?.filtered)}
        onClearFilters={empty?.onClear}
        emptyIcon={empty?.icon}
        emptyAction={empty?.action}
        rowProps={row => ({
          'data-record-id': String(row.code || row.id),
          className: `registry-row-clickable${highlightId && highlightId === String(row.code || row.id) ? ' registry-row-returned' : ''}`,
          tabIndex: 0,
          onClick: () => onOpenSample?.(row.code || row.id),
          onKeyDown: e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpenSample?.(row.code || row.id)
            }
          },
        })}
        renderRow={row => (
          <>
            <td>
              <strong className="environment-code">{row.code || row.id}</strong>
              <small className="environment-type">{sampleTypeLabel(row.type, t)}</small>
              <small className="env-inline-secondary">
                {[fmt(row.collectedAt || row.requestedAt), departmentName(row), row.environmentalBatchId].filter(Boolean).join(' · ')}
              </small>
            </td>
            <td className="env-col-secondary">{departmentName(row)}</td>
            <td>{[row.location, row.point].filter(Boolean).join(' · ') || '—'}</td>
            <td className="env-col-secondary">{fmt(row.collectedAt || row.requestedAt)}</td>
            <td className="env-col-secondary env-batch">{row.environmentalBatchId || '—'}</td>
            <td>
              {row.result ? (
                // The limits decide what the point needs, so they lead; the result and CFU follow, small.
                <span className="environment-result-cell">
                  {row.microbiologyResults?.[0]?.withinLimit === true ? (
                    <StatusBadge tone="success">{t('clinicalRecords.withinLimitsShort')}</StatusBadge>
                  ) : row.microbiologyResults?.[0]?.withinLimit === false ? (
                    <StatusBadge tone="danger">{t('clinicalRecords.outsideLimitsShort')}</StatusBadge>
                  ) : (
                    <strong>{t(row.result)}</strong>
                  )}
                  <small>{[row.microbiologyResults?.[0]?.withinLimit != null && t(row.result), row.microbiologyResults?.[0]?.cfuCount != null && `${row.microbiologyResults[0].cfuCount} CFU`].filter(Boolean).join(' · ')}</small>
                </span>
              ) : (
                '—'
              )}
            </td>
            <td>
              <EnvironmentalStatusCell row={row} t={t} />
            </td>
          </>
        )}
      />
      </div>
    </section>
  )
}

function EnvironmentalStatusCell({ row, t }) {
  const status = environmentalStatusDisplay(row, t)
  return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
}
