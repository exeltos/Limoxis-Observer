import { useEffect, useMemo, useState } from 'react'
import { EpiMiniQuestions, useEpiMini } from '../surveillance/epiQuestionnaire/EpiQuestionnaireViews'
import { isCultureSampleType } from '../surveillance/epiQuestionnaire/epiQuestionnaireModel'
import { AlertTriangle, Clock3, FlaskConical, Microscope, Plus, UserPlus, UserRound, UsersRound, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FormSubmit, useFormValidation } from '../../design-system/FormValidation'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { UI_ACTIONS, canPerform } from '../../core/actions/actionPolicy'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES } from '../../core/permissions/roles'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { formatDateTime } from '../../core/i18n/formatDay'
import { ENVIRONMENTAL_SAMPLE_TYPES, EMPLOYEE_SCREENING_TYPES, LAB_PRIORITIES, patientSampleSources, patientSampleTypeOptions, referenceOptions, sampleSourceCatalog, sampleSourceLabel } from './laboratoryReferenceData'
import { createPatient, loadPatients } from '../patients/patientsService'
import { useEmployeesData } from '../employees/useEmployeesData'
import { libraryOptions, useLibraries } from '../management/useLibraries'
import { MetricCard } from '../../design-system/MetricCard'
import { SubjectChoiceStep } from '../../design-system/SubjectChoiceStep'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'
import { Field } from '../../design-system/Field'
import { getLaboratoryKpis, sampleTypeLabel } from './laboratoryCloudService'
import { computeTurnaroundHours, formatTurnaround } from './model/laboratoryModel'
import { useLaboratoryRegistry } from './hooks/useLaboratoryRegistry'
import { LAB_STATUS_ORDER, LaboratoryStatus, labResultLabel, labStatusLabel } from './LaboratoryStatus'
import { PERIOD_DAYS, inPeriod } from '../surveillance/surveillanceOptions'
import { ChoiceField } from '../../design-system/ChoiceField'
import { LAB_RESULT_SCOPES, defaultLabScope, matchesLabScope, reviewTag } from './sampleReviewModel'
import { SampleReviewTag } from '../surveillance/SampleReviewWorklist'
import './LaboratoryWorkspace.css'

