import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock3, FlaskConical, Microscope, UserPlus, UserRound, UsersRound, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { SaveButton } from '../../design-system/SaveButton'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
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
import { LaboratoryStatus } from './LaboratoryStatus'
import { ChoiceField } from '../../design-system/ChoiceField'
import './LaboratoryWorkspace.css'

export function LaboratoryWorkspace() {
  const { t, language } = useLanguage()
  const { notify } = useFeedback()
  const { canAccessRecord, tenant, isDemo } = useTenant()
  const { rows: repositoryRows, loading: samplesLoading, error: samplesError, createSample: createRepositorySample } = useLaboratoryRegistry()
  const { data: employees = [] } = useEmployeesData()
  const navigate = useNavigate()
  const registry = useRegistryMemory('laboratory')
  const saved = registry.loadViewState({ query: '', status: 'all', result: 'all', department: 'all' })
  const [query, setQuery] = useState(saved.query)
  const [status, setStatus] = useState(saved.status)
  const [result, setResult] = useState(saved.result)
  const [department, setDepartment] = useState(saved.department)
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
    .filter(sample => department === 'all' || (language === 'el' ? sample.department : sample.departmentEn) === department),
  [query, status, result, department, language, repositoryRows, canAccessRecord])

  const filtered = Boolean(query.trim()) || status !== 'all' || result !== 'all' || department !== 'all'
  useEffect(() => setPage(1), [query, status, result, department, pageSize])
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
    registry.saveViewState({ query, status, result, department })
    registry.openRecord(navigate, `/laboratory/${sample.id}`, sample.id, rows.map(item => item.id))
  }

  return <Page fill title={t('laboratory')} subtitle={t('laboratoryRecords.labSubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE]} actionCapabilities={{ [UI_ACTIONS.CREATE]: CAPABILITIES.MANAGE_LAB_SAMPLES }} onAction={action => action === UI_ACTIONS.CREATE && setNewOpen(true)} />}>
    <div className="module-summary-strip lab-summary"><LabKpi icon={FlaskConical} label={language === 'el' ? 'Δείγματα σήμερα' : 'Samples today'} value={k.today}/><LabKpi icon={Clock3} label={t('laboratoryRecords.pendingResults')} value={k.pending}/><LabKpi icon={Microscope} label={t('laboratoryRecords.positiveResults')} value={k.positive} filter="positive" current={result} onFilter={setResult}/><LabKpi icon={AlertTriangle} label={t('laboratoryRecords.uncommunicatedCritical')} value={k.critical} danger={k.critical > 0} filter="critical" current={result} onFilter={setResult}/></div>
    <section className="surface workspace-fill registry-workspace workspace-column canonical-paginated-registry laboratory-registry">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={t('laboratoryRecords.searchLab')} activeAdvancedCount={(status !== 'all' ? 1 : 0) + (department !== 'all' ? 1 : 0) + (result !== 'all' ? 1 : 0)} onClear={() => { setQuery(''); setStatus('all'); setResult('all'); setDepartment('all') }}>
        <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="requested">{t('requested')}</option><option value="received">{t('received')}</option><option value="processing">{t('processing')}</option><option value="completed">{t('completed')}</option><option value="rejected">{t('rejected')}</option><option value="cancelled">{t('cancelled')}</option></FilterSelect>
        <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(item => <option key={item}>{item}</option>)}</FilterSelect>
        <FilterSelect label={t('result')} value={result} onChange={setResult}><option value="all">{t('all')}</option><option value="positive">{t('positive')}</option><option value="negative">{t('negative')}</option><option value="critical">{t('criticalResult')}</option></FilterSelect>
      </FilterBar>
      <RegistryTable wrapperRef={registry.scrollRef} className="lab-table" columns={[
        {key:'sample',label:t('sampleCode')},{key:'subject',label:t('laboratoryRecords.subject')},{key:'type',label:t('sampleType')},{key:'source',label:t('clinicalSource')},{key:'result',label:t('result')},{key:'status',label:t('status')}
      ]} rows={pagedRows} rowKey={sample => sample.id} rowProps={sample => ({...registry.rowProps(sample.id),onClick:() => openSample(sample)})} emptyTitle={samplesLoading ? (language === 'el' ? 'Φόρτωση δειγμάτων…' : 'Loading samples…') : samplesError ? (language === 'el' ? 'Τα δείγματα δεν φορτώθηκαν' : 'Samples could not be loaded') : (language === 'el' ? 'Δεν υπάρχουν εργαστηριακά δείγματα' : 'No laboratory samples')} emptyText={samplesLoading ? '' : samplesError ? (language === 'el' ? 'Ανανεώστε τη σελίδα ή δοκιμάστε ξανά σε λίγο.' : 'Refresh the page or try again shortly.') : filtered ? (language === 'el' ? 'Δεν βρέθηκαν εγγραφές με τα επιλεγμένα φίλτρα.' : 'No records match the selected filters.') : (language === 'el' ? 'Πατήστε «Δημιουργία» για να καταχωρίσετε το πρώτο δείγμα.' : 'Use “Create” to register the first sample.')} renderRow={sample => <>
        <td><strong>{displaySampleCode(sample)}</strong><small>{[fmt(sample.collectedAt), computeTurnaroundHours(sample) != null && formatTurnaround(computeTurnaroundHours(sample), language)].filter(Boolean).join(' · ')}</small></td>
        <td><strong>{language === 'el' ? sample.patient : sample.patientEn}</strong><small>{sample.patientId} · {language === 'el' ? sample.department : sample.departmentEn}</small></td>
        <td>{sampleTypeLabel(sample.type,t)}{surveillanceLabel(sample) !== '—' && <small>{surveillanceLabel(sample)}</small>}</td>
        <td>{sourceLabel(sample)}{sample.anatomicalSite && <small>{sample.anatomicalSite}</small>}</td>
        <td>{sample.result ? <LaboratoryStatus text={t(sample.result)} kind={sample.result}/> : <span>—</span>}{sample.critical && <small className="lab-critical-note">{language === 'el' ? 'Κρίσιμο εύρημα' : 'Critical finding'}</small>}</td>
        <td><LaboratoryStatus text={t(sample.status)} kind={sample.status}/></td>
      </>}/>
      {rows.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>}
    </section>
    {newOpen && <NewSampleCard t={t} language={language} patients={patients} employees={employees} recentSamples={repositoryRows} onClose={() => setNewOpen(false)} onSave={createSample}/>}
  </Page>
}

