import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Award, CheckSquare2, ClipboardList, Pencil, Plus, Stethoscope, Star, Trash2, Truck } from 'lucide-react'
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
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { exportRegistry } from '../../../core/export/registryExports'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { useResources, useResourceAccess, supplierNotes } from './ResourcesPanel'
import { removeSupplier, saveSupplier } from './resourceService'
import { APPROVED_AT, CERTIFICATION_TYPES, CONDITIONAL_AT, CRITERIA, CRITICALITY, NONCONFORMITY_SEVERITIES, SCORE_STEPS, SUPPLIER_CATEGORIES, approvalFor, approvalLabel, approvalTone, certificationState, certificationStateLabel, certificationStateTone, criticalityLabel, criticalityTone, equipmentStateLabel, equipmentStateTone, evaluationScore, newCertification, newEvaluation, newNonconformity, newSupplier, severityLabel, severityTone, supplierCapaSource, supplierCategoryLabel, supplierProblems } from './resourceModel'
import '../quality.css'
import './resources.css'

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })
const byNewest = field => (a, b) => String(b[field] || '').localeCompare(String(a[field] || ''))

export function SupplierRecordPage() {
  const { supplierId } = useParams()
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

  const row = useMemo(() => (isNew ? null : list.suppliers.find(item => item.id === supplierId) || null), [isNew, list.suppliers, supplierId])
  useEffect(() => { if (isNew) setDraft(current => current || newSupplier()); else if (row) setDraft(current => (current?.id === row.id ? current : structuredClone(row))) }, [isNew, row])
  const devices = useMemo(() => list.equipment.filter(item => item.supplierId === supplierId), [list.equipment, supplierId])

  if (list.loading && !draft) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (!isNew && !row) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Supplier not found' : 'Ο προμηθευτής δεν βρέθηκε'}</strong></div></Page>
  if (!draft) return null

  const locked = !access.canManage
  const set = next => setDraft(current => ({ ...current, ...next }))

  // Saves the supplier as it is, or with one list changed (an evaluation, a certificate, a nonconformity).
  async function persist(next = draft, message) {
    const problems = supplierProblems(next, language)
    if (problems.length) { notify(`${en ? 'Fill in:' : 'Συμπληρώστε:'} ${problems.join(' · ')}`, 'error'); setTab('details'); return false }
    setSaving(true)
    try {
      const saved = await saveSupplier(tenant?.id, next)
      notify(message || (en ? 'Supplier saved.' : 'Ο προμηθευτής αποθηκεύτηκε.'), 'success')
      await list.reload()
      if (isNew) navigate(`/quality/suppliers/${saved.id}`, { replace: true })
      else setDraft(structuredClone(saved))
      return true
    } catch (error) { console.error(error); notify(en ? 'The supplier could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση.', 'error'); return false } finally { setSaving(false) }
  }
  const saveItem = (field, item, message) => persist({ ...draft, [field]: draft[field].some(entry => entry.id === item.id) ? draft[field].map(entry => (entry.id === item.id ? item : entry)) : [...draft[field], item] }, message)
  async function dropItem(field, item) {
    const ok = await confirm({ title: en ? 'Delete' : 'Διαγραφή', message: en ? 'The entry is deleted.' : 'Η εγγραφή διαγράφεται.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (ok) await persist({ ...draft, [field]: draft[field].filter(entry => entry.id !== item.id) }, en ? 'Deleted.' : 'Διαγράφηκε.')
  }
  async function remove() {
    const ok = await confirm({ title: en ? 'Delete supplier' : 'Διαγραφή προμηθευτή', message: en ? `The supplier with its evaluations is deleted; ${devices.length} devices keep no supplier. A supplier no longer used is better marked inactive.` : `Διαγράφεται ο προμηθευτής με τις αξιολογήσεις του· ${devices.length} εξοπλισμοί μένουν χωρίς προμηθευτή. Για προμηθευτή που δεν χρησιμοποιείται πια, προτιμήστε «Ανενεργός».`, confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    try { await removeSupplier(tenant?.id, row.id); notify(en ? 'Supplier deleted.' : 'Ο προμηθευτής διαγράφηκε.', 'success'); goBack() } catch (error) { console.error(error); notify(en ? 'The supplier could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  const openCapa = item => navigate('/quality/capas/new', { state: { qualitySource: supplierCapaSource(row, item, language) } })

  const evaluations = [...(draft.evaluations || [])].sort(byNewest('evaluatedOn'))
  const certifications = draft.certifications || []
  const nonconformities = [...(draft.nonconformities || [])].sort(byNewest('date'))
  const openCount = nonconformities.filter(item => item.status !== 'closed').length
  const tabs = isNew ? [{ id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: ClipboardList }] : [
    { id: 'evaluations', label: en ? `Evaluations ${evaluations.length}` : `Αξιολογήσεις ${evaluations.length}`, icon: Star },
    { id: 'nonconformities', label: en ? `Nonconformities ${openCount}` : `Μη συμμορφώσεις ${openCount}`, icon: AlertTriangle },
    { id: 'certifications', label: en ? `Certificates ${certifications.length}` : `Πιστοποιητικά ${certifications.length}`, icon: Award },
    { id: 'equipment', label: en ? `Equipment ${devices.length}` : `Εξοπλισμός ${devices.length}`, icon: Stethoscope },
    { id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: ClipboardList },
  ]
  const notes = row ? supplierNotes(row, language) : []
  // The supplier's file: every evaluation and nonconformity, for the yearly review.
  const exportFile = () => exportRegistry({
    name: `${row.code}-${en ? 'supplier-file' : 'fakelos-promithefti'}`,
    headers: en ? ['Kind', 'Date', 'Details', 'Score % / severity', 'Result / status'] : ['Είδος', 'Ημερομηνία', 'Στοιχεία', 'Βαθμολογία % / σοβαρότητα', 'Αποτέλεσμα / κατάσταση'],
    rows: [...evaluations.map(item => { const score = evaluationScore(item.scores, item.weights); return [en ? 'Evaluation' : 'Αξιολόγηση', item.evaluatedOn, CRITERIA.map(criterion => `${criterion.label[en ? 1 : 0]}: ${item.scores?.[criterion.key] || '—'}`).join('; '), score ?? '', approvalLabel(approvalFor(score), language)] }),
      ...nonconformities.map(item => [en ? 'Nonconformity' : 'Μη συμμόρφωση', item.date, item.description, severityLabel(item.severity, language), item.status === 'closed' ? (en ? 'Closed' : 'Έκλεισε') : (en ? 'Open' : 'Ανοιχτή')]),
      ...certifications.map(item => [en ? 'Certificate' : 'Πιστοποιητικό', item.expiresOn, [item.type, item.number, item.issuer].filter(Boolean).join(' · '), '', certificationStateLabel(certificationState(item), language)])],
  })
  const headerActions = !isNew && <div className="row-actions">
    <ExportMenu onExcel={exportFile} />
    {access.canManage && <Button variant="secondary" onClick={() => { setTab('evaluations'); setEditing({ field: 'evaluations', item: newEvaluation() }) }}><Star size={15} />{en ? 'Evaluate' : 'Αξιολόγηση'}</Button>}
    {access.canManage && <Button variant="secondary" onClick={() => { setTab('nonconformities'); setEditing({ field: 'nonconformities', item: newNonconformity() }) }}><AlertTriangle size={15} />{en ? 'Nonconformity' : 'Μη συμμόρφωση'}</Button>}
    {access.canManage && <IconButton tone="danger" label={en ? 'Delete supplier' : 'Διαγραφή προμηθευτή'} onClick={remove}><Trash2 size={16} /></IconButton>}
  </div>
  const add = (field, item) => !locked && <Button onClick={() => setEditing({ field, item })}><Plus size={15} />{en ? 'Add' : 'Προσθήκη'}</Button>

  return <Page fill><EntityRecordShell className="quality-record-shell resource-record-shell workspace-fill" avatar={<Truck size={19} />} eyebrow={row?.code || (en ? 'New supplier' : 'Νέος προμηθευτής')} title={draft.name || (en ? 'New supplier' : 'Νέος προμηθευτής')}
    subtitle={row ? [supplierCategoryLabel(row.category, language), row.taxId && `${en ? 'Tax ID' : 'ΑΦΜ'} ${row.taxId}`, row.products].filter(Boolean).join(' · ') : ''}
    status={row && <span className="resource-status"><StatusBadge tone={approvalTone(row.approval)}>{approvalLabel(row.approval, language)}{row.score != null ? ` · ${row.score}%` : ''}</StatusBadge><StatusBadge tone={criticalityTone(row.criticality)}>{en ? 'Criticality' : 'Κρισιμότητα'}: {criticalityLabel(row.criticality, language)}</StatusBadge>{row.status === 'inactive' && <StatusBadge tone="neutral">{en ? 'Inactive' : 'Ανενεργός'}</StatusBadge>}</span>}
    headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {tab === 'evaluations' && row && <RecordTabPanel title={en ? 'Yearly evaluation' : 'Ετήσια αξιολόγηση'} subtitle={en ? `Six criteria scored 1–5. ${APPROVED_AT}% and above: approved · ${CONDITIONAL_AT}–${APPROVED_AT - 1}%: under monitoring · below ${CONDITIONAL_AT}%: not accepted.` : `Έξι κριτήρια με βαθμό 1–5. ${APPROVED_AT}% και άνω: εγκεκριμένος · ${CONDITIONAL_AT}–${APPROVED_AT - 1}%: υπό παρακολούθηση · κάτω από ${CONDITIONAL_AT}%: μη αποδεκτός.`} actions={add('evaluations', newEvaluation())}>
      {notes.length > 0 && <div className="resource-notes resource-notes-wide">{notes.map(note => <StatusBadge key={note.key} tone={note.tone}>{note.label}</StatusBadge>)}{row.evaluationDue && <StatusBadge tone="warning">{en ? 'Evaluation due' : 'Οφείλεται αξιολόγηση'}</StatusBadge>}</div>}
      <RegistryTable className="quality-table" rows={evaluations} rowKey={item => item.id}
        columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, ...CRITERIA.map(item => ({ key: item.key, label: item.label[en ? 1 : 0] })), { key: 'score', label: en ? 'Score' : 'Βαθμολογία' }, { key: 'actions', label: '' }]}
        emptyTitle={en ? 'Not evaluated yet' : 'Δεν έχει αξιολογηθεί'} emptyText={en ? 'Evaluate the supplier once a year, and after a serious nonconformity.' : 'Αξιολογήστε τον προμηθευτή μία φορά τον χρόνο και μετά από σοβαρή μη συμμόρφωση.'}
        renderRow={item => { const score = evaluationScore(item.scores, item.weights); return <>
          <td className="nowrap-cell">{formatDay(item.evaluatedOn, language)}{item.evaluator && <small>{item.evaluator}</small>}</td>
          {CRITERIA.map(criterion => <td key={criterion.key} className="resource-score-cell">{item.scores?.[criterion.key] || '—'}</td>)}
          <td><StatusBadge tone={approvalTone(approvalFor(score))}>{score != null ? `${score}%` : '—'}</StatusBadge>{item.notes && <small>{item.notes}</small>}</td>
          <td><div className="row-actions">{!locked && <IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => setEditing({ field: 'evaluations', item: structuredClone(item) })}><Pencil size={14} /></IconButton>}{!locked && <IconButton size="sm" tone="danger" label={en ? 'Delete' : 'Διαγραφή'} onClick={() => dropItem('evaluations', item)}><Trash2 size={14} /></IconButton>}</div></td>
        </> }} />
    </RecordTabPanel>}
    {tab === 'nonconformities' && row && <RecordTabPanel title={en ? 'Nonconformities' : 'Μη συμμορφώσεις'} subtitle={en ? 'A defective batch, a late or wrong delivery, missing documents. A serious one becomes a corrective action.' : 'Ελαττωματική παρτίδα, καθυστερημένη ή λάθος παράδοση, ελλιπή έγγραφα. Μια σοβαρή γίνεται διορθωτική ενέργεια.'} actions={add('nonconformities', newNonconformity())}>
      <RegistryTable className="quality-table" rows={nonconformities} rowKey={item => item.id}
        columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'description', label: en ? 'Description' : 'Περιγραφή' }, { key: 'severity', label: en ? 'Severity' : 'Σοβαρότητα' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }, { key: 'actions', label: '' }]}
        emptyTitle={en ? 'No nonconformities' : 'Δεν υπάρχουν μη συμμορφώσεις'}
        renderRow={item => <>
          <td className="nowrap-cell">{formatDay(item.date, language)}</td>
          <td className="resource-description-cell">{item.description}{item.capaCode && <small>{en ? 'Corrective action' : 'Διορθωτική ενέργεια'} {item.capaCode}</small>}</td>
          <td><StatusBadge tone={severityTone(item.severity)}>{severityLabel(item.severity, language)}</StatusBadge></td>
          <td><StatusBadge tone={item.status === 'closed' ? 'success' : 'info'}>{item.status === 'closed' ? (en ? 'Closed' : 'Έκλεισε') : (en ? 'Open' : 'Ανοιχτή')}</StatusBadge>{item.closedOn && <small>{formatDay(item.closedOn, language)}</small>}</td>
          <td><div className="row-actions">
            {!locked && item.status !== 'closed' && <Button variant="secondary" onClick={() => openCapa(item)}><CheckSquare2 size={15} />{en ? 'Corrective action' : 'Διορθωτική ενέργεια'}</Button>}
            {!locked && <IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => setEditing({ field: 'nonconformities', item: structuredClone(item) })}><Pencil size={14} /></IconButton>}
            {!locked && <IconButton size="sm" tone="danger" label={en ? 'Delete' : 'Διαγραφή'} onClick={() => dropItem('nonconformities', item)}><Trash2 size={14} /></IconButton>}
          </div></td>
        </>} />
    </RecordTabPanel>}
    {tab === 'certifications' && row && <RecordTabPanel title={en ? 'Certificates' : 'Πιστοποιητικά'} subtitle={en ? 'ISO certificates, CE marking, licences: the list warns 60 days before expiry.' : 'Πιστοποιητικά ISO, σήμανση CE, άδειες: η λίστα ειδοποιεί 60 ημέρες πριν τη λήξη.'} actions={add('certifications', newCertification())}>
      <RegistryTable className="quality-table" rows={certifications} rowKey={item => item.id}
        columns={[{ key: 'type', label: en ? 'Certificate' : 'Πιστοποιητικό' }, { key: 'number', label: en ? 'Number' : 'Αριθμός' }, { key: 'issuer', label: en ? 'Issued by' : 'Φορέας' }, { key: 'expires', label: en ? 'Expires' : 'Λήξη' }, { key: 'actions', label: '' }]}
        emptyTitle={en ? 'No certificates' : 'Δεν υπάρχουν πιστοποιητικά'}
        renderRow={item => { const state = certificationState(item); return <>
          <td><strong>{item.type}</strong></td>
          <td>{item.number || '—'}</td>
          <td>{item.issuer || '—'}</td>
          <td className="nowrap-cell">{formatDay(item.expiresOn, language) || '—'} <StatusBadge tone={certificationStateTone(state)}>{certificationStateLabel(state, language)}</StatusBadge></td>
          <td><div className="row-actions">{!locked && <IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => setEditing({ field: 'certifications', item: structuredClone(item) })}><Pencil size={14} /></IconButton>}{!locked && <IconButton size="sm" tone="danger" label={en ? 'Delete' : 'Διαγραφή'} onClick={() => dropItem('certifications', item)}><Trash2 size={14} /></IconButton>}</div></td>
        </> }} />
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
    {tab === 'details' && <RecordTabPanel title={en ? 'Details' : 'Στοιχεία'} footer={!locked && <div className="inline-edit-footer"><SaveButton loading={saving} disabled={saving} onClick={() => persist()}>{isNew ? (en ? 'Register supplier' : 'Καταχώριση προμηθευτή') : (en ? 'Save' : 'Αποθήκευση')}</SaveButton></div>}>
      <div className="lo-form-cards">
        <FormCard wide title={en ? 'Supplier' : 'Προμηθευτής'}>
          <FormGrid columns={3}>
            <Field label={en ? 'Name *' : 'Επωνυμία *'}><input value={draft.name} disabled={locked} onChange={e => set({ name: e.target.value })} /></Field>
            <SearchableSelect label={en ? 'Category' : 'Κατηγορία'} value={draft.category} disabled={locked} options={SUPPLIER_CATEGORIES.map(item => ({ value: item.value, label: item.label[en ? 1 : 0], keywords: item.label.join(' ') }))} onChange={value => set({ category: value || 'consumables' })} {...selectText(en)} />
            <Field label={en ? 'Tax ID' : 'ΑΦΜ'}><input value={draft.taxId} disabled={locked} onChange={e => set({ taxId: e.target.value })} inputMode="numeric" /></Field>
          </FormGrid>
          <Field label={en ? 'Products / services' : 'Προϊόντα / υπηρεσίες'}><textarea rows={2} value={draft.products} disabled={locked} onChange={e => set({ products: e.target.value })} /></Field>
          <FormGrid columns={3}>
            <ChoiceField label={en ? 'Criticality' : 'Κρισιμότητα'} value={draft.criticality} options={CRITICALITY.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => !locked && set({ criticality: value })} />
            <ManualDateField label={en ? 'Contract ends' : 'Λήξη σύμβασης'} value={draft.contractEndsOn} disabled={locked} onChange={value => set({ contractEndsOn: value })} optional />
            <ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={draft.status} options={[{ value: 'active', label: en ? 'Active' : 'Ενεργός' }, { value: 'inactive', label: en ? 'Inactive' : 'Ανενεργός' }]} onChange={value => !locked && set({ status: value })} />
          </FormGrid>
        </FormCard>
        <FormCard wide title={en ? 'Contact' : 'Επικοινωνία'}>
          <FormGrid columns={3}>
            <Field label={en ? 'Contact person' : 'Υπεύθυνος επικοινωνίας'}><input value={draft.contactName} disabled={locked} onChange={e => set({ contactName: e.target.value })} /></Field>
            <Field label={en ? 'Phone' : 'Τηλέφωνο'}><input value={draft.phone} disabled={locked} onChange={e => set({ phone: e.target.value })} inputMode="tel" /></Field>
            <Field label="Email"><input value={draft.email} disabled={locked} onChange={e => set({ email: e.target.value })} inputMode="email" /></Field>
            <Field label={en ? 'Address' : 'Διεύθυνση'}><input value={draft.address} disabled={locked} onChange={e => set({ address: e.target.value })} /></Field>
            <Field label={en ? 'Website' : 'Ιστότοπος'}><input value={draft.website} disabled={locked} onChange={e => set({ website: e.target.value })} /></Field>
          </FormGrid>
          <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={3} value={draft.notes} disabled={locked} onChange={e => set({ notes: e.target.value })} /></Field>
        </FormCard>
      </div>
    </RecordTabPanel>}
    {editing && <ItemDialog editing={editing} setEditing={setEditing} language={language} saving={saving} onSave={async () => { if (await saveItem(editing.field, editing.item)) setEditing(null) }} />}
  </EntityRecordShell></Page>
}

