import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckSquare2, ClipboardList, Eye, FilePlus2, FolderOpen, Paperclip, Pencil, Plus, Send, Stethoscope, Star, Trash2, Truck, Users } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../../design-system/RecordTabPanel'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { IconButton } from '../../../design-system/IconButton'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { OverflowMenu } from '../../../design-system/OverflowMenu'
import { ActionButton } from '../../../design-system/ActionButton'
import '../../../design-system/AttachmentField.css'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { MultiSelect } from '../../../design-system/MultiSelect'
import { formatDay } from '../../../core/i18n/formatDay'
import { exportRegistry } from '../../../core/export/registryExports'
import { reportExports } from '../../../core/export/reportDocument'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { useResources, useResourceAccess, supplierNotes } from './ResourcesPanel'
import { removeSupplier, saveSupplier } from './resourceService'
import { APPROVALS, CERTIFICATION_TYPES, CRITERIA, CRITICALITY, DOCUMENT_KINDS, NONCONFORMITY_SEVERITIES, SCORE_STEPS, SUPPLIER_CATEGORIES, approvalLabel, approvalTone, certificationState, certificationStateLabel, certificationStateTone, criticalityLabel, documentKindLabel, equipmentStateLabel, equipmentStateTone, evaluationApproval, evaluationPercent, newCertification, newContact, newEvaluation, newNonconformity, newSupplier, severityLabel, severityTone, supplierCapaSource, supplierCategoryLabel, supplierCategoryOf, supplierProblems } from './resourceModel'
import { applyTemplate, everyCriterionScored, evaluationFromTemplate, evaluationTemplates, formatPercent, isTemplateEvaluation, resultFor, templateFor, weightedScore } from './supplierTemplates'
import { supplierEvaluationDocument } from './supplierEvaluationReport'
import { SupplierTemplatesPage } from './SupplierTemplatesPage'
import { RenewalSendDialog, SupplierRenewalsPage, canRequestRenewal, useCertificateRequests } from './SupplierRenewalsPage'
import { itemStatusLabel, itemStatusTone, renewalQueue } from './supplierRenewalModel'
import { attachSupplierFile, certificationFromFile, openSupplierFile, removeSupplierFile, supplierDocumentRows, useSupplierFiles } from './supplierDocuments'
import '../quality.css'
import './resources.css'

// The record shell keeps only the export control and the edit / delete actions of the
// header (these go to «…»); a primary domain action marked `utility` stays visible
// beside the status, as a standard text button.
const HeaderAction = ({ children }) => children

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })
const byNewest = field => (a, b) => String(b[field] || '').localeCompare(String(a[field] || ''))

// /quality/suppliers/templates is the templates page, /quality/suppliers/renewals the
// certificates to renew; any other id is a supplier. Nothing here when the hospital
// has no «Suppliers & certificates» module.
export function SupplierRecordPage() {
  const { supplierId } = useParams()
  const { moduleEnabled } = useTenant()
  const { language } = useLanguage()
  if (!moduleEnabled('suppliers')) return <Page fill><div className="registry-empty-state"><strong>{language === 'en' ? 'The «Suppliers & certificates» module is not enabled for this hospital.' : 'Η ενότητα «Προμηθευτές & πιστοποιητικά» δεν είναι ενεργή για το νοσοκομείο.'}</strong></div></Page>
  return supplierId === 'templates' ? <SupplierTemplatesPage /> : supplierId === 'renewals' ? <SupplierRenewalsPage /> : <SupplierRecord supplierId={supplierId} />
}

