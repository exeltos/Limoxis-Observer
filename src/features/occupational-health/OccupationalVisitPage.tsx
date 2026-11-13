import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Stethoscope, Trash2, UserRound } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { FormPage } from '../../design-system/FormPage'
import { FormGrid } from '../../design-system/FormCard'
import { ChoiceField } from '../../design-system/ChoiceField'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Field } from '../../design-system/Field'
import { SaveButton } from '../../design-system/SaveButton'
import { Button } from '../../design-system/Button'
import { StatusBadge } from '../../design-system/StatusBadge'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { useEmployeesData } from '../employees/useEmployeesData'
import { createOccupationalVisitAsync, deleteOccupationalVisitAsync, loadAllOccupationalVisitsAsync, updateOccupationalVisitAsync } from '../employees/employeeSubRecordsService'
import { EMPTY_OCCUPATIONAL_VISIT, FITNESS, VISIT_STATUSES, VISIT_TYPES, fitnessLabel, visitProblems, visitSavedMessage, visitStatusLabel, visitTypeLabel } from './occupationalVisitModel'
import { signalDemoStep } from '../demo/demoScenarioSignals'
import './OccupationalHealthPage.css'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import type { EmployeeRow, OccupationalVisit, OccupationalVisitDraft } from './occupationalHealthTypes'

const fmtDay = (value: unknown, locale: string) => (value ? new Intl.DateTimeFormat(locale).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : '—')

