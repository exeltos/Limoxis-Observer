import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Copy, Info, ListChecks, Plus, Trash2 } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { BackButton } from '../../../design-system/BackButton'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { FilterBar, FilterSelect } from '../../../design-system/FilterBar'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { MultiSelect } from '../../../design-system/MultiSelect'
import { CheckboxField } from '../../../design-system/CheckboxField'
import { SectionHeader } from '../../../design-system/SectionHeader'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { useAuth } from '../../../core/auth/AuthContext'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { exportRegistry } from '../../../core/export/registryExports'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { AUDIT_AREAS, AUDIT_STANDARDS, areaLabel, standardLabel, standardShort } from './auditStandards'
import { templateChapters } from './auditModel'
import { copyOfTemplate, newAuditTemplate, newQuestion, removeAuditTemplate, saveAuditTemplate } from './auditTemplateService'
import { useAuditTemplates } from './useAuditTemplates'
import '../quality.css'
import './audits.css'

const L = (en, el, english) => (en ? english : el)

function useAccess() {
  const { role, membership, actualRole, isRolePreview } = useTenant()
  const { profile } = useAuth()
  const owner = !isRolePreview && (actualRole === ROLES.PLATFORM_OWNER || Boolean(profile?.isPlatformOwner))
  return { canManage: owner || can(role, CAPABILITIES.MANAGE_QUALITY, membership?.capabilities ?? [], membership?.customCapabilities ?? []), platformOwner: owner }
}

const questionsExport = (templates, en) => ({
  name: en ? 'audit-questionnaires' : 'erotimatologia-epitheorisis',
  headers: en ? ['Questionnaire', 'Standard', 'Version', 'Library', '#', 'Chapter', 'Clause', 'Question', 'Guidance', 'Evidence', 'Weight', 'Critical', 'Areas'] : ['Ερωτηματολόγιο', 'Πρότυπο', 'Έκδοση', 'Προέλευση', '#', 'Κεφάλαιο', 'Άρθρο', 'Ερώτηση', 'Οδηγία', 'Τεκμήρια', 'Βάρος', 'Κρίσιμη', 'Περιοχές'],
  rows: templates.flatMap(template => template.questions.map((item, index) => [template.title, standardShort(template.standard), template.version, template.isSystem ? (en ? 'Platform library' : 'Βιβλιοθήκη πλατφόρμας') : (en ? 'Hospital' : 'Νοσοκομείο'), index + 1, [item.chapterRef, item.chapterTitle].filter(Boolean).join(' · '), item.clauseRef, item.question, item.guidance, item.evidence, item.weight, item.critical ? (en ? 'Yes' : 'Ναι') : '', (item.areas || []).map(area => areaLabel(area, en ? 'en' : 'el')).join(', ')])),
})

// Quality → Audits → «Ερωτηματολόγια επιθεώρησης»: the platform library (one
// questionnaire per standard, kept by the Platform Owner) and the hospital's own
// copies. A copy of the library is edited freely; audits keep the version they used.
export function AuditQuestionnairesPage() {
  const { templateId } = useParams()
  return templateId ? <QuestionnaireEditor templateId={templateId} /> : <QuestionnaireLibrary />
}