// A card with a result filter narrows the registry to it; clicking it again clears it.
function LabKpi({ icon: Icon, label, value, danger, filter, current, onFilter }) { const active = Boolean(filter) && current === filter; return <MetricCard icon={Icon} value={value} label={label} tone={danger ? 'danger' : 'neutral'} active={active} onClick={filter && onFilter ? () => onFilter(active ? 'all' : filter) : undefined}/> }

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
  const valid = Boolean(subjectType && draft.departmentId && draft.collectedAt && draft.priority) && (subjectType === 'patient' ? Boolean(patientMode && draft.subjectCode && draft.subjectName && draft.type && draft.sourceCode) : subjectType === 'employee' ? Boolean(draft.subjectCode && draft.subjectName && draft.sourceCode) : Boolean(draft.environmentType && draft.subjectName))
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

  return <ObserverDialog width="standard" fixedHeight className="lab-create-flow" eyebrow={en ? 'NEW LABORATORY SAMPLE' : 'ΝΕΟ ΕΡΓΑΣΤΗΡΙΑΚΟ ΔΕΙΓΜΑ'} title={en ? 'Sample registration' : 'Καταχώρηση δείγματος'} onClose={onClose} footer={<SaveButton disabled={!valid} onClick={() => onSave(draft)}>{t('save')}</SaveButton>}>
    <div className="lab-flow-body">
      <section className="lab-flow-section"><SubjectChoiceStep step={1} title={en ? 'Where does the sample come from?' : 'Από πού προέρχεται το δείγμα;'} hint={en ? 'Choose one category to continue.' : 'Επιλέξτε μία κατηγορία για να συνεχίσετε.'} choices={subjectChoices} value={subjectType} onChoose={switchSubject}/></section>

      {subjectType === 'patient' && <section className="lab-flow-section lab-flow-reveal"><div className="lab-flow-heading"><span>2</span><div><strong>{en ? 'Patient' : 'Ασθενής'}</strong><small>{en ? 'Choose an existing patient or register a new one.' : 'Επιλέξτε υπάρχοντα ασθενή ή καταχωρήστε νέο.'}</small></div></div><ModeSwitch ariaLabel={en ? 'Patient' : 'Ασθενής'} value={patientMode} onChange={choosePatientMode} options={[{ value: 'existing', label: t('existingPatient'), icon: UserRound }, { value: 'new', label: t('laboratoryRecords.newPatientInline'), icon: UserPlus }]}/></section>}

      {subjectReady && <section className="lab-flow-section lab-flow-reveal"><div className="lab-flow-heading"><span>{subjectType === 'patient' ? '3' : '2'}</span><div><strong>{en ? 'Sample details' : 'Στοιχεία δείγματος'}</strong><small>{en ? 'Complete the required information.' : 'Συμπληρώστε τα απαραίτητα στοιχεία.'}</small></div></div><div className="entry-grid lab-flow-grid">
        {subjectType === 'patient' && patientMode === 'existing' && <div className="lab-flow-full"><SearchableSelect label={t('patient')} value={draft.subjectCode} onChange={choosePatient} options={patientOptions} placeholder={t('surveillanceList.patientSearchPlaceholder')} emptyLabel={t('surveillanceList.noPatientsFound')} clearLabel={t('surveillanceList.clearSelection')}/></div>}
        {subjectType === 'patient' && patientMode === 'new' && <><Field label={t('patient')}><input value={draft.subjectName} onChange={event => { set('subjectName', event.target.value); set('subjectNameEn', event.target.value) }}/></Field><Field label={t('patientId')}><input value={draft.subjectCode} onChange={event => set('subjectCode', event.target.value)}/></Field></>}
        {subjectType === 'employee' && <div className="lab-flow-full"><SearchableSelect label={en ? 'Employee' : 'Εργαζόμενος'} value={draft.subjectCode} onChange={chooseEmployee} options={employeeOptions} placeholder={en ? 'Search by name or code…' : 'Αναζήτηση με όνομα ή κωδικό…'} emptyLabel={en ? 'No employees found' : 'Δεν βρέθηκαν εργαζόμενοι'} clearLabel={t('surveillanceList.clearSelection')}/></div>}
        {subjectType === 'environment' && <><SearchableSelect label={en ? 'Environmental sample type' : 'Τύπος περιβαλλοντικού δείγματος'} value={draft.environmentType} onChange={setEnvType} options={referenceOptions(ENVIRONMENTAL_SAMPLE_TYPES, language)} placeholder={en ? 'Select type' : 'Επιλέξτε τύπο'} {...selectText}/><SearchableSelect label={draft.environmentType === 'water' ? (en ? 'Sampling point' : 'Σημείο υδροληψίας') : (en ? 'Sampling point / location' : 'Σημείο / χώρος δειγματοληψίας')} value={draft.subjectName} onChange={value => setDraft(current => ({ ...current, subjectName: value || '', subjectNameEn: value || '' }))} options={pointOptions} allowCustom customLabel={text => en ? `Use «${text}»` : `Χρήση «${text}»`} placeholder={en ? 'Search or type a point' : 'Αναζήτηση ή νέο σημείο'} {...selectText}/></>}
        <SearchableSelect label={t('department')} value={draft.departmentId} onChange={setDepartment} options={departmentChoices} recentValues={recentDepartments} recentLabel={en ? 'Recent samples' : 'Πρόσφατα δείγματα'} placeholder={en ? 'Select department' : 'Επιλέξτε τμήμα'} {...selectText}/>
        {subjectType === 'patient' && <><SearchableSelect label={t('sampleType')} value={draft.type ? typeChoice : ''} onChange={setType} options={typeOptions} placeholder={en ? 'Select sample type' : 'Επιλέξτε τύπο δείγματος'} {...selectText}/><SearchableSelect label={t('collectionSource')} value={draft.sourceCode} disabled={!draft.type} onChange={setSource} options={patientSampleSources(draft.type).map(code => ({ value: code, label: t(sampleSourceCatalog[code]?.label || code) }))} placeholder={en ? 'Select source' : 'Επιλέξτε πηγή'} {...selectText}/><Field label={t('anatomicalSite')}><input value={draft.anatomicalSite} onChange={event => set('anatomicalSite', event.target.value)}/></Field></>}
        {subjectType === 'employee' && <SearchableSelect label={en ? 'Screening type' : 'Τύπος ελέγχου'} value={draft.sourceCode} onChange={setEmployeeSource} options={referenceOptions(EMPLOYEE_SCREENING_TYPES, language)} placeholder={en ? 'Select screening type' : 'Επιλέξτε τύπο ελέγχου'} {...selectText}/>}
        <ChoiceField className="lab-flow-priority" label={t('priority')} value={draft.priority} onChange={value => set('priority', value)} options={LAB_PRIORITIES.map(id => ({ value: id, label: t(id) }))}/>
        <div className="lab-collected-pair"><ManualDateField label={t('clinicalRecords.collectionDate')} value={collectedDate} onChange={value => setCollected(value, collectedTime)}/><TimeField label={t('copy.clinicalRecordCopy.collectionTime')} value={collectedTime} onChange={value => setCollected(collectedDate, value)} disabled={!collectedDate}/></div>
      </div></section>}
    </div>
  </ObserverDialog>
}