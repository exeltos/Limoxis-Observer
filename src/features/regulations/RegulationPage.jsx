import { useCallback, useEffect, useMemo, useState } from 'react'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { useLocation, useParams } from 'react-router-dom'
import { Archive, ArchiveRestore, BookOpen, CheckCircle2, FilePenLine, History, ListChecks, PenLine, RefreshCcw, Sparkles } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { Field } from '../../design-system/Field'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { IconButton } from '../../design-system/IconButton'
import { StatusBadge } from '../../design-system/StatusBadge'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RouteLoading } from '../../design-system/RouteLoading'
import { printElement } from '../../design-system/printElement'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuth } from '../../core/auth/AuthContext'
import { formatDay } from '../../core/i18n/formatDay'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { SIGNING_ROLES, categoryLabel, contentFromTemplate, contentStats, fillItems, regulationProblems, regulationStatus, statusLabel, statusTone, takeTemplateSection, templateChanges, validSignatures } from './regulationModel'
import { sanitizeHtml } from './regulationHtml'
import { approveDraft, discardDraft, loadEdition, loadRegulation, loadTemplate, loadTemplateVersion, saveDraft, signDraft, updateRegulation } from './regulationService'
import { useRegulationAccess } from './regulationAccess'
import { regulationDocumentHtml, downloadRegulationWord } from './regulationDocument'
import { RegulationBook } from './RegulationBook'
import { RegulationEditor } from './RegulationEditor'
import { RegulationFill } from './RegulationFill'
import { RegulationSignatures } from './RegulationSignatures'
import './regulations.css'

