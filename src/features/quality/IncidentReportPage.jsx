import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, FileText, Plus, Send, UserCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { StepList } from '../../design-system/StepList'
import { FormCard, FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ChoiceField } from '../../design-system/ChoiceField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { formatDay } from '../../core/i18n/formatDay'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES, ROLES } from '../../core/permissions/roles'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { auditActorFromAuth, auditEvent } from '../../core/audit/actor'
import { useEmployeesData } from '../employees/useEmployeesData'
import { resolveSelfEmployee } from '../employees/employeeIdentity'
import { useLibraries } from '../management/useLibraries'
import { createQualityRecord } from './qualityService'
import { withHarm, withIncidentClass } from './qualityRecordRules'
import { IMPACTS, INCIDENT_CLASSES, REPORT_KINDS, categoryKind, harmLevel, incidentCategoryLabel, incidentCategoryOptions, isSentinelHarm, rcaDueDate, severityOptions, vocabularyLabel, vocabularyOptions } from './qualityVocabulary'
import { QualityDepartmentField, QualityOwnerField, departmentRef } from './QualityFields'
import './quality.css'

const today = () => new Date().toISOString().slice(0, 10)

export function emptyIncidentReport() {
  return { title: '', titleEn: '', departmentId: '', department: '', departmentEn: '', status: 'reported', severity: 'medium', incidentClass: 'nearMiss', reachedPatient: false, harmOccurred: false, category: '', impact: 'none', date: today(), eventTime: '', description: '', descriptionEn: '', immediateActions: '', immediateActionsEn: '', owners: [], owner: '', ownerId: null, anonymous: false, reportKind: 'clinical', sentinel: false, rcaDueDate: '' }
}

// What a control entry with a finding, or another module, hands to the form.
export function incidentPrefill(state, language = 'el') {
  const en = language === 'en'
  const control = state?.controlSource
  if (control) {
    const lines = [control.controlTitle && `${en ? 'Control' : 'Έλεγχος'}: ${control.controlTitle}`, control.value !== undefined && control.value !== '' && control.value !== null && `${en ? 'Recorded value' : 'Καταγεγραμμένη τιμή'}: ${typeof control.value === 'object' ? JSON.stringify(control.value) : control.value}`, control.notes && `${en ? 'Notes' : 'Σημειώσεις'}: ${control.notes}`].filter(Boolean)
    const title = `${en ? 'Deviation in control' : 'Απόκλιση στον έλεγχο'}: ${control.controlTitle || ''}`.trim(), description = lines.join('\n')
    // Both language fields: the form edits the one of the screen's language.
    return { title, titleEn: title, department: control.department || '', departmentId: control.departmentId || '', category: 'process', description, descriptionEn: description, date: String(control.scheduledAt || '').slice(0, 10) || today() }
  }
  const source = state?.qualitySource
  if (!source) return null
  return { title: source.title || '', titleEn: source.title || '', departmentId: source.departmentId || '', department: source.department || '', description: source.description || '', descriptionEn: source.description || '', date: source.date || today() }
}

