import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ClipboardCheck, Search } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { Field } from '../../../design-system/Field'
import { FormGrid } from '../../../design-system/FormCard'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { CheckboxField } from '../../../design-system/CheckboxField'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { useDepartments } from '../../management/useLibraries'
import { useAuditTemplates } from '../audits/useAuditTemplates'
import { AUDIT_AREAS, areaLabel, departmentArea, standardShort } from '../audits/auditStandards'
import { createSelfAssessments } from './selfAssessmentService'
import './selfAssessment.css'

const L = (en, el, english) => (en ? english : el)

// A new self-assessment, on a page of its own: the questionnaire, the title and the due date on one line, then
// the departments as a list to tick (search, a button per area, «all» and «clear»). One self-assessment is made per
// department; it stays a draft until it is released.
export function SelfAssessmentCreatePage() {
  const { language, t } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant, role, membership, actualRole, isRolePreview } = useTenant()
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  const canManage = (!isRolePreview && actualRole === ROLES.PLATFORM_OWNER) || can(role, CAPABILITIES.MANAGE_QUALITY, addOns, custom)
  const { goBack } = useContextualNavigation('/quality')
  const { templates, loading } = useAuditTemplates(tenant?.id)
  const { departments } = useDepartments()
  // The ward checklist (a department's own checklist) first, then the standards' questionnaires.
  const active = useMemo(() => templates.filter(item => item.active !== false && item.questions.length).sort((a, b) => Number(b.key === 'ward' || b.basedOn != null) - Number(a.key === 'ward' || a.basedOn != null)), [templates])
  const [templateId, setTemplateId] = useState('')
  const [title, setTitle] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [picked, setPicked] = useState([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (templateId || !active.length) return
    const first = active.find(item => item.key === 'ward') || active[0]
    setTemplateId(first.id)
    setTitle(`${L(en, 'Αυτοαξιολόγηση', 'Self-assessment')} · ${first.title}`)
  }, [active, templateId, en])
  const template = active.find(item => item.id === templateId)
  const all = useMemo(() => departments.map(item => ({ id: item.id || item.name, name: item.name || item.el || '', area: departmentArea(item.name || item.el || '') })).filter(item => item.name).sort((a, b) => a.name.localeCompare(b.name, 'el')), [departments])
  const shown = all.filter(item => !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase()))
  const areas = AUDIT_AREAS.map(area => ({ ...area, ids: all.filter(item => item.area === area.value).map(item => item.id) })).filter(area => area.ids.length)
  const toggle = id => setPicked(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]))
  const addIds = ids => setPicked(current => [...new Set([...current, ...ids])])
  async function save() {
    if (!template || !picked.length || busy) return
    setBusy(true)
    try {
      const chosen = all.filter(item => picked.includes(item.id)).map(item => ({ id: item.id, name: item.name }))
      const made = await createSelfAssessments(tenant?.id, { template, departments: chosen, title: title.trim() || `${L(en, 'Αυτοαξιολόγηση', 'Self-assessment')} · ${template.title}`, dueOn })
      if (!made.length) { notify(L(en, 'Το ερωτηματολόγιο δεν έχει ερωτήσεις για τα τμήματα που επιλέξατε.', 'The questionnaire has no questions for the chosen departments.'), 'error'); return }
      notify(L(en, `Δημιουργήθηκαν ${made.length} αυτοαξιολογήσεις (πρόχειρες).`, `${made.length} self-assessments were created (drafts).`), 'success')
      goBack()
    } catch (error) { console.error(error); notify(L(en, 'Δεν ήταν δυνατή η δημιουργία.', 'It could not be created.'), 'error') } finally { setBusy(false) }
  }
  if (!canManage) return <Navigate to="/quality" replace />
  return <Page fill><EntityRecordShell className="quality-record-shell workspace-fill" avatar={<ClipboardCheck size={19} />} eyebrow={t('quality')} title={L(en, 'Νέα αυτοαξιολόγηση', 'New self-assessment')}
    subtitle={L(en, 'Μία αυτοαξιολόγηση ανά τμήμα, με τις ερωτήσεις του ερωτηματολογίου που ταιριάζουν στο τμήμα. Μένει πρόχειρη μέχρι να την ενεργοποιήσετε.', 'One self-assessment per department, with the questions of the questionnaire that fit it. It stays a draft until you release it.')}
    tabs={[]} activeTab="" onTabChange={() => {}} onBack={goBack}>
    <div className="record-section self-create-page">
      <FormGrid columns={3} className="self-create-fields">
        <ChoiceField label={L(en, 'Ερωτηματολόγιο *', 'Questionnaire *')} value={templateId} disabled={loading} onChange={value => { setTemplateId(value); const next = active.find(item => item.id === value); if (next && (!title || title.startsWith(L(en, 'Αυτοαξιολόγηση', 'Self-assessment')))) setTitle(`${L(en, 'Αυτοαξιολόγηση', 'Self-assessment')} · ${next.title}`) }}
          options={active.map(item => ({ value: item.id, label: `${item.title} (${item.questions.length})`, description: standardShort(item.standard) }))} placeholder={L(en, 'Επιλέξτε ερωτηματολόγιο…', 'Choose a questionnaire…')} />
        <Field label={L(en, 'Τίτλος', 'Title')}><input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} /></Field>
        <ManualDateField label={L(en, 'Προθεσμία', 'Due date')} value={dueOn} onChange={setDueOn} />
      </FormGrid>
      <p className="self-new-hint">{L(en, 'Θέλετε άλλες ερωτήσεις; Δημιουργήστε αντίγραφο του ερωτηματολογίου για το νοσοκομείο σας από τα «Ερωτηματολόγια».', 'Want other questions? Make a copy of the questionnaire for your hospital from «Questionnaires».')}</p>
      <section className="self-departments" aria-label={L(en, 'Τμήματα', 'Departments')}>
        <header>
          <strong>{L(en, 'Τμήματα', 'Departments')} <span>{picked.length} {L(en, 'από', 'of')} {all.length}</span></strong>
          <div className="self-departments-quick">
            <button type="button" onClick={() => setPicked(all.map(item => item.id))}>{L(en, 'Όλα', 'All')} ({all.length})</button>
            {areas.map(area => <button key={area.value} type="button" onClick={() => addIds(area.ids)}>{areaLabel(area.value, language)} ({area.ids.length})</button>)}
            {picked.length > 0 && <button type="button" className="is-clear" onClick={() => setPicked([])}>{L(en, 'Καθαρισμός', 'Clear')}</button>}
          </div>
          <div className="self-departments-search"><Search size={15} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={L(en, 'Αναζήτηση τμήματος…', 'Search a department…')} aria-label={L(en, 'Αναζήτηση τμήματος', 'Search a department')} /></div>
        </header>
        <ul className="self-departments-list">
          {shown.map(item => <li key={item.id} className={picked.includes(item.id) ? 'is-on' : undefined}><CheckboxField label={item.name} checked={picked.includes(item.id)} onChange={() => toggle(item.id)} /></li>)}
          {!shown.length && <li className="self-departments-empty">{L(en, 'Κανένα τμήμα.', 'No department.')}</li>}
        </ul>
      </section>
      <div className="inline-edit-footer">
        <span className="self-departments-count">{picked.length ? `${picked.length} ${L(en, 'τμήματα', 'departments')}` : L(en, 'Επιλέξτε τουλάχιστον ένα τμήμα', 'Choose at least one department')}</span>
        <Button variant="secondary" onClick={goBack}>{L(en, 'Ακύρωση', 'Cancel')}</Button>
        <SaveButton loading={busy} disabled={busy || !template || !picked.length} onClick={save}>{L(en, 'Δημιουργία', 'Create')}</SaveButton>
      </div>
    </div>
  </EntityRecordShell></Page>
}
