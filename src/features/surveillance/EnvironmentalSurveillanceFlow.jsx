import { useState } from 'react'
import {
  Building2,
  Droplets,
  Layers3,
  ListChecks,
  MapPin,
  Plus,
  RotateCcw,
  Trash2,
  Wind,
} from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { environmentalMethodLabel, sampleTypeLabel } from '../laboratory/laboratoryCloudService'
import { environmentalSubjectCatalog } from './environmentalSurveillanceData'
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
        <Button
          disabled={
            saving ||
            !date ||
            (mode === 'single' && !location.trim() && !point.trim()) ||
            (mode === 'batch' && !batchRows.some(x => x.location.trim() || x.point.trim()))
          }
          onClick={save}
        >
          {t('createSurveillance')}
        </Button>
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
        <label>
          <span>{t('department')}</span>
          <select value={departmentValue} onChange={e => setDepartmentValue(e.target.value)}>
            <option value="">{t('select')}</option>
            {departmentOptions.map(item => (
              <option key={item.value} value={item.value}>
                {language === 'el' ? item.label : item.labelEn || item.label}
              </option>
            ))}
          </select>
        </label>
        <ManualDateField label={t('samplingDate')} value={date} onChange={setDate} />
        <label>
          <span>{t('samplingMethod')}</span>
          <select value={sourceCode} onChange={e => setSourceCode(e.target.value)}>
            {sources.map(code => (
              <option key={code} value={code}>
                {environmentalMethodLabel(code, t)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {mode === 'single' ? (
        <div className="entry-grid environmental-point-fields">
          <label>
            <span>{t('locationArea')}</span>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={t('clinicalRecords.locationAreaPlaceholder')}
            />
          </label>
          <label>
            <span>{t('samplingPoint')}</span>
            <input
              value={point}
              onChange={e => setPoint(e.target.value)}
              placeholder={t('clinicalRecords.samplingPointPlaceholder')}
            />
          </label>
        </div>
      ) : (
        <div className="environmental-batch-points">
          <div className="batch-point-head">
            <strong>{t('samplingPoints')}</strong>
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
              <input
                value={row.location}
                onChange={e => updateRow(row.id, 'location', e.target.value)}
                placeholder={t('locationArea')}
              />
              <input
                value={row.point}
                onChange={e => updateRow(row.id, 'point', e.target.value)}
                placeholder={t('samplingPoint')}
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
        </div>
      )}
      <label className="environmental-notes">
        <span>{t('notes')}</span>
        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
      </label>
      <div className="source-truth-note">
        {t('clinicalRecords.environmentalCreatesLabRequests')}
      </div>
    </ObserverDialog>
  )
}

export function EnvironmentalRegistry({
  rows,
  empty,
  t,
  language,
  fmt,
  onOpenSample,
  onResample,
  highlightId = '',
}) {
  const columns = [
    { key: 'surveillance', label: t('surveillance') },
    { key: 'department', label: t('department') },
    { key: 'point', label: t('samplingPoint') },
    { key: 'date', label: t('samplingDate') },
    { key: 'batch', label: t('batch') },
    { key: 'result', label: t('result') },
    { key: 'status', label: t('status') },
  ]
  return (
    <section className="environmental-registry workspace-fill">
      <RegistryTable
        columns={columns}
        rows={rows}
        rowKey={row => row.code || row.id}
        emptyTitle={empty?.title}
        emptyText={empty?.text}
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
            </td>
            <td>{language === 'el' ? row.department : row.departmentEn}</td>
            <td>{[row.location, row.point].filter(Boolean).join(' · ') || '—'}</td>
            <td>{fmt(row.collectedAt || row.requestedAt)}</td>
            <td>{row.environmentalBatchId || '—'}</td>
            <td>
              {row.result ? (
                <span className="environment-result-cell">
                  <strong>{t(row.result)}</strong>
                  {row.microbiologyResults?.[0]?.cfuCount != null && (
                    <small>{row.microbiologyResults[0].cfuCount} CFU</small>
                  )}
                  {row.microbiologyResults?.[0]?.withinLimit === true && (
                    <b className="limit-ok">{t('withinLimits')}</b>
                  )}
                  {row.microbiologyResults?.[0]?.withinLimit === false && (
                    <b className="limit-bad">{t('outsideLimits')}</b>
                  )}
                </span>
              ) : (
                '—'
              )}
            </td>
            <td>
              <EnvironmentalStatusCell row={row} t={t} onResample={onResample} />
            </td>
          </>
        )}
      />
    </section>
  )
}

function EnvironmentalStatusCell({ row, t, onResample }) {
  const status = environmentalStatusDisplay(row, t)
  const needsAction = environmentalNeedsAction(row)
  return (
    <span className="environment-status-cell">
      <span className={`status-badge ${status.tone}`.trim()}>{status.label}</span>
      {needsAction && onResample && (
        <Button
          variant="secondary"
          className="environment-resample-action"
          title={t('surveillanceList.resampleHelp')}
          onClick={event => {
            event.stopPropagation()
            onResample(row)
          }}
          onKeyDown={event => event.stopPropagation()}
        >
          <RotateCcw size={13} aria-hidden="true" />
          {t('surveillanceList.resample')}
        </Button>
      )}
    </span>
  )
}
