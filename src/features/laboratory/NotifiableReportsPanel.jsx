import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock3, Megaphone } from 'lucide-react'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { PERIOD_DAYS, inPeriod } from '../surveillance/surveillanceOptions'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useTableSort } from '../../design-system/useTableSort'
import { StatusBadge } from '../../design-system/StatusBadge'
import { StatusCards } from '../../design-system/StatusCards'
import { formatDay } from '../../core/i18n/formatDay'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { createClinicalNotificationReport, loadNotificationReports } from '../reporting/notificationReportsService'
import { deadlineDueAt, deadlineStatusText, deadlineWords } from '../reporting/eodyCatalogue'
import { NotifiableDialog, notifiableRows } from '../surveillance/forms/sections/notifiableSection'
import { NewNotificationDialog } from '../surveillance/forms/sections/notifiablePicker'
import { createPatient, findPatientMatches, loadPatients } from '../patients/patientsService'
import { useRecordDelete } from '../recycle-bin/useRecordDelete'
import { DuplicatePatientDialog } from '../patients/DuplicatePatientDialog'

// A patient's name; one just registered here may carry only its last and first name.
const nameOf = (patient, language) => (language === 'en' ? patient?.nameEn : '') || patient?.name || [patient?.lastName, patient?.firstName].filter(Boolean).join(' ')

// «Δηλωτέα νοσήματα» of the laboratory: every notification of the hospital in one list, the
// notifiable laboratory findings (with or without a report yet) and the clinical notifications.
// A row opens the same notification window as the patient's record; «Νέα δήλωση» picks the
// disease, then an existing patient or a new one.
// The deadline as a date and time when the rule sets one (24 hours, a week), the rule itself
// («immediately»), or «no deadline · national plan» for findings reported through the national plan.
function NotificationDeadline({ row, language, t }) {
  const due = row.status === 'pending' && row.entry ? deadlineDueAt(row.entry.deadline, row.start) : null
  const when = due ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Athens' }).format(due) : ''
  const text = due ? `${language === 'en' ? 'by' : 'έως'} ${when}` : row.entry ? deadlineWords(row.entry.deadline, language) : row.finding?.rule.nationalPlan ? t('labNotifiable.noDeadlineNationalPlan') : '—'
  return <>{text}{row.waitingText && <small>{row.waitingText}</small>}</>
}

