import { inactiveEmployeeCodes } from '../../design-system/InactiveEmployeeBadge'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileClock,
  Paperclip,
  Pencil,
  ShieldCheck,
  Target,
  Trash2,
  Users,
} from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { MeetingRecord } from './CommitteeMeetingRecord'
import { ExportMenu } from '../../design-system/ExportMenu'
import { downloadRecordJson } from '../../core/export/recordExport'
import { Button } from '../../design-system/Button'
import { ActionButton } from '../../design-system/ActionButton'
import { IconButton } from '../../design-system/IconButton'
import { AttachmentField } from '../../design-system/AttachmentField'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { can, canForRecord, CAPABILITIES } from '../../core/permissions/roles'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { loadQualityRecords } from '../quality/qualityService'
import { committeeDecisionSourceId } from '../quality/capaSources'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import { useCommitteesData } from './useCommitteesData'
import { saveCommittees } from './committeeData'
import { fmtDate, controlTeamName, controlTeamShort } from './committeeRecordFormat'
import { committeeRecordActions, type CommitteeDialog, type CommitteeStep } from './committeeRecordActions'
import type { RecordNavigation } from '../../design-system/EntityRecordShell'
import type { AnyRecord } from '../../types/featureTypes'
import {
  Head,
  Overview,
  Members,
  Meetings,
  Decisions,
  Plan,
  History,
} from './CommitteeRecordSections'
import {
  CommitteeDetailsDialog,
  ReasonDialog,
  MemberDialog,
  NewMeetingDialog,
  DecisionDialog,
  PlanDialog,
  FrameworkDialog,
} from './CommitteeRecordDialogs'
import './committeeRefinements.css'

