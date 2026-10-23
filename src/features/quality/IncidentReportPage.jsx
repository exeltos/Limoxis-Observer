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
import { severityOptions } from './qualityVocabulary'
import { QualityDepartmentField, QualityOwnerField, departmentRef } from './QualityFields'
import { PrefilledList } from '../surveillance/forms/PrefilledList'
import './quality.css'

const today = () => new Date().toISOString().slice(0, 10)

// Staff submit a neutral report. They do not have to decide whether the event
// is an incident, a deviation, a complaint or something else; Quality does
// that during assessment. The database stores report_kind='report' until then.
export function emptyIncidentReport() {
  return {
    title: '', titleEn: '', departmentId: '', department: '', departmentEn: '',
    status: 'reported', severity: 'medium', incidentClass: 'nearMiss',
    reachedPatient: false, harmOccurred: false, category: 'other', impact: 'none',
    date: today(), eventTime: '', description: '', descriptionEn: '',
    immediateActions: '', immediateActionsEn: '', owners: [], owner: '', ownerId: null,
    anonymous: false, reportKind: 'report', sentinel: false, rcaDueDate: '', eventType: '',
    fall: null, sharp: null, blueCode: null, obstetric: null,
  }
}

// A report may start from another workflow (episode/control). It is still a
// report first; its source only pre-fills context for Quality to assess later.
export function incidentPrefill(state, language = 'el') {
  const en = language === 'en'
  const episode = state?.episodeSource
  if (episode) return {
    reportKind: 'report', category: 'other', departmentId: episode.departmentId || '',
    department: episode.department || '', departmentEn: episode.department || '', date: today(),
    linkedPatient: episode.linkedPatient || '', linkedSurveillance: episode.linkedSurveillance || '',
    linkedAdmission: episode.linkedAdmission || '', episodeSource: episode,
  }
  const control = state?.controlSource
  if (control) {
    const lines = [
      control.controlTitle && `${en ? 'Control' : 'Έλεγχος'}: ${control.controlTitle}`,
      control.value !== undefined && control.value !== '' && control.value !== null && `${en ? 'Recorded value' : 'Καταγεγραμμένη τιμή'}: ${typeof control.value === 'object' ? JSON.stringify(control.value) : control.value}`,
      control.notes && `${en ? 'Notes' : 'Σημειώσεις'}: ${control.notes}`,
    ].filter(Boolean)
    const title = `${en ? 'Report from control' : 'Αναφορά από έλεγχο'}: ${control.controlTitle || ''}`.trim()
    const description = lines.join('\n')
    return { reportKind: 'report', category: 'other', title, titleEn: title, department: control.department || '', departmentId: control.departmentId || '', description, descriptionEn: description, date: String(control.scheduledAt || '').slice(0, 10) || today() }
  }
  const source = state?.qualitySource
  if (!source) return null
  return { reportKind: 'report', category: 'other', title: source.title || '', titleEn: source.title || '', departmentId: source.departmentId || '', department: source.department || '', description: source.description || '', descriptionEn: source.description || '', date: source.date || today() }
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
  const { departments } = useLibraries()
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  const ownerFullAccess = !isRolePreview && actualRole === ROLES.PLATFORM_OWNER
  const canManage = ownerFullAccess || can(role, CAPABILITIES.MANAGE_QUALITY, addOns, custom)
  const canViewQuality = ownerFullAccess || can(role, CAPABILITIES.VIEW_QUALITY, addOns, custom)
  const { goBack } = useContextualNavigation(canViewQuality ? '/quality' : '/quality/my-reports')
  const fromEpisode = location.state?.episodeSource || null
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(() => ({ ...emptyIncidentReport(), ...(incidentPrefill(location.state, language) || {}) }))
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(null)
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const patch = next => setDraft(current => ({ ...current, ...next }))

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

  const titleKey = en ? 'titleEn' : 'title'
  const descriptionKey = en ? 'descriptionEn' : 'description'
  const actionsKey = en ? 'immediateActionsEn' : 'immediateActions'
  const steps = [en ? 'Where & when' : 'Πού και πότε', en ? 'What happened' : 'Τι συνέβη', en ? 'Review & send' : 'Έλεγχος & αποστολή']
  const valid = [Boolean(departmentRef(draft) && draft.date), Boolean(draft[titleKey].trim() && draft[descriptionKey].trim()), true]

  async function send() {
    if (!valid.every(Boolean) || saving) return
    setSaving(true)
    try {
      const actor = draft.anonymous ? { id: null, name: en ? 'Anonymous report' : 'Ανώνυμη αναφορά' } : auditActorFromAuth({ profile, user })
      const created = await createQualityRecord('incidents', tenant?.id, {
        ...draft,
        reportKind: 'report',
        category: 'other',
        eventType: '',
        sentinel: false,
        rcaDueDate: '',
        incidentClass: 'nearMiss',
        reachedPatient: false,
        harmOccurred: false,
        impact: 'none',
        title: draft.title || draft.titleEn,
        titleEn: draft.titleEn || draft.title,
        description: draft.description || draft.descriptionEn,
        descriptionEn: draft.descriptionEn || draft.description,
        immediateActions: draft.immediateActions || draft.immediateActionsEn,
        reportedByLabel: draft.anonymous ? '' : actor.name,
        history: [auditEvent('recordCreated', { actor })],
      }, profile?.id || user?.id)
      notify(en ? 'The report was sent.' : 'Η αναφορά στάλθηκε.', 'success')
      if (fromEpisode) { goBack(); return }
      const code = created?.id || created?.code
      if (canViewQuality && code && !draft.anonymous) navigate(`/quality/incidents/${code}`, { replace: true, state: { limoxisFrom: { pathname: '/quality', search: '', hash: '', state: null, tab: 'reports', registry: null } } })
      else setSent(created)
    } catch (error) {
      console.error(error)
      notify(en ? 'The report could not be sent.' : 'Δεν ήταν δυνατή η αποστολή της αναφοράς.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const shell = children => <Page fill><EntityRecordShell
    className="quality-record-shell workspace-fill"
    avatar={<AlertTriangle size={19} />}
    eyebrow={t('quality')}
    title={en ? 'New report' : 'Νέα αναφορά'}
    subtitle={en ? 'Tell us what happened or what you observed. Quality will assess and classify it.' : 'Καταγράψτε τι συνέβη ή τι παρατηρήσατε. Η Ποιότητα θα αξιολογήσει και θα ταξινομήσει την αναφορά.'}
    tabs={[]} activeTab="" onTabChange={() => {}} onBack={goBack}>{children}</EntityRecordShell></Page>

  if (sent) return shell(<div className="record-section quality-report-done">
    <CheckCircle2 size={34} aria-hidden="true" />
    <strong>{en ? 'Thank you, your report was sent.' : 'Ευχαριστούμε, η αναφορά σας στάλθηκε.'}</strong>
    <span>{en ? 'Code' : 'Κωδικός'}: <b>{sent.displayId || sent.id}</b>{sent.anonymous ? ` · ${en ? 'anonymous' : 'ανώνυμη'}` : ''}</span>
    <p>{en ? 'Quality will assess it and decide whether it is an incident, a deviation, a complaint or another quality issue.' : 'Η Ποιότητα θα την αξιολογήσει και θα αποφασίσει αν πρόκειται για συμβάν, απόκλιση, παράπονο ή άλλο θέμα ποιότητας.'}</p>
    <div className="row-actions">
      <Button variant="secondary" onClick={() => navigate('/quality/my-reports')}>{en ? 'My reports' : 'Οι αναφορές μου'}</Button>
      <Button onClick={() => { setSent(null); setStep(0); setDraft({ ...emptyIncidentReport(), anonymous: draft.anonymous, departmentId: draft.departmentId, department: draft.department, departmentEn: draft.departmentEn }) }}><Plus size={15} />{en ? 'New report' : 'Νέα αναφορά'}</Button>
    </div>
  </div>)

  const goTo = index => setStep(Math.max(0, Math.min(steps.length - 1, index)))
  return shell(<div className="record-section quality-report-form">
    <StepList steps={steps} current={step} valid={valid} disabled={saving} onSelect={goTo} ariaLabel={en ? 'Steps' : 'Βήματα'} />
    <div className="lo-form-cards quality-report-body">
      {step === 0 && <>
        {draft.episodeSource && <PrefilledList items={[{ label: t('episodeForms.prefill.patient'), value: draft.episodeSource.patientLabel }, { label: t('episodeForms.prefill.admission'), value: draft.episodeSource.admissionLabel }, { label: t('episodeForms.prefill.episode'), value: draft.episodeSource.episodeLabel }]} />}
        <FormCard wide title={en ? 'Report' : 'Αναφορά'} icon={ClipboardList} hint={en ? 'You only report what you know. Quality decides the formal classification.' : 'Καταγράφετε μόνο όσα γνωρίζετε. Η επίσημη ταξινόμηση γίνεται από την Ποιότητα.'}>
          <ChoiceField label={en ? 'Who reports' : 'Ποιος αναφέρει'} value={draft.anonymous ? 'anonymous' : 'named'} options={[{ value: 'named', label: en ? 'With my name' : 'Με το όνομά μου' }, { value: 'anonymous', label: en ? 'Anonymously' : 'Ανώνυμα' }]} onChange={value => set('anonymous', value === 'anonymous')} />
          <small className="quality-report-hint">{draft.anonymous ? (en ? 'Your name is not stored anywhere. Quality cannot ask you for details.' : 'Το όνομά σας δεν καταγράφεται πουθενά και η Ποιότητα δεν θα μπορεί να σας ζητήσει διευκρινίσεις.') : (en ? 'You can follow the report in «My reports».' : 'Θα μπορείτε να παρακολουθείτε την αναφορά στις «Αναφορές μου».')}</small>
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
          <Field label={en ? 'Short title *' : 'Σύντομος τίτλος *'}><input value={draft[titleKey]} onChange={event => set(titleKey, event.target.value)} placeholder={en ? 'Short description of the issue' : 'Σύντομη περιγραφή του θέματος'} /></Field>
          <Field label={en ? 'Description *' : 'Περιγραφή *'} hint={en ? 'Describe facts and observations. Avoid patient names in free text.' : 'Περιγράψτε γεγονότα και παρατηρήσεις. Αποφύγετε ονόματα ασθενών στο ελεύθερο κείμενο.'}><textarea rows={5} value={draft[descriptionKey]} onChange={event => set(descriptionKey, event.target.value)} /></Field>
          <Field label={en ? 'Immediate actions taken' : 'Άμεσες ενέργειες'}><textarea rows={2} value={draft[actionsKey]} onChange={event => set(actionsKey, event.target.value)} placeholder={en ? 'Anything you did immediately…' : 'Τυχόν άμεσες ενέργειες που έγιναν…'} /></Field>
        </FormCard>
      </>}
      {step === 2 && <>
        <FormCard title={en ? 'Your report' : 'Η αναφορά σας'} icon={Send} wide={!canManage}>
          <strong className="quality-report-title">{draft[titleKey]}</strong>
          <RecordDetailsGrid fields={[
            { label: en ? 'Classification' : 'Ταξινόμηση', value: en ? 'To be assessed by Quality' : 'Προς αξιολόγηση από την Ποιότητα' },
            { label: en ? 'Department' : 'Τμήμα', value: en ? draft.departmentEn || draft.department : draft.department },
            { label: en ? 'Date' : 'Ημερομηνία', value: [formatDay(draft.date, language), draft.eventTime].filter(Boolean).join(' ') },
            { label: en ? 'Reported' : 'Αναφορά', value: draft.anonymous ? (en ? 'Anonymously' : 'Ανώνυμα') : (en ? 'With my name' : 'Με το όνομά μου') },
          ]} />
          <p className="quality-report-description">{draft[descriptionKey]}</p>
        </FormCard>
        {canManage && <FormCard title={en ? 'Initial handling (Quality)' : 'Αρχική διαχείριση (Ποιότητα)'} hint={en ? 'Severity and responsible person can be set now; formal classification follows in assessment.' : 'Μπορούν να οριστούν τώρα η σοβαρότητα και ο υπεύθυνος· η επίσημη ταξινόμηση γίνεται στην αξιολόγηση.'} icon={UserCheck}>
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