export function IncidentReportPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t, language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { user, profile } = useAuth()
  const { role, membership, tenant, actualRole, isRolePreview, isDemo } = useTenant()
  const { data: employeeRows = [] } = useEmployeesData()
  const { libraries, departments } = useLibraries()
  const categories = useMemo(() => libraries.incidentCategories || [], [libraries])
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  const ownerFullAccess = !isRolePreview && actualRole === ROLES.PLATFORM_OWNER
  const canManage = ownerFullAccess || can(role, CAPABILITIES.MANAGE_QUALITY, addOns, custom)
  const canViewQuality = ownerFullAccess || can(role, CAPABILITIES.VIEW_QUALITY, addOns, custom)
  // Back without history: the Quality Center, or the reporter's own list.
  const { goBack } = useContextualNavigation(canViewQuality ? '/quality' : '/quality/my-reports')
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(() => ({ ...emptyIncidentReport(), ...(incidentPrefill(location.state, language) || {}) }))
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(null)
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const patch = next => setDraft(current => ({ ...current, ...next }))

  // The reporter's department comes first; a prefilled department name finds its id.
  const self = useMemo(() => resolveSelfEmployee({ employeeRows, membership, profile, user, isDemo }), [employeeRows, membership, profile, user, isDemo])
  useEffect(() => {
    if (!departments.length) return
    setDraft(current => {
      if (current.departmentId && departments.some(dep => (dep.id || dep.name) === current.departmentId)) return current
      const name = current.department || self?.department || ''
      const dep = departments.find(item => item.name === name || item.nameEn === name)
      return dep ? { ...current, departmentId: dep.id || dep.name, department: dep.name, departmentEn: dep.nameEn || dep.name } : current
    })
  }, [departments, self])

  const titleKey = en ? 'titleEn' : 'title', descriptionKey = en ? 'descriptionEn' : 'description', actionsKey = en ? 'immediateActionsEn' : 'immediateActions'
  const steps = [en ? 'What happened' : 'Τι συνέβη', en ? 'Description' : 'Περιγραφή', en ? 'Review & send' : 'Έλεγχος & αποστολή']
  const isSuggestion = draft.reportKind === 'suggestion', classified = ['clinical', 'nonClinical'].includes(draft.reportKind)
  const valid = [Boolean((draft.category || isSuggestion) && departmentRef(draft) && draft.date), Boolean(draft[titleKey].trim() && draft[descriptionKey].trim()), true]
  const harmful = classified && draft.incidentClass === 'harmful'
  // A new kind keeps a category only if it belongs to it; complaints and ideas have no near-miss class.
  function changeKind(kind) {
    setDraft(current => {
      const keepsCategory = !categoryKind(current.category) || categoryKind(current.category) === kind
      const next = { ...current, reportKind: kind, category: keepsCategory ? current.category : '' }
      return ['clinical', 'nonClinical'].includes(kind) ? next : withIncidentClass(next, kind === 'complaint' ? 'noHarm' : 'nearMiss')
    })
  }

  async function send() {
    if (!valid.every(Boolean) || saving) return
    setSaving(true)
    try {
      // An anonymous report keeps no trace of the reporter, not even in its history.
      const actor = draft.anonymous ? { id: null, name: en ? 'Anonymous report' : 'Ανώνυμη αναφορά' } : auditActorFromAuth({ profile, user })
      const sentinel = harmful && isSentinelHarm(draft.impact)
      const created = await createQualityRecord('incidents', tenant?.id, { ...draft, sentinel, rcaDueDate: sentinel ? rcaDueDate(draft.date) : '', category: draft.category || (isSuggestion ? 'other' : ''), title: draft.title || draft.titleEn, titleEn: draft.titleEn || draft.title, description: draft.description || draft.descriptionEn, descriptionEn: draft.descriptionEn || draft.description, immediateActions: draft.immediateActions || draft.immediateActionsEn, reportedByLabel: draft.anonymous ? '' : actor.name, history: [auditEvent('recordCreated', { actor })] }, profile?.id || user?.id)
      notify(en ? 'The report was sent.' : 'Η αναφορά στάλθηκε.', 'success')
      const code = created?.id || created?.code
      // Quality staff go on to the record; everyone else gets a receipt.
      if (canViewQuality && code && !draft.anonymous) navigate(`/quality/incidents/${code}`, { replace: true, state: { limoxisFrom: { pathname: '/quality', search: '', hash: '', state: null, tab: 'incidents', registry: null } } })
      else setSent(created)
    } catch (error) {
      console.error(error)
      notify(en ? 'The report could not be sent.' : 'Δεν ήταν δυνατή η αποστολή της αναφοράς.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const shell = children => <Page fill><EntityRecordShell className="quality-record-shell workspace-fill" avatar={<AlertTriangle size={19} />} eyebrow={t('quality')} title={en ? 'New incident report' : 'Νέα αναφορά συμβάντος'} subtitle={en ? 'An incident, a near miss or a complaint. Anyone on the staff can report.' : 'Συμβάν, παρ’ ολίγον συμβάν ή παράπονο. Κάθε μέλος του προσωπικού μπορεί να αναφέρει.'} tabs={[]} activeTab="" onTabChange={() => {}} onBack={goBack}>{children}</EntityRecordShell></Page>

  if (sent) return shell(<div className="record-section quality-report-done">
    <CheckCircle2 size={34} aria-hidden="true" />
    <strong>{en ? 'Thank you, your report was sent.' : 'Ευχαριστούμε, η αναφορά σας στάλθηκε.'}</strong>
    <span>{en ? 'Code' : 'Κωδικός'}: <b>{sent.displayId || sent.id}</b>{sent.anonymous ? ` · ${en ? 'anonymous' : 'ανώνυμη'}` : ''}</span>
    <p>{en ? 'The Quality team will review it. Reporting helps the hospital learn; it is not about blame.' : 'Η ομάδα Ποιότητας θα την αξιολογήσει. Η αναφορά βοηθά το νοσοκομείο να μαθαίνει· δεν αναζητά υπαίτιους.'}</p>
    <div className="row-actions"><Button variant="secondary" onClick={() => navigate('/quality/my-reports')}>{en ? 'My incident reports' : 'Οι αναφορές συμβάντων μου'}</Button><Button onClick={() => { setSent(null); setStep(0); setDraft({ ...emptyIncidentReport(), anonymous: draft.anonymous, departmentId: draft.departmentId, department: draft.department, departmentEn: draft.departmentEn }) }}><Plus size={15} />{en ? 'New incident report' : 'Νέα αναφορά συμβάντος'}</Button></div>
  </div>)

  const goTo = index => setStep(Math.max(0, Math.min(steps.length - 1, index)))
  return shell(<div className="record-section quality-report-form">
    <StepList steps={steps} current={step} valid={valid} disabled={saving} onSelect={goTo} ariaLabel={en ? 'Steps' : 'Βήματα'} />
    <div className="lo-form-cards quality-report-body">
      {step === 0 && <>
        <FormCard wide title={en ? 'What are you reporting' : 'Τι αναφέρετε'} icon={ClipboardList} hint={REPORT_KINDS.find(item => item.value === draft.reportKind)?.hint[en ? 1 : 0]}>
          <FormGrid columns={2}>
            <ChoiceField label={en ? 'Kind *' : 'Είδος *'} value={draft.reportKind} options={vocabularyOptions(REPORT_KINDS, language)} onChange={changeKind} />
            <ChoiceField label={en ? 'Who reports' : 'Ποιος αναφέρει'} value={draft.anonymous ? 'anonymous' : 'named'} options={[{ value: 'named', label: en ? 'With my name' : 'Με το όνομά μου' }, { value: 'anonymous', label: en ? 'Anonymously' : 'Ανώνυμα' }]} onChange={value => set('anonymous', value === 'anonymous')} />
          </FormGrid>
          <small className="quality-report-hint">{draft.anonymous ? (en ? 'Your name is not stored anywhere. The report will not appear in «My incident reports» and Quality cannot ask you for details.' : 'Το όνομά σας δεν καταγράφεται πουθενά. Η αναφορά δεν θα εμφανίζεται στις «Αναφορές συμβάντων μου» και η Ποιότητα δεν θα μπορεί να σας ζητήσει διευκρινίσεις.') : (en ? 'You can follow it in «My incident reports».' : 'Θα την παρακολουθείτε στις «Αναφορές συμβάντων μου».')}</small>
        </FormCard>
        <FormCard title={isSuggestion ? (en ? 'Topic' : 'Θέμα') : (en ? 'Details' : 'Λεπτομέρειες')} icon={AlertTriangle}>
          {classified && <>
            <ChoiceField label={en ? 'Did it reach the patient? *' : 'Έφτασε στον ασθενή; *'} value={draft.incidentClass} options={vocabularyOptions(INCIDENT_CLASSES, language)} onChange={value => setDraft(current => withIncidentClass(current, value))} />
            <small className="quality-report-hint">{INCIDENT_CLASSES.find(item => item.value === draft.incidentClass)?.hint[en ? 1 : 0]}</small>
          </>}
          <SearchableSelect label={`${en ? 'Category' : 'Κατηγορία'}${isSuggestion ? '' : ' *'}`} value={draft.category} options={incidentCategoryOptions(categories, language, draft.reportKind === 'suggestion' ? null : draft.reportKind)} onChange={value => set('category', value)} placeholder={isSuggestion ? (en ? 'Optional' : 'Προαιρετικό') : en ? 'Choose a category' : 'Επιλέξτε κατηγορία'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel={en ? 'Clear' : 'Καθαρισμός'} />
        </FormCard>
        <FormCard title={en ? 'Where and when' : 'Πού και πότε'} icon={ClipboardList}>
          <QualityDepartmentField required value={departmentRef(draft)} onChange={patch} />
          <FormGrid columns={2}>
            <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={draft.date} onChange={value => set('date', value)} />
            <TimeField label={en ? 'Time' : 'Ώρα'} value={draft.eventTime} onChange={value => set('eventTime', value)} />
          </FormGrid>
        </FormCard>
      </>}
      {step === 1 && <>
        <FormCard title={en ? 'What happened' : 'Τι συνέβη'} icon={FileText} wide>
          <Field label={en ? 'Short title *' : 'Σύντομος τίτλος *'}><input value={draft[titleKey]} onChange={event => set(titleKey, event.target.value)} placeholder={en ? 'e.g. Wrong dose prepared' : 'π.χ. Προετοιμασία λάθος δόσης'} /></Field>
          <Field label={en ? 'Description *' : 'Περιγραφή *'} hint={en ? 'What happened, without names of patients.' : 'Τι συνέβη, χωρίς ονόματα ασθενών.'}><textarea rows={4} value={draft[descriptionKey]} onChange={event => set(descriptionKey, event.target.value)} /></Field>
          <Field label={en ? 'Immediate actions taken' : 'Άμεσες ενέργειες'}><textarea rows={2} value={draft[actionsKey]} onChange={event => set(actionsKey, event.target.value)} placeholder={en ? 'Containment, first response…' : 'Περιορισμός, πρώτη αντιμετώπιση…'} /></Field>
          {harmful && <ChoiceField label={en ? 'Harm to the patient (WHO)' : 'Βλάβη στον ασθενή (WHO)'} value={harmLevel(draft.impact)} options={vocabularyOptions(IMPACTS.filter(item => item.value !== 'none'), language)} onChange={value => setDraft(current => withHarm(current, value))} />}
          {harmful && isSentinelHarm(draft.impact) && <div className="governance-banner warning quality-sentinel-banner"><AlertTriangle size={16} /><span>{en ? `Sentinel event: Quality will open a root cause analysis, due by ${formatDay(rcaDueDate(draft.date), language)}.` : `Σοβαρό ανεπιθύμητο συμβάν (sentinel): η Ποιότητα θα ανοίξει ανάλυση ριζικής αιτίας, με προθεσμία ${formatDay(rcaDueDate(draft.date), language)}.`}</span></div>}
        </FormCard>
      </>}
      {step === 2 && <>
        <FormCard title={en ? 'Your report' : 'Η αναφορά σας'} icon={Send} wide={!canManage}>
          <strong className="quality-report-title">{draft[titleKey]}</strong>
          <RecordDetailsGrid fields={[
            { label: en ? 'Kind' : 'Είδος', value: vocabularyLabel(REPORT_KINDS, draft.reportKind, language) },
            classified && { label: en ? 'Reached the patient' : 'Έφτασε στον ασθενή', value: vocabularyLabel(INCIDENT_CLASSES, draft.incidentClass, language) },
            draft.category && { label: en ? 'Category' : 'Κατηγορία', value: incidentCategoryLabel(draft.category, categories, language) },
            { label: en ? 'Department' : 'Τμήμα', value: en ? draft.departmentEn || draft.department : draft.department },
            { label: en ? 'Date' : 'Ημερομηνία', value: [formatDay(draft.date, language), draft.eventTime].filter(Boolean).join(' ') },
            harmful && { label: en ? 'Harm' : 'Βλάβη', value: vocabularyLabel(IMPACTS, draft.impact, language) },
            { label: en ? 'Reported' : 'Αναφορά', value: draft.anonymous ? (en ? 'Anonymously' : 'Ανώνυμα') : (en ? 'With my name' : 'Με το όνομά μου') },
          ]} />
          <p className="quality-report-description">{draft[descriptionKey]}</p>
        </FormCard>
        {canManage && <FormCard title={en ? 'Assessment (Quality)' : 'Αξιολόγηση (Ποιότητα)'} hint={en ? 'Optional now; can be set later.' : 'Προαιρετικά τώρα· ορίζεται και αργότερα.'} icon={UserCheck}>
          <ChoiceField label={t('severity')} value={draft.severity} options={severityOptions(t)} onChange={value => set('severity', value)} />
          <QualityOwnerField record={draft} onChange={patch} />
        </FormCard>}
      </>}
    </div>
    <div className="inline-edit-footer quality-report-footer">
      <span className="quality-report-step">{en ? 'Step' : 'Βήμα'} {step + 1} / {steps.length}</span>
      {step > 0 ? <Button variant="secondary" disabled={saving} onClick={() => goTo(step - 1)}><ArrowLeft size={15} />{en ? 'Back' : 'Πίσω'}</Button> : <Button variant="secondary" onClick={goBack}>{t('cancel')}</Button>}
      {step < steps.length - 1 ? <Button disabled={!valid[step]} onClick={() => goTo(step + 1)}>{en ? 'Next' : 'Επόμενο'}<ArrowRight size={15} /></Button> : <SaveButton loading={saving} disabled={!valid.every(Boolean) || saving} onClick={send}>{en ? 'Send report' : 'Αποστολή αναφοράς'}</SaveButton>}
    </div>
  </div>)
}