function SupplierRecord({ supplierId }) {
  const isNew = supplierId === 'new'
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation('/quality')
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const { tenant } = useTenant()
  const access = useResourceAccess()
  const list = useResources()
  const [draft, setDraft] = useState(null)
  const [tab, setTab] = useState(isNew ? 'details' : 'evaluations')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [renewing, setRenewing] = useState(null)
  // The details of a saved supplier open read-only; «Edit» (in the card's ⋯) opens them.
  const [editingDetails, setEditingDetails] = useState(false)
  const renewals = useCertificateRequests(!isNew && access.canViewAll)
  const supplierFiles = useSupplierFiles(tenant?.id, isNew ? null : supplierId)

  const row = useMemo(() => (isNew ? null : list.suppliers.find(item => item.id === supplierId) || null), [isNew, list.suppliers, supplierId])
  useEffect(() => { if (isNew) setDraft(current => current || newSupplier()); else if (row) setDraft(current => (current?.id === row.id ? current : structuredClone(row))) }, [isNew, row])
  const devices = useMemo(() => list.equipment.filter(item => item.supplierId === supplierId), [list.equipment, supplierId])
  const templates = list.templates || []
  // Each certificate with its latest renewal request (the e-mailed link to the supplier).
  const renewalRows = useMemo(() => new Map((row ? renewalQueue([{ ...row, status: 'active' }], renewals.requests, { expiring: true }) : []).map(item => [item.key, item])), [row, renewals.requests])

  if (list.loading && !draft) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (!isNew && !row) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Supplier not found' : 'Ο προμηθευτής δεν βρέθηκε'}</strong></div></Page>
  if (!draft) return null

  const locked = !access.canManage
  const detailsLocked = locked || (!isNew && !editingDetails)
  const set = next => setDraft(current => ({ ...current, ...next }))

  // Saves the supplier as it is, or with one list changed (an evaluation, a certificate, a contact, a nonconformity).
  async function persist(next = draft, message) {
    const problems = supplierProblems(next, language)
    if (problems.length) { notify(`${en ? 'Fill in:' : 'Συμπληρώστε:'} ${problems.join(' · ')}`, 'error'); setTab('details'); return false }
    setSaving(true)
    try {
      const saved = await saveSupplier(tenant?.id, next)
      notify(message || (en ? 'Supplier saved.' : 'Ο προμηθευτής αποθηκεύτηκε.'), 'success')
      await list.reload()
      if (isNew) navigate(`/quality/suppliers/${saved.id}`, { replace: true })
      else { setDraft(structuredClone(saved)); setEditingDetails(false) }
      return true
    } catch (error) { console.error(error); notify(en ? 'The supplier could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση.', 'error'); return false } finally { setSaving(false) }
  }
  const saveItem = (field, item, message) => persist({ ...draft, [field]: (draft[field] || []).some(entry => entry.id === item.id) ? draft[field].map(entry => (entry.id === item.id ? item : entry)) : [...(draft[field] || []), item] }, message)
  async function dropItem(field, item) {
    const ok = await confirm({ title: en ? 'Delete' : 'Διαγραφή', message: en ? 'The entry is deleted.' : 'Η εγγραφή διαγράφεται.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (ok) await persist({ ...draft, [field]: draft[field].filter(entry => entry.id !== item.id) }, en ? 'Deleted.' : 'Διαγράφηκε.')
  }
  async function remove() {
    const ok = await confirm({ title: en ? 'Delete supplier' : 'Διαγραφή προμηθευτή', message: en ? `The supplier with its evaluations is deleted; ${devices.length} devices keep no supplier. A supplier no longer used is better marked inactive.` : `Διαγράφεται ο προμηθευτής με τις αξιολογήσεις του· ${devices.length} εξοπλισμοί μένουν χωρίς προμηθευτή. Για προμηθευτή που δεν χρησιμοποιείται πια, προτιμήστε «Ανενεργός».`, confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    try { await removeSupplier(tenant?.id, row.id); notify(en ? 'Supplier deleted.' : 'Ο προμηθευτής διαγράφηκε.', 'success'); goBack() } catch (error) { console.error(error); notify(en ? 'The supplier could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  // A document is saved with its file: a new file is uploaded first, and the one it replaces is removed after.
  async function saveDocument(item) {
    const { pendingFile, ...cert } = item
    const previous = supplierFiles.files.find(file => file.id === (draft.certifications || []).find(entry => entry.id === cert.id)?.attachmentId) || null
    let uploaded = null
    if (pendingFile) {
      try { uploaded = await attachSupplierFile(supplierFiles.cloud, tenant?.id, draft.id, pendingFile, cert.kind) } catch (error) { console.error(error); notify(en ? 'The file could not be uploaded.' : 'Δεν ήταν δυνατή η αποστολή του αρχείου.', 'error'); return false }
      cert.attachmentId = uploaded.id
    }
    const ok = await saveItem('certifications', cert)
    if (ok && uploaded) {
      supplierFiles.setFiles(current => [...current.filter(file => !previous || file.id !== previous.id), uploaded])
      if (previous && previous.id !== uploaded.id) await removeSupplierFile(supplierFiles.cloud, previous).catch(error => console.error(error))
    }
    return ok
  }
  // Deleting a document deletes its file too (a file without details: only the file).
  async function removeDocument(doc) {
    const ok = await confirm({ title: en ? 'Delete document' : 'Διαγραφή εγγράφου', message: doc.file ? (en ? 'The document and its file are deleted.' : 'Διαγράφονται το έγγραφο και το αρχείο του.') : (en ? 'The document is deleted.' : 'Το έγγραφο διαγράφεται.'), confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    if (doc.cert && !(await persist({ ...draft, certifications: draft.certifications.filter(entry => entry.id !== doc.cert.id) }, en ? 'Deleted.' : 'Διαγράφηκε.'))) return
    if (doc.file) {
      try { await removeSupplierFile(supplierFiles.cloud, doc.file); supplierFiles.setFiles(current => current.filter(file => file.id !== doc.file.id)); if (!doc.cert) notify(en ? 'Deleted.' : 'Διαγράφηκε.', 'success') } catch (error) { console.error(error); notify(en ? 'The file could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή του αρχείου.', 'error') }
    }
  }
  const viewFile = file => openSupplierFile(supplierFiles.cloud, file).catch(() => notify(en ? 'The file could not be opened.' : 'Δεν ήταν δυνατό το άνοιγμα του αρχείου.', 'error'))
  const editDocument = doc => setEditing({ field: 'certifications', item: doc.cert ? structuredClone(doc.cert) : certificationFromFile(newCertification(), doc.file) })
  // Each row's «⋯»: what can be done with it, never icons on the row.
  const rowMenu = items => <span className="resource-row-menu" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}><OverflowMenu label={en ? 'Actions' : 'Ενέργειες'} items={items} /></span>
  const editDelete = (field, item) => [
    { id: 'edit', label: en ? 'Edit' : 'Επεξεργασία', icon: Pencil, onClick: () => setEditing({ field, item: structuredClone(item) }) },
    { id: 'delete', label: en ? 'Delete' : 'Διαγραφή', icon: Trash2, tone: 'danger', separatorBefore: true, onClick: () => dropItem(field, item) },
  ]
  const openRow = (field, item) => (locked ? {} : { className: 'registry-row-clickable', tabIndex: 0, onClick: () => setEditing({ field, item: structuredClone(item) }), onKeyDown: event => { if (event.key === 'Enter') setEditing({ field, item: structuredClone(item) }) } })
  const openCapa = item => navigate('/quality/capas/new', { state: { qualitySource: supplierCapaSource(row, item, language) } })
  // A new evaluation starts on the template of the supplier's category (else the earlier six criteria).
  const startEvaluation = () => { const template = evaluationTemplates(templates, supplierCategoryOf(draft.category))[0] || templateFor(templates, supplierCategoryOf(draft.category)); return template ? evaluationFromTemplate(template) : newEvaluation() }

  const evaluations = [...(draft.evaluations || [])].sort(byNewest('evaluatedOn'))
  const certifications = draft.certifications || []
  const documents = supplierDocumentRows(certifications, supplierFiles.files)
  const addDocument = !locked && <ActionButton tone="neutral" label={en ? 'Add a document' : 'Προσθήκη εγγράφου'} onClick={() => setEditing({ field: 'certifications', item: newCertification() })}><FilePlus2 size={15} /><span>{en ? 'Add a document' : 'Προσθήκη εγγράφου'}</span></ActionButton>
  const contacts = draft.contacts || []
  const nonconformities = [...(draft.nonconformities || [])].sort(byNewest('date'))
  const openCount = nonconformities.filter(item => item.status !== 'closed').length
  const tabs = isNew ? [{ id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: ClipboardList }] : [
    { id: 'evaluations', label: en ? `Evaluations ${evaluations.length}` : `Αξιολογήσεις ${evaluations.length}`, icon: Star },
    { id: 'nonconformities', label: en ? `Nonconformities ${openCount}` : `Μη συμμορφώσεις ${openCount}`, icon: AlertTriangle },
    { id: 'documents', label: en ? `Documents ${documents.length}` : `Έγγραφα ${documents.length}`, icon: FolderOpen },
    { id: 'contacts', label: en ? `Contacts ${contacts.length}` : `Επαφές ${contacts.length}`, icon: Users },
    { id: 'equipment', label: en ? `Equipment ${devices.length}` : `Εξοπλισμός ${devices.length}`, icon: Stethoscope },
    { id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: ClipboardList },
  ]
  const notes = row ? supplierNotes(row, language) : []
  const latest = row?.latestEvaluation || null
  // The supplier's file: every evaluation and nonconformity, for the yearly review.
  const exportFile = () => exportRegistry({
    name: `${row.code}-${en ? 'supplier-file' : 'fakelos-promithefti'}`,
    headers: en ? ['Kind', 'Date', 'Details', 'Score % / severity', 'Result / status'] : ['Είδος', 'Ημερομηνία', 'Στοιχεία', 'Βαθμολογία % / σοβαρότητα', 'Αποτέλεσμα / κατάσταση'],
    rows: [...evaluations.map(item => [en ? 'Evaluation' : 'Αξιολόγηση', item.evaluatedOn, isTemplateEvaluation(item) ? [item.templateName, ...(item.criteria || []).map(criterion => `${criterion.label}: ${criterion.score === '' || criterion.score == null ? '—' : criterion.score}`)].filter(Boolean).join('; ') : CRITERIA.map(criterion => `${criterion.label[en ? 1 : 0]}: ${item.scores?.[criterion.key] || '—'}`).join('; '), evaluationPercent(item) ?? '', approvalLabel(evaluationApproval(item), language)]),
      ...nonconformities.map(item => [en ? 'Nonconformity' : 'Μη συμμόρφωση', item.date, item.description, severityLabel(item.severity, language), item.status === 'closed' ? (en ? 'Closed' : 'Έκλεισε') : (en ? 'Open' : 'Ανοιχτή')]),
      ...certifications.map(item => [en ? 'Certificate' : 'Πιστοποιητικό', item.expiresOn, [item.type, item.title, item.number, item.issuer].filter(Boolean).join(' · '), '', certificationStateLabel(certificationState(item), language)])],
  })
  // One export control: the evaluation sheet of the latest evaluation (print / PDF) and the supplier's file (Excel).
  const sheet = () => supplierEvaluationDocument(row, latest, { language, nextEvaluation: row.nextEvaluation, months: row.evaluationMonths })
  const blocked = () => notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  const headerActions = !isNew && <div className="row-actions">
    <ExportMenu {...(latest ? reportExports(sheet, { onBlocked: blocked }) : {})} onExcel={exportFile} />
    {access.canManage && tab === 'details' && !editingDetails && <IconButton tone="edit" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => setEditingDetails(true)}><Pencil size={16} /></IconButton>}
    {access.canManage && <IconButton tone="danger" label={en ? 'Delete supplier' : 'Διαγραφή προμηθευτή'} onClick={remove}><Trash2 size={16} /></IconButton>}
    {access.canManage && <HeaderAction utility tone="primary"><Button onClick={() => { setTab('evaluations'); setEditing({ field: 'evaluations', item: startEvaluation() }) }}><Plus size={15} />{en ? 'New evaluation' : 'Νέα αξιολόγηση'}</Button></HeaderAction>}
  </div>
  const add = (field, item) => !locked && <Button onClick={() => setEditing({ field, item: typeof item === 'function' ? item() : item })}><Plus size={15} />{en ? 'Add' : 'Προσθήκη'}</Button>
  const nextText = row?.nextEvaluation ? `${en ? 'Next evaluation' : 'Επόμενη αξιολόγηση'}: ${formatDay(row.nextEvaluation, language)}` : (en ? 'Not evaluated yet' : 'Δεν έχει αξιολογηθεί')
  const own = templateFor(templates, supplierCategoryOf(draft.category))

  return <Page fill><EntityRecordShell className="quality-record-shell resource-record-shell workspace-fill" avatar={<Truck size={19} />} eyebrow={row?.code || (en ? 'New supplier' : 'Νέος προμηθευτής')} title={draft.name || (en ? 'New supplier' : 'Νέος προμηθευτής')}
    subtitle={row ? [supplierCategoryLabel(row.category, language), row.taxId && `${en ? 'Tax ID' : 'ΑΦΜ'} ${row.taxId}`, nextText, `${en ? 'Criticality' : 'Κρισιμότητα'}: ${criticalityLabel(row.criticality, language)}`].filter(Boolean).join(' · ') : ''}
    status={row && <span className="resource-status"><StatusBadge tone={approvalTone(row.approval)}>{approvalLabel(row.approval, language)}{row.score != null ? ` · ${formatPercent(row.score, language)}` : ''}</StatusBadge>{row.status === 'inactive' && <StatusBadge tone="neutral">{en ? 'Inactive' : 'Ανενεργός'}</StatusBadge>}</span>}
    headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {tab === 'evaluations' && row && <RecordTabPanel title={en ? 'Evaluations' : 'Αξιολογήσεις'} subtitle={own ? (en ? `Template «${own.name}»: approved from ${own.passThreshold}%, conditional from ${own.conditionalThreshold}%, every ${row.evaluationMonths} months. ${nextText}.` : `Πρότυπο «${own.name}»: εγκεκριμένος από ${own.passThreshold}%, υπό όρους από ${own.conditionalThreshold}%, κάθε ${row.evaluationMonths} μήνες. ${nextText}.`) : `${en ? `Every ${row.evaluationMonths} months` : `Κάθε ${row.evaluationMonths} μήνες`}. ${nextText}.`}>
      {(notes.length > 0 || row.evaluationDue) && <div className="resource-notes resource-notes-wide">{notes.map(note => <StatusBadge key={note.key} tone={note.tone}>{note.label}</StatusBadge>)}{row.evaluationDue && <StatusBadge tone="warning">{en ? 'Evaluation due' : 'Οφείλεται αξιολόγηση'}</StatusBadge>}</div>}
      <RegistryTable className="quality-table" rows={evaluations} rowKey={item => item.id}
        columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'template', label: en ? 'Template' : 'Πρότυπο' }, { key: 'criteria', label: en ? 'Criteria' : 'Κριτήρια' }, { key: 'score', label: en ? 'Score' : 'Βαθμολογία' }, { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα' }, ...(locked ? [] : [{ key: 'actions', label: '' }])]}
        rowProps={item => openRow('evaluations', item)}
        emptyTitle={en ? 'Not evaluated yet' : 'Δεν έχει αξιολογηθεί'} emptyText={en ? 'Evaluate the supplier on its category’s template, and after a serious nonconformity.' : 'Αξιολογήστε τον προμηθευτή με το πρότυπο της κατηγορίας του, και μετά από σοβαρή μη συμμόρφωση.'}
        renderRow={item => { const score = evaluationPercent(item); const result = evaluationApproval(item); return <>
          <td className="nowrap-cell">{formatDay(item.evaluatedOn, language)}{item.evaluator && <small>{item.evaluator}</small>}</td>
          <td>{item.templateName || (en ? 'General criteria' : 'Γενικά κριτήρια')}{item.templateVersion > 1 && <small>{en ? 'version' : 'έκδοση'} {item.templateVersion}</small>}</td>
          <td>{criteriaSummary(item, en)}</td>
          <td><strong>{formatPercent(score, language)}</strong></td>
          <td><StatusBadge tone={approvalTone(result)}>{approvalLabel(result, language)}</StatusBadge></td>
          {!locked && <td className="resource-menu-cell">{rowMenu(editDelete('evaluations', item))}</td>}
        </> }} />
    </RecordTabPanel>}
    {tab === 'nonconformities' && row && <RecordTabPanel title={en ? 'Nonconformities' : 'Μη συμμορφώσεις'} subtitle={en ? 'A defective batch, a late or wrong delivery, missing documents. A serious one becomes a corrective action.' : 'Ελαττωματική παρτίδα, καθυστερημένη ή λάθος παράδοση, ελλιπή έγγραφα. Μια σοβαρή γίνεται διορθωτική ενέργεια.'} actions={add('nonconformities', newNonconformity)}>
      <RegistryTable className="quality-table" rows={nonconformities} rowKey={item => item.id}
        columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'description', label: en ? 'Description' : 'Περιγραφή' }, { key: 'severity', label: en ? 'Severity' : 'Σοβαρότητα' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }, ...(locked ? [] : [{ key: 'actions', label: '' }])]}
        rowProps={item => openRow('nonconformities', item)}
        emptyTitle={en ? 'No nonconformities' : 'Δεν υπάρχουν μη συμμορφώσεις'}
        renderRow={item => <>
          <td className="nowrap-cell">{formatDay(item.date, language)}</td>
          <td className="resource-description-cell">{item.description}{item.capaCode && <small>{en ? 'Corrective action' : 'Διορθωτική ενέργεια'} {item.capaCode}</small>}</td>
          <td><StatusBadge tone={severityTone(item.severity)}>{severityLabel(item.severity, language)}</StatusBadge></td>
          <td><StatusBadge tone={item.status === 'closed' ? 'success' : 'info'}>{item.status === 'closed' ? (en ? 'Closed' : 'Έκλεισε') : (en ? 'Open' : 'Ανοιχτή')}</StatusBadge>{item.closedOn && <small>{formatDay(item.closedOn, language)}</small>}</td>
          {!locked && <td className="resource-menu-cell">{rowMenu([item.status !== 'closed' && { id: 'capa', label: en ? 'Corrective action' : 'Διορθωτική ενέργεια', icon: CheckSquare2, onClick: () => openCapa(item) }, ...editDelete('nonconformities', item)].filter(Boolean))}</td>}
        </>} />
    </RecordTabPanel>}
    {tab === 'documents' && row && <RecordTabPanel title={en ? 'Documents' : 'Έγγραφα'} subtitle={en ? 'Certificates, licences, contracts and other files of the supplier: the list warns 60 days before expiry.' : 'Πιστοποιητικά, άδειες, συμβάσεις και άλλα αρχεία του προμηθευτή: η λίστα ειδοποιεί 60 ημέρες πριν τη λήξη.'}>
      {/* The same box as every record's attachments: one card per document, its «⋯», and «Add» at the foot. */}
      <div className="resource-pad"><div className="attachment-field attachment-field-v2">
        {documents.length === 0 && <div className="attachment-empty-row"><Paperclip size={16} aria-hidden="true" /><span>{en ? 'No documents yet.' : 'Δεν υπάρχουν έγγραφα.'}</span>{addDocument}</div>}
        {documents.length > 0 && <div className="attachment-list">{documents.map(doc => { const cert = doc.cert; const state = cert ? certificationState(cert) : null; const renewal = cert ? renewalRows.get(cert.id) : null; const open = () => (cert && !locked ? editDocument(doc) : viewFile(doc.file)); return <div key={doc.key} className="attachment-row attachment-row-v2">
          <div className="attachment-file-info">
            <strong className="attachment-open-target" role="button" tabIndex={0} onClick={open} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() } }}>{cert ? cert.type : doc.file.description || doc.file.name}</strong>
            <div><span className="attachment-category">{cert ? documentKindLabel(cert.kind, language) : (en ? 'File' : 'Αρχείο')}</span>{cert?.expiresOn && <StatusBadge tone={certificationStateTone(state)}>{`${formatDay(cert.expiresOn, language)} · ${certificationStateLabel(state, language)}`}</StatusBadge>}{renewal?.item && <StatusBadge tone={itemStatusTone(renewal.item.status)}>{en ? 'Renewal' : 'Ανανέωση'}: {itemStatusLabel(renewal.item.status, language)}</StatusBadge>}<small>{[cert && cert.title !== cert.type && cert.title, cert?.number, cert?.issuer, doc.file?.name].filter(Boolean).join(' · ')}</small></div>
          </div>
          <div className="attachment-actions"><OverflowMenu label={en ? 'Document actions' : 'Ενέργειες εγγράφου'} items={[
            doc.file && { id: 'view', label: en ? 'View the file' : 'Προβολή αρχείου', icon: Eye, onClick: () => viewFile(doc.file) },
            !locked && { id: 'edit', label: en ? 'Edit' : 'Επεξεργασία', icon: Pencil, onClick: () => editDocument(doc) },
            !locked && cert && canRequestRenewal(renewal) && { id: 'renew', label: en ? 'Request renewal' : 'Αίτημα ανανέωσης', icon: Send, onClick: () => setRenewing([renewal]) },
            !locked && { id: 'delete', label: en ? 'Delete' : 'Διαγραφή', icon: Trash2, tone: 'danger', separatorBefore: true, onClick: () => removeDocument(doc) },
          ].filter(Boolean)} /></div>
        </div> })}</div>}
        {documents.length > 0 && addDocument && <div className="attachment-add-row">{addDocument}</div>}
      </div></div>
    </RecordTabPanel>}
    {tab === 'contacts' && row && <RecordTabPanel title={en ? 'Contact persons' : 'Πρόσωπα επικοινωνίας'} subtitle={en ? 'Who to call for orders, quality and technical support.' : 'Με ποιον επικοινωνείτε για παραγγελίες, ποιότητα και τεχνική υποστήριξη.'} actions={add('contacts', newContact)}>
      <RegistryTable className="quality-table" rows={contacts} rowKey={item => item.id}
        columns={[{ key: 'name', label: en ? 'Name' : 'Ονοματεπώνυμο' }, { key: 'role', label: en ? 'Role' : 'Θέση' }, { key: 'phone', label: en ? 'Phone' : 'Τηλέφωνο' }, { key: 'email', label: 'Email' }, ...(locked ? [] : [{ key: 'actions', label: '' }])]}
        rowProps={item => openRow('contacts', item)}
        emptyTitle={en ? 'No contact persons' : 'Δεν υπάρχουν πρόσωπα επικοινωνίας'}
        renderRow={item => <>
          <td><strong>{item.fullName}</strong>{item.notes && <small>{item.notes}</small>}</td>
          <td>{item.jobTitle || '—'}</td>
          <td className="nowrap-cell">{item.phone || '—'}</td>
          <td>{item.email || '—'}</td>
          {!locked && <td className="resource-menu-cell">{rowMenu(editDelete('contacts', item))}</td>}
        </>} />
    </RecordTabPanel>}
    {tab === 'equipment' && row && <RecordTabPanel title={en ? 'Equipment from this supplier' : 'Εξοπλισμός από τον προμηθευτή'}>
      <RegistryTable className="quality-table" rows={devices} rowKey={item => item.id}
        columns={[{ key: 'code', label: en ? 'Code' : 'Κωδικός' }, { key: 'device', label: en ? 'Device' : 'Εξοπλισμός' }, { key: 'department', label: en ? 'Department' : 'Τμήμα' }, { key: 'failures', label: en ? 'Failures' : 'Βλάβες' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }]}
        emptyTitle={en ? 'No equipment' : 'Δεν υπάρχει εξοπλισμός'} emptyText={en ? 'Link a device to this supplier from the device’s details.' : 'Συνδέστε εξοπλισμό με τον προμηθευτή από τα στοιχεία του εξοπλισμού.'}
        rowProps={item => ({ className: 'registry-row-clickable', onClick: () => navigate(`/quality/equipment/${item.id}`) })}
        renderRow={item => <>
          <td><strong>{item.code}</strong></td>
          <td>{item.name}<small>{[item.manufacturer, item.model].filter(Boolean).join(' ')}</small></td>
          <td>{(en ? item.departmentEn : item.department) || '—'}</td>
          <td>{item.failures}</td>
          <td><StatusBadge tone={equipmentStateTone(item.state)}>{equipmentStateLabel(item.state, language)}</StatusBadge></td>
        </>} />
    </RecordTabPanel>}
    {tab === 'details' && <RecordTabPanel title={en ? 'Details' : 'Στοιχεία'} footer={!detailsLocked && <div className="inline-edit-footer">{!isNew && <Button variant="secondary" onClick={() => { setDraft(structuredClone(row)); setEditingDetails(false) }}>{en ? 'Cancel' : 'Ακύρωση'}</Button>}<SaveButton loading={saving} disabled={saving} onClick={() => persist()}>{isNew ? (en ? 'Register supplier' : 'Καταχώριση προμηθευτή') : (en ? 'Save' : 'Αποθήκευση')}</SaveButton></div>}>
      <div className="lo-form-cards">
        <FormCard wide title={en ? 'Supplier' : 'Προμηθευτής'}>
          <FormGrid columns={3}>
            <Field label={en ? 'Name *' : 'Επωνυμία *'}><input value={draft.name} disabled={detailsLocked} onChange={e => set({ name: e.target.value })} /></Field>
            <Field label={en ? 'Legal name' : 'Νομική επωνυμία'}><input value={draft.legalName || ''} disabled={detailsLocked} onChange={e => set({ legalName: e.target.value })} /></Field>
            <Field label={en ? 'Tax ID' : 'ΑΦΜ'}><input value={draft.taxId} disabled={detailsLocked} onChange={e => set({ taxId: e.target.value })} inputMode="numeric" /></Field>
            <SearchableSelect label={en ? 'Category' : 'Κατηγορία'} value={supplierCategoryOf(draft.category)} disabled={detailsLocked} options={SUPPLIER_CATEGORIES.map(item => ({ value: item.value, label: item.label[en ? 1 : 0], keywords: item.label.join(' ') }))} onChange={value => set({ category: value || 'products' })} {...selectText(en)} />
            <ChoiceField label={en ? 'Criticality' : 'Κρισιμότητα'} value={draft.criticality} disabled={detailsLocked} options={CRITICALITY.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => set({ criticality: value })} />
            <ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={draft.status} disabled={detailsLocked} options={[{ value: 'active', label: en ? 'Active' : 'Ενεργός' }, { value: 'inactive', label: en ? 'Inactive' : 'Ανενεργός' }]} onChange={value => set({ status: value })} />
          </FormGrid>
          <Field label={en ? 'Products / services' : 'Προϊόντα / υπηρεσίες'}><textarea rows={2} value={draft.products} disabled={detailsLocked} onChange={e => set({ products: e.target.value })} /></Field>
          <MultiSelect label={en ? 'Departments that use this supplier' : 'Τμήματα που χρησιμοποιούν τον προμηθευτή'} tags disabled={detailsLocked} selected={draft.departmentIds || []} options={(list.departments || []).map(item => ({ value: item.id || item.name, label: en ? item.nameEn || item.name : item.name }))} onChange={value => set({ departmentIds: value })} placeholder={en ? 'Every department sees only its own suppliers' : 'Κάθε τμήμα βλέπει μόνο τους δικούς του προμηθευτές'} searchPlaceholder={en ? 'Search department' : 'Αναζήτηση τμήματος'} selectAllLabel={en ? 'Select all' : 'Επιλογή όλων'} clearAllLabel={en ? 'Clear' : 'Καθαρισμός'} />
          <FormGrid columns={3}>
            <ChoiceField label={en ? 'Recorded approval' : 'Καταχωρισμένη έγκριση'} value={draft.approvalStatus || 'none'} disabled={detailsLocked} options={[{ value: 'none', label: en ? 'From the latest evaluation' : 'Από την τελευταία αξιολόγηση' }, ...APPROVALS.filter(item => item.value !== 'unevaluated').map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))]} onChange={value => set({ approvalStatus: value === 'none' ? '' : value })} />
            <Field label={en ? 'Evaluate every (months)' : 'Αξιολόγηση κάθε (μήνες)'}><input type="number" min="1" max="60" value={draft.evaluationMonths ?? ''} disabled={detailsLocked} placeholder={own ? String(own.frequencyMonths) : '12'} onChange={e => set({ evaluationMonths: e.target.value })} /></Field>
            <ManualDateField label={en ? 'Contract ends' : 'Λήξη σύμβασης'} value={draft.contractEndsOn} disabled={detailsLocked} onChange={value => set({ contractEndsOn: value })} optional />
          </FormGrid>
        </FormCard>
        <FormCard wide title={en ? 'Contact' : 'Επικοινωνία'}>
          <FormGrid columns={3}>
            <Field label={en ? 'Address' : 'Διεύθυνση'}><input value={draft.address} disabled={detailsLocked} onChange={e => set({ address: e.target.value })} /></Field>
            <Field label={en ? 'City' : 'Πόλη'}><input value={draft.city || ''} disabled={detailsLocked} onChange={e => set({ city: e.target.value })} /></Field>
            <Field label={en ? 'Country' : 'Χώρα'}><input value={draft.country || ''} disabled={detailsLocked} onChange={e => set({ country: e.target.value })} /></Field>
            <Field label={en ? 'Phone' : 'Τηλέφωνο'}><input value={draft.phone} disabled={detailsLocked} onChange={e => set({ phone: e.target.value })} inputMode="tel" /></Field>
            <Field label="Email"><input value={draft.email} disabled={detailsLocked} onChange={e => set({ email: e.target.value })} inputMode="email" /></Field>
            <Field label={en ? 'Website' : 'Ιστότοπος'}><input value={draft.website} disabled={detailsLocked} onChange={e => set({ website: e.target.value })} /></Field>
            <Field label={en ? 'Contact person' : 'Υπεύθυνος επικοινωνίας'}><input value={draft.contactName} disabled={detailsLocked} onChange={e => set({ contactName: e.target.value })} /></Field>
          </FormGrid>
          <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={3} value={draft.notes} disabled={detailsLocked} onChange={e => set({ notes: e.target.value })} /></Field>
        </FormCard>
      </div>
    </RecordTabPanel>}
    {renewing && <RenewalSendDialog rows={renewing} canSend={access.canSend} onClose={() => setRenewing(null)} onDone={async () => { setRenewing(null); await renewals.reload() }} />}
    {editing && <ItemDialog editing={editing} setEditing={setEditing} language={language} saving={saving} templates={templates} category={supplierCategoryOf(draft.category)} files={supplierFiles.files} onViewFile={viewFile} onSave={async () => { if (await (editing.field === 'certifications' ? saveDocument(editing.item) : saveItem(editing.field, editing.item))) setEditing(null) }} />}
  </EntityRecordShell></Page>
}

