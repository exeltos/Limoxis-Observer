import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock3, Megaphone, UserPlus, UserRound } from 'lucide-react'
import { FilterBar } from '../../design-system/FilterBar'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { StatusCards } from '../../design-system/StatusCards'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { Field } from '../../design-system/Field'
import { FormSubmit, useFormValidation } from '../../design-system/FormValidation'
import { formatDay } from '../../core/i18n/formatDay'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { createClinicalNotificationReport, loadNotificationReports } from '../reporting/notificationReportsService'
import { deadlineStatusText, deadlineWords } from '../reporting/eodyCatalogue'
import { NotifiableDialog, notifiableRows } from '../surveillance/forms/sections/notifiableSection'
import { NotifiablePicker } from '../surveillance/forms/sections/notifiablePicker'
import { createPatient, loadPatients, suggestPatientCode } from '../patients/patientsService'

// «Δηλωτέα νοσήματα» of the laboratory: every notification of the hospital in one list, the
// notifiable laboratory findings (with or without a report yet) and the clinical notifications.
// A row opens the same notification window as the patient's record; «Νέα δήλωση» picks the
// disease, then an existing patient or a new one.
export function NotifiableReportsPanel({ organizationId, isDemo, samples = [], canCreate = false, creating = false, onCreatingChange }) {
  const { t, language } = useLanguage()
  const { notify } = useFeedback()
  const fmtDate = value => formatDay(value, language)
  const [reports, setReports] = useState([])
  const [patients, setPatients] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [quick, setQuick] = useState('all')
  const [openRow, setOpenRow] = useState(null)
  const [disease, setDisease] = useState(null)

  const reload = useCallback(() => {
    let alive = true
    Promise.all([loadNotificationReports(organizationId, { isDemo }), loadPatients(organizationId, { isDemo }).catch(() => [])])
      .then(([reportRows, patientRows]) => { if (alive) { setReports(reportRows); setPatients(patientRows) } })
      .catch(() => { if (alive) notify(t('labNotifiable.loadFailed'), 'danger') })
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [organizationId, isDemo, notify, t])
  useEffect(() => reload(), [reload])

  // Clinical reports carry the patient's record id (the code in the demo); findings their sample's patient.
  const patientOf = useCallback(report => patients.find(item => item.recordId === report?.patientRecordId || item.id === report?.patientRecordId) || null, [patients])
  const rows = useMemo(() => {
    const ctx = { language, t, samples }
    return notifiableRows(ctx, reports).map(row => {
      const patient = row.finding ? null : patientOf(row.report)
      const sample = row.finding?.sample
      const name = sample ? (language === 'en' ? sample.patientEn || sample.patient : sample.patient) : (language === 'en' ? patient?.nameEn || patient?.name : patient?.name)
      const code = sample ? sample.patientId : patient?.id
      const waiting = row.status === 'pending' && row.entry ? deadlineStatusText(row.entry.deadline, row.start, { language }) : { overdue: false, text: '' }
      return { ...row, patient, patientName: name || '', patientCode: code || '', overdue: waiting.overdue, waitingText: waiting.text }
    }).sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')))
  }, [reports, samples, language, t, patientOf])

  const counts = { pending: rows.filter(row => row.status === 'pending').length, overdue: rows.filter(row => row.overdue).length, notified: rows.filter(row => row.status === 'notified').length }
  const shown = rows
    .filter(row => quick === 'all' || (quick === 'overdue' ? row.overdue : row.status === quick))
    .filter(row => `${row.title} ${row.patientName} ${row.patientCode} ${row.report?.reference || ''}`.toLowerCase().includes(query.toLowerCase()))
  const toggle = key => setQuick(current => (current === key ? 'all' : key))
  const statusLabel = row => (row.status === 'notified' ? t('episodeForms.notifiable.notified') : row.status === 'not_required' ? t('episodeForms.notifiable.notRequired') : t('episodeForms.notifiable.pending'))

  // The notification window needs the patient (for its prefilled lines); a finding brings its sample's.
  const dialogCtx = row => {
    const sample = row.finding?.sample
    const patient = row.patient || (sample ? patients.find(item => item.id === sample.patientId) || { id: sample.patientId, name: sample.patient, nameEn: sample.patientEn, recordId: sample.patientRecordId || null } : null)
    return { organizationId, isDemo, language, t, fmtDate, patient, admission: null, record: null, samples }
  }

  async function createReport({ patient }) {
    try {
      const report = await createClinicalNotificationReport(organizationId, { patientRecordId: isDemo ? patient.id : patient.recordId, departmentId: patient.departmentId || null, entry: disease }, { isDemo })
      notify(t('episodeForms.notifiable.saved'), 'success')
      setDisease(null)
      onCreatingChange?.(false)
      reload()
      setOpenRow({ key: report.id, finding: null, report, title: report.disease || disease.el, sample: '', organism: '', date: String(report.createdAt || '').slice(0, 10), start: report.createdAt, entry: disease, status: 'pending', patient })
    } catch (error) {
      notify(error?.message || t('episodeForms.notifiable.saveFailed'), 'danger')
    }
  }

  return (
    <>
      <StatusCards label={t('labNotifiable.tab')} loading={!loaded} items={[
        { key: 'pending', icon: Clock3, label: t('labNotifiable.pending'), value: counts.pending, active: quick === 'pending', onToggle: () => toggle('pending') },
        { key: 'overdue', icon: AlertTriangle, label: t('labNotifiable.overdue'), value: counts.overdue, tone: counts.overdue > 0 ? 'danger' : '', active: quick === 'overdue', onToggle: () => toggle('overdue') },
        { key: 'notified', icon: Megaphone, label: t('labNotifiable.notified'), value: counts.notified, active: quick === 'notified', onToggle: () => toggle('notified') },
      ]} />
      <section className="surface workspace-fill registry-workspace workspace-column canonical-paginated-registry laboratory-registry">
        <FilterBar query={query} onQueryChange={setQuery} placeholder={t('labNotifiable.search')} onClear={() => { setQuery(''); setQuick('all') }} />
        <div className="scroll-table">
          <RegistryTable bare className="lab-table lab-notifiable-table" columns={[
            { key: 'disease', label: t('labNotifiable.colDisease') },
            { key: 'patient', label: t('labNotifiable.colPatient') },
            { key: 'date', label: t('labNotifiable.colDate') },
            { key: 'deadline', label: t('labNotifiable.colDeadline') },
            { key: 'status', label: t('labNotifiable.colStatus') },
            { key: 'reference', label: t('labNotifiable.colReference') },
          ]} rows={shown} loading={!loaded} rowKey={row => row.key}
          rowProps={row => ({ className: 'clickable-row', tabIndex: 0, onClick: () => setOpenRow(row), onKeyDown: event => { if (event.key === 'Enter') setOpenRow(row) } })}
          emptyTitle={rows.length ? t('svEmptyFiltered') : t('labNotifiable.empty')} emptyText={rows.length ? t('svEmptyFilteredHint') : t('labNotifiable.emptyText')} emptyFiltered={rows.length > 0} onClearFilters={() => { setQuery(''); setQuick('all') }} emptyIcon={Megaphone}
          renderRow={row => <>
            <td><strong>{row.title}</strong><small>{row.finding ? [t('labNotifiable.fromLab'), row.sample, row.organism].filter(Boolean).join(' · ') : t('labNotifiable.clinical')}</small></td>
            <td><strong>{row.patientName || '—'}</strong>{row.patientCode && <small>{row.patientCode}</small>}</td>
            <td>{row.date ? fmtDate(row.date) : '—'}</td>
            <td>{row.entry ? deadlineWords(row.entry.deadline, language) : row.finding?.rule.nationalPlan ? t('episodeForms.notifiable.nationalPlan') : '—'}{row.waitingText && <small>{row.waitingText}</small>}</td>
            <td><StatusBadge tone={row.overdue ? 'danger' : row.status === 'notified' ? 'success' : row.status === 'pending' ? 'warning' : 'neutral'}>{row.overdue ? t('episodeForms.status.overdue') : statusLabel(row)}</StatusBadge></td>
            <td>{row.report?.reference || '—'}</td>
          </>} />
        </div>
      </section>
      {creating && canCreate && !disease && <NotifiablePicker onPick={entry => setDisease(entry)} onClose={() => onCreatingChange?.(false)} />}
      {creating && canCreate && disease && (
        <NotifiablePatientDialog organizationId={organizationId} isDemo={isDemo} patients={patients} disease={disease} language={language} t={t}
          onClose={() => { setDisease(null); onCreatingChange?.(false) }} onDone={createReport} onPatientCreated={list => setPatients(list)} />
      )}
      {openRow && <NotifiableDialog ctx={dialogCtx(openRow)} row={openRow} onClose={() => setOpenRow(null)} onSaved={() => { setOpenRow(null); reload() }} />}
    </>
  )
}

// Step 2 of «Νέα δήλωση»: the patient. An existing one is searched; a new one is registered with
// the few fields of the laboratory's «new patient» (last name, first name, patient code).
function NotifiablePatientDialog({ organizationId, isDemo, patients, disease, language, t, onClose, onDone, onPatientCreated }) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const [mode, setMode] = useState('')
  const [patientId, setPatientId] = useState('')
  const [draft, setDraft] = useState({ lastName: '', firstName: '', patientCode: '' })
  const [busy, setBusy] = useState(false)
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const form = useFormValidation([
    { key: 'mode', label: t('labNotifiable.patientTitle'), valid: Boolean(mode) },
    mode === 'existing' && { key: 'patientId', label: t('patient'), valid: Boolean(patientId) },
    mode === 'new' && { key: 'lastName', label: t('labNotifiable.lastName'), valid: Boolean(draft.lastName.trim()) },
    mode === 'new' && { key: 'firstName', label: t('labNotifiable.firstName'), valid: Boolean(draft.firstName.trim()) },
    mode === 'new' && { key: 'patientCode', label: t('labNotifiable.patientCode'), valid: Boolean(draft.patientCode.trim()) },
  ])
  const options = patients.map(patient => ({ value: patient.id, label: en ? patient.nameEn || patient.name : patient.name, description: [patient.id, en ? patient.departmentEn || patient.department : patient.department].filter(Boolean).join(' · ') }))
  function chooseMode(value) {
    setMode(value)
    if (value === 'new' && !draft.patientCode) set('patientCode', suggestPatientCode(patients))
  }
  async function save() {
    setBusy(true)
    try {
      if (mode === 'existing') return await onDone({ patient: patients.find(item => item.id === patientId) })
      const created = await createPatient(organizationId, patients, { patientCode: draft.patientCode.trim(), firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), admissionDate: new Date().toISOString().slice(0, 10), status: 'active' }, { isDemo })
      onPatientCreated?.(created.list)
      await onDone({ patient: created.record })
    } catch (error) {
      notify(error?.duplicateCode ? t('patientCodeDuplicate') : error?.message || t('patientSaveFailed'), 'danger')
    } finally {
      setBusy(false)
    }
  }
  return (
    <ObserverDialog width="standard" title={en ? disease.en || disease.el : disease.el} subtitle={t('labNotifiable.patientSubtitle')} onClose={onClose}
      footer={<FormSubmit form={form} disabled={busy} onSubmit={save}>{t('labNotifiable.create')}</FormSubmit>}>
      <div className="lab-flow-body" ref={form.scopeRef}>
        <div data-field-key="mode">
          <ModeSwitch ariaLabel={t('labNotifiable.patientTitle')} value={mode} onChange={chooseMode} options={[{ value: 'existing', label: t('existingPatient'), icon: UserRound }, { value: 'new', label: t('laboratoryRecords.newPatientInline'), icon: UserPlus }]} />
          {form.errorFor('mode') && <span className="field-error">{form.errorFor('mode')}</span>}
        </div>
        {mode === 'existing' && (
          <SearchableSelect label={t('patient')} {...form.field('patientId')} value={patientId} onChange={value => setPatientId(value || '')} options={options} placeholder={t('surveillanceList.patientSearchPlaceholder')} emptyLabel={t('surveillanceList.noPatientsFound')} clearLabel={t('surveillanceList.clearSelection')} />
        )}
        {mode === 'new' && (
          <div className="entry-grid lab-flow-grid">
            <Field label={t('labNotifiable.lastName')} {...form.field('lastName')}><input value={draft.lastName} onChange={event => set('lastName', event.target.value)} /></Field>
            <Field label={t('labNotifiable.firstName')} {...form.field('firstName')}><input value={draft.firstName} onChange={event => set('firstName', event.target.value)} /></Field>
            <Field label={t('labNotifiable.patientCode')} {...form.field('patientCode')}><input value={draft.patientCode} onChange={event => set('patientCode', event.target.value)} /></Field>
          </div>
        )}
      </div>
    </ObserverDialog>
  )
}