const TITLES = { evaluations: ['Αξιολόγηση προμηθευτή', 'Supplier evaluation'], certifications: ['Πιστοποιητικό', 'Certificate'], nonconformities: ['Μη συμμόρφωση', 'Nonconformity'] }

function ItemDialog({ editing, setEditing, language, saving, onSave }) {
  const en = language === 'en'
  const { field, item } = editing
  const set = next => setEditing(current => ({ ...current, item: { ...current.item, ...next } }))
  const score = field === 'evaluations' ? evaluationScore(item.scores, item.weights) : null
  const ready = field === 'evaluations' ? Boolean(item.evaluatedOn) && CRITERIA.every(criterion => Number(item.scores?.[criterion.key]) >= 1)
    : field === 'certifications' ? Boolean(String(item.type || '').trim())
    : Boolean(item.date) && String(item.description || '').trim().length > 2
  return <ObserverDialog width={field === 'evaluations' ? 'wide' : undefined} title={TITLES[field][en ? 1 : 0]} onClose={() => setEditing(null)}
    footer={<DialogActions onCancel={() => setEditing(null)} onSave={onSave} saveLabel={en ? 'Save' : 'Αποθήκευση'} disabled={saving || !ready} />}>
    {field === 'evaluations' && <div className="resource-evaluation">
      <FormGrid columns={2}>
        <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={item.evaluatedOn} onChange={value => set({ evaluatedOn: value })} />
        <Field label={en ? 'Evaluated by' : 'Αξιολογητής'}><input value={item.evaluator} onChange={e => set({ evaluator: e.target.value })} /></Field>
      </FormGrid>
      <div className="resource-criteria">{CRITERIA.map(criterion => <ChoiceField key={criterion.key} className="resource-criterion" label={criterion.label[en ? 1 : 0]} value={Number(item.scores?.[criterion.key]) || ''} options={SCORE_STEPS.map(step => ({ value: step.value, label: `${step.value} · ${step.label[en ? 1 : 0]}` }))} onChange={value => set({ scores: { ...item.scores, [criterion.key]: value } })} />)}</div>
      <div className="resource-evaluation-score"><span>{en ? 'Score' : 'Βαθμολογία'}</span><strong>{score != null ? `${score}%` : '—'}</strong><StatusBadge tone={approvalTone(approvalFor(score))}>{approvalLabel(approvalFor(score), language)}</StatusBadge></div>
      <Field label={en ? 'Notes' : 'Παρατηρήσεις'}><textarea rows={2} value={item.notes} onChange={e => set({ notes: e.target.value })} /></Field>
    </div>}
    {field === 'certifications' && <FormGrid columns={2}>
      <SearchableSelect label={en ? 'Certificate *' : 'Πιστοποιητικό *'} value={item.type} options={CERTIFICATION_TYPES.map(type => ({ value: type, label: type }))} allowCustom customLabel={value => `«${value}»`} onChange={value => set({ type: value || '' })} {...selectText(en)} />
      <Field label={en ? 'Number' : 'Αριθμός'}><input value={item.number} onChange={e => set({ number: e.target.value })} /></Field>
      <Field label={en ? 'Issued by' : 'Φορέας'}><input value={item.issuer} onChange={e => set({ issuer: e.target.value })} /></Field>
      <ManualDateField label={en ? 'Expires' : 'Λήξη'} value={item.expiresOn} onChange={value => set({ expiresOn: value })} optional />
    </FormGrid>}
    {field === 'nonconformities' && <div className="resource-event-form">
      <FormGrid columns={2}>
        <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={item.date} onChange={value => set({ date: value })} />
        <ChoiceField label={en ? 'Severity' : 'Σοβαρότητα'} value={item.severity} options={NONCONFORMITY_SEVERITIES.map(entry => ({ value: entry.value, label: entry.label[en ? 1 : 0] }))} onChange={value => set({ severity: value })} />
      </FormGrid>
      <Field label={en ? 'What happened *' : 'Τι συνέβη *'}><textarea rows={3} value={item.description} onChange={e => set({ description: e.target.value })} /></Field>
      <FormGrid columns={3}>
        <ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={item.status} options={[{ value: 'open', label: en ? 'Open' : 'Ανοιχτή' }, { value: 'closed', label: en ? 'Closed' : 'Έκλεισε' }]} onChange={value => set({ status: value, closedOn: value === 'closed' ? item.closedOn || new Date().toISOString().slice(0, 10) : '' })} />
        {item.status === 'closed' && <ManualDateField label={en ? 'Closed on' : 'Έκλεισε στις'} value={item.closedOn} onChange={value => set({ closedOn: value })} />}
        <Field label={en ? 'Corrective action code' : 'Κωδικός διορθωτικής ενέργειας'}><input value={item.capaCode} onChange={e => set({ capaCode: e.target.value })} placeholder="CAPA-…" /></Field>
      </FormGrid>
    </div>}
  </ObserverDialog>
}