function criteriaSummary(item, en) {
  if (!isTemplateEvaluation(item)) { const given = CRITERIA.filter(criterion => Number(item.scores?.[criterion.key]) >= 1).length; return `${given} / ${CRITERIA.length}` }
  const given = (item.criteria || []).length
  if (item.criteriaScores === 'partial' || item.criteriaScores === 'not_recorded') return en ? 'Total only' : 'Μόνο σύνολο'
  return String(given)
}


// The document's file: the one attached (opens on click) and «Choose a file» to add or replace it.
function DocumentFileField({ item, set, files, onView, en }) {
  const current = files.find(file => file.id === item.attachmentId) || null
  const picker = useRef(null)
  return <div className="resource-document-file"><span className="resource-document-file-label">{en ? 'File' : 'Αρχείο'}</span><div className="resource-document-file-row">
    {item.pendingFile ? <strong>{item.pendingFile.name}</strong> : current ? <button type="button" className="resource-file-link" onClick={() => onView?.(current)}>{current.name}</button> : <small>{en ? 'No file yet' : 'Χωρίς αρχείο'}</small>}
    <Button variant="secondary" onClick={() => picker.current?.click()}><FilePlus2 size={15} aria-hidden="true" />{current || item.pendingFile ? (en ? 'Replace the file' : 'Αλλαγή αρχείου') : (en ? 'Choose a file' : 'Επιλογή αρχείου')}</Button>
    <input ref={picker} type="file" hidden onChange={event => { const file = event.target.files?.[0]; if (file) set({ pendingFile: file }) }} />
  </div></div>
}

