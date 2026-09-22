import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, BookOpenCheck, Check, Download, FileClock, Paperclip, Pencil, RotateCcw, Search, Send, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { Button } from '../../design-system/Button'
import { ActionButton } from '../../design-system/ActionButton'
import { IconButton } from '../../design-system/IconButton'
import { SaveButton } from '../../design-system/SaveButton'
import { AttachmentField } from '../../design-system/AttachmentField'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { createAnnouncement, loadAnnouncementByLinkPath, loadAnnouncementAcknowledgers } from '../management/announcementCloudService'
import { useDocumentsData } from './useDocumentsData'
import {
  updateDocumentAsync,
  submitDocumentReviewAsync,
  approveDocumentAsync,
  returnDocumentToDraftAsync,
  publishDocumentAsync,
  archiveDocumentAsync,
  createDocumentRevisionAsync,
  deleteDocumentDraftAsync,
  loadDocumentOwnerProfile,
  getDocumentFamily,
  groupDocumentFamilies,
} from './documentService'
import { DocumentForm, DOCUMENT_TYPES, documentDraftIsValid } from './DocumentForm'
import { loadDepartments } from '../management/departmentsService'
import { RouteLoading } from '../../design-system/RouteLoading'

const labels = {
  el: {
    types: DOCUMENT_TYPES.el,
    statuses: {
      draft: 'Πρόχειρο',
      review: 'Σε έλεγχο',
      approved: 'Εγκεκριμένο',
      published: 'Δημοσιευμένο',
      superseded: 'Αντικαταστάθηκε',
      archived: 'Αρχειοθετημένο',
    },
  },
  en: {
    types: DOCUMENT_TYPES.en,
    statuses: {
      draft: 'Draft',
      review: 'In review',
      approved: 'Approved',
      published: 'Published',
      superseded: 'Superseded',
      archived: 'Archived',
    },
  },
}

const toDraft = (record) => ({
  title: record?.title || '',
  type: record?.type || 'policy',
  version: record?.version || '0.1',
  departmentId: record?.departmentId || null,
  audience: record?.audience || 'organization',
  effectiveDate: record?.effectiveDate || '',
  reviewDate: record?.reviewDate || '',
  description: record?.description || '',
})

function formatHistoryAction(item, en, statusLabels) {
  if (item.action === 'created') return en ? 'Created' : 'Δημιουργία'
  if (item.action === 'updated') return en ? 'Updated' : 'Ενημέρωση'
  if (item.action === 'deleted') return en ? 'Deleted' : 'Διαγραφή'
  if (item.action?.startsWith('status:')) {
    const transition = item.action.slice(7)
    if (transition.includes('->')) {
      const [from, to] = transition.split('->')
      return `${statusLabels[from] || from} → ${statusLabels[to] || to}`
    }
    return `${en ? 'Current state' : 'Τρέχουσα κατάσταση'}: ${statusLabels[transition] || transition}`
  }
  return item.action || '—'
}