export function RegulationPage() {
  const { regulationId } = useParams()
  const location = useLocation()
  const { goBack } = useContextualNavigation('/regulations')
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const { tenant } = useTenant()
  const auth = useAuth()
  const { canManage, signRoles } = useRegulationAccess()
  const [data, setData] = useState(null)
  const [template, setTemplate] = useState(null)
  const [baseTemplate, setBaseTemplate] = useState(null)
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState(location.state?.tab || 'read')
  const [readMode, setReadMode] = useState('current')
  const [edition, setEdition] = useState(null)
  const [approving, setApproving] = useState(null)
  const [editMode, setEditMode] = useState(null)
  const [editorAt, setEditorAt] = useState(null)

  const reload = useCallback(async () => {
    try {
      const found = await loadRegulation(tenant?.id, regulationId)
      if (!found) { setData(false); return }
      setData(found)
      setDraft(found.draft ? structuredClone(found.draft) : null)
      setDirty(false)
      if (found.regulation.templateKey) {
        const latest = await loadTemplate(found.regulation.templateKey)
        setTemplate(latest)
        setBaseTemplate(latest && found.regulation.templateVersion && latest.version > found.regulation.templateVersion ? await loadTemplateVersion(latest.key, found.regulation.templateVersion) : null)
      }
    } catch { setData(false) }
  }, [tenant?.id, regulationId])
  useEffect(() => { void reload() }, [reload])

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return undefined
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const regulation = data?.regulation
  const status = regulation ? regulationStatus({ ...regulation, hasDraft: Boolean(draft) }) : 'draft'
  const hasApproved = Boolean(regulation?.edition)
  const reading = edition ? 'edition' : (!hasApproved || (readMode === 'draft' && draft)) ? 'draft' : 'current'
  const readContent = edition?.content || (reading === 'draft' ? draft?.content : regulation?.content) || { chapters: [] }
  const newerTemplate = Boolean(template && regulation?.templateVersion && template.version > regulation.templateVersion)
  // Comparing with the template reads the whole text: only on the template tab.
  const changes = useMemo(() => (tab === 'updates' && template && regulation ? templateChanges({ base: baseTemplate, latest: template.content, current: draft?.content || regulation.content }) : []), [tab, template, baseTemplate, regulation, draft])
  const problems = useMemo(() => (regulation ? regulationProblems(regulation, draft?.content, language) : []), [regulation, draft, language])
  const toFill = useMemo(() => fillItems(draft?.content).length, [draft])
  const templateFills = useMemo(() => (template ? fillItems(contentFromTemplate(template)).length : 0), [template])
  const signed = useMemo(() => (draft?.revision ? validSignatures(data?.signatures || [], draft.revision) : []), [data, draft])

  const mode = editMode || (toFill ? 'fill' : 'write')
  if (data === null) return <RouteLoading />
  if (data === false) return <Page title={en ? 'Regulation' : 'Κανονισμός'}><div className="data-access-state error" role="alert"><span>{en ? 'The regulation was not found.' : 'Ο κανονισμός δεν βρέθηκε.'}</span><Button variant="secondary" onClick={goBack}>{en ? 'Back' : 'Πίσω'}</Button></div></Page>

  const meta = {
    title: regulation.title, organization: tenant?.name || '', code: regulation.code, category: categoryLabel(regulation.category, language),
    edition: reading === 'edition' ? edition.edition : reading === 'draft' ? (hasApproved ? `${regulation.edition + 1} (${en ? 'draft' : 'προσχέδιο'})` : '') : regulation.edition,
    editionLabel: en ? 'Edition' : 'Έκδοση',
    issued: reading === 'edition' ? formatDay(edition.issuedOn, language) : reading === 'draft' ? '' : formatDay(regulation.issuedOn, language),
    approvedBy: reading === 'edition' ? edition.approvedByName : reading === 'draft' ? '' : regulation.approvedByName,
    status: reading === 'draft' ? (en ? 'Draft' : 'Προσχέδιο') : reading === 'edition' && edition.edition !== regulation.edition ? (en ? 'Earlier edition' : 'Προηγούμενη έκδοση') : statusLabel('approved', language),
    template: template ? `${template.title} · v${regulation.templateVersion || template.version}` : '',
    draft: reading === 'draft',
    signatures: SIGNING_ROLES.map(role => {
      const found = (reading === 'edition' ? edition.signatures : reading === 'draft' ? signed : regulation.signatures)?.find(item => item.role === role.value)
      return { role: role.value, label: role.label[en ? 1 : 0], name: found?.name || '', title: found?.title || '', image: found?.image || '', date: found ? formatDay(found.signedAt, language) : '' }
    }),
  }

  const startRevision = () => { setDraft({ content: structuredClone(regulation.content), changeNote: '' }); setDirty(true); setTab('edit') }
  // Saving reloads the draft: its revision tells which signatures still hold.
  const storeDraft = async () => {
    const content = { ...draft.content, chapters: draft.content.chapters.map(chapter => ({ ...chapter, sections: chapter.sections.map(section => ({ ...section, html: sanitizeHtml(section.html) })) })) }
    await saveDraft(tenant?.id, regulation.id, content, draft.changeNote)
    await reload()
  }
  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      await storeDraft()
      notify(en ? 'The draft was saved.' : 'Το προσχέδιο αποθηκεύτηκε.', 'success')
    } catch { notify(en ? 'The draft could not be saved.' : 'Το προσχέδιο δεν αποθηκεύτηκε.', 'error') } finally { setSaving(false) }
  }
  async function sign(signature) {
    try {
      if (dirty) await storeDraft()
      await signDraft(regulation.id, signature)
      await reload()
      notify(en ? 'The draft was signed.' : 'Το προσχέδιο υπογράφηκε.', 'success')
      return true
    } catch { notify(en ? 'The signature was not saved.' : 'Η υπογραφή δεν αποθηκεύτηκε.', 'error'); return false }
  }
  async function discard() {
    if (!(await confirm({ title: en ? 'Leave the revision?' : 'Εγκατάλειψη της αναθεώρησης;', message: en ? 'The changes of this draft are lost; the edition in force stays as it is.' : 'Οι αλλαγές του προσχεδίου χάνονται· η έκδοση σε ισχύ μένει ως έχει.', danger: true }))) return
    try { await discardDraft(tenant?.id, regulation.id); await reload(); setTab('read') } catch { notify(en ? 'Could not leave the revision.' : 'Δεν ήταν δυνατή η εγκατάλειψη.', 'error') }
  }
  async function approve() {
    setSaving(true)
    try {
      if (approving.changeNote !== (draft.changeNote || '')) await saveDraft(tenant?.id, regulation.id, draft.content, approving.changeNote)
      const number = await approveDraft(tenant?.id, regulation.id, approving)
      setApproving(null)
      notify(en ? `Edition ${number} is now in force.` : `Η έκδοση ${number} είναι πλέον σε ισχύ.`, 'success')
      setReadMode('current'); setEdition(null); setTab('read')
      await reload()
    } catch (error) { notify(String(error?.message || '').includes('SIGNATURES') ? (en ? 'Both signatures are needed, for the text as it is now.' : 'Χρειάζονται και οι δύο υπογραφές, για το κείμενο όπως είναι τώρα.') : (en ? 'The edition could not be approved.' : 'Η έκδοση δεν εγκρίθηκε.'), 'error') } finally { setSaving(false) }
  }
  async function takeSection(change) {
    const base = draft?.content || structuredClone(regulation.content)
    setDraft(current => ({ changeNote: current?.changeNote || '', ...current, content: takeTemplateSection(base, template.content, change.origin, { hospital: tenant?.name || '' }) }))
    setDirty(true)
    notify(en ? 'Added to the draft. Review it and save.' : 'Προστέθηκε στο προσχέδιο. Ελέγξτε το και αποθηκεύστε.', 'success')
  }
  function takeAll() {
    let content = draft?.content || structuredClone(regulation.content)
    for (const change of changes) if (change.kind !== 'removed') content = takeTemplateSection(content, template.content, change.origin, { hospital: tenant?.name || '' })
    setDraft(current => ({ changeNote: current?.changeNote || '', ...current, content }))
    setDirty(true)
    notify(en ? 'Every change was added to the draft. Review it and save.' : 'Όλες οι αλλαγές προστέθηκαν στο προσχέδιο. Ελέγξτε το και αποθηκεύστε.', 'success')
  }
  async function markReviewed() {
    try { await updateRegulation(tenant?.id, regulation.id, { templateVersion: template.version }); notify(en ? 'The template update was marked as reviewed.' : 'Η ενημέρωση του προτύπου σημειώθηκε ως ελεγμένη.', 'success'); await reload() } catch { notify(en ? 'Could not save.' : 'Δεν αποθηκεύτηκε.', 'error') }
  }
  async function toggleArchive() {
    const archived = !regulation.archived
    if (archived && !(await confirm({ title: en ? 'Archive the regulation?' : 'Αρχειοθέτηση του κανονισμού;', message: en ? 'It leaves the shelf; its editions are kept.' : 'Φεύγει από τη βιβλιοθήκη· οι εκδόσεις του φυλάσσονται.' }))) return
    try { await updateRegulation(tenant?.id, regulation.id, { archived }); await reload() } catch { notify(en ? 'Could not save.' : 'Δεν αποθηκεύτηκε.', 'error') }
  }
  async function openEdition(row) {
    try { const found = await loadEdition(regulation.id, row.edition); if (found) { setEdition(found); setTab('read') } } catch { notify(en ? 'The edition could not be opened.' : 'Η έκδοση δεν άνοιξε.', 'error') }
  }
  const print = () => { const node = document.createElement('div'); node.innerHTML = regulationDocumentHtml(readContent, meta); printElement(node.firstElementChild, { title: `${regulation.code} ${regulation.title}` }) }

  const stats = contentStats(readContent)
  const tabs = [
    { id: 'read', label: en ? 'Read' : 'Ανάγνωση', icon: BookOpen },
    ...(canManage ? [{ id: 'edit', label: draft ? (en ? 'Draft' : 'Προσχέδιο') : (en ? 'Revise' : 'Αναθεώρηση'), icon: FilePenLine }] : []),
    ...(canManage && template ? [{ id: 'updates', label: newerTemplate ? (en ? `Template v${template.version}` : `Πρότυπο v${template.version}`) : (en ? 'Template' : 'Πρότυπο'), icon: newerTemplate ? Sparkles : RefreshCcw }] : []),
    { id: 'editions', label: en ? `Editions ${data.editions.length}` : `Εκδόσεις ${data.editions.length}`, icon: History },
  ]
  const headerActions = <div className="row-actions">
    <PrintExportActions onPrint={print} onExport={() => downloadRegulationWord(readContent, meta)} exportLabel={en ? 'Download Word' : 'Λήψη Word'} />
    {canManage && hasApproved && <IconButton label={regulation.archived ? (en ? 'Restore from the archive' : 'Επαναφορά από το αρχείο') : (en ? 'Archive' : 'Αρχειοθέτηση')} onClick={toggleArchive}>{regulation.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}</IconButton>}
  </div>

  return <Page fill><EntityRecordShell className="reg-record-shell workspace-fill" avatar={<BookOpen size={19} />} eyebrow={`${regulation.code} · ${categoryLabel(regulation.category, language)}`} title={regulation.title}
    subtitle={hasApproved ? `${en ? 'Edition' : 'Έκδοση'} ${regulation.edition} · ${en ? 'in force since' : 'σε ισχύ από'} ${formatDay(regulation.issuedOn, language)}${regulation.approvedByName ? ` · ${regulation.approvedByName}` : ''}` : (en ? 'Not approved yet' : 'Δεν έχει εγκριθεί ακόμη')}
    status={<StatusBadge tone={statusTone(status)}>{statusLabel(status, language)}</StatusBadge>} headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={next => { if (next !== 'read') setEdition(null); setTab(next) }} onBack={goBack}>
    {tab === 'read' && <RecordTabPanel className="reg-read-panel" title={edition ? (en ? `Edition ${edition.edition}` : `Έκδοση ${edition.edition}`) : reading === 'draft' ? (en ? 'Draft' : 'Προσχέδιο') : (en ? 'Edition in force' : 'Έκδοση σε ισχύ')}
      subtitle={`${stats.chapters} ${en ? 'chapters' : 'κεφάλαια'} · ${stats.sections} ${en ? 'sections' : 'ενότητες'} · ${stats.words.toLocaleString(language === 'en' ? 'en-GB' : 'el-GR')} ${en ? 'words' : 'λέξεις'}${reading === 'draft' ? (en ? ' · not in force yet' : ' · δεν ισχύει ακόμη') : ''}`}
      actions={edition ? <Button variant="secondary" onClick={() => setEdition(null)}>{en ? 'Back to the edition in force' : 'Επιστροφή στην έκδοση σε ισχύ'}</Button> : canManage && hasApproved && draft ? <ModeSwitch ariaLabel={en ? 'Which text' : 'Ποιο κείμενο'} value={readMode} onChange={setReadMode} options={[{ value: 'current', label: en ? 'In force' : 'Σε ισχύ' }, { value: 'draft', label: en ? 'Draft' : 'Προσχέδιο' }]} /> : null}>
      {stats.sections ? <RegulationBook key={`${reading}-${edition?.edition || ''}`} content={readContent} meta={meta} language={language} /> : <div className="reg-empty"><BookOpen size={28} /><strong>{en ? 'Nothing to read yet' : 'Δεν υπάρχει ακόμη κείμενο'}</strong>{canManage && <Button onClick={() => setTab('edit')}>{en ? 'Write the draft' : 'Σύνταξη προσχεδίου'}</Button>}</div>}
    </RecordTabPanel>}
    {tab === 'edit' && canManage && <RecordTabPanel className="reg-edit-panel" title={draft ? (hasApproved ? (en ? `Draft of edition ${regulation.edition + 1}` : `Προσχέδιο έκδοσης ${regulation.edition + 1}`) : (en ? 'Draft of the first edition' : 'Προσχέδιο πρώτης έκδοσης')) : (en ? 'Revision' : 'Αναθεώρηση')}
      subtitle={draft ? (problems.length ? `${en ? 'Before approval:' : 'Πριν από την έγκριση:'} ${problems.join(' · ')}` : signed.length < SIGNING_ROLES.length ? (en ? `Ready to sign · ${signed.length} of ${SIGNING_ROLES.length} signatures` : `Έτοιμο για υπογραφές · ${signed.length} από ${SIGNING_ROLES.length}`) : (en ? 'Signed and ready for approval.' : 'Υπογεγραμμένο και έτοιμο για έγκριση.')) : (en ? 'The edition in force is never edited: a revision starts from it and is approved as the next edition.' : 'Η έκδοση σε ισχύ δεν αλλάζει ποτέ: η αναθεώρηση ξεκινά από αυτήν και εγκρίνεται ως η επόμενη έκδοση.')}
      actions={draft && <SearchableSelect hideLabel className="reg-mode-select" label={en ? 'How to work on the draft' : 'Τρόπος εργασίας'} value={mode} onChange={next=>next&&(setEditMode)(next)} options={[
        { value: 'fill', icon: ListChecks, label: `${en ? 'Fill in' : 'Συμπλήρωση'}${toFill ? ` · ${toFill}` : ''}` },
        { value: 'write', icon: FilePenLine, label: en ? 'Free editing' : 'Ελεύθερη επεξεργασία' },
        { value: 'sign', icon: PenLine, label: `${en ? 'Signatures' : 'Υπογραφές'} · ${signed.length}/${SIGNING_ROLES.length}` },
      ]}/>}
      footer={draft && <div className="inline-edit-footer">
        {hasApproved && <Button variant="secondary" onClick={discard}>{en ? 'Leave the revision' : 'Εγκατάλειψη αναθεώρησης'}</Button>}
        <SaveButton variant="secondary" loading={saving} disabled={saving || !dirty} onClick={save}>{en ? 'Save the draft' : 'Αποθήκευση προσχεδίου'}</SaveButton>
        <Button disabled={saving || dirty || problems.length > 0 || signed.length < SIGNING_ROLES.length} title={signed.length < SIGNING_ROLES.length ? (en ? 'Needs both signatures' : 'Χρειάζονται και οι δύο υπογραφές') : undefined} onClick={() => setApproving({ changeNote: draft.changeNote || '', issuedOn: new Date().toISOString().slice(0, 10), approvedByName: auth?.profile?.fullName || auth?.profile?.full_name || '' })}><CheckCircle2 size={15} />{en ? 'Approve the edition' : 'Έγκριση έκδοσης'}</Button>
      </div>}>
      {draft ? <>
        {mode === 'write' && <label className="reg-change-note"><span>{en ? 'What this edition changes' : 'Τι αλλάζει σε αυτή την έκδοση'}</span><input value={draft.changeNote || ''} onChange={event => { setDraft(current => ({ ...current, changeNote: event.target.value })); setDirty(true) }} placeholder={en ? 'e.g. New hand hygiene targets; isolation rooms updated' : 'π.χ. Νέοι στόχοι υγιεινής χεριών· ενημέρωση θαλάμων απομόνωσης'} /></label>}
        {mode === 'fill' && <RegulationFill content={draft.content} total={templateFills} language={language} onChange={content => { setDraft(current => ({ ...current, content })); setDirty(true) }}
          onOpenSection={item => { setEditorAt({ chapter: item.chapterIndex, section: item.sectionIndex, at: Date.now() }); setEditMode('write') }} />}
        {mode === 'write' && <RegulationEditor key={editorAt?.at || 'editor'} initialSelection={editorAt} content={draft.content} onChange={content => { setDraft(current => ({ ...current, content })); setDirty(true) }} language={language} onConfirm={options => confirm({ ...options, danger: true })} />}
        {mode === 'sign' && <RegulationSignatures signatures={data.signatures || []} revision={draft.revision} signRoles={signRoles} language={language} blocked={problems} dirty={dirty} onSign={sign} profileName={auth?.profile?.fullName || auth?.profile?.full_name || ''} />}
      </> : <div className="reg-empty"><FilePenLine size={28} /><strong>{en ? 'No revision in progress' : 'Δεν γίνεται αναθεώρηση'}</strong><Button onClick={startRevision}>{en ? `Start edition ${regulation.edition + 1}` : `Έναρξη έκδοσης ${regulation.edition + 1}`}</Button></div>}
    </RecordTabPanel>}
    {tab === 'updates' && canManage && template && <RecordTabPanel title={template.title} subtitle={`${en ? 'Template' : 'Πρότυπο'} v${template.version} · ${en ? 'your regulation follows' : 'ο κανονισμός σας ακολουθεί την'} v${regulation.templateVersion || '—'}`}
      actions={<div className="row-actions">
        {changes.some(change => change.kind !== 'removed') && <Button variant="secondary" onClick={takeAll}><Sparkles size={15} />{en ? 'Add all to the draft' : 'Προσθήκη όλων στο προσχέδιο'}</Button>}
        {newerTemplate && <Button variant="secondary" onClick={markReviewed}><CheckCircle2 size={15} />{en ? 'Mark as reviewed' : 'Σημείωση ως ελεγμένη'}</Button>}
      </div>}>
      <div className="reg-updates">
        {newerTemplate ? <div className="reg-update-banner"><Sparkles size={18} /><div><strong>{en ? `Version ${template.version} of the template is out` : `Κυκλοφόρησε η έκδοση ${template.version} του προτύπου`}</strong><span>{template.changeNote || (en ? 'No note.' : 'Χωρίς σημείωση.')}</span><small>{en ? 'Nothing changes in your regulation by itself: take what you want into the draft, then approve it as a new edition.' : 'Τίποτα δεν αλλάζει μόνο του στον κανονισμό σας: πάρτε στο προσχέδιο ό,τι θέλετε και εγκρίνετέ το ως νέα έκδοση.'}</small></div></div>
          : <p className="reg-updates-intro">{en ? 'Your regulation follows the latest version of the template. Below, the sections where your text differs from the template.' : 'Ο κανονισμός σας ακολουθεί την τελευταία έκδοση του προτύπου. Παρακάτω, οι ενότητες όπου το κείμενό σας διαφέρει από το πρότυπο.'}</p>}
        {changes.length ? <ul className="reg-change-list">{changes.map(change => <li key={`${change.kind}-${change.origin}`} className={`is-${change.kind}`}>
          <header><span className="reg-change-kind">{change.kind === 'new' ? (en ? 'New in the template' : 'Νέο στο πρότυπο') : change.kind === 'removed' ? (en ? 'Removed from the template' : 'Αφαιρέθηκε από το πρότυπο') : (en ? 'Changed in the template' : 'Άλλαξε στο πρότυπο')}</span><strong>{change.title}</strong><small>{change.chapterTitle}</small></header>
          <div className="reg-change-compare">
            <div><b>{en ? 'Template' : 'Πρότυπο'}</b><div className="reg-page-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(change.templateHtml) || `<p><em>${en ? '(removed)' : '(αφαιρέθηκε)'}</em></p>` }} /></div>
            <div><b>{en ? 'Your regulation' : 'Ο κανονισμός σας'}</b><div className="reg-page-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(change.currentHtml) || `<p><em>${en ? '(not in your regulation)' : '(δεν υπάρχει στον κανονισμό σας)'}</em></p>` }} /></div>
          </div>
          {change.kind !== 'removed' && <footer><Button variant="secondary" onClick={() => takeSection(change)}>{change.currentHtml ? (en ? 'Replace in the draft' : 'Αντικατάσταση στο προσχέδιο') : (en ? 'Add to the draft' : 'Προσθήκη στο προσχέδιο')}</Button></footer>}
        </li>)}</ul> : <p className="reg-updates-intro">{en ? 'No differences.' : 'Δεν υπάρχουν διαφορές.'}</p>}
      </div>
    </RecordTabPanel>}
    {tab === 'editions' && <RecordTabPanel title={en ? 'Editions' : 'Εκδόσεις'} subtitle={en ? 'Every approved edition is kept unchanged.' : 'Κάθε εγκεκριμένη έκδοση φυλάσσεται αμετάβλητη.'}>
      <RegistryTable className="quality-table" rows={data.editions} rowKey={row => row.id}
        columns={[{ key: 'edition', label: en ? 'Edition' : 'Έκδοση' }, { key: 'issued', label: en ? 'In force from' : 'Ισχύς από' }, { key: 'by', label: en ? 'Approved by' : 'Έγκριση' }, { key: 'note', label: en ? 'Changes' : 'Αλλαγές' }, { key: 'open', label: '' }]}
        emptyTitle={en ? 'No edition yet' : 'Δεν υπάρχει ακόμη έκδοση'} emptyText={en ? 'The first edition appears here once the draft is approved.' : 'Η πρώτη έκδοση εμφανίζεται εδώ μόλις εγκριθεί το προσχέδιο.'}
        renderRow={row => <>
          <td><strong>{row.edition}</strong>{row.edition === regulation.edition && <StatusBadge tone="success">{en ? 'In force' : 'Σε ισχύ'}</StatusBadge>}</td>
          <td className="nowrap-cell">{formatDay(row.issuedOn, language)}</td>
          <td>{row.approvedByName || '—'}</td>
          <td className="reg-note-cell">{row.changeNote || '—'}</td>
          <td><button type="button" className="reg-link" onClick={() => openEdition(row)}><BookOpen size={13} /> {en ? 'Read' : 'Ανάγνωση'}</button></td>
        </>} />
    </RecordTabPanel>}
    {approving && <ObserverDialog title={en ? `Approve edition ${regulation.edition + 1}` : `Έγκριση έκδοσης ${regulation.edition + 1}`} subtitle={en ? 'It comes into force and is kept unchanged.' : 'Τίθεται σε ισχύ και φυλάσσεται αμετάβλητη.'} onClose={() => setApproving(null)}
      footer={<DialogActions onCancel={() => setApproving(null)} onSave={approve} saveLabel={en ? 'Approve' : 'Έγκριση'} disabled={saving || !approving.issuedOn} />}>
      <div className="reg-approve">
        <div className="reg-approve-signed">{signed.map(item => <span key={item.role}><CheckCircle2 size={14} /><b>{SIGNING_ROLES.find(role => role.value === item.role)?.label[en ? 1 : 0]}</b> {item.name}</span>)}</div>
        <Field label={en ? 'What this edition changes' : 'Τι αλλάζει σε αυτή την έκδοση'}><textarea rows={3} value={approving.changeNote} onChange={event => setApproving(current => ({ ...current, changeNote: event.target.value }))} /></Field>
        <ManualDateField label={en ? 'In force from' : 'Ισχύς από'} value={approving.issuedOn} onChange={value => setApproving(current => ({ ...current, issuedOn: value }))} />
        <Field label={en ? 'Approved by' : 'Εγκρίθηκε από'} hint={en ? 'As it appears on the document, e.g. “Board of Directors, decision 12/2026”.' : 'Όπως θα φαίνεται στο έγγραφο, π.χ. «Διοίκηση, απόφαση 12/2026».'}><input value={approving.approvedByName} onChange={event => setApproving(current => ({ ...current, approvedByName: event.target.value }))} /></Field>
      </div>
    </ObserverDialog>}
  </EntityRecordShell></Page>
}