const TITLES = { evaluations: ['Αξιολόγηση προμηθευτή', 'Supplier evaluation'], certifications: ['Έγγραφο', 'Document'], nonconformities: ['Μη συμμόρφωση', 'Nonconformity'], contacts: ['Πρόσωπο επικοινωνίας', 'Contact person'] }

function ItemDialog({ editing, setEditing, language, saving, templates, category, files = [], onViewFile, onSave }) {
  const en = language === 'en'
  const { field, item } = editing
  const set = next => setEditing(current => ({ ...current, item: { ...current.item, ...next } }))
  const ready = field === 'evaluations' ? Boolean(item.evaluatedOn) && (isTemplateEvaluation(item) ? (item.criteriaScores && item.criteriaScores !== 'complete') || everyCriterionScored(item) : CRITERIA.every(criterion => Number(item.scores?.[criterion.key]) >= 1))
    : field === 'certifications' ? Boolean(String(item.type || '').trim())
    : field === 'contacts' ? Boolean(String(item.fullName || '').trim())
    : Boolean(item.date) && String(item.description || '').trim().length > 2
  return <ObserverDialog width={field === 'evaluations' ? 'wide' : undefined} title={TITLES[field][en ? 1 : 0]} subtitle={field === 'evaluations' && item.templateName ? item.templateName : undefined} onClose={() => setEditing(null)}
    footer={<DialogActions onSave={onSave} saveLabel={en ? 'Save' : 'Αποθήκευση'} disabled={saving || !ready} />}>
    {field === 'evaluations' && (isTemplateEvaluation(item) ? <TemplateEvaluationForm item={item} set={set} templates={templates} category={category} language={language} /> : <LegacyEvaluationForm item={item} set={set} language={language} />)}
    {field === 'certifications' && <div className="resource-event-form"><FormGrid columns={3}>
      <ChoiceField label={en ? 'Kind' : 'Είδος'} value={item.kind || 'certificate'} options={DOCUMENT_KINDS.map(entry => ({ value: entry.value, label: entry.label[en ? 1 : 0] }))} onChange={value => set({ kind: value })} />
      <SearchableSelect label={en ? 'Document *' : 'Έγγραφο *'} value={item.type} options={CERTIFICATION_TYPES.map(type => ({ value: type, label: type }))} allowCustom customLabel={value => `«${value}»`} onChange={value => set({ type: value || '' })} {...selectText(en)} />
      <Field label={en ? 'Title' : 'Τίτλος'}><input value={item.title || ''} onChange={e => set({ title: e.target.value })} /></Field>
      <Field label={en ? 'Number' : 'Αριθμός'}><input value={item.number} onChange={e => set({ number: e.target.value })} /></Field>
      <Field label={en ? 'Issued by' : 'Φορέας'}><input value={item.issuer} onChange={e => set({ issuer: e.target.value })} /></Field>
      <ManualDateField label={en ? 'Expires' : 'Λήξη'} value={item.expiresOn} onChange={value => set({ expiresOn: value })} optional />
    </FormGrid>
      <DocumentFileField item={item} set={set} files={files} onView={onViewFile} en={en} /></div>}
    {field === 'contacts' && <div className="resource-event-form">
      <FormGrid columns={3}>
        <Field label={en ? 'Name *' : 'Ονοματεπώνυμο *'}><input value={item.fullName} onChange={e => set({ fullName: e.target.value })} /></Field>
        <Field label={en ? 'Role' : 'Θέση'}><input value={item.jobTitle} onChange={e => set({ jobTitle: e.target.value })} /></Field>
        <Field label={en ? 'Phone' : 'Τηλέφωνο'}><input value={item.phone} onChange={e => set({ phone: e.target.value })} inputMode="tel" /></Field>
        <Field label="Email"><input value={item.email} onChange={e => set({ email: e.target.value })} inputMode="email" /></Field>
      </FormGrid>
      <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={2} value={item.notes} onChange={e => set({ notes: e.target.value })} /></Field>
    </div>}
    {field === 'nonconformities' && <div className="resource-event-form">
      <FormGrid columns={3}>
        <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={item.date} onChange={value => set({ date: value })} />
        <ChoiceField label={en ? 'Severity' : 'Σοβαρότητα'} value={item.severity} options={NONCONFORMITY_SEVERITIES.map(entry => ({ value: entry.value, label: entry.label[en ? 1 : 0] }))} onChange={value => set({ severity: value })} />
        <ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={item.status} options={[{ value: 'open', label: en ? 'Open' : 'Ανοιχτή' }, { value: 'closed', label: en ? 'Closed' : 'Έκλεισε' }]} onChange={value => set({ status: value, closedOn: value === 'closed' ? item.closedOn || new Date().toISOString().slice(0, 10) : '' })} />
      </FormGrid>
      <Field label={en ? 'What happened *' : 'Τι συνέβη *'}><textarea rows={3} value={item.description} onChange={e => set({ description: e.target.value })} /></Field>
      <FormGrid columns={3}>
        {item.status === 'closed' && <ManualDateField label={en ? 'Closed on' : 'Έκλεισε στις'} value={item.closedOn} onChange={value => set({ closedOn: value })} />}
        <Field label={en ? 'Corrective action code' : 'Κωδικός διορθωτικής ενέργειας'}><input value={item.capaCode} onChange={e => set({ capaCode: e.target.value })} placeholder="CAPA-…" /></Field>
      </FormGrid>
    </div>}
  </ObserverDialog>
}