function QuestionnaireLibrary() {
  const { language } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation('/quality')
  const access = useAccess()
  const { templates, loading } = useAuditTemplates(tenant?.id)
  const [query, setQuery] = useState('')
  const [standard, setStandard] = useState('all')
  const rows = templates.filter(item => (standard === 'all' || item.standard === standard) && (!query.trim() || `${item.title} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())))
  return <Page fill className="audit-questionnaires-page" navigation={<BackButton onClick={goBack} label={L(en, 'Πίσω στις επιθεωρήσεις', 'Back to audits')} />}
    title={L(en, 'Ερωτηματολόγια επιθεώρησης', 'Audit questionnaires')}
    subtitle={L(en, 'Ένα ερωτηματολόγιο ανά πρότυπο, οργανωμένο ανά άρθρο ή κεφάλαιο. Είναι βοήθημα επιθεώρησης, όχι το κείμενο του προτύπου· δημιουργήστε αντίγραφο για να το προσαρμόσετε στο νοσοκομείο.', 'One questionnaire per standard, organised by clause or chapter. An audit aid, not the text of the standard; make a copy to adapt it to the hospital.')}
    actions={<div className="row-actions"><ExportMenu disabled={!rows.length} onExcel={() => exportRegistry(questionsExport(rows, en))} />{access.canManage && <Button onClick={() => navigate('/quality/audit-questionnaires/new')}><Plus size={15} />{L(en, 'Νέο ερωτηματολόγιο', 'New questionnaire')}</Button>}</div>}>
    <section className="surface registry-workspace workspace-column workspace-fill">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={L(en, 'Αναζήτηση ερωτηματολογίου…', 'Search questionnaires…')} activeAdvancedCount={standard !== 'all' ? 1 : 0} onClear={() => { setQuery(''); setStandard('all') }}>
        <FilterSelect label={L(en, 'Πρότυπο', 'Standard')} value={standard} onChange={setStandard}><option value="all">{L(en, 'Όλα', 'All')}</option>{AUDIT_STANDARDS.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      </FilterBar>
      <div className="scroll-table">
        <RegistryTable bare className="quality-table audit-questionnaire-table" rows={rows} rowKey={row => row.id} empty={!loading && !rows.length} emptyFiltered={templates.length > 0} onClearFilters={() => { setQuery(''); setStandard('all') }}
          columns={[{ key: 'title', label: L(en, 'Ερωτηματολόγιο', 'Questionnaire') }, { key: 'standard', label: L(en, 'Πρότυπο', 'Standard') }, { key: 'areas', label: L(en, 'Περιοχές', 'Areas') }, { key: 'questions', label: L(en, 'Ερωτήσεις', 'Questions') }, { key: 'origin', label: L(en, 'Προέλευση', 'Origin') }, { key: 'status', label: L(en, 'Κατάσταση', 'Status') }]}
          emptyTitle={L(en, 'Δεν υπάρχουν ερωτηματολόγια', 'No questionnaires')} emptyText={L(en, 'Η βιβλιοθήκη της πλατφόρμας δίνει ένα ερωτηματολόγιο ανά πρότυπο.', 'The platform library gives one questionnaire per standard.')}
          rowProps={row => ({ className: 'registry-row-clickable', onClick: () => navigate(`/quality/audit-questionnaires/${row.id}`) })}
          renderRow={row => <>
            <td><strong>{row.title}</strong><small>{L(en, 'έκδοση', 'version')} {row.version}{row.standardVersion ? ` · ${standardShort(row.standard)} ${row.standardVersion}` : ''}</small></td>
            <td className="nowrap-cell">{standardShort(row.standard)}</td>
            <td>{row.departmentTypes?.length ? <span className="resource-notes">{row.departmentTypes.map(area => <StatusBadge key={area} tone="neutral">{areaLabel(area, language)}</StatusBadge>)}</span> : L(en, 'Όλα τα τμήματα', 'Every department')}</td>
            <td className="nowrap-cell">{row.questions.length}<small>{templateChapters(row).length} {L(en, 'κεφάλαια', 'chapters')} · {row.questions.filter(item => item.critical).length} {L(en, 'κρίσιμες', 'critical')}</small></td>
            <td>{row.isSystem ? L(en, 'Βιβλιοθήκη πλατφόρμας', 'Platform library') : L(en, 'Του νοσοκομείου', 'Hospital')}{!row.isSystem && row.basedOn && <small>{L(en, 'αντίγραφο της βιβλιοθήκης', 'copy of the library')}</small>}</td>
            <td><StatusBadge tone={row.active !== false ? 'success' : 'neutral'}>{row.active !== false ? L(en, 'Ενεργό', 'Active') : L(en, 'Ανενεργό', 'Inactive')}</StatusBadge></td>
          </>} />
      </div>
    </section>
  </Page>
}

function QuestionnaireEditor({ templateId }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const { notify, confirm } = useFeedback()
  const navigate = useNavigate()
  const access = useAccess()
  const { templates, loading, reload } = useAuditTemplates(tenant?.id)
  const stored = templateId === 'new' ? newAuditTemplate() : templates.find(item => String(item.id) === String(templateId))
  const [draft, setDraft] = useState(null)
  const [chapter, setChapter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const current = draft || stored
  const locked = !current || !access.canManage || (current.isSystem && !access.platformOwner)
  const chapters = useMemo(() => templateChapters(current), [current])
  if (!current) return <Page title={L(en, 'Ερωτηματολόγιο', 'Questionnaire')}><div className="inline-empty">{loading ? L(en, 'Φόρτωση…', 'Loading…') : L(en, 'Δεν βρέθηκε.', 'Not found.')}</div></Page>
  const set = next => setDraft({ ...current, ...next })
  const dirty = Boolean(draft) && JSON.stringify(draft) !== JSON.stringify(stored)
  const questions = current.questions.map((item, index) => ({ ...item, index })).filter(item => chapter === 'all' || item.chapterRef === chapter)
  async function save() {
    if (!String(current.title || '').trim()) { notify(L(en, 'Συμπληρώστε τον τίτλο.', 'Fill in the title.'), 'error'); return }
    setSaving(true)
    try {
      const saved = await saveAuditTemplate(tenant?.id, current, stored?.id ? stored : null)
      notify(L(en, 'Το ερωτηματολόγιο αποθηκεύτηκε.', 'Questionnaire saved.'), 'success')
      await reload()
      setDraft(null)
      navigate(`/quality/audit-questionnaires/${saved.id}`, { replace: true })
    } catch (error) { console.error(error); notify(L(en, 'Δεν ήταν δυνατή η αποθήκευση.', 'The questionnaire could not be saved.'), 'error') } finally { setSaving(false) }
  }
  async function copy() {
    setSaving(true)
    try {
      const saved = await saveAuditTemplate(tenant?.id, copyOfTemplate(current, language))
      notify(L(en, 'Δημιουργήθηκε αντίγραφο για το νοσοκομείο.', 'Hospital copy created.'), 'success')
      await reload()
      setDraft(null)
      navigate(`/quality/audit-questionnaires/${saved.id}`, { replace: true })
    } catch (error) { console.error(error); notify(L(en, 'Δεν ήταν δυνατή η δημιουργία αντιγράφου.', 'The copy could not be made.'), 'error') } finally { setSaving(false) }
  }
  async function remove() {
    const ok = await confirm({ title: L(en, 'Διαγραφή ερωτηματολογίου', 'Delete questionnaire'), message: L(en, 'Οι επιθεωρήσεις που έγιναν με αυτό κρατούν τις ερωτήσεις και τις απαντήσεις τους. Για ερωτηματολόγιο που δεν χρησιμοποιείται πια, προτιμήστε να το κάνετε ανενεργό.', 'Audits made with it keep their questions and answers. For one no longer used, prefer to make it inactive.'), confirmLabel: L(en, 'Διαγραφή', 'Delete'), danger: true })
    if (!ok) return
    try { await removeAuditTemplate(tenant?.id, current.id); navigate('/quality/audit-questionnaires', { replace: true }) } catch (error) { console.error(error); notify(L(en, 'Δεν ήταν δυνατή η διαγραφή.', 'The questionnaire could not be deleted.'), 'error') }
  }
  const saveQuestion = () => {
    const list = [...current.questions]
    const item = { ...editing.item, weight: Number(editing.item.weight) > 0 ? Number(editing.item.weight) : 1 }
    if (editing.index == null) list.push(item); else list[editing.index] = item
    set({ questions: list.map((entry, index) => ({ ...entry, position: index + 1 })) })
    setEditing(null)
  }
  return <Page fill className="audit-questionnaires-page" navigation={<BackButton onClick={() => navigate('/quality/audit-questionnaires')} label={L(en, 'Πίσω στα ερωτηματολόγια', 'Back to questionnaires')} />}
    title={current.title || L(en, 'Νέο ερωτηματολόγιο', 'New questionnaire')}
    subtitle={`${standardLabel(current.standard, language)} · ${L(en, 'έκδοση', 'version')} ${current.version} · ${current.questions.length} ${L(en, 'ερωτήσεις', 'questions')}`}
    actions={<div className="row-actions">
      <ExportMenu onExcel={() => exportRegistry(questionsExport([current], en))} />
      {access.canManage && current.id && <Button variant="secondary" disabled={saving} onClick={copy}><Copy size={15} />{L(en, 'Αντίγραφο για το νοσοκομείο', 'Copy for the hospital')}</Button>}
      {!locked && current.id && !current.isSystem && <Button variant="secondary" onClick={remove}><Trash2 size={15} />{L(en, 'Διαγραφή', 'Delete')}</Button>}
      {!locked && <SaveButton loading={saving} disabled={!dirty && current.id != null} onClick={save}>{L(en, 'Αποθήκευση', 'Save')}</SaveButton>}
    </div>}>
    <div className="workspace-fill audit-questionnaire-editor">
      {current.isSystem && <div className="governance-banner info"><Info size={16} aria-hidden="true" /><span>{access.platformOwner ? L(en, 'Ερωτηματολόγιο της βιβλιοθήκης της πλατφόρμας: οι αλλαγές σας φτάνουν σε κάθε νοσοκομείο.', 'Platform library questionnaire: your changes reach every hospital.') : L(en, 'Ερωτηματολόγιο της βιβλιοθήκης της πλατφόρμας. Για να το προσαρμόσετε, δημιουργήστε αντίγραφο για το νοσοκομείο.', 'Platform library questionnaire. To adapt it, make a copy for the hospital.')}</span></div>}
      <FormCard wide title={L(en, 'Ερωτηματολόγιο', 'Questionnaire')} icon={ListChecks}>
        <FormGrid columns={3}>
          <Field label={L(en, 'Τίτλος *', 'Title *')}><input value={current.title} disabled={locked} onChange={event => set({ title: event.target.value })} /></Field>
          <ChoiceField label={L(en, 'Πρότυπο', 'Standard')} value={current.standard} disabled={locked} options={AUDIT_STANDARDS.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => set({ standard: value })} />
          <Field label={L(en, 'Έκδοση προτύπου', 'Standard version')}><input value={current.standardVersion || ''} disabled={locked} onChange={event => set({ standardVersion: event.target.value })} /></Field>
          <MultiSelect label={L(en, 'Τμήματα (περιοχές)', 'Departments (areas)')} disabled={locked} tags options={AUDIT_AREAS.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} selected={current.departmentTypes || []} onChange={value => set({ departmentTypes: value })} placeholder={L(en, 'Όλα τα τμήματα', 'Every department')} searchPlaceholder={L(en, 'Αναζήτηση', 'Search')} emptyLabel={L(en, 'Δεν βρέθηκε', 'No match')} selectAllLabel={L(en, 'Επιλογή όλων', 'Select all')} clearAllLabel={L(en, 'Καθαρισμός', 'Clear')} />
          <Field label={L(en, 'Πεδίο εφαρμογής', 'Scope')}><input value={current.scope || ''} disabled={locked} onChange={event => set({ scope: event.target.value })} /></Field>
          <CheckboxField label={L(en, 'Ενεργό (προτείνεται σε νέες επιθεωρήσεις)', 'Active (offered for new audits)')} checked={current.active !== false} disabled={locked} onChange={value => set({ active: value })} />
        </FormGrid>
        <Field label={L(en, 'Περιγραφή', 'Description')}><textarea rows={2} value={current.description || ''} disabled={locked} onChange={event => set({ description: event.target.value })} /></Field>
      </FormCard>
      <SectionHeader title={L(en, `Ερωτήσεις ${current.questions.length}`, `Questions ${current.questions.length}`)} subtitle={L(en, 'Οι ερωτήσεις είναι διατυπωμένες για επιθεώρηση, με αναφορά στο άρθρο ή το κεφάλαιο.', 'Questions are phrased for auditing, with the clause or chapter reference.')}
        actions={<div className="row-actions">
          <FilterSelect label={L(en, 'Κεφάλαιο', 'Chapter')} value={chapter} onChange={setChapter}><option value="all">{L(en, 'Όλα', 'All')}</option>{chapters.map(item => <option key={item.ref} value={item.ref}>{item.ref} · {item.title} ({item.questions})</option>)}</FilterSelect>
          {!locked && <Button variant="secondary" onClick={() => setEditing({ index: null, item: newQuestion(chapters.find(item => item.ref === chapter) || {}) })}><Plus size={15} />{L(en, 'Ερώτηση', 'Question')}</Button>}
        </div>} />
      <RegistryTable className="quality-table audit-question-table" rows={questions} rowKey={row => row.id || `q-${row.index}`}
        columns={[{ key: 'n', label: '#' }, { key: 'clause', label: L(en, 'Άρθρο', 'Clause') }, { key: 'question', label: L(en, 'Ερώτηση', 'Question') }, { key: 'evidence', label: L(en, 'Τεκμήρια', 'Evidence') }, { key: 'weight', label: L(en, 'Βάρος', 'Weight') }, { key: 'areas', label: L(en, 'Περιοχές', 'Areas') }]}
        rowProps={row => ({ className: 'registry-row-clickable', onClick: () => setEditing({ index: row.index, item: { ...row } }) })}
        renderRow={row => <>
          <td className="nowrap-cell">{row.index + 1}</td>
          <td className="nowrap-cell"><strong>{row.clauseRef || '—'}</strong><small>{row.chapterTitle}</small></td>
          <td>{row.question}{row.critical && <> <StatusBadge tone="danger">{L(en, 'Κρίσιμη', 'Critical')}</StatusBadge></>}{row.guidance && <small>{row.guidance}</small>}</td>
          <td><small className="audit-question-evidence">{row.evidence || '—'}</small></td>
          <td className="nowrap-cell">{row.weight}</td>
          <td>{row.areas?.length ? row.areas.map(area => areaLabel(area, language)).join(', ') : L(en, 'Όλες', 'All')}</td>
        </>} />
    </div>
    {editing && <ObserverDialog width="wide" title={editing.index == null ? L(en, 'Νέα ερώτηση', 'New question') : `${L(en, 'Ερώτηση', 'Question')} ${editing.index + 1}`} onClose={() => setEditing(null)}
      footer={!locked && <DialogActions onSave={saveQuestion} disabled={!String(editing.item.question || '').trim()}>{editing.index != null && <Button variant="secondary" onClick={() => { set({ questions: current.questions.filter((_, at) => at !== editing.index).map((entry, index) => ({ ...entry, position: index + 1 })) }); setEditing(null) }}><Trash2 size={15} />{L(en, 'Αφαίρεση ερώτησης', 'Remove question')}</Button>}</DialogActions>}>
      <QuestionFields item={editing.item} locked={locked} language={language} onChange={next => setEditing(currentEdit => ({ ...currentEdit, item: { ...currentEdit.item, ...next } }))} />
    </ObserverDialog>}
  </Page>
}

function QuestionFields({ item, locked, language, onChange }) {
  const en = language === 'en'
  return <FormGrid columns={3}>
    <Field label={L(en, 'Κεφάλαιο', 'Chapter')}><input value={item.chapterRef || ''} disabled={locked} onChange={event => onChange({ chapterRef: event.target.value })} /></Field>
    <Field label={L(en, 'Τίτλος κεφαλαίου', 'Chapter title')}><input value={item.chapterTitle || ''} disabled={locked} onChange={event => onChange({ chapterTitle: event.target.value })} /></Field>
    <Field label={L(en, 'Άρθρο / παράγραφος', 'Clause')}><input value={item.clauseRef || ''} disabled={locked} onChange={event => onChange({ clauseRef: event.target.value })} /></Field>
    <Field label={L(en, 'Ερώτηση *', 'Question *')}><textarea rows={3} value={item.question || ''} disabled={locked} onChange={event => onChange({ question: event.target.value })} /></Field>
    <Field label={L(en, 'Οδηγία για τον επιθεωρητή', 'Guidance for the auditor')}><textarea rows={3} value={item.guidance || ''} disabled={locked} onChange={event => onChange({ guidance: event.target.value })} /></Field>
    <Field label={L(en, 'Τεκμήρια που ζητούνται', 'Evidence required')}><textarea rows={3} value={item.evidence || ''} disabled={locked} onChange={event => onChange({ evidence: event.target.value })} /></Field>
    <Field label={L(en, 'Βάρος', 'Weight')}><input type="number" min="0.5" step="0.5" value={item.weight} disabled={locked} onChange={event => onChange({ weight: event.target.value })} /></Field>
    <MultiSelect label={L(en, 'Ισχύει για', 'Applies to')} disabled={locked} tags options={AUDIT_AREAS.map(area => ({ value: area.value, label: area.label[en ? 1 : 0] }))} selected={item.areas || []} onChange={areas => onChange({ areas })} placeholder={L(en, 'Όλες τις περιοχές', 'Every area')} searchPlaceholder={L(en, 'Αναζήτηση', 'Search')} emptyLabel={L(en, 'Δεν βρέθηκε', 'No match')} selectAllLabel={L(en, 'Επιλογή όλων', 'Select all')} clearAllLabel={L(en, 'Καθαρισμός', 'Clear')} />
    <CheckboxField label={L(en, 'Κρίσιμη ερώτηση', 'Critical question')} checked={Boolean(item.critical)} disabled={locked} onChange={critical => onChange({ critical })} />
  </FormGrid>
}