// The visit of the occupational physician as a page: its details, with Edit and Delete in the «…»; «new» (and
// Edit) open the form as a page too, not as a window.
export function OccupationalVisitPage() {
  const { visitId } = useParams()
  const isNew = visitId === 'new'
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation('/occupational-health')
  const { language, locale } = useLanguage()
  const en = language === 'en'
  const { notify, notifyError, confirm } = useFeedback()
  const { tenant, canAccessRecord, role, membership } = useTenant()
  const { data: employeeRows } = useEmployeesData() as unknown as { data: EmployeeRow[] }
  const [visits, setVisits] = useState<OccupationalVisit[] | null>(null)
  const [editing, setEditing] = useState(isNew)
  const [draft, setDraft] = useState<OccupationalVisitDraft>(() => ({ ...EMPTY_OCCUPATIONAL_VISIT }))
  const [saving, setSaving] = useState(false)
  const canManage = can(role, CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  useEffect(() => {
    let live = true
    loadAllOccupationalVisitsAsync(tenant?.id).then(rows => { if (live) setVisits(rows) }).catch(error => { console.error(error); if (live) setVisits([]) })
    return () => { live = false }
  }, [tenant?.id])
  const employeeMap = useMemo(() => { const out: Record<string, EmployeeRow> = {}; for (const item of employeeRows) { out[item.id] = item; if (item.dbId) out[item.dbId] = item } return out }, [employeeRows])
  const visit = isNew ? null : visits?.find(item => String(item.id) === String(visitId)) || null
  const employee = visit ? employeeMap[visit.employeeId] : null
  const nameOf = (item: EmployeeRow | null | undefined) => (!item ? '—' : en ? `${item.firstNameEn || item.firstName} ${item.lastNameEn || item.lastName}` : `${item.lastName} ${item.firstName}`)

  if (!isNew && visits === null) return <Page fill><TableSkeleton/></Page>
  if (!isNew && (!visit || (employee && !canAccessRecord(employee)))) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Visit not found' : 'Η επίσκεψη δεν βρέθηκε'}</strong></div></Page>

  const patch = (next: OccupationalVisitDraft) => setDraft(current => ({ ...current, ...next }))
  const startEdit = () => { setDraft({ ...EMPTY_OCCUPATIONAL_VISIT, ...visit, employeeId: visit?.employeeId }); setEditing(true) }
  const problems = visitProblems(draft, language)
  async function save() {
    setSaving(true)
    try {
      if (isNew) {
        const chosen = employeeRows.find(item => item.id === draft.employeeId)
        const created = await createOccupationalVisitAsync(tenant?.id, chosen, draft)
        signalDemoStep('occupational_visit', 'visit')
        notify(visitSavedMessage(language), 'success')
        navigate(`/occupational-health/visits/${encodeURIComponent(created.id)}`, { replace: true })
      } else {
        const updated = await updateOccupationalVisitAsync(tenant?.id, visit, draft) as OccupationalVisit
        setVisits(rows => (rows as OccupationalVisit[]).map(item => (item.id === updated.id ? updated : item)))
        notify(visitSavedMessage(language), 'success')
        setEditing(false)
      }
    } catch (error) { notifyError(error, 'save', { operation: 'occupational_visit_save' }) } finally { setSaving(false) }
  }
  async function remove() {
    if (!await confirm({ title: en ? 'Delete visit' : 'Διαγραφή επίσκεψης', message: en ? 'The visit is deleted from the clinical record.' : 'Η επίσκεψη διαγράφεται από το κλινικό αρχείο.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })) return
    try { await deleteOccupationalVisitAsync(tenant?.id, visit?.id ?? ''); notify(en ? 'Deleted.' : 'Διαγράφηκε.', 'success'); goBack() } catch (error) { notifyError(error, 'delete', { operation: 'occupational_visit_delete' }) }
  }

  if (editing) {
    const done = draft.status === 'completed'
    const people = employeeRows.filter(item => item.employmentStatus === 'active' && canAccessRecord(item))
    return <FormPage title={isNew ? (en ? 'New occupational health visit' : 'Νέα επίσκεψη Ιατρού Εργασίας') : (en ? 'Edit visit' : 'Επεξεργασία επίσκεψης')}
      subtitle={isNew ? (en ? 'Schedule a visit, or record one that took place, with its fitness outcome.' : 'Προγραμματίστε επίσκεψη ή καταγράψτε επίσκεψη που έγινε, με το αποτέλεσμα καταλληλότητας.') : nameOf(employee)}
      onClose={() => (isNew ? goBack() : setEditing(false))}
      footer={<>{problems.length > 0 && <span className="lo-form-page-missing">{en ? 'Missing' : 'Λείπει'}: {problems.join(' · ')}</span>}<SaveButton disabled={saving || problems.length > 0} onClick={save}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton></>}>
      <FormGrid columns={3}>
        {isNew
          ? <ChoiceField label={en ? 'Employee *' : 'Εργαζόμενος *'} value={draft.employeeId} options={[{ value: '', label: en ? 'Select employee' : 'Επιλέξτε εργαζόμενο' }, ...people.map(item => ({ value: item.id, label: `${nameOf(item)} (${item.id})` }))]} onChange={value => patch({ employeeId: value })} />
          : <Field label={en ? 'Employee' : 'Εργαζόμενος'}><input value={nameOf(employee)} disabled readOnly /></Field>}
        <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={draft.date} onChange={date => patch({ date })} />
        <ChoiceField label={en ? 'Visit type *' : 'Τύπος επίσκεψης *'} value={draft.type} options={VISIT_TYPES.map(([value, el, enText]) => ({ value, label: en ? enText : el }))} onChange={value => patch({ type: value })} />
        <ChoiceField label={en ? 'Status *' : 'Κατάσταση *'} value={draft.status} options={VISIT_STATUSES.map(([value, el, enText]) => ({ value, label: en ? enText : el }))} onChange={value => patch({ status: value })} />
        {done && <ChoiceField label={en ? 'Fitness for work *' : 'Καταλληλότητα *'} value={draft.fitStatus} options={FITNESS.map(([value, el, enText]) => ({ value, label: en ? enText : el }))} onChange={value => patch({ fitStatus: value })} />}
        {done && <ManualDateField label={en ? 'Next check' : 'Επανέλεγχος'} value={draft.followUpDate} onChange={followUpDate => patch({ followUpDate })} optional />}
        <div className="occupational-span-3"><Field label={en ? 'Clinical notes' : 'Κλινικές σημειώσεις'}><textarea rows={5} value={draft.clinicalNotes} onChange={event => patch({ clinicalNotes: event.target.value })} /></Field></div>
      </FormGrid>
    </FormPage>
  }

  if (!visit) return null
  const headerActions = canManage ? <div className="row-actions">
    <Button recordMenu variant="secondary" onClick={startEdit}><Pencil size={15} />{en ? 'Edit visit' : 'Επεξεργασία επίσκεψης'}</Button>
    <Button recordMenu variant="secondary" onClick={remove}><Trash2 size={15} />{en ? 'Delete visit' : 'Διαγραφή επίσκεψης'}</Button>
  </div> : null
  return <Page fill><EntityRecordShell className="occupational-visit-shell workspace-fill" avatar={<Stethoscope size={19} />} eyebrow={en ? 'Occupational health' : 'Ιατρός Εργασίας'}
    title={`${fmtDay(visit.date, locale)} · ${visitTypeLabel(visit.type, language)}`} subtitle={employee ? `${nameOf(employee)} · ${employee.id}` : ''}
    status={<StatusBadge tone={visit.status === 'completed' ? 'success' : 'warning'}>{visitStatusLabel(visit.status, language)}</StatusBadge>} headerActions={headerActions} onBack={goBack}>
    <RecordTabPanel title={en ? 'Visit' : 'Επίσκεψη'} subtitle={en ? 'Clinical data: only the occupational physician and those with access see them.' : 'Κλινικά στοιχεία: τα βλέπουν μόνο ο Ιατρός Εργασίας και όσοι έχουν πρόσβαση.'}
      actions={employee && <Button variant="secondary" onClick={() => navigate(`/employees/${encodeURIComponent(employee.id)}`)}><UserRound size={15} />{en ? 'Employee record' : 'Καρτέλα εργαζομένου'}</Button>}>
      <div className="record-view-stack">
        <RecordDetailsGrid fields={[
          { label: en ? 'Employee' : 'Εργαζόμενος', value: nameOf(employee), meta: employee?.id },
          { label: en ? 'Date' : 'Ημερομηνία', value: fmtDay(visit.date, locale) },
          { label: en ? 'Visit type' : 'Τύπος επίσκεψης', value: visitTypeLabel(visit.type, language) },
          { label: en ? 'Fitness for work' : 'Καταλληλότητα', value: fitnessLabel(visit.fitStatus, language), hidden: visit.status !== 'completed' },
          { label: en ? 'Next check' : 'Επανέλεγχος', value: fmtDay(visit.followUpDate, locale), hidden: !visit.followUpDate },
          { label: en ? 'Clinical notes' : 'Κλινικές σημειώσεις', value: visit.clinicalNotes, hidden: !visit.clinicalNotes, className: 'occupational-span-3' },
        ]} />
      </div>
    </RecordTabPanel>
  </EntityRecordShell></Page>
}