const scoreOptions = (scale, en) => (Number(scale) === 10
  ? Array.from({ length: 11 }, (_, value) => ({ value, label: String(value) }))
  : SCORE_STEPS.map(step => ({ value: step.value, label: `${step.value} · ${step.label[en ? 1 : 0]}` })))

// An evaluation on a template: the template (one select when several apply), the
// criteria scored with the house select, the weighted result as it is worked out.
function TemplateEvaluationForm({ item, set, templates, category, language }) {
  const en = language === 'en'
  const recorded = !item.criteriaScores || item.criteriaScores === 'complete'
  // Kitchen: its own template, chosen for the supplier. Others: the evaluator picks among the non-kitchen templates.
  const kitchen = category === 'kitchen'
  const options = evaluationTemplates(templates, category)
  const known = options.some(template => template.id === item.templateId)
  const score = recorded ? weightedScore(item.criteria, item.scoreScale) : item.totalScore
  const result = resultFor(score, item.passThreshold, item.conditionalThreshold)
  const scored = (item.criteria || []).filter(criterion => criterion.score !== '' && criterion.score != null).length
  return <div className="resource-evaluation">
    <FormGrid columns={3}>
      {recorded && !kitchen && options.length > 0
        ? <ChoiceField label={en ? 'Evaluation template' : 'Πρότυπο αξιολόγησης'} value={known ? item.templateId : ''} placeholder={item.templateName} options={options.map(template => ({ value: template.id, label: template.name }))} onChange={value => { const template = templates.find(entry => entry.id === value); if (template) set(applyTemplate(item, template)) }} />
        : <Field label={kitchen ? (en ? 'Template (automatic for the kitchen)' : 'Πρότυπο (αυτόματα για την κουζίνα)') : (en ? 'Template' : 'Πρότυπο')}><input value={`${item.templateName || ''}${item.templateVersion ? ` · v${item.templateVersion}` : ''}`} disabled /></Field>}
      <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={item.evaluatedOn} onChange={value => set({ evaluatedOn: value })} />
      <Field label={en ? 'Evaluated by' : 'Αξιολογητής'}><input value={item.evaluator || ''} onChange={e => set({ evaluator: e.target.value })} /></Field>
    </FormGrid>
    {!recorded && <p className="resource-import-note">{en ? 'Total score only.' : 'Μόνο συνολική βαθμολογία.'}</p>}
    <div className="resource-criteria">{(item.criteria || []).map((criterion, index) => <ChoiceField key={criterion.criterionId || criterion.id || index} className="resource-criterion" disabled={!recorded}
      label={`${index + 1}. ${criterion.label} · ${en ? 'weight' : 'βάρος'} ${String(criterion.weight).replace('.', en ? '.' : ',')}`} value={criterion.score === '' || criterion.score == null ? '' : Number(criterion.score)} options={scoreOptions(item.scoreScale, en)}
      onChange={value => set({ criteria: item.criteria.map((entry, at) => (at === index ? { ...entry, score: value } : entry)) })} />)}</div>
    <div className="resource-evaluation-score">
      <span>{en ? 'Weighted score' : 'Σταθμισμένη βαθμολογία'}</span><strong>{formatPercent(score, language)}</strong><StatusBadge tone={approvalTone(result)}>{approvalLabel(result, language)}</StatusBadge>
      <small>{recorded ? `${scored} / ${(item.criteria || []).length} ${en ? 'scored' : 'βαθμολογήθηκαν'} · ` : ''}{en ? `approved ≥ ${item.passThreshold}%, conditional ≥ ${item.conditionalThreshold}%` : `εγκεκριμένος ≥ ${item.passThreshold}%, υπό όρους ≥ ${item.conditionalThreshold}%`}</small>
    </div>
    <Field label={en ? 'Notes' : 'Παρατηρήσεις'}><textarea rows={2} value={item.notes || ''} onChange={e => set({ notes: e.target.value })} /></Field>
  </div>
}