function formatDateTime(value, en) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(en ? 'en-GB' : 'el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DocumentRecordPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const actor = useAuditActor()
  const { notify, confirm } = useFeedback()
  const { role, actualRole, isRolePreview, membership, tenant, isDemo } = useTenant()
  const { language } = useLanguage()
  const en = language === 'en'
  const typeLabels = labels[language].types
  const statusLabels = labels[language].statuses

  const { data: rows, loading, error, reload } = useDocumentsData()
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [departments, setDepartments] = useState([])
  const [ownerName, setOwnerName] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const reportRef = useRef(null)

  const record = useMemo(() => rows.find((x) => x.id === documentId) || null, [rows, documentId])
  const family = useMemo(() => getDocumentFamily(rows, record), [rows, record])
  const families = useMemo(() => groupDocumentFamilies(rows), [rows])
  const currentFamily = useMemo(
    () => families.find((item) => (item.versions || []).some((version) => version.id === documentId)) || null,
    [families, documentId],
  )
  const addOns = membership?.capabilities ?? []
  const custom = membership?.customCapabilities ?? []
  const permissionRole = isRolePreview ? role : (actualRole || role)
  const recordNavigation = useRecordSequenceNavigation({
    registry: 'documents',
    currentId: currentFamily?.key || documentId,
    pathForId: (key) => {
      const target = families.find((item) => item.key === key)?.current
      return target ? `/documents/${target.id}` : '/documents'
    },
  })

  const canManage = can(permissionRole, CAPABILITIES.MANAGE_DOCUMENTS, addOns, custom)
  const canSubmitReview = can(permissionRole, CAPABILITIES.SUBMIT_DOCUMENT_REVIEW, addOns, custom)
  const canApprove = can(permissionRole, CAPABILITIES.APPROVE_DOCUMENT, addOns, custom)
  const canPublish = can(permissionRole, CAPABILITIES.PUBLISH_DOCUMENT, addOns, custom)
  const canSupersede = can(permissionRole, CAPABILITIES.SUPERSEDE_DOCUMENT, addOns, custom)
  const canArchive = can(permissionRole, CAPABILITIES.ARCHIVE_DOCUMENT, addOns, custom)
  const organizationId = tenant?.id || null

  useEffect(() => {
    let active = true
    if (!organizationId) return undefined
    loadDepartments(organizationId)
      .then((data) => { if (active) setDepartments((data || []).filter((x) => x.is_active !== false)) })
      .catch(() => { if (active) setDepartments([]) })
    return () => { active = false }
  }, [organizationId])

  useEffect(() => {
    if (record) {
      setDraft(toDraft(record))
      setEditing(false)
    }
  }, [record])

  useEffect(() => {
    let active = true
    if (!record?.ownerId) {
      setOwnerName('')
      return () => { active = false }
    }
    if (record.ownerId === actor?.id) {
      setOwnerName(actor?.name || '')
      return () => { active = false }
    }
    loadDocumentOwnerProfile(record.ownerId)
      .then((profile) => { if (active) setOwnerName(profile?.full_name || profile?.username || '') })
      .catch(() => { if (active) setOwnerName('') })
    return () => { active = false }
  }, [record?.ownerId, actor?.id, actor?.name])

  if (loading) return <RouteLoading />
  if (error) {
    return <Page title={en ? 'Documents' : 'Έγγραφα'}><div className="data-access-state error" role="alert"><span>{en ? 'Could not load the document.' : 'Δεν ήταν δυνατή η φόρτωση του εγγράφου.'}</span><Button variant="secondary" onClick={() => reload().catch(() => {})}>{en ? 'Retry' : 'Επανάληψη'}</Button></div></Page>
  }
  if (!record || !draft) {
    return <Page title={en ? 'Documents' : 'Έγγραφα'}><div className="inline-empty">{en ? 'Document not found.' : 'Το έγγραφο δεν βρέθηκε.'}</div></Page>
  }

  const approvalEvent = [...(record.history || [])].reverse().find((item) => item.action === 'status:review->approved')
  const publishEvent = [...(record.history || [])].reverse().find((item) => item.action === 'status:approved->published')
  const activePublishedId = currentFamily?.activePublished?.id || null
  const versionState = record.status === 'published' && activePublishedId === record.id
    ? (en ? 'Current active version' : 'Ισχύουσα έκδοση')
    : record.status === 'superseded'
      ? (en ? 'Non-current — superseded' : 'Μη ισχύουσα — έχει αντικατασταθεί')
      : record.status === 'archived'
        ? (en ? 'Non-current — archived' : 'Μη ισχύουσα — αρχειοθετημένη')
        : (statusLabels[record.status] || record.status)

  async function run(operation, successMessage) {
    if (busy) return null
    setBusy(true)
    try {
      const result = await operation()
      await reload()
      if (successMessage) notify(successMessage, 'success')
      return result
    } catch (operationError) {
      notify(operationError?.message || (en ? 'The action could not be completed.' : 'Η ενέργεια δεν ήταν δυνατό να ολοκληρωθεί.'), 'danger')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    if (!documentDraftIsValid(draft) || busy) return
    const result = await run(
      () => updateDocumentAsync(organizationId, record, draft, actor),
      en ? 'Document updated.' : 'Το έγγραφο ενημερώθηκε.',
    )
    if (result) setEditing(false)
  }

  async function submitReview() {
    if (record.status !== 'draft' || !canSubmitReview) return
    const ok = await confirm({
      title: en ? 'Submit for review' : 'Υποβολή για έλεγχο',
      message: en ? 'Editing will be locked while the document is reviewed. Continue?' : 'Η επεξεργασία θα κλειδώσει όσο το έγγραφο βρίσκεται σε έλεγχο. Θέλετε να συνεχίσετε;',
      confirmLabel: en ? 'Submit' : 'Υποβολή',
    })
    if (ok) await run(() => submitDocumentReviewAsync(organizationId, record, actor), en ? 'Document submitted for review.' : 'Το έγγραφο υποβλήθηκε για έλεγχο.')
  }

  async function approve() {
    if (record.status !== 'review' || !canApprove) return
    const ok = await confirm({
      title: en ? 'Approve document' : 'Έγκριση εγγράφου',
      message: en ? 'The reviewed version will be approved for publication. Continue?' : 'Η ελεγμένη έκδοση θα εγκριθεί για δημοσίευση. Θέλετε να συνεχίσετε;',
      confirmLabel: en ? 'Approve' : 'Έγκριση',
    })
    if (ok) await run(() => approveDocumentAsync(organizationId, record, actor), en ? 'Document approved.' : 'Το έγγραφο εγκρίθηκε.')
  }

  async function returnToDraft() {
    if (!['review', 'approved'].includes(record.status) || !(canManage || canApprove)) return
    const ok = await confirm({
      title: en ? 'Return to draft' : 'Επιστροφή σε πρόχειρο',
      message: en ? 'The current revision will become editable again. Its audit history will be preserved. Continue?' : 'Η τρέχουσα έκδοση θα γίνει ξανά επεξεργάσιμη. Το ιστορικό της θα διατηρηθεί. Θέλετε να συνεχίσετε;',
      confirmLabel: en ? 'Return to draft' : 'Επιστροφή σε πρόχειρο',
    })
    if (ok) await run(() => returnDocumentToDraftAsync(organizationId, record, actor), en ? 'Document returned to draft.' : 'Το έγγραφο επέστρεψε σε πρόχειρο.')
  }

  async function publish() {
    if (record.status !== 'approved' || !canPublish) return
    const ok = await confirm({
      title: en ? 'Publish document' : 'Δημοσίευση εγγράφου',
      message: en ? 'The approved version will become active for use. Continue?' : 'Η εγκεκριμένη έκδοση θα γίνει ενεργή για χρήση. Θέλετε να συνεχίσετε;',
      confirmLabel: en ? 'Publish' : 'Δημοσίευση',
    })
    if (ok) await run(() => publishDocumentAsync(organizationId, record, actor), en ? 'Document published.' : 'Το έγγραφο δημοσιεύτηκε.')
  }

  async function archive() {
    if (record.status !== 'published' || !canArchive) return
    const ok = await confirm({
      title: en ? 'Archive document' : 'Αρχειοθέτηση εγγράφου',
      message: en ? 'The document will no longer be active for current use. History will be preserved.' : 'Το έγγραφο θα πάψει να θεωρείται ενεργό για τρέχουσα χρήση. Το ιστορικό θα διατηρηθεί.',
      confirmLabel: en ? 'Archive' : 'Αρχειοθέτηση',
      danger: true,
    })
    if (ok) await run(() => archiveDocumentAsync(organizationId, record, actor), en ? 'Document archived.' : 'Το έγγραφο αρχειοθετήθηκε.')
  }

  async function createRevision() {
    if (record.status !== 'published' || !canSupersede) return
    const revisionReason = await confirm({
      title: en ? 'Create new revision' : 'Νέα αναθεώρηση',
      message: en ? 'A new draft version will be created. The published version stays active until the revision is published.' : 'Θα δημιουργηθεί νέα πρόχειρη έκδοση. Η δημοσιευμένη έκδοση παραμένει ενεργή μέχρι να δημοσιευτεί η αναθεώρηση.',
      confirmLabel: en ? 'Create revision' : 'Δημιουργία αναθεώρησης',
      input: {
        label: en ? 'Revision reason' : 'Λόγος αναθεώρησης',
        placeholder: en ? 'Summarize what changed and why.' : 'Συνοψίστε τι αλλάζει και γιατί.',
        required: true,
        maxLength: 500,
      },
    })
    if (!revisionReason) return
    const next = await run(
      () => createDocumentRevisionAsync(organizationId, record, actor, rows, revisionReason),
      en ? 'New draft revision created.' : 'Δημιουργήθηκε νέα πρόχειρη αναθεώρηση.',
    )
    if (next) navigate(`/documents/${next.id}`)
  }

  async function removeDraft() {
    if (record.status !== 'draft' || !canManage) return
    const ok = await confirm({
      title: en ? 'Delete draft' : 'Διαγραφή πρόχειρου',
      message: en ? 'This draft document will be permanently deleted. Continue?' : 'Το πρόχειρο έγγραφο θα διαγραφεί οριστικά. Θέλετε να συνεχίσετε;',
      confirmLabel: en ? 'Delete' : 'Διαγραφή',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteDocumentDraftAsync(organizationId, record)
      notify(en ? 'Draft deleted.' : 'Το πρόχειρο διαγράφηκε.', 'success')
      navigate('/documents', { replace: true })
    } catch (operationError) {
      notify(operationError?.message || (en ? 'Could not delete draft.' : 'Δεν ήταν δυνατή η διαγραφή του πρόχειρου.'), 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function attachments(next) {
    if (!isDemo) return
    await run(() => updateDocumentAsync(organizationId, record, { attachments: next }, actor), en ? 'Attachments updated.' : 'Τα συνημμένα ενημερώθηκαν.')
  }

  function cancelEdit() {
    setDraft(toDraft(record))
    setEditing(false)
  }

  async function exportPdf() {
    if (exportingPdf || !reportRef.current) return
    setExportingPdf(true)
    try {
      await exportElementAsPdf({ element: reportRef.current, filename: `${record.id}_${record.title}_v${record.version || '—'}`, orientation: 'portrait' })
    } catch (error) {
      notify(error?.message || (en ? 'Could not export the PDF.' : 'Δεν ήταν δυνατή η εξαγωγή του PDF.'), 'danger')
    } finally {
      setExportingPdf(false)
    }
  }

  const tabs = [
    { id: 'overview', label: en ? 'Overview' : 'Σύνοψη', icon: BookOpenCheck },
    { id: 'files', label: en ? 'Files' : 'Αρχεία', icon: Paperclip },
    { id: 'distribution', label: en ? 'Distribution' : 'Κοινοποίηση', icon: Send },
    { id: 'history', label: en ? 'History' : 'Ιστορικό', icon: FileClock },
  ]

  const headerActions = <>
    {canManage && !editing && record.status === 'draft' && <>
      <IconButton tone="edit" onClick={() => setEditing(true)} label={en ? 'Edit' : 'Επεξεργασία'}><Pencil size={16} /></IconButton>
      <ActionButton tone="danger" label={en ? 'Delete' : 'Διαγραφή'} onClick={removeDraft} disabled={busy}><Trash2 size={16} /></ActionButton>
    </>}
    <IconButton onClick={exportPdf} disabled={exportingPdf} label={en ? 'Export PDF' : 'Εξαγωγή PDF'}><Download size={16} /></IconButton>
    <PrintExportActions onExport={() => downloadRecordJson(record, { filename: record?.id })} />
  </>

  return <Page fill><EntityRecordShell
    avatar={<BookOpenCheck size={19} />}
    eyebrow={record.id}
    title={record.title}
    subtitle={`${typeLabels[record.type] || record.type} · ${en ? 'Version' : 'Έκδοση'} ${record.version || '—'}`}
    status={<span className={`status-badge ${record.status === 'published' ? 'active' : record.status === 'draft' ? 'temporary' : ''}`}>{statusLabels[record.status] || record.status}</span>}
    recordNavigation={recordNavigation}
    onBack={() => navigate('/documents')}
    headerActions={headerActions}
    tabs={tabs}
    activeTab={tab}
    onTabChange={setTab}
  >
    {tab === 'overview' && <div className="document-record-workspace" ref={reportRef}>
      <section className="record-section">
        <div className="record-section-header"><div>
          <span className="eyebrow">{en ? 'Document' : 'Έγγραφο'}</span>
          <h3>{en ? 'Document details' : 'Στοιχεία εγγράφου'}</h3>
          <p>{en ? 'Core metadata and scope for this controlled document.' : 'Βασικά στοιχεία και πεδίο εφαρμογής του ελεγχόμενου εγγράφου.'}</p>
        </div></div>
        <DocumentForm value={draft} onChange={setDraft} language={language} departments={departments} ownerName={ownerName} readOnly={!editing} />
        {editing && <div className="inline-edit-footer">
          <Button variant="secondary" onClick={cancelEdit} disabled={busy}>{en ? 'Cancel' : 'Ακύρωση'}</Button>
          <SaveButton loading={busy} disabled={!documentDraftIsValid(draft) || busy} onClick={saveEdit}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton>
        </div>}
      </section>

      {!editing && <section className="record-section">
        <div className="record-section-header"><div>
          <span className="eyebrow">{en ? 'Governance' : 'Διακυβέρνηση'}</span>
          <h3>{en ? 'Controlled version' : 'Ελεγχόμενη έκδοση'}</h3>
          <p>{en ? 'Ownership, approval and publication evidence for this version.' : 'Υπευθυνότητα και στοιχεία έγκρισης/δημοσίευσης για την έκδοση.'}</p>
        </div></div>
        <div className="document-version-history-events">
          <div className="timeline-line"><strong>{en ? 'Document owner' : 'Υπεύθυνος εγγράφου'}</strong><span>{ownerName || '—'}</span></div>
          <div className="timeline-line"><strong>{en ? 'Version state' : 'Κατάσταση έκδοσης'}</strong><span>{versionState}</span></div>
          {record.revisionReason && <div className="timeline-line"><strong>{en ? 'Revision reason' : 'Λόγος αναθεώρησης'}</strong><span>{record.revisionReason}</span></div>}
          {record.approvedAt && <div className="timeline-line"><strong>{en ? 'Approved' : 'Έγκριση'}</strong><span>{formatDateTime(record.approvedAt, en)} · {approvalEvent?.actor || '—'}</span></div>}
          {record.publishedAt && <div className="timeline-line"><strong>{en ? 'Published' : 'Δημοσίευση'}</strong><span>{formatDateTime(record.publishedAt, en)} · {publishEvent?.actor || '—'}</span></div>}
        </div>
      </section>}

      {!editing && <section className="record-section document-lifecycle-section">
        <div className="record-section-header"><div>
          <span className="eyebrow">{en ? 'Workflow' : 'Ροή έγκρισης'}</span>
          <h3>{en ? 'Next action' : 'Επόμενη ενέργεια'}</h3>
          <p>{record.status === 'draft'
            ? (en ? 'The document is editable and can be submitted for review.' : 'Το έγγραφο είναι επεξεργάσιμο και μπορεί να υποβληθεί για έλεγχο.')
            : record.status === 'review'
              ? (en ? 'The document is under review. It may be approved or returned to draft for corrections.' : 'Το έγγραφο βρίσκεται σε έλεγχο. Μπορεί να εγκριθεί ή να επιστρέψει σε πρόχειρο για διορθώσεις.')
              : record.status === 'approved'
                ? (en ? 'The document is approved. It may be published or returned to draft before publication.' : 'Το έγγραφο έχει εγκριθεί. Μπορεί να δημοσιευτεί ή να επιστρέψει σε πρόχειρο πριν τη δημοσίευση.')
                : record.status === 'published'
                  ? (en ? 'The published document is locked. Create a revision for changes.' : 'Το δημοσιευμένο έγγραφο είναι κλειδωμένο. Για αλλαγές δημιουργήστε νέα αναθεώρηση.')
                  : (en ? 'No further workflow action is available.' : 'Δεν υπάρχει διαθέσιμη επόμενη ενέργεια.')}</p>
        </div></div>
        <div className="record-actions">
          {record.status === 'draft' && canSubmitReview && <ActionButton tone="primary" label={en ? 'Submit for review' : 'Υποβολή για έλεγχο'} onClick={submitReview} disabled={busy}>{en ? 'Submit for review' : 'Υποβολή για έλεγχο'}</ActionButton>}
          {record.status === 'review' && canApprove && <ActionButton tone="success" label={en ? 'Approve' : 'Έγκριση'} onClick={approve} disabled={busy}>{en ? 'Approve' : 'Έγκριση'}</ActionButton>}
          {['review', 'approved'].includes(record.status) && (canManage || canApprove) && <ActionButton tone="neutral" label={en ? 'Return to draft' : 'Επιστροφή σε πρόχειρο'} onClick={returnToDraft} disabled={busy}><RotateCcw size={15} />{en ? 'Return to draft' : 'Επιστροφή σε πρόχειρο'}</ActionButton>}
          {record.status === 'approved' && canPublish && <ActionButton tone="success" label={en ? 'Publish' : 'Δημοσίευση'} onClick={publish} disabled={busy}>{en ? 'Publish' : 'Δημοσίευση'}</ActionButton>}
          {record.status === 'published' && canSupersede && <ActionButton tone="edit" label={en ? 'New revision' : 'Νέα αναθεώρηση'} onClick={createRevision} disabled={busy}><Pencil size={15} />{en ? 'New revision' : 'Νέα αναθεώρηση'}</ActionButton>}
          {record.status === 'published' && canArchive && <ActionButton tone="danger" label={en ? 'Archive' : 'Αρχειοθέτηση'} onClick={archive} disabled={busy}><Archive size={16} />{en ? 'Archive' : 'Αρχειοθέτηση'}</ActionButton>}
        </div>
      </section>}
    </div>}

    {tab === 'files' && <section className="record-section" ref={reportRef}>
      <div className="record-section-header"><div>
        <span className="eyebrow">{en ? 'Documents' : 'Έγγραφα'}</span>
        <h3>{en ? 'Files & attachments' : 'Αρχεία & συνημμένα'}</h3>
        <p>{record.status === 'draft'
          ? (en ? 'Draft attachments can be added, corrected or removed.' : 'Στο πρόχειρο μπορείτε να προσθέσετε, να διορθώσετε ή να αφαιρέσετε συνημμένα.')
          : (en ? 'Attachments are locked for this lifecycle state. Return to draft or create a revision to change them.' : 'Τα συνημμένα είναι κλειδωμένα σε αυτή την κατάσταση. Επιστρέψτε σε πρόχειρο ή δημιουργήστε αναθεώρηση για αλλαγές.')}</p>
      </div></div>
      <AttachmentField disabled={!canManage || record.status !== 'draft'} value={record.attachments || []} onChange={attachments} organizationId={organizationId} entityType="controlled_document" entityId={record.dbId || record.id} />
    </section>}

    {tab === 'distribution' && <div ref={reportRef}><DocumentDistributionPanel record={record} organizationId={organizationId} isDemo={isDemo} departments={departments} canManage={canManage} canPublish={canPublish} en={en} /></div>}

    {tab === 'history' && <section className="record-section" ref={reportRef}>
      <div className="record-section-header"><div>
        <span className="eyebrow">{en ? 'Governance' : 'Διακυβέρνηση'}</span>
        <h3>{en ? 'Version & lifecycle history' : 'Ιστορικό εκδόσεων & κύκλου ζωής'}</h3>
        <p>{en ? 'Each revision keeps its own canonical audit trail.' : 'Κάθε έκδοση διατηρεί τη δική της πραγματική ροή από το κεντρικό audit trail.'}</p>
      </div></div>
      {family.length === 0
        ? <div className="inline-empty">{en ? 'No lifecycle audit events are available yet.' : 'Δεν υπάρχουν ακόμη καταγεγραμμένα audit events για τον κύκλο ζωής.'}</div>
        : <div className="document-version-history">{family.map((version) => <details key={version.dbId || version.id} className="record-section" open={version.dbId === record.dbId}>
          <summary><strong>{en ? 'Version' : 'Έκδοση'} {version.version || '—'}</strong> · {statusLabels[version.status] || version.status} · {version.id}</summary>
          <div className="document-version-history-events">
            {version.revisionReason && <div className="timeline-line"><strong>{en ? 'Revision reason' : 'Λόγος αναθεώρησης'}</strong><span>{version.revisionReason}</span></div>}
            {(version.history || []).length === 0
              ? <div className="inline-empty">{en ? 'No audit events for this revision.' : 'Δεν υπάρχουν audit events για αυτή την έκδοση.'}</div>
              : (version.history || []).map((item, index) => <div key={`${item.at}-${index}`} className="timeline-line"><strong>{formatHistoryAction(item, en, statusLabels)}</strong><span>{formatDateTime(item.at, en)} · {item.actor}</span></div>)}
          </div>
        </details>)}</div>}
    </section>}
  </EntityRecordShell></Page>
}

function DocumentDistributionPanel({ record, organizationId, isDemo, departments, canManage, canPublish, en }) {
  const n = useNotifications()
  const { notify } = useFeedback()
  const linkPath = `/documents/${record.id}`
  const canSend = canManage || canPublish
  const [distribution, setDistribution] = useState(null)
  const [loadingDistribution, setLoadingDistribution] = useState(!isDemo)
  const [acknowledgers, setAcknowledgers] = useState([])
  const [loadingAcknowledgers, setLoadingAcknowledgers] = useState(false)
  const [sending, setSending] = useState(false)
  const [audienceMode, setAudienceMode] = useState(record.departmentId ? 'department' : 'all')
  const [selectedDepartments, setSelectedDepartments] = useState(record.departmentId ? [record.departmentId] : [])
  const [deptQuery, setDeptQuery] = useState('')

  useEffect(() => {
    setAudienceMode(record.departmentId ? 'department' : 'all')
    setSelectedDepartments(record.departmentId ? [record.departmentId] : [])
    setDeptQuery('')
  }, [record.id, record.departmentId])

  function toggleDepartment(id) {
    setSelectedDepartments((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  useEffect(() => {
    if (isDemo) {
      setDistribution(n.announcements.find((a) => a.linkPath === linkPath) || null)
      setLoadingDistribution(false)
      return undefined
    }
    if (!organizationId) return undefined
    let active = true
    setLoadingDistribution(true)
    loadAnnouncementByLinkPath(organizationId, linkPath)
      .then((row) => { if (active) setDistribution(row) })
      .catch(() => { if (active) setDistribution(null) })
      .finally(() => { if (active) setLoadingDistribution(false) })
    return () => { active = false }
  }, [isDemo, n.announcements, organizationId, linkPath])

  useEffect(() => {
    if (isDemo || !distribution?.id || !canSend) { setAcknowledgers([]); return undefined }
    let active = true
    setLoadingAcknowledgers(true)
    loadAnnouncementAcknowledgers(organizationId, distribution.id)
      .then((rows) => { if (active) setAcknowledgers(rows) })
      .catch(() => { if (active) setAcknowledgers([]) })
      .finally(() => { if (active) setLoadingAcknowledgers(false) })
    return () => { active = false }
  }, [isDemo, distribution?.id, organizationId, canSend])

  async function send() {
    if (sending) return
    if (audienceMode === 'department' && selectedDepartments.length === 0) return
    setSending(true)
    const departmentNames = selectedDepartments.map((id) => departments.find((d) => d.id === id)?.name).filter(Boolean)
    const scopeLabel = audienceMode === 'department' ? departmentNames.join(', ') : ''
    const audienceType = audienceMode
    const audienceValues = audienceMode === 'department' ? selectedDepartments : []
    const title = en ? `Published document: ${record.title}` : `Δημοσιευμένο έγγραφο: ${record.title}`
    const message = en
      ? `"${record.title}" (${record.id} · v${record.version || '—'}) has been published${scopeLabel ? ` for ${scopeLabel}` : ''} and requires read acknowledgement.`
      : `Το έγγραφο «${record.title}» (${record.id} · v${record.version || '—'}) δημοσιεύτηκε${scopeLabel ? ` για ${scopeLabel}` : ''} και απαιτεί επιβεβαίωση ανάγνωσης.`
    const payload = { title, message, priority: 'normal', audienceType, audienceValues, requiresAck: true, linkPath }
    try {
      if (isDemo) {
        n.addAnnouncement(payload)
      } else {
        const created = await createAnnouncement(organizationId, payload)
        setDistribution(created)
        await n.reloadAnnouncements()
      }
      notify(en ? 'Distribution notice sent.' : 'Η κοινοποίηση εστάλη.', 'success')
    } catch (error) {
      notify(error?.message || (en ? 'Could not send the distribution notice.' : 'Δεν ήταν δυνατή η αποστολή της κοινοποίησης.'), 'danger')
    } finally {
      setSending(false)
    }
  }

  const audienceLabel = (item) => item?.audienceType === 'department'
    ? ((item.audienceValues || []).map((id) => departments.find((d) => d.id === id)?.name).filter(Boolean).join(', ') || (en ? 'Department(s)' : 'Τμήματα'))
    : (en ? 'Whole hospital' : 'Όλο το νοσοκομείο')
  const filteredDepartments = departments.filter((d) => d.name.toLowerCase().includes(deptQuery.toLowerCase()))

  return <section className="record-section">
    <div className="record-section-header"><div>
      <span className="eyebrow">{en ? 'Governance' : 'Διακυβέρνηση'}</span>
      <h3>{en ? 'Distribution & acknowledgement' : 'Κοινοποίηση & επιβεβαίωση ανάγνωσης'}</h3>
      <p>{en ? 'Notify the relevant staff that this version is published and track who has confirmed reading it.' : 'Ενημερώστε το αρμόδιο προσωπικό ότι δημοσιεύτηκε αυτή η έκδοση και παρακολουθήστε ποιοι έχουν επιβεβαιώσει ότι το διάβασαν.'}</p>
    </div></div>
    {record.status !== 'published' && <div className="inline-empty">{en ? 'Distribution is available once the document is published.' : 'Η κοινοποίηση είναι διαθέσιμη μόλις δημοσιευτεί το έγγραφο.'}</div>}
    {record.status === 'published' && (loadingDistribution
      ? <div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div>
      : distribution
        ? <div className="document-version-history-events">
            <div className="timeline-line"><strong>{en ? 'Sent' : 'Απεστάλη'}</strong><span>{formatDateTime(distribution.createdAt, en)}</span></div>
            <div className="timeline-line"><strong>{en ? 'Audience' : 'Κοινό'}</strong><span>{audienceLabel(distribution)}</span></div>
            {isDemo
              ? <div className="timeline-line"><strong>{en ? 'Your acknowledgement' : 'Η δική σας επιβεβαίωση'}</strong><span>{n.visibleAnnouncements.find((a) => a.id === distribution.id)?.acknowledged ? (en ? 'Confirmed' : 'Επιβεβαιώθηκε') : (en ? 'Pending' : 'Εκκρεμεί')}</span></div>
              : canSend && <>
                  <div className="timeline-line"><strong>{en ? 'Acknowledged by' : 'Επιβεβαίωσαν ανάγνωση'}</strong><span>{acknowledgers.length}</span></div>
                  {loadingAcknowledgers
                    ? <div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div>
                    : acknowledgers.length === 0
                      ? <div className="inline-empty">{en ? 'No acknowledgements yet.' : 'Δεν υπάρχουν ακόμη επιβεβαιώσεις.'}</div>
                      : acknowledgers.map((row) => <div key={row.userId} className="timeline-line"><strong>{row.name}</strong><span>{formatDateTime(row.acknowledgedAt, en)}</span></div>)}
                </>}
          </div>
        : canSend
          ? <div className="document-distribution-composer">
              <label className="field"><span>{en ? 'Audience' : 'Κοινό'}</span><select value={audienceMode} onChange={(e) => setAudienceMode(e.target.value)}>
                <option value="all">{en ? 'Whole hospital' : 'Όλο το νοσοκομείο'}</option>
                <option value="department">{en ? 'Specific department(s)' : 'Συγκεκριμένα τμήματα'}</option>
              </select></label>
              {audienceMode === 'department' && <div className="recipient-picker">
                <label className="filter-search"><Search size={16} /><input value={deptQuery} onChange={(e) => setDeptQuery(e.target.value)} placeholder={en ? 'Search department...' : 'Αναζήτηση τμήματος...'} /></label>
                <div className="recipient-options">{filteredDepartments.map((d) => <button type="button" key={d.id} className={selectedDepartments.includes(d.id) ? 'selected' : ''} onClick={() => toggleDepartment(d.id)}><span className="recipient-check">{selectedDepartments.includes(d.id) && <Check size={13} />}</span><span><strong>{d.name}</strong></span></button>)}</div>
                <div className="recipient-summary">{selectedDepartments.length} {en ? 'selected' : 'επιλεγμένα'}</div>
              </div>}
              <div className="record-actions"><ActionButton tone="primary" label={en ? 'Send distribution notice' : 'Αποστολή κοινοποίησης'} onClick={send} disabled={sending || (audienceMode === 'department' && selectedDepartments.length === 0)}><Send size={15} />{en ? 'Send distribution notice' : 'Αποστολή κοινοποίησης'}</ActionButton></div>
            </div>
          : <div className="inline-empty">{en ? 'This document has not been distributed yet.' : 'Το έγγραφο δεν έχει κοινοποιηθεί ακόμη.'}</div>)}
  </section>
}