export function CommitteeRecordPage() {
  const { committeeId } = useParams()
  const navigate = useNavigate()
  const actor = useAuditActor()
  const { role, membership, tenant, isDemo } = useTenant()
  const { language, t } = useLanguage()
  const en = language === 'en'
  const { notify, notifyError, confirm } = useFeedback()
  const n = useNotifications()
  const { data: rows, setData: setRows, loading, error, reload } = useCommitteesData(committeeId)
  const { data: employeeRows } = useEmployeesData() as { data: AnyRecord[] }
  const [tab, setTab] = useState('overview')
  const [dialog, setDialog] = useState<CommitteeDialog>(null)
  const [busy, setBusy] = useState(false)
  // An open meeting is a page of its own (?minutes=<id>), so «back» returns to the committee's meetings.
  const [params, setParams] = useSearchParams()
  const minutesId = params.get('minutes') || ''
  const openMeeting = (id: string) => { const next = new URLSearchParams(params); next.set('minutes', id); setParams(next) }
  const closeMeeting = () => { const next = new URLSearchParams(params); next.delete('minutes'); setParams(next); setTab('meetings') }

  const recordNavigation = useRecordSequenceNavigation({
    registry: 'committees',
    currentId: committeeId,
    pathForId: id => `/committees/${id}`,
  })
  const record = useMemo(() => rows.find(x => x.id === committeeId) || null, [rows, committeeId])
  const organizationId = tenant?.id || null
  const { goTo, restored } = useContextualNavigation('/meetings')
  // The corrective actions of the open minutes' decisions (read only while minutes are open).
  const canCreateCapa = can(role, CAPABILITIES.MANAGE_QUALITY, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const [capas, setCapas] = useState<AnyRecord[]>([])
  useEffect(() => {
    if (!minutesId) return undefined
    let active = true
    loadQualityRecords('capas', organizationId).then(list => { if (active) setCapas(list || []) }).catch(() => { if (active) setCapas([]) })
    return () => { active = false }
  }, [minutesId, organizationId])
  const staff = useMemo(
    () =>
      employeeRows
        .filter(x => x.employmentStatus === 'active')
        .map(x => ({
          id: x.id,
          dbId: x.dbId || null,
          name: `${x.firstName || ''} ${x.lastName || ''}`.trim(),
          department: x.department || '',
          profession: x.profession || '',
          email: x.email || '',
        })),
    [employeeRows],
  )
  const permissionContext = {
    role,
    addOns: membership?.capabilities ?? [],
    customCapabilities: membership?.customCapabilities ?? [],
    organizationId: (membership as { organizationId?: string } | null)?.organizationId ?? membership?.organization?.id,
    assignments: membership?.assignments ?? [],
  }
  const canDo = (cap: string) =>
    record ? canForRecord(cap, { ...record, resourceType: 'committee' }, permissionContext) : false
  const canMembers = canDo(CAPABILITIES.MANAGE_COMMITTEE_MEMBERS)
  const canMeeting = canDo(CAPABILITIES.CREATE_COMMITTEE_MEETING)
  const canMinutes = canDo(CAPABILITIES.EDIT_COMMITTEE_MINUTES)
  const canFinalize = canDo(CAPABILITIES.FINALIZE_COMMITTEE_MINUTES)
  const canDecisions = canDo(CAPABILITIES.MANAGE_COMMITTEE_DECISIONS)
  const canDocuments = canDo(CAPABILITIES.MANAGE_COMMITTEE_DOCUMENTS)
  const canFramework = canDo(CAPABILITIES.CREATE_COMMITTEE)
  const canArchive = canDo(CAPABILITIES.ARCHIVE_COMMITTEE)

  async function execute({ operation, local, success, context = 'save', close = true }: CommitteeStep) {
    if (busy) return null
    setBusy(true)
    try {
      let result: unknown
      if (isDemo) {
        result = local?.()
        if (result) {
          const nextRows = rows.map(x => (x.id === record?.id ? result as AnyRecord : x))
          setRows(nextRows)
          saveCommittees(nextRows)
        }
      } else {
        result = await operation()
        await reload()
      }
      if (close) setDialog(null)
      if (success) notify(success, 'success', { operation: 'committee_workflow' })
      return result
    } catch (err) {
      notifyError(err, context, { operation: 'committee_workflow' })
      return null
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <RouteLoading />
  if (error)
    return (
      <Page title={en ? 'Committees' : 'Επιτροπές'}>
        <div className="data-access-state error">
          <span>
            {en
              ? 'Committee data could not be loaded.'
              : 'Δεν ήταν δυνατή η φόρτωση των επιτροπών.'}
          </span>
          <Button variant="secondary" onClick={() => reload().catch(() => {})}>
            {en ? 'Retry' : 'Επανάληψη'}
          </Button>
        </div>
      </Page>
    )
  if (!record)
    return (
      <Page title={en ? 'Committees' : 'Επιτροπές'}>
        <div className="inline-empty">
          {en ? 'Committee not found.' : 'Η επιτροπή δεν βρέθηκε.'}
        </div>
      </Page>
    )

  const activeMembers: AnyRecord[] = (record.memberRefs || []).filter((x: AnyRecord) => x.active !== false)
  const activePlan: AnyRecord[] = (record.annualPlan || []).filter((x: AnyRecord) => x.status !== 'cancelled')
  const tabs = [
    { id: 'overview', label: en ? 'Overview' : 'Σύνοψη', icon: CheckCircle2 },
    { id: 'members', label: `${en ? 'Members' : 'Μέλη'} ${activeMembers.length}`, icon: Users },
    { id: 'plan', label: `${en ? 'Annual plan' : 'Ετήσιο σχέδιο'}${activePlan.length ? ` ${activePlan.filter(x => x.status === 'completed').length}/${activePlan.length}` : ''}`, icon: Target },
    { id: 'meetings', label: `${en ? 'Meetings' : 'Συνεδριάσεις'} ${(record.meetings || []).length}`, icon: CalendarDays },
    { id: 'decisions', label: `${en ? 'Decisions' : 'Αποφάσεις'} ${(record.decisions || []).filter((x: AnyRecord) => !['completed', 'closed', 'cancelled'].includes(x.status)).length}`, icon: ClipboardList },
    { id: 'documents', label: en ? 'Documents' : 'Έγγραφα', icon: Paperclip },
    { id: 'history', label: en ? 'History' : 'Ιστορικό', icon: FileClock },
  ]

  const {
    saveDetails, archiveCommittee, addMember, editMember, endMember, confirmEndMember, addMeeting, saveMeeting, cancelMeeting, confirmCancelMeeting, answerApproval, externalAction, saveDecision, decisionStatus, savePlan, removePlan, saveFramework, saveDemoDocuments,
  } = committeeRecordActions({ record, rows, setRows, execute, en, organizationId, actor, staff, activeMembers, dialog, setDialog, confirm, notify, navigate, isDemo, n, openMeeting })

  const headerActions = (
    <>
      {tab === 'overview' && (
        <div className="record-actions">
          {canFramework && (
            <IconButton
              tone="edit"
              label={en ? 'Edit committee' : 'Επεξεργασία επιτροπής'}
              disabled={busy}
              onClick={() => setDialog({ type: 'details' })}
            >
              <Pencil size={16} />
            </IconButton>
          )}
          {/* The institutional framework (role, basis, mandate) shows in the Overview; it is edited from the record's «…». */}
          {canFramework && (
            <IconButton
              tone="edit"
              label={en ? 'Edit institutional framework' : 'Επεξεργασία θεσμικού πλαισίου'}
              disabled={busy}
              onClick={() => setDialog({ type: 'framework' })}
            >
              <ShieldCheck size={16} />
            </IconButton>
          )}
          {canArchive && (
            <ActionButton
              tone="danger"
              label={en ? 'Archive committee' : 'Αρχειοθέτηση επιτροπής'}
              disabled={busy}
              onClick={archiveCommittee}
            >
              <Trash2 size={16} />
            </ActionButton>
          )}
        </div>
      )}
      <ExportMenu items={[{id:'committee-print',kind:'print',label:en?'Print the committee details':'Εκτύπωση στοιχείων επιτροπής',onClick:()=>window.print()},{id:'json',kind:'data',label:'JSON',onClick:() => downloadRecordJson(record, { filename: record?.id })}]} />
    </>
  )

  const openedMeeting: AnyRecord | null = minutesId ? (record.meetings || []).find((x: AnyRecord) => x.id === minutesId) : null
  // A decision of the minutes opens a corrective action of the Quality Center; it keeps the decision as its source.
  const openDecisionCapa = (topic: AnyRecord) => {
    const decision = String(topic.decision || '').trim()
    const when = [fmtDate(openedMeeting?.date), openedMeeting?.minutesNo && `${en ? 'minutes' : 'πρακτικό'} ${openedMeeting?.minutesNo}`].filter(Boolean).join(', ')
    goTo('/quality/capas/new', { tab: 'topics', state: { qualitySource: {
      source: 'other', sourceId: committeeDecisionSourceId(record.id, openedMeeting?.id, topic.id),
      title: (decision.split('\n')[0] || topic.subject || '').slice(0, 120),
      description: [`${en ? 'Decision of' : 'Απόφαση'} ${record.name}${when ? ` (${when})` : ''}.`, topic.subject && `${en ? 'Topic' : 'Θέμα'}: ${topic.subject}`, decision].filter(Boolean).join('\n'),
      dueDate: topic.dueDate || '',
    } } })
  }
  if (openedMeeting)
    return (
      <Page fill>
        <MeetingRecord
          inactiveCodes={inactiveEmployeeCodes(employeeRows)}
          key={openedMeeting.id}
          meeting={openedMeeting}
          committeeName={record.name}
          committeeCode={record.id}
          initialTab={restored?.tab || null}
          capas={capas}
          canCreateCapa={canCreateCapa}
          onCreateCapa={openDecisionCapa}
          onOpenCapa={capa => goTo(`/quality/capas/${capa.id}`, { tab: 'topics' })}
          actionStatus={t}
          members={activeMembers}
          actorId={actor.id}
          canSave={canMinutes && !busy}
          canFinalize={canFinalize && !busy}
          busy={busy}
          onBack={closeMeeting}
          onSave={saveMeeting}
          onApproval={answerApproval}
          onExternalAction={externalAction}
          en={en}
        />
      </Page>
    )

  return (
    <Page fill>
      <EntityRecordShell
        className="committee-record-shell"
        avatar={<Users size={19} />}
        eyebrow={record.id}
        title={(en && record.nameEn) || record.name}
        subtitle={(en && record.shortNameEn) || record.shortName || ''}
        status={
          <span className={`status-badge ${record.status === 'active' ? 'active' : ''}`}>
            {record.status === 'active' ? (en ? 'Active' : 'Ενεργή') : en ? 'Inactive' : 'Ανενεργή'}
          </span>
        }
        recordNavigation={recordNavigation as RecordNavigation}
        onBack={() => navigate('/meetings')}
        headerActions={headerActions}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
      >
        {tab === 'overview' && <Overview record={record} members={activeMembers} en={en} />}
        {tab === 'members' && (
          <Members
            inactiveCodes={inactiveEmployeeCodes(employeeRows)}
            teamShort={controlTeamShort(record.name, en)}
            rows={record.memberRefs || []}
            canManage={canMembers && !busy}
            onAdd={() => setDialog({ type: 'member' })}
            onEdit={x => setDialog({ type: 'member', value: x })}
            onEnd={endMember}
            en={en}
          />
        )}
        {tab === 'plan' && (
          <Plan
            rows={(record.annualPlan || []).filter((x: AnyRecord) => x.status !== 'cancelled')}
            canManage={canDecisions && !busy}
            onAdd={() => setDialog({ type: 'plan' })}
            onEdit={x => setDialog({ type: 'plan', value: x })}
            onDelete={removePlan}
            en={en}
          />
        )}
        {tab === 'meetings' && (
          <Meetings
            teamName={controlTeamName(record.name, en)}
            rows={record.meetings || []}
            canCreate={canMeeting && !busy}
            canCancel={canMeeting && !busy}
            onAdd={() => setDialog({ type: 'newMeeting' })}
            onOpen={x => openMeeting(x.id)}
            onCancel={cancelMeeting}
            en={en}
          />
        )}
        {tab === 'decisions' && (
          <Decisions
            rows={record.decisions || []}
            canManage={canDecisions && !busy}
            onAdd={() => setDialog({ type: 'decision' })}
            onEdit={x => setDialog({ type: 'decision', value: x })}
            onStatus={decisionStatus}
            en={en}
          />
        )}
        {tab === 'documents' && (
          <section className="record-section">
            <Head
              title={en ? 'Documents & evidence' : 'Έγγραφα & τεκμήρια'}
              subtitle={
                en
                  ? 'Files are stored through the governed attachment service.'
                  : 'Τα αρχεία αποθηκεύονται μέσω της ελεγχόμενης υπηρεσίας συνημμένων.'
              }
            />
            {(record.documents || []).some((x: AnyRecord) => x.documentCode) && (
              <ul
                className="committee-linked-documents"
                aria-label={en ? 'Linked controlled documents' : 'Συνδεδεμένα ελεγχόμενα έγγραφα'}
              >
                {record.documents
                  .filter((x: AnyRecord) => x.documentCode)
                  .map((x: AnyRecord) => (
                    <li key={x.id}>
                      <Link to={`/documents/${x.documentCode}`}>
                        <strong>{x.documentCode}</strong>
                        <span>{x.documentTitle}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
            <AttachmentField
              disabled={!canDocuments}
              value={(record.documents || []).filter((x: AnyRecord) => !x.documentCode)}
              onChange={saveDemoDocuments}
              organizationId={organizationId}
              entityType="committee_document"
              entityId={record.dbId || record.id}
            />
          </section>
        )}
        {tab === 'history' && <History rows={record.history || []} en={en} />}
      </EntityRecordShell>

      {dialog?.type === 'details' && (
        <CommitteeDetailsDialog
          record={record}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={saveDetails}
          en={en}
        />
      )}
      {dialog?.type === 'member' && (
        <MemberDialog
          teamName={controlTeamName(record.name, en)}
          staff={staff}
          initial={dialog.value}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={dialog.value ? editMember : addMember}
          en={en}
        />
      )}
      {dialog?.type === 'endMember' && (
        <ReasonDialog
          busy={busy}
          title={en ? 'End membership' : 'Λήξη συμμετοχής'}
          description={
            en
              ? 'The membership will end and remain in the committee history.'
              : 'Η συμμετοχή θα λήξει και θα παραμείνει στο ιστορικό της επιτροπής.'
          }
          label={en ? 'Reason' : 'Αιτιολογία'}
          confirmLabel={en ? 'End membership' : 'Λήξη συμμετοχής'}
          danger
          onClose={() => setDialog(null)}
          onSave={confirmEndMember}
          en={en}
        />
      )}
      {dialog?.type === 'newMeeting' && (
        <NewMeetingDialog busy={busy} onClose={() => setDialog(null)} onSave={addMeeting} en={en} teamName={controlTeamName(record.name, en)} hasTeam={activeMembers.some(member => member.inControlTeam)} />
      )}
      {dialog?.type === 'cancelMeeting' && (
        <ReasonDialog
          busy={busy}
          title={en ? 'Cancel meeting' : 'Ακύρωση συνεδρίασης'}
          description={
            en
              ? 'Cancellation is permanent and will be recorded in the committee history.'
              : 'Η ακύρωση είναι οριστική και θα καταγραφεί στο ιστορικό της επιτροπής.'
          }
          label={en ? 'Cancellation reason' : 'Αιτιολογία ακύρωσης'}
          confirmLabel={en ? 'Cancel meeting' : 'Ακύρωση συνεδρίασης'}
          danger
          onClose={() => setDialog(null)}
          onSave={confirmCancelMeeting}
          en={en}
        />
      )}
      {dialog?.type === 'decision' && (
        <DecisionDialog
          initial={dialog.value}
          meetings={record.meetings || []}
          members={activeMembers}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={saveDecision}
          en={en}
        />
      )}
      {dialog?.type === 'plan' && (
        <PlanDialog
          initial={dialog.value}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={savePlan}
          en={en}
        />
      )}
      {dialog?.type === 'framework' && (
        <FrameworkDialog
          record={record}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={saveFramework}
          en={en}
        />
      )}
    </Page>
  )
}