export function NotifiableReportsPanel({ organizationId, isDemo, samples = [], canCreate = false, creating = false, onCreatingChange }) {
  const { t, language } = useLanguage()
  const { notify } = useFeedback()
  const deleteItem = useRecordDelete()
  const fmtDate = value => formatDay(value, language)
  const [reports, setReports] = useState([])
  const [patients, setPatients] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [quick, setQuick] = useState('all')
  const [disease, setDisease] = useState('all')
  const [status, setStatus] = useState('all')
  const [period, setPeriod] = useState('all')
  const [openRow, setOpenRow] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [busy, setBusy] = useState(false)
  // Patients registered here stay known even when a reload does not return them (the demo keeps none).
  const [added, setAdded] = useState([])
  const [duplicate, setDuplicate] = useState(null)

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
  const known = useMemo(() => [...patients, ...added.filter(item => !patients.some(patient => patient.id === item.id))], [patients, added])
  const patientOf = useCallback(report => known.find(item => item.recordId === report?.patientRecordId || item.id === report?.patientRecordId) || null, [known])
  const rows = useMemo(() => {
    const ctx = { language, t, samples }
    return notifiableRows(ctx, reports).map(row => {
      const patient = row.finding ? null : patientOf(row.report)
      const sample = row.finding?.sample
      const name = sample ? (language === 'en' ? sample.patientEn || sample.patient : sample.patient) : nameOf(patient, language)
      const code = sample ? sample.patientId : patient?.id
      const waiting = row.status === 'pending' && row.entry ? deadlineStatusText(row.entry.deadline, row.start, { language }) : { overdue: false, text: '' }
      return { ...row, patient, patientName: name || '', patientCode: code || '', overdue: waiting.overdue, waitingText: waiting.text }
    }).sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')))
  }, [reports, samples, language, t, patientOf])

  const counts = { pending: rows.filter(row => row.status === 'pending').length, overdue: rows.filter(row => row.overdue).length, notified: rows.filter(row => row.status === 'notified').length }
  const shown = rows
    .filter(row => quick === 'all' || (quick === 'overdue' ? row.overdue : row.status === quick))
    .filter(row => disease === 'all' || row.title === disease)
    .filter(row => status === 'all' || (status === 'overdue' ? row.overdue : row.status === status))
    .filter(row => inPeriod(row.start || row.date, period))
    .filter(row => `${row.title} ${row.patientName} ${row.patientCode} ${row.report?.reference || ''}`.toLowerCase().includes(query.toLowerCase()))
  // The arrows in the headers sort the whole filtered list (newest first); then the page is cut.
  const dueTime = row => { const due = row.status === 'pending' && row.entry ? deadlineDueAt(row.entry.deadline, row.start) : null; return due ? new Date(due).getTime() : null }
  const { sorted: sortedRows, sort, onSort } = useTableSort(shown, {
    disease: row => row.title,
    patient: row => row.patientName,
    date: row => row.date,
    deadline: dueTime,
    status: row => (row.overdue ? '0' : '1') + row.status,
    reference: row => row.report?.reference,
  }, { key: 'date', dir: 'desc' })
  useEffect(() => { setPage(1) }, [sort, query, quick, disease, status, period, pageSize])
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const toggle = key => setQuick(current => (current === key ? 'all' : key))
  const diseases = [...new Set(rows.map(row => row.title).filter(Boolean))].sort((a, b) => a.localeCompare(b, language))
  const statusOptions = [['pending', t('labNotifiable.pending')], ['overdue', t('labNotifiable.overdue')], ['notified', t('labNotifiable.notified')], ['not_required', t('episodeForms.notifiable.notRequired')]]
  const clearAll = () => { setQuery(''); setQuick('all'); setDisease('all'); setStatus('all'); setPeriod('all') }
  const statusLabel = row => (row.status === 'notified' ? t('episodeForms.notifiable.notified') : row.status === 'not_required' ? t('episodeForms.notifiable.notRequired') : t('episodeForms.notifiable.pending'))

  // The notification window needs the patient (for its prefilled lines); a finding brings its sample's.
  const dialogCtx = row => {
    const sample = row.finding?.sample
    const patient = row.patient || (sample ? known.find(item => item.id === sample.patientId) || { id: sample.patientId, name: sample.patient, nameEn: sample.patientEn, recordId: sample.patientRecordId || null } : null)
    return { organizationId, isDemo, language, t, fmtDate, patient, admission: null, record: null, samples, deleteItem }
  }

  // «Δημιουργία δήλωσης»: a new patient is registered first, then the pending report is made and opened.
  async function createReport({ entry, patient, newPatient }, confirmed = false) {
    // A «new» patient who is already registered: the notification goes to the existing one (or continue as new).
    const found = newPatient && !confirmed ? findPatientMatches(known, newPatient) : []
    if (found.length) return setDuplicate({ entry, newPatient, matches: found })
    setDuplicate(null)
    setBusy(true)
    try {
      let target = patient
      if (newPatient) {
        const created = await createPatient(organizationId, known, { ...newPatient, admissionDate: new Date().toISOString().slice(0, 10), status: 'active' }, { isDemo })
        target = { ...created.record, name: created.record.name || [newPatient.lastName, newPatient.firstName].join(' ') }
        setAdded(current => [...current, target])
      }
      const report = await createClinicalNotificationReport(organizationId, { patientRecordId: isDemo ? target.id : target.recordId, departmentId: target.departmentId || null, entry }, { isDemo })
      notify(t('episodeForms.notifiable.saved'), 'success')
      onCreatingChange?.(false)
      reload()
      setOpenRow({ key: report.id, finding: null, report, title: report.disease || entry.el, sample: '', organism: '', date: String(report.createdAt || '').slice(0, 10), start: report.createdAt, entry, status: 'pending', patient: target })
    } catch (error) {
      notify(error?.duplicateCode ? t('patientCodeDuplicate') : error?.message || t('episodeForms.notifiable.saveFailed'), 'danger')
    } finally {
      setBusy(false)
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
        <FilterBar query={query} onQueryChange={setQuery} placeholder={t('labNotifiable.search')} onClear={clearAll} activeAdvancedCount={(disease !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0) + (period !== 'all' ? 1 : 0)} activeFilters={[
          disease !== 'all' && { key: 'disease', label: `${t('labNotifiable.colDisease')}: ${disease}`, onRemove: () => setDisease('all') },
          status !== 'all' && { key: 'status', label: `${t('status')}: ${statusOptions.find(([value]) => value === status)?.[1] || status}`, onRemove: () => setStatus('all') },
          period !== 'all' && { key: 'period', label: `${t('svPeriod')}: ${t(`svPeriod${period}`)}`, onRemove: () => setPeriod('all') },
        ].filter(Boolean)} advanced={<>
          <FilterSelect label={t('labNotifiable.colDisease')} value={disease} onChange={setDisease}><option value="all">{t('all')}</option>{diseases.map(name => <option key={name} value={name}>{name}</option>)}</FilterSelect>
          <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</FilterSelect>
          <FilterSelect label={t('svPeriod')} value={period} onChange={setPeriod}><option value="all">{t('svPeriodAll')}</option>{PERIOD_DAYS.map(days => <option key={days} value={String(days)}>{t(`svPeriod${days}`)}</option>)}</FilterSelect>
        </>} />
        <div className="scroll-table">
          <RegistryTable bare className="lab-table lab-notifiable-table" sort={sort} onSort={onSort} columns={[
            { key: 'disease', label: t('labNotifiable.colDisease'), sortable: true },
            { key: 'patient', label: t('labNotifiable.colPatient'), sortable: true },
            { key: 'date', label: t('labNotifiable.colDate'), sortable: true },
            { key: 'deadline', label: t('labNotifiable.colDeadline'), sortable: true },
            { key: 'status', label: t('labNotifiable.colStatus'), sortable: true },
            { key: 'reference', label: t('labNotifiable.colReference'), sortable: true },
          ]} rows={pagedRows} loading={!loaded} rowKey={row => row.key}
          rowProps={row => ({ className: 'clickable-row', tabIndex: 0, onClick: () => setOpenRow(row), onKeyDown: event => { if (event.key === 'Enter') setOpenRow(row) } })}
          emptyTitle={rows.length ? t('svEmptyFiltered') : t('labNotifiable.empty')} emptyText={rows.length ? t('svEmptyFilteredHint') : t('labNotifiable.emptyText')} emptyFiltered={rows.length > 0} onClearFilters={clearAll} emptyIcon={Megaphone}
          renderRow={row => <>
            <td><strong>{row.title}</strong><small>{row.finding ? [t('labNotifiable.fromLab'), row.sample, row.organism].filter(Boolean).join(' · ') : t('labNotifiable.clinical')}</small></td>
            <td><strong>{row.patientName || '—'}</strong>{row.patientCode && <small>{row.patientCode}</small>}</td>
            <td>{row.date ? fmtDate(row.date) : '—'}</td>
            <td><NotificationDeadline row={row} language={language} t={t} /></td>
            <td><StatusBadge tone={row.overdue ? 'danger' : row.status === 'notified' ? 'success' : row.status === 'pending' ? 'warning' : 'neutral'}>{row.overdue ? t('episodeForms.status.overdue') : statusLabel(row)}</StatusBadge></td>
            <td>{row.report?.reference || '—'}</td>
          </>} />
        </div>
        {shown.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }}/>}
      </section>
      {creating && canCreate && <NewNotificationDialog patients={known} busy={busy} onSave={createReport} onClose={() => onCreatingChange?.(false)} />}
      {duplicate && <DuplicatePatientDialog matches={duplicate.matches} onClose={() => setDuplicate(null)} onContinue={() => createReport(duplicate, true)} actions={[
        { key: 'use', label: t('patientDuplicate.useExisting'), onClick: patient => createReport({ entry: duplicate.entry, patient }, true) },
      ]} />}
      {openRow && <NotifiableDialog ctx={dialogCtx(openRow)} row={openRow} onClose={() => setOpenRow(null)} onSaved={() => { setOpenRow(null); reload() }} />}
    </>
  )
}