// An earlier evaluation on the six fixed criteria: it stays as it was made.
function LegacyEvaluationForm({ item, set, language }) {
  const en = language === 'en'
  const score = evaluationPercent(item)
  const result = evaluationApproval(item)
  return <div className="resource-evaluation">
    <FormGrid columns={3}>
      <Field label={en ? 'Template' : 'Πρότυπο'}><input value={en ? 'General criteria (before templates)' : 'Γενικά κριτήρια (πριν τα πρότυπα)'} disabled /></Field>
      <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={item.evaluatedOn} onChange={value => set({ evaluatedOn: value })} />
      <Field label={en ? 'Evaluated by' : 'Αξιολογητής'}><input value={item.evaluator} onChange={e => set({ evaluator: e.target.value })} /></Field>
    </FormGrid>
    <div className="resource-criteria">{CRITERIA.map(criterion => <ChoiceField key={criterion.key} className="resource-criterion" label={criterion.label[en ? 1 : 0]} value={Number(item.scores?.[criterion.key]) || ''} options={scoreOptions(5, en)} onChange={value => set({ scores: { ...item.scores, [criterion.key]: value } })} />)}</div>
    <div className="resource-evaluation-score"><span>{en ? 'Score' : 'Βαθμολογία'}</span><strong>{formatPercent(score, language)}</strong><StatusBadge tone={approvalTone(result)}>{approvalLabel(result, language)}</StatusBadge></div>
    <Field label={en ? 'Notes' : 'Παρατηρήσεις'}><textarea rows={2} value={item.notes} onChange={e => set({ notes: e.target.value })} /></Field>
  </div>
}
