import { useState } from 'react'
import { isOutsideLimit, limitAssessment } from '../laboratory/environmentalLimit'
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
import { Field } from '../../design-system/Field'
import { reportExports } from '../../core/export/reportDocument'
import { ExportMenu } from '../../design-system/ExportMenu'
import { formatDay } from '../../core/i18n/formatDay'
import { environmentalPlateText, environmentalSheetDocument } from './environmentalSamplingSheet'
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
  (row?.microbiologyResults || []).some(result => isOutsideLimit(result))

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
    [plate, setPlate] = useState(''),
    [position, setPosition] = useState(''),
    [batchRows, setBatchRows] = useState([{ id: 1, location: '', point: '', plate: '', position: '' }]),
    [created, setCreated] = useState(null),
    [saving, setSaving] = useState(false)
  // Surfaces, rooms and air are sampled on culture plates: the plate and the spot on it are required (water goes in a bottle).
  const needsPlate = subjectType !== 'water'
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
  function buildDraft(entryLocation, entryPoint, batchId, entryPlate = '', entryPosition = '') {
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
      environmentalPlate: entryPlate,
      environmentalPosition: entryPosition,
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
        const made = await createSample({
          patientRecordId: null,
          draft: buildDraft(location.trim(), point.trim(), null, plate.trim(), position.trim()),
        })
        notify(t('clinicalRecords.environmentalSurveillanceCreated'), 'success')
        onCreated?.()
        setCreated({ code: made?.id || '', points: [{ location: location.trim(), point: point.trim(), plate: plate.trim(), position: position.trim(), code: made?.id || '' }] })
        return
      }
      const items = batchRows.filter(x => x.location.trim() || x.point.trim())
      if (!items.length) return
      const batchId = items.length > 1 ? `ENVB-${Date.now()}` : null
      const points = []
      for (const item of items) {
        const made = await createSample({
          patientRecordId: null,
          draft: buildDraft(item.location.trim(), item.point.trim(), batchId, item.plate.trim(), item.position.trim()),
        })
        points.push({ location: item.location.trim(), point: item.point.trim(), plate: item.plate.trim(), position: item.position.trim(), code: made?.id || '' })
      }
      notify(
        t('clinicalRecords.environmentalBatchCreated').replace('{count}', String(items.length)),
        'success',
      )
      onCreated?.()
      setCreated({ code: batchId || points[0]?.code || '', points })
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
  const addRow = () => setBatchRows(rows => [...rows, { id: Date.now(), location: '', point: '', plate: '', position: '' }]),
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
    mode === 'single' && needsPlate && { key: 'plate', label: t('clinicalRecords.envPlate'), valid: Boolean(plate.trim()) },
    mode === 'single' && needsPlate && { key: 'position', label: t('clinicalRecords.envPosition'), valid: Boolean(position.trim()) },
    ...(mode === 'batch' && needsPlate
      ? batchRows.flatMap((row, index) =>
          row.location.trim() || row.point.trim()
            ? [
                { key: `plate-${row.id}`, label: `${t('clinicalRecords.envPlate')} ${index + 1}`, valid: Boolean(row.plate.trim()) },
                { key: `position-${row.id}`, label: `${t('clinicalRecords.envPosition')} ${index + 1}`, valid: Boolean(row.position.trim()) },
              ]
            : [],
        )
      : []),
  ])
  // The points as typed so far, for the recording sheet (printed before saving too: the sampler takes it to the field).
  const typedPoints = mode === 'single'
    ? [{ location: location.trim(), point: point.trim(), plate: plate.trim(), position: position.trim() }].filter(item => item.location || item.point)
    : batchRows.filter(row => row.location.trim() || row.point.trim()).map(row => ({ location: row.location.trim(), point: row.point.trim(), plate: row.plate.trim(), position: row.position.trim() }))
  // The recording sheet is exported like every other document (Εξαγωγή: print, PDF, Word).
  const sheetExports = (points, code = '') =>
    reportExports(() => sheetFor(points, code), { word: true, onBlocked: () => notify(t('clinicalRecords.envPopupBlocked'), 'error') })
  function sheetFor(points, code = '') {
    const dep = departmentOptions.find(item => item.value === departmentValue)
    return environmentalSheetDocument({
      language,
      t,
      department: dep ? (language === 'el' ? dep.label : dep.labelEn || dep.label) : '',
      date: formatDay(date, language),
      typeLabel: sampleTypeLabel(subjectType, t),
      methodLabel: environmentalMethodLabel(sourceCode, t),
      points,
      notes,
      code,
    })
  }
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
        created ? (
          <>
            <ExportMenu {...sheetExports(created.points, created.code)} />
            <Button onClick={onClose}>{t('close')}</Button>
          </>
        ) : (
          <>
            <ExportMenu {...sheetExports(typedPoints)} disabled={!typedPoints.length || saving} />
            <FormSubmit form={form} icon={false} disabled={saving} onSubmit={save}>
              {t('createSurveillance')}
            </FormSubmit>
          </>
        )
      }
    >
      {created ? (
        <div className="environmental-created" role="status">
          <strong>{t('clinicalRecords.envCreatedTitle')}</strong>
          <p>{t('clinicalRecords.envCreatedText')}</p>
        </div>
      ) : null}
      {created ? (
        <ul className="environmental-created-list" aria-label={t('clinicalRecords.envSheetPoints')}>
          {created.points.map((item, index) => (
            <li key={`${item.code}-${index}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{[item.location, item.point].filter(Boolean).join(' · ')}</strong>
              <small>{environmentalPlateText({ environmentalPlate: item.plate, environmentalPosition: item.position }, t)}</small>
              <code>{item.code}</code>
            </li>
          ))}
        </ul>
      ) : (
        <>
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
              placeholder={t('clinicalRecords.envChooseOrType')}
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
              placeholder={t('clinicalRecords.envChooseOrType')}
              emptyLabel=""
              clearLabel={texts.clearLabel}
              onChange={setPoint}
            />
            {/* Where on which culture plate the specimen is: the laboratory reads the plate with it. */}
            <Field label={t('clinicalRecords.envPlate')} {...(needsPlate ? form.field('plate') : {})}>
              <input value={plate} placeholder={t('clinicalRecords.envPlateHint')} onChange={event => setPlate(event.target.value)} />
            </Field>
            <Field label={t('clinicalRecords.envPosition')} {...(needsPlate ? form.field('position') : {})}>
              <input value={position} placeholder={t('clinicalRecords.envPositionHint')} onChange={event => setPosition(event.target.value)} />
            </Field>
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
            <div className="batch-point-columns plate">
              <span>#</span>
              <span>{t('locationArea')}</span>
              <span>{t('samplingPoint')}</span>
              <span>
                {t('clinicalRecords.envPlate')}
                {needsPlate && <i className="lo-required-mark" aria-hidden="true" />}
              </span>
              <span>
                {t('clinicalRecords.envPosition')}
                {needsPlate && <i className="lo-required-mark" aria-hidden="true" />}
              </span>
              <span></span>
            </div>
            {batchRows.map((row, index) => (
              <div className="batch-point-row with-plate" key={row.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <SearchableSelect
                  hideLabel
                  label={t('locationArea')}
                  value={row.location}
                  options={locationOptions}
                  allowCustom
                  customLabel={texts.customLabel}
                  placeholder={t('clinicalRecords.envChooseOrType')}
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
                  placeholder={t('clinicalRecords.envChooseOrType')}
                  emptyLabel=""
                  onChange={v => updateRow(row.id, 'point', v)}
                />
                {['plate', 'position'].map(key => {
                  const fieldKey = `${key}-${row.id}`
                  const invalid = Boolean(form.errorFor(fieldKey))
                  return (
                    <input
                      key={key}
                      data-field-key={fieldKey}
                      className={invalid ? 'is-invalid' : ''}
                      aria-invalid={invalid || undefined}
                      aria-label={t(key === 'plate' ? 'clinicalRecords.envPlate' : 'clinicalRecords.envPosition')}
                      placeholder={t(key === 'plate' ? 'clinicalRecords.envPlateHint' : 'clinicalRecords.envPositionHint')}
                      value={row[key]}
                      onChange={event => updateRow(row.id, key, event.target.value)}
                    />
                  )
                })}
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
        </>
      )}
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
            <td>
              {[row.location, row.point].filter(Boolean).join(' · ') || '—'}
              {environmentalPlateText(row, t) && <small className="environment-type">{environmentalPlateText(row, t)}</small>}
            </td>
            <td className="env-col-secondary">{fmt(row.collectedAt || row.requestedAt)}</td>
            <td className="env-col-secondary env-batch">{row.environmentalBatchId || '—'}</td>
            <td>
              {row.result ? (
                // The limits decide what the point needs, so they lead; the result and CFU follow, small.
                <span className="environment-result-cell">
                  {limitAssessment(row.microbiologyResults?.[0]) === true ? (
                    <StatusBadge tone="success">{t('clinicalRecords.withinLimitsShort')}</StatusBadge>
                  ) : limitAssessment(row.microbiologyResults?.[0]) === false ? (
                    <StatusBadge tone="danger">{t('clinicalRecords.outsideLimitsShort')}</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">{t(row.result)}</StatusBadge>
                  )}
                  <small>{[limitAssessment(row.microbiologyResults?.[0]) != null && t(row.result), row.microbiologyResults?.[0]?.cfuCount != null && `${row.microbiologyResults[0].cfuCount} CFU`].filter(Boolean).join(' · ')}</small>
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