export function LaboratoryWorkspace() {
  const { t, language } = useLanguage()
  const { notify } = useFeedback()
  const { canAccessRecord, tenant, isDemo, role, actualRole, membership } = useTenant()
  const { rows: repositoryRows, loading: samplesLoading, error: samplesError, createSample: createRepositorySample } = useLaboratoryRegistry()
  // Until the first read ends the figures show placeholders, not 0.
  const kpisLoading = samplesLoading && !repositoryRows.length
  const { data: employees = [] } = useEmployeesData()
  const navigate = useNavigate()
  const registry = useRegistryMemory('laboratory')
  const saved = registry.loadViewState({ query: '', status: 'all', result: 'all', department: 'all', period: 'all', scope: defaultLabScope(role || actualRole) })
  const [query, setQuery] = useState(saved.query)
  const [status, setStatus] = useState(saved.status)
  const [result, setResult] = useState(saved.result)
  const [department, setDepartment] = useState(saved.department)
  const [period, setPeriod] = useState(saved.period || 'all')
  // «Μόνο θετικά / Όλα»: the infection-control roles open on the positives, the laboratory on everything. Negatives are only hidden here, never removed.
  const [scope, setScope] = useState(saved.scope || defaultLabScope(role || actualRole))
  const [newOpen, setNewOpen] = useState(false)
  const [patients, setPatients] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  // The patient roster serves only the new-sample form: read when it opens.
  useEffect(() => {
    if (!newOpen) return
    let alive = true
    loadPatients(tenant?.id, { isDemo }).then(patientRows => { if (alive) setPatients(patientRows) }).catch(() => {})
    return () => { alive = false }
  }, [newOpen, tenant?.id, isDemo])

  const k = getLaboratoryKpis(repositoryRows)
  const fmt = value => formatDateTime(value, language)
  const departments = [...new Set(repositoryRows.map(sample => language === 'el' ? sample.department : sample.departmentEn).filter(Boolean))]
  const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
  const surveillanceLabel = sample => {
    const value = sample.surveillanceCase || sample.employeeSurveillanceCase || sample.employeeSurveillanceId || sample.environmentalSurveillanceCase || sample.environmentalBatchId
    if (!value) return '—'
    if (!isUuid(value)) return value
    if (sample.subjectType === 'employee') return language === 'el' ? 'Επιτήρηση εργαζομένου' : 'Employee surveillance'
    if (sample.subjectType === 'environment') return language === 'el' ? 'Περιβαλλοντική επιτήρηση' : 'Environmental surveillance'
    return language === 'el' ? 'Ενεργή επιτήρηση' : 'Active surveillance'
  }
  const sourceLabel = sample => {
    const value = language === 'el' ? sample.source : sample.sourceEn
    if (!value) return '—'
    return sampleSourceLabel(value, language)
  }
  const displaySampleCode = sample => /^LAB-EMP-[0-9a-f-]{20,}$/i.test(sample.id) ? (language === 'el' ? 'Δείγμα εργαζομένου' : 'Employee sample') : sample.id
  const rows = useMemo(() => repositoryRows
    .filter(sample => canAccessRecord(sample))
    .filter(sample => `${sample.id} ${sample.patient} ${sample.patientEn} ${sample.patientId} ${sample.organism ?? ''} ${sample.surveillanceCase ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .filter(sample => status === 'all' || sample.status === status)
    .filter(sample => result === 'all' || (result === 'critical' ? sample.critical : sample.result === result))
    .filter(sample => department === 'all' || (language === 'el' ? sample.department : sample.departmentEn) === department)
    .filter(sample => matchesLabScope(sample, scope))
    .filter(sample => inPeriod(sample.collectedAt || sample.requestedAt, period)),
  [query, status, result, department, period, scope, language, repositoryRows, canAccessRecord])

  const clearFilters = () => { setQuery(''); setStatus('all'); setResult('all'); setDepartment('all'); setPeriod('all'); setScope(LAB_RESULT_SCOPES.ALL) }
  const canCreate = canPerform({ role: role || actualRole, addOns: membership?.capabilities ?? [], customCapabilities: membership?.customCapabilities ?? [], action: UI_ACTIONS.CREATE, resourceCapability: CAPABILITIES.MANAGE_LAB_SAMPLES })
  const registerLabel = language === 'el' ? 'Καταχώρηση δείγματος' : 'Register sample'
  // Empty lists say why: nothing registered yet, or nothing matches the search or filters.
  const recorded = repositoryRows.filter(sample => canAccessRecord(sample))
  const empty = samplesLoading ? { title: language === 'el' ? 'Φόρτωση δειγμάτων…' : 'Loading samples…' }
    : samplesError ? { title: language === 'el' ? 'Τα δείγματα δεν φορτώθηκαν' : 'Samples could not be loaded', text: language === 'el' ? 'Ανανεώστε τη σελίδα ή δοκιμάστε ξανά σε λίγο.' : 'Refresh the page or try again shortly.' }
    : recorded.length ? { title: t('svEmptyFiltered'), text: t('svEmptyFilteredHint'), filtered: true, onClear: clearFilters }
    : { title: language === 'el' ? 'Δεν υπάρχουν εργαστηριακά δείγματα' : 'No laboratory samples', text: canCreate ? (language === 'el' ? 'Καταχωρίστε το πρώτο δείγμα για να ξεκινήσει η εργαστηριακή ροή.' : 'Register the first sample to start the laboratory flow.') : '', icon: FlaskConical, action: canCreate ? { label: registerLabel, icon: Plus, onClick: () => setNewOpen(true) } : null }
  useEffect(() => setPage(1), [query, status, result, department, period, scope, pageSize])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)

  async function createSample(draft) {
    try {
      let patient = null
      if (draft.subjectType === 'patient') {
        patient = patients.find(item => item.id === draft.subjectCode)
        if (draft.newPatient && !isDemo) {
          const names = String(draft.subjectName || draft.subjectNameEn || '').trim().split(/\s+/)
          const created = await createPatient(tenant?.id, patients, {
            patientCode: draft.subjectCode,
            firstName: names.shift() || '',
            lastName: names.join(' ') || '',
            departmentId: draft.departmentId || null,
            department: draft.department,
            departmentEn: draft.departmentEn,
            admissionDate: new Date().toISOString().slice(0, 10),
            status: 'active',
          }, { isDemo: false })
          patient = created.record
          setPatients(created.list)
        }
      }
      await createRepositorySample({ patientRecordId: patient?.recordId || null, draft: { ...draft, patient: draft.subjectName, patientEn: draft.subjectNameEn, patientId: draft.subjectCode } })
      setNewOpen(false)
      notify(t('laboratoryRecords.sampleCreated'), 'success')
    } catch (error) { notify(error?.message || t('actionFailed'), 'error') }
  }

  function openSample(sample) {
    registry.saveViewState({ query, status, result, department, period, scope })
    registry.openRecord(navigate, `/laboratory/${sample.id}`, sample.id, rows.map(item => item.id))
  }

  return <Page fill title={t('laboratory')} subtitle={t('laboratoryRecords.labSubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE]} actionCapabilities={{ [UI_ACTIONS.CREATE]: CAPABILITIES.MANAGE_LAB_SAMPLES }} actionLabels={{ [UI_ACTIONS.CREATE]: registerLabel }} onAction={action => action === UI_ACTIONS.CREATE && setNewOpen(true)} />}>
    <div className="module-summary-strip lab-summary"><LabKpi loading={kpisLoading} icon={FlaskConical} label={language === 'el' ? 'Δείγματα σήμερα' : 'Samples today'} value={k.today}/><LabKpi loading={kpisLoading} icon={Clock3} label={t('laboratoryRecords.pendingResults')} value={k.pending}/><LabKpi loading={kpisLoading} icon={Microscope} label={t('laboratoryRecords.positiveResults')} value={k.positive} filter="positive" current={result} onFilter={setResult}/><LabKpi loading={kpisLoading} icon={AlertTriangle} label={t('laboratoryRecords.uncommunicatedCritical')} value={k.critical} danger={k.critical > 0} filter="critical" current={result} onFilter={setResult}/></div>
    <section className="surface workspace-fill registry-workspace workspace-column canonical-paginated-registry laboratory-registry">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={t('laboratoryRecords.searchLab')} activeAdvancedCount={(status !== 'all' ? 1 : 0) + (department !== 'all' ? 1 : 0) + (result !== 'all' ? 1 : 0) + (period !== 'all' ? 1 : 0) + (scope !== LAB_RESULT_SCOPES.ALL ? 1 : 0)} onClear={clearFilters} advanced={<>
        <FilterSelect label={language === 'en' ? 'Show' : 'Εμφάνιση'} value={scope} onChange={setScope}><option value={LAB_RESULT_SCOPES.ALL}>{language === 'en' ? 'All' : 'Όλα'}</option><option value={LAB_RESULT_SCOPES.POSITIVE}>{language === 'en' ? 'Positive only' : 'Μόνο θετικά'}</option></FilterSelect>
        <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(item => <option key={item}>{item}</option>)}</FilterSelect>
        <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option>{LAB_STATUS_ORDER.map(item => <option key={item} value={item}>{labStatusLabel(item, language)}</option>)}</FilterSelect>
        <FilterSelect label={t('result')} value={result} onChange={setResult}><option value="all">{t('all')}</option><option value="positive">{t('positive')}</option><option value="negative">{t('negative')}</option><option value="critical">{t('criticalResult')}</option></FilterSelect>
        <FilterSelect label={t('svPeriod')} value={period} onChange={setPeriod}><option value="all">{t('svPeriodAll')}</option>{PERIOD_DAYS.map(days => <option key={days} value={String(days)}>{t(`svPeriod${days}`)}</option>)}</FilterSelect>
      </>}/>
      <div className="scroll-table" ref={registry.scrollRef}>
      <RegistryTable bare className="lab-table" columns={[
        {key:'sample',label:t('sampleCode')},{key:'subject',label:t('laboratoryRecords.subject')},{key:'type',label:t('sampleType')},{key:'source',label:t('clinicalSource'),className:'lab-col-secondary'},{key:'result',label:t('result')},{key:'status',label:t('status')}
      ]} rows={pagedRows} loading={samplesLoading} rowKey={sample => sample.id} rowProps={sample => { const rp = registry.rowProps(sample.id, () => openSample(sample)); return { ...rp, className: `${rp.className} clickable-row` } }} emptyTitle={empty.title} emptyText={empty.text} emptyFiltered={Boolean(empty.filtered)} onClearFilters={empty.onClear} emptyIcon={empty.icon} emptyAction={empty.action} renderRow={sample => <>
        <td><strong>{displaySampleCode(sample)}</strong><small>{[fmt(sample.collectedAt), computeTurnaroundHours(sample) != null && formatTurnaround(computeTurnaroundHours(sample), language)].filter(Boolean).join(' · ')}</small></td>
        <td><strong>{language === 'el' ? sample.patient : sample.patientEn}</strong><small>{sample.patientId} · {language === 'el' ? sample.department : sample.departmentEn}</small></td>
        <td>{sampleTypeLabel(sample.type,t)}{surveillanceLabel(sample) !== '—' && <small>{surveillanceLabel(sample)}</small>}<small className="lab-inline-secondary">{[sourceLabel(sample) !== '—' && sourceLabel(sample), sample.anatomicalSite].filter(Boolean).join(' · ')}</small></td>
        <td className="lab-col-secondary">{sourceLabel(sample)}{sample.anatomicalSite && <small>{sample.anatomicalSite}</small>}</td>
        <td>{labResultLabel(sample, t, language) ? <LaboratoryStatus text={labResultLabel(sample, t, language)} kind={sample.result}/> : <span>—</span>}{sample.critical && <small className="lab-critical-note">{language === 'el' ? 'Κρίσιμο εύρημα' : 'Critical finding'}</small>}{reviewTag(sample, language) && <small className="lab-review-tag"><SampleReviewTag label={reviewTag(sample, language)}/></small>}</td>
        <td><LaboratoryStatus text={labStatusLabel(sample.status, language)} kind={sample.status}/></td>
      </>}/>
      </div>
      {rows.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }}/>}
    </section>
    {newOpen && <NewSampleCard t={t} language={language} patients={patients} employees={employees} recentSamples={repositoryRows} onClose={() => setNewOpen(false)} onSave={createSample}/>}
  </Page>
}

// A card with a result filter narrows the registry to it; clicking it again clears it.
function LabKpi({ icon: Icon, label, value, danger, filter, current, onFilter, loading = false }) { const active = Boolean(filter) && current === filter; return <MetricCard loading={loading} icon={Icon} value={value} label={label} tone={danger ? 'danger' : 'neutral'} active={active} onClick={filter && onFilter ? () => onFilter(active ? 'all' : filter) : undefined}/> }

function NewSampleCard({ t, language, patients, employees, recentSamples, onClose, onSave }) {
  const en = language === 'en'
  const { libraries, departments } = useLibraries()
  const [typeChoice, setTypeChoice] = useState('')
  const [subjectType, setSubjectType] = useState('')
  const [patientMode, setPatientMode] = useState('')
  const emptyDraft = type => ({ subjectType: type, subjectName: '', subjectNameEn: '', subjectCode: '', newPatient: false, departmentId: '', department: '', departmentEn: '', type: '', source: '', sourceEn: '', sourceCode: '', environmentType: '', anatomicalSite: '', collectedAt: '', priority: '' })
  const [draft, setDraft] = useState(emptyDraft(''))
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  function switchSubject(type) { setSubjectType(type); setPatientMode(''); setDraft(emptyDraft(type)) }
  function setDepartment(id) { const item = departments.find(value => value.id === id); setDraft(current => ({ ...current, departmentId: id, department: item?.name || '', departmentEn: item?.nameEn || item?.name || '' })) }
  function choosePatient(id) { const patient = patients.find(item => item.id === id); if (patient) setDraft(current => ({ ...current, subjectName: patient.name, subjectNameEn: patient.nameEn, subjectCode: patient.id, departmentId: patient.departmentId || '', department: patient.department || '', departmentEn: patient.departmentEn || '', newPatient: false })) }
  function chooseEmployee(id) { const employee = employees.find(item => item.id === id); if (employee) setDraft(current => ({ ...current, subjectName: `${employee.lastName} ${employee.firstName}`, subjectNameEn: `${employee.firstNameEn || employee.firstName} ${employee.lastNameEn || employee.lastName}`, subjectCode: employee.id, departmentId: employee.departmentId || '', department: employee.department || '', departmentEn: employee.departmentEn || '' })) }
  const sourceFields = code => { const source = code ? sampleSourceCatalog[code] || { el: code, en: code } : null; return { sourceCode: code || '', source: source?.el || '', sourceEn: source?.en || '' } }
  // A library sample type maps onto the stored type (and may already say the source).
  function setType(value) { const option = typeOptions.find(item => item.value === value); setTypeChoice(option ? value : ''); setDraft(current => ({ ...current, type: option?.type || '', ...sourceFields(option?.source), anatomicalSite: option?.type === current.type ? current.anatomicalSite : '' })) }
  function setSource(code) { setDraft(current => ({ ...current, ...sourceFields(code) })) }
  function setEnvType(code) { const item = ENVIRONMENTAL_SAMPLE_TYPES.find(value => value.id === code); setDraft(current => ({ ...current, environmentType: code || '', type: code ? 'environmental' : '', source: item?.el || '', sourceEn: item?.en || '' })) }
  function setEmployeeSource(code) { const item = EMPLOYEE_SCREENING_TYPES.find(value => value.id === code); setDraft(current => ({ ...current, type: code ? 'surveillance' : '', sourceCode: code || '', source: item?.el || '', sourceEn: item?.en || '' })) }
  const subjectReady = subjectType === 'patient' ? Boolean(patientMode) : Boolean(subjectType)
  const subjectChoices = [
    ['patient', UserRound, en ? 'Patient' : 'Ασθενής', en ? 'Clinical specimen linked to a patient' : 'Κλινικό δείγμα συνδεδεμένο με ασθενή'],
    ['employee', UsersRound, en ? 'Employee' : 'Εργαζόμενος', en ? 'Occupational screening specimen' : 'Δείγμα επιτήρησης εργαζομένου'],
    ['environment', Building2, en ? 'Environment' : 'Περιβάλλον', en ? 'Surface, equipment, water or air' : 'Επιφάνεια, εξοπλισμός, νερό ή αέρας'],
  ]

  // Collection date and time are kept apart (shared date and 24-hour time fields)
  // and joined into the local "YYYY-MM-DDTHH:MM" value the sample stores.
  const collectedDate = draft.collectedAt.slice(0, 10), collectedTime = draft.collectedAt.slice(11, 16)
  const setCollected = (date, time) => set('collectedAt', date ? `${date}T${time || '00:00'}` : '')
  const patientOptions = patients.filter(item => item.status === 'active').map(patient => ({ value: patient.id, label: language === 'el' ? patient.name : patient.nameEn || patient.name, description: [patient.id, language === 'el' ? patient.department : patient.departmentEn || patient.department].filter(Boolean).join(' · ') }))
  const employeeOptions = employees.filter(item => item.employmentStatus === 'active').map(employee => ({ value: employee.id, label: language === 'el' ? `${employee.lastName} ${employee.firstName}` : `${employee.firstNameEn || employee.firstName} ${employee.lastNameEn || employee.lastName}`, description: [employee.id, language === 'el' ? employee.department : employee.departmentEn || employee.department].filter(Boolean).join(' · ') }))
  function choosePatientMode(mode) { setPatientMode(mode); setTypeChoice(''); setDraft(current => ({ ...emptyDraft('patient'), newPatient: mode === 'new', collectedAt: current.collectedAt, priority: current.priority })) }
  // Lists from the central libraries; the departments of recent samples first.
  const typeOptions = useMemo(() => patientSampleTypeOptions(libraries.sampleTypes, language, t), [libraries.sampleTypes, language, t])
  const departmentChoices = departments.map(item => ({ value: item.id, label: en ? item.nameEn || item.name : item.name, description: item.nameEn && item.nameEn !== item.name ? (en ? item.name : item.nameEn) : undefined, keywords: `${item.name} ${item.nameEn || ''}` }))
  const recentDepartments = [...new Set([...recentSamples].sort((a, b) => String(b.collectedAt || '').localeCompare(String(a.collectedAt || ''))).map(sample => sample.department).filter(Boolean))].map(name => departments.find(item => item.name === name)?.id).filter(Boolean)
  const pointOptions = useMemo(() => libraryOptions([...(libraries.environmentalLocations || []), ...(libraries.surfacePoints || [])], language), [libraries.environmentalLocations, libraries.surfacePoints, language])
  const selectText = { emptyLabel: en ? 'No match' : 'Καμία αντιστοιχία', clearLabel: t('surveillanceList.clearSelection') }
  // The shared rule: «*» on every required field, «Συμπληρώστε: …» beside the button, messages on a press.
  // The mini version of the epidemiological questionnaire (3 core questions) for patient cultures: kept with
  // the sample and used to prefill the questionnaire when a surveillance episode is opened for it.
  const miniOn = subjectType === 'patient' && Boolean(patientMode) && isCultureSampleType(draft.type)
  const mini = useEpiMini({ enabled: true })
  const form = useFormValidation([
    ...(miniOn ? mini.rules : []),
    { key: 'subjectType', label: en ? 'Sample origin' : 'Προέλευση δείγματος', valid: Boolean(subjectType) },
    subjectType === 'patient' && { key: 'patientMode', label: en ? 'Existing or new patient' : 'Υπάρχων ή νέος ασθενής', valid: Boolean(patientMode) },
    subjectType === 'patient' && patientMode === 'existing' && { key: 'subjectCode', label: t('patient'), valid: Boolean(draft.subjectCode) },
    subjectType === 'patient' && patientMode === 'new' && { key: 'subjectName', label: t('patient'), valid: Boolean(draft.subjectName.trim()) },
    subjectType === 'patient' && patientMode === 'new' && { key: 'subjectCode', label: t('patientId'), valid: Boolean(draft.subjectCode.trim()) },
    subjectType === 'employee' && { key: 'subjectCode', label: en ? 'Employee' : 'Εργαζόμενος', valid: Boolean(draft.subjectCode) },
    subjectType === 'environment' && { key: 'environmentType', label: en ? 'Environmental sample type' : 'Τύπος περιβαλλοντικού δείγματος', valid: Boolean(draft.environmentType) },
    subjectType === 'environment' && { key: 'subjectName', label: en ? 'Sampling point' : 'Σημείο δειγματοληψίας', valid: Boolean(draft.subjectName) },
    subjectReady && { key: 'departmentId', label: t('department'), valid: Boolean(draft.departmentId) },
    subjectType === 'patient' && patientMode && { key: 'type', label: t('sampleType'), valid: Boolean(draft.type) },
    subjectType === 'patient' && patientMode && { key: 'sourceCode', label: t('collectionSource'), valid: Boolean(draft.sourceCode) },
    subjectType === 'employee' && { key: 'sourceCode', label: en ? 'Screening type' : 'Τύπος ελέγχου', valid: Boolean(draft.sourceCode) },
    subjectReady && { key: 'priority', label: t('priority'), valid: Boolean(draft.priority) },
    subjectReady && { key: 'collectedDate', label: t('clinicalRecords.collectionDate'), valid: Boolean(draft.collectedAt) },
  ])

  return <ObserverDialog width="standard" className="lab-create-flow" eyebrow={en ? 'NEW LABORATORY SAMPLE' : 'ΝΕΟ ΕΡΓΑΣΤΗΡΙΑΚΟ ΔΕΙΓΜΑ'} title={en ? 'Sample registration' : 'Καταχώρηση δείγματος'} onClose={onClose} footer={<FormSubmit form={form} onSubmit={() => onSave(miniOn ? { ...draft, clinicalContext: mini.context() } : draft)}>{t('save')}</FormSubmit>}>
    <div className="lab-flow-body" ref={form.scopeRef}>
      <section className="lab-flow-section" data-field-key="subjectType"><SubjectChoiceStep compact step={1} title={en ? 'Where does the sample come from?' : 'Από πού προέρχεται το δείγμα;'} hint={en ? 'Choose one category to continue.' : 'Επιλέξτε μία κατηγορία για να συνεχίσετε.'} choices={subjectChoices} value={subjectType} onChoose={switchSubject}/>{form.errorFor('subjectType') && <span className="field-error">{form.errorFor('subjectType')}</span>}</section>

      {subjectType === 'patient' && <section className="lab-flow-section lab-flow-reveal"><div className="lab-flow-heading"><span>2</span><div><strong>{en ? 'Patient' : 'Ασθενής'}</strong><small>{en ? 'Choose an existing patient or register a new one.' : 'Επιλέξτε υπάρχοντα ασθενή ή καταχωρήστε νέο.'}</small></div></div><div data-field-key="patientMode"><ModeSwitch ariaLabel={en ? 'Patient' : 'Ασθενής'} value={patientMode} onChange={choosePatientMode} options={[{ value: 'existing', label: t('existingPatient'), icon: UserRound }, { value: 'new', label: t('laboratoryRecords.newPatientInline'), icon: UserPlus }]}/>{form.errorFor('patientMode') && <span className="field-error">{form.errorFor('patientMode')}</span>}</div></section>}

      {subjectReady && <section className="lab-flow-section lab-flow-reveal"><div className="lab-flow-heading"><span>{subjectType === 'patient' ? '3' : '2'}</span><div><strong>{en ? 'Sample details' : 'Στοιχεία δείγματος'}</strong><small>{en ? 'Complete the required information.' : 'Συμπληρώστε τα απαραίτητα στοιχεία.'}</small></div></div><div className="entry-grid lab-flow-grid">
        {subjectType === 'patient' && patientMode === 'existing' && <div className="lab-flow-full"><SearchableSelect label={t('patient')} {...form.field('subjectCode')} value={draft.subjectCode} onChange={choosePatient} options={patientOptions} placeholder={t('surveillanceList.patientSearchPlaceholder')} emptyLabel={t('surveillanceList.noPatientsFound')} clearLabel={t('surveillanceList.clearSelection')}/></div>}
        {subjectType === 'patient' && patientMode === 'new' && <><Field label={t('patient')} {...form.field('subjectName')}><input value={draft.subjectName} onChange={event => { set('subjectName', event.target.value); set('subjectNameEn', event.target.value) }}/></Field><Field label={t('patientId')} {...form.field('subjectCode')}><input value={draft.subjectCode} onChange={event => set('subjectCode', event.target.value)}/></Field></>}
        {subjectType === 'employee' && <div className="lab-flow-full"><SearchableSelect label={en ? 'Employee' : 'Εργαζόμενος'} {...form.field('subjectCode')} value={draft.subjectCode} onChange={chooseEmployee} options={employeeOptions} placeholder={en ? 'Search by name or code…' : 'Αναζήτηση με όνομα ή κωδικό…'} emptyLabel={en ? 'No employees found' : 'Δεν βρέθηκαν εργαζόμενοι'} clearLabel={t('surveillanceList.clearSelection')}/></div>}
        {subjectType === 'environment' && <><SearchableSelect label={en ? 'Environmental sample type' : 'Τύπος περιβαλλοντικού δείγματος'} {...form.field('environmentType')} value={draft.environmentType} onChange={setEnvType} options={referenceOptions(ENVIRONMENTAL_SAMPLE_TYPES, language)} placeholder={en ? 'Select type' : 'Επιλέξτε τύπο'} {...selectText}/><SearchableSelect label={draft.environmentType === 'water' ? (en ? 'Sampling point' : 'Σημείο υδροληψίας') : (en ? 'Sampling point / location' : 'Σημείο / χώρος δειγματοληψίας')} {...form.field('subjectName')} value={draft.subjectName} onChange={value => setDraft(current => ({ ...current, subjectName: value || '', subjectNameEn: value || '' }))} options={pointOptions} allowCustom customLabel={text => en ? `Use «${text}»` : `Χρήση «${text}»`} placeholder={en ? 'Search or type a point' : 'Αναζήτηση ή νέο σημείο'} {...selectText}/></>}
        <SearchableSelect label={t('department')} {...form.field('departmentId')} value={draft.departmentId} onChange={setDepartment} options={departmentChoices} recentValues={recentDepartments} recentLabel={en ? 'Recent samples' : 'Πρόσφατα δείγματα'} placeholder={en ? 'Select department' : 'Επιλέξτε τμήμα'} {...selectText}/>
        {subjectType === 'patient' && <><SearchableSelect label={t('sampleType')} {...form.field('type')} value={draft.type ? typeChoice : ''} onChange={setType} options={typeOptions} placeholder={en ? 'Select sample type' : 'Επιλέξτε τύπο δείγματος'} {...selectText}/><SearchableSelect label={t('collectionSource')} {...form.field('sourceCode')} value={draft.sourceCode} disabled={!draft.type} onChange={setSource} options={patientSampleSources(draft.type).map(code => ({ value: code, label: t(sampleSourceCatalog[code]?.label || code) }))} placeholder={en ? 'Select source' : 'Επιλέξτε πηγή'} {...selectText}/><Field label={t('anatomicalSite')}><input value={draft.anatomicalSite} onChange={event => set('anatomicalSite', event.target.value)}/></Field></>}
        {subjectType === 'employee' && <SearchableSelect label={en ? 'Screening type' : 'Τύπος ελέγχου'} {...form.field('sourceCode')} value={draft.sourceCode} onChange={setEmployeeSource} options={referenceOptions(EMPLOYEE_SCREENING_TYPES, language)} placeholder={en ? 'Select screening type' : 'Επιλέξτε τύπο ελέγχου'} {...selectText}/>}
        <ChoiceField className="lab-flow-priority" label={t('priority')} {...form.field('priority')} placeholder={en ? 'Select priority' : 'Επιλέξτε προτεραιότητα'} value={draft.priority} onChange={value => set('priority', value)} options={LAB_PRIORITIES.map(id => ({ value: id, label: t(id) }))}/>
        <div className="lab-collected-pair"><ManualDateField label={t('clinicalRecords.collectionDate')} {...form.field('collectedDate')} value={collectedDate} onChange={value => setCollected(value, collectedTime)}/><TimeField label={t('copy.clinicalRecordCopy.collectionTime')} value={collectedTime} onChange={value => setCollected(collectedDate, value)} disabled={!collectedDate}/></div>
      </div></section>}
      {miniOn && <EpiMiniQuestions mini={mini} form={form}/>}
    </div>
  </ObserverDialog>
}