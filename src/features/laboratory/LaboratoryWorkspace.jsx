import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock3, FlaskConical, Microscope, ShieldAlert, UserRound, UsersRound, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES } from '../../core/permissions/roles'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { sampleSourceCatalog } from './laboratoryReferenceData'
import { createPatient, loadPatients } from '../patients/patientsService'
import { useEmployeesData } from '../employees/useEmployeesData'
import { demoLibrarySeed } from '../management/managementData'
import { loadDepartments } from '../management/departmentsService'
import { MetricCard } from '../../design-system/MetricCard'
import { getLaboratoryKpis, sampleTypeLabel } from './laboratoryCloudService'
import { computeTurnaroundHours, formatTurnaround } from './model/laboratoryModel'
import { useLaboratoryRegistry } from './hooks/useLaboratoryRegistry'
import './LaboratoryWorkspace.css'

const sourceOptions = {
  bloodCulture: [['peripheral', 'peripheralBlood'], ['centralLine', 'centralLine'], ['arterialLine', 'arterialLine'], ['other', 'other']],
  urineCulture: [['midstream', 'midstreamUrine'], ['urinaryCatheter', 'urinaryCatheter'], ['nephrostomy', 'nephrostomy'], ['suprapubicCatheter', 'suprapubicCatheter'], ['other', 'other']],
  respiratorySample: [['sputum', 'sputum'], ['trachealAspirate', 'trachealAspirate'], ['bal', 'bal'], ['other', 'other']],
  woundCulture: [['woundSwab', 'woundSwab'], ['deepTissue', 'deepTissue'], ['drainage', 'drainage'], ['other', 'other']],
}
const environmentalTypes = [['surface', 'Επιφάνεια', 'Surface'], ['equipment', 'Εξοπλισμός', 'Equipment'], ['water', 'Νερό', 'Water'], ['air', 'Αέρας', 'Air'], ['other', 'Άλλο', 'Other']]

export function LaboratoryWorkspace() {
  const { t, language, locale } = useLanguage()
  const { notify } = useFeedback()
  const { canAccessRecord, tenant, isDemo } = useTenant()
  const { rows: repositoryRows, createSample: createRepositorySample } = useLaboratoryRegistry()
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
  const [departmentOptions, setDepartmentOptions] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  useEffect(() => {
    let alive = true
    Promise.all([
      loadPatients(tenant?.id, { isDemo }),
      isDemo ? Promise.resolve(demoLibrarySeed.departments.map(([name, nameEn]) => ({ id: name, name, nameEn }))) : loadDepartments(tenant?.id),
    ]).then(([patientRows, departmentRows]) => {
      if (alive) { setPatients(patientRows); setDepartmentOptions(departmentRows) }
    }).catch(() => {})
    return () => { alive = false }
  }, [tenant?.id, isDemo])

  const k = getLaboratoryKpis(repositoryRows)
  const fmt = value => value ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
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
    const aliases = {
      nasalSwab: language === 'el' ? 'Ρινικό επίχρισμα' : 'Nasal swab',
      handSwab: language === 'el' ? 'Επίχρισμα χεριών' : 'Hand swab',
      throatSwab: language === 'el' ? 'Φαρυγγικό επίχρισμα' : 'Throat swab',
      surface: language === 'el' ? 'Επιφάνεια' : 'Surface',
      equipment: language === 'el' ? 'Εξοπλισμός' : 'Equipment',
      water: language === 'el' ? 'Νερό' : 'Water',
      air: language === 'el' ? 'Αέρας' : 'Air',
    }
    const parts = String(value).split(',').map(item => item.trim()).filter(Boolean)
    return parts.map(item => aliases[item] || sampleSourceCatalog[item]?.[language] || sampleSourceCatalog[item]?.el || item).join(', ')
  }
  const displaySampleCode = sample => /^LAB-EMP-[0-9a-f-]{20,}$/i.test(sample.id) ? (language === 'el' ? 'Δείγμα εργαζομένου' : 'Employee sample') : sample.id
  const rows = useMemo(() => repositoryRows
    .filter(sample => canAccessRecord(sample))
    .filter(sample => `${sample.id} ${sample.patient} ${sample.patientEn} ${sample.patientId} ${sample.organism ?? ''} ${sample.surveillanceCase ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .filter(sample => status === 'all' || sample.status === status)
    .filter(sample => result === 'all' || (result === 'critical' ? sample.critical : sample.result === result))
    .filter(sample => department === 'all' || (language === 'el' ? sample.department : sample.departmentEn) === department),
  [query, status, result, department, language, repositoryRows, canAccessRecord])

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
    <div className="lab-kpis"><LabKpi icon={FlaskConical} label={t('laboratoryRecords.newSamplesToday')} value={k.today}/><LabKpi icon={Clock3} label={t('laboratoryRecords.pendingResults')} value={k.pending}/><LabKpi icon={Microscope} label={t('laboratoryRecords.positiveResults')} value={k.positive}/><LabKpi icon={ShieldAlert} label={t('laboratoryRecords.amrFindings')} value={k.amr}/><LabKpi icon={AlertTriangle} label={t('laboratoryRecords.uncommunicatedCritical')} value={k.critical} danger={k.critical > 0}/><LabKpi icon={Clock3} label={t('laboratoryRecords.avgTurnaroundTime')} value={formatTurnaround(k.avgTatHours, language)}/></div>
    <section className="surface workspace-fill registry-workspace workspace-column canonical-paginated-registry"><FilterBar query={query} onQueryChange={setQuery} placeholder={t('laboratoryRecords.searchLab')} activeAdvancedCount={(status !== 'all' ? 1 : 0) + (department !== 'all' ? 1 : 0) + (result !== 'all' ? 1 : 0)} onClear={() => { setQuery(''); setStatus('all'); setResult('all'); setDepartment('all') }}><FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option><option value="requested">{t('requested')}</option><option value="received">{t('received')}</option><option value="processing">{t('processing')}</option><option value="completed">{t('completed')}</option><option value="rejected">{t('rejected')}</option></FilterSelect><FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(item => <option key={item}>{item}</option>)}</FilterSelect><FilterSelect label={t('result')} value={result} onChange={setResult}><option value="all">{t('all')}</option><option value="positive">{t('positive')}</option><option value="negative">{t('negative')}</option><option value="critical">{t('criticalResult')}</option></FilterSelect></FilterBar><div className="scroll-table" ref={registry.scrollRef}><table className="data-table lab-table sticky-table"><thead><tr><th>{t('sampleCode')}</th><th>{t('laboratoryRecords.subject')}</th><th>{t('sampleType')}</th><th>{t('clinicalSource')}</th><th>{t('status')}</th><th>{t('result')}</th><th>{t('laboratoryRecords.turnaroundTime')}</th><th>{t('surveillance')}</th></tr></thead><tbody>{pagedRows.map(sample => <tr key={sample.id} {...registry.rowProps(sample.id)} onClick={() => openSample(sample)}><td><strong>{displaySampleCode(sample)}</strong><small>{fmt(sample.collectedAt)}</small></td><td><strong>{language === 'el' ? sample.patient : sample.patientEn}</strong><small>{sample.patientId} · {language === 'el' ? sample.department : sample.departmentEn}</small></td><td>{sampleTypeLabel(sample.type,t)}</td><td>{sourceLabel(sample)}{sample.anatomicalSite && <small>{sample.anatomicalSite}</small>}</td><td><Status text={t(sample.status)} kind={sample.status}/></td><td>{sample.result ? <Status text={t(sample.result)} kind={sample.result}/> : <span>—</span>}</td><td>{formatTurnaround(computeTurnaroundHours(sample), language)}</td><td>{surveillanceLabel(sample) !== '—' ? <span className="linked-case-chip" title={language === 'el' ? 'Συνδεδεμένη εγγραφή επιτήρησης' : 'Linked surveillance record'}>{surveillanceLabel(sample)}</span> : '—'}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="registry-empty-state"><strong>{language === 'el' ? 'Δεν υπάρχουν εργαστηριακά δείγματα' : 'No laboratory samples'}</strong><span>{language === 'el' ? 'Δεν βρέθηκαν εγγραφές με τα επιλεγμένα φίλτρα.' : 'No records match the selected filters.'}</span></div>}</div><RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/></section>
    {newOpen && <NewSampleCard t={t} language={language} patients={patients} employees={employees} departments={departmentOptions} onClose={() => setNewOpen(false)} onSave={createSample}/>} 
  </Page>
}

function LabKpi({ icon: Icon, label, value, danger }) { return <MetricCard icon={Icon} value={value} label={label} tone={danger ? 'danger' : 'neutral'}/> }
export function Status({ text, kind }) { return <span className={`lab-status ${kind}`}>{text}</span> }

function NewSampleCard({ t, language, patients, employees, departments, onClose, onSave }) {
  const en = language === 'en'
  const [subjectType, setSubjectType] = useState('')
  const [patientMode, setPatientMode] = useState('')
  const emptyDraft = type => ({ subjectType: type, subjectName: '', subjectNameEn: '', subjectCode: '', newPatient: false, departmentId: '', department: '', departmentEn: '', type: '', source: '', sourceEn: '', sourceCode: '', environmentType: '', anatomicalSite: '', collectedAt: '', priority: '' })
  const [draft, setDraft] = useState(emptyDraft(''))
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  function switchSubject(type) { setSubjectType(type); setPatientMode(''); setDraft(emptyDraft(type)) }
  function setDepartment(id) { const item = departments.find(value => value.id === id); setDraft(current => ({ ...current, departmentId: id, department: item?.name || '', departmentEn: item?.nameEn || item?.name || '' })) }
  function choosePatient(id) { const patient = patients.find(item => item.id === id); if (patient) setDraft(current => ({ ...current, subjectName: patient.name, subjectNameEn: patient.nameEn, subjectCode: patient.id, departmentId: patient.departmentId || '', department: patient.department || '', departmentEn: patient.departmentEn || '', newPatient: false })) }
  function chooseEmployee(id) { const employee = employees.find(item => item.id === id); if (employee) setDraft(current => ({ ...current, subjectName: `${employee.lastName} ${employee.firstName}`, subjectNameEn: `${employee.firstNameEn || employee.firstName} ${employee.lastNameEn || employee.lastName}`, subjectCode: employee.id, departmentId: employee.departmentId || '', department: employee.department || '', departmentEn: employee.departmentEn || '' })) }
  function setType(type) { setDraft(current => ({ ...current, type, source: '', sourceEn: '', sourceCode: '', anatomicalSite: '' })) }
  function setSource(code) { const source = sampleSourceCatalog[code] || { el: code, en: code }; setDraft(current => ({ ...current, sourceCode: code, source: source.el, sourceEn: source.en })) }
  function setEnvType(code) { const item = environmentalTypes.find(value => value[0] === code); setDraft(current => ({ ...current, environmentType: code, type: code ? 'environmental' : '', source: item?.[1] || '', sourceEn: item?.[2] || '' })) }
  function setEmployeeSource(code) { const labels = { nasalSwab: ['Ρινικό επίχρισμα', 'Nasal swab'], handSwab: ['Επίχρισμα χεριών', 'Hand swab'], throatSwab: ['Φαρυγγικό επίχρισμα', 'Throat swab'] }; const item = labels[code]; setDraft(current => ({ ...current, type: code ? 'surveillance' : '', sourceCode: code, source: item?.[0] || '', sourceEn: item?.[1] || '' })) }
  const subjectReady = subjectType === 'patient' ? Boolean(patientMode) : Boolean(subjectType)
  const valid = Boolean(subjectType && draft.departmentId && draft.collectedAt && draft.priority) && (subjectType === 'patient' ? Boolean(patientMode && draft.subjectCode && draft.subjectName && draft.type && draft.sourceCode) : subjectType === 'employee' ? Boolean(draft.subjectCode && draft.subjectName && draft.sourceCode) : Boolean(draft.environmentType && draft.subjectName))
  const subjectChoices = [
    ['patient', UserRound, en ? 'Patient' : 'Ασθενής', en ? 'Clinical specimen linked to a patient' : 'Κλινικό δείγμα συνδεδεμένο με ασθενή'],
    ['employee', UsersRound, en ? 'Employee' : 'Εργαζόμενος', en ? 'Occupational screening specimen' : 'Δείγμα επιτήρησης εργαζομένου'],
    ['environment', Building2, en ? 'Environment' : 'Περιβάλλον', en ? 'Surface, equipment, water or air' : 'Επιφάνεια, εξοπλισμός, νερό ή αέρας'],
  ]

  return <div className="modal-backdrop"><div className="entry-card lab-entry-card lab-create-flow"><header><div><span className="eyebrow">{en ? 'NEW LABORATORY SAMPLE' : 'ΝΕΟ ΕΡΓΑΣΤΗΡΙΑΚΟ ΔΕΙΓΜΑ'}</span><h3>{en ? 'Sample registration' : 'Καταχώρηση δείγματος'}</h3></div><button className="icon-close" onClick={onClose}>×</button></header>
    <div className="lab-flow-body">
      <section className="lab-flow-section"><div className="lab-flow-heading"><span>1</span><div><strong>{en ? 'Where does the sample come from?' : 'Από πού προέρχεται το δείγμα;'}</strong><small>{en ? 'Choose one category to continue.' : 'Επιλέξτε μία κατηγορία για να συνεχίσετε.'}</small></div></div><div className="lab-subject-cards">{subjectChoices.map(([id, Icon, title, text]) => <button key={id} type="button" className={`lab-subject-card ${subjectType === id ? 'active' : ''}`} onClick={() => switchSubject(id)}><Icon size={20}/><span><strong>{title}</strong><small>{text}</small></span></button>)}</div></section>

      {subjectType === 'patient' && <section className="lab-flow-section lab-flow-reveal"><div className="lab-flow-heading"><span>2</span><div><strong>{en ? 'Patient' : 'Ασθενής'}</strong><small>{en ? 'Choose an existing patient or register a new one.' : 'Επιλέξτε υπάρχοντα ασθενή ή καταχωρήστε νέο.'}</small></div></div><div className="lab-choice-row"><button type="button" className={patientMode === 'existing' ? 'active' : ''} onClick={() => { setPatientMode('existing'); setDraft(current => ({ ...emptyDraft('patient'), collectedAt: current.collectedAt, priority: current.priority })) }}>{t('existingPatient')}</button><button type="button" className={patientMode === 'new' ? 'active' : ''} onClick={() => { setPatientMode('new'); setDraft(current => ({ ...emptyDraft('patient'), newPatient: true, collectedAt: current.collectedAt, priority: current.priority })) }}>{t('laboratoryRecords.newPatientInline')}</button></div></section>}

      {subjectReady && <section className="lab-flow-section lab-flow-reveal"><div className="lab-flow-heading"><span>{subjectType === 'patient' ? '3' : '2'}</span><div><strong>{en ? 'Sample details' : 'Στοιχεία δείγματος'}</strong><small>{en ? 'Complete the required information.' : 'Συμπληρώστε τα απαραίτητα στοιχεία.'}</small></div></div><div className="entry-grid lab-flow-grid">
        {subjectType === 'patient' && patientMode === 'existing' && <label className="entry-span-2"><span>{t('patient')}</span><select value={draft.subjectCode} onChange={event => choosePatient(event.target.value)}><option value="">{en ? 'Select patient' : 'Επιλέξτε ασθενή'}</option>{patients.filter(item => item.status === 'active').map(patient => <option key={patient.id} value={patient.id}>{language === 'el' ? patient.name : patient.nameEn} · {patient.id}</option>)}</select></label>}
        {subjectType === 'patient' && patientMode === 'new' && <><label><span>{t('patient')}</span><input value={draft.subjectName} onChange={event => { set('subjectName', event.target.value); set('subjectNameEn', event.target.value) }}/></label><label><span>{t('patientId')}</span><input value={draft.subjectCode} onChange={event => set('subjectCode', event.target.value)}/></label></>}
        {subjectType === 'employee' && <label className="entry-span-2"><span>{en ? 'Employee' : 'Εργαζόμενος'}</span><select value={draft.subjectCode} onChange={event => chooseEmployee(event.target.value)}><option value="">{en ? 'Select employee' : 'Επιλέξτε εργαζόμενο'}</option>{employees.filter(item => item.employmentStatus === 'active').map(employee => <option key={employee.id} value={employee.id}>{language === 'el' ? `${employee.lastName} ${employee.firstName}` : `${employee.firstNameEn || employee.firstName} ${employee.lastNameEn || employee.lastName}`} · {employee.id}</option>)}</select></label>}
        {subjectType === 'environment' && <><label><span>{en ? 'Environmental sample type' : 'Τύπος περιβαλλοντικού δείγματος'}</span><select value={draft.environmentType} onChange={event => setEnvType(event.target.value)}><option value="">{en ? 'Select type' : 'Επιλέξτε τύπο'}</option>{environmentalTypes.map(([id, el, enLabel]) => <option key={id} value={id}>{en ? enLabel : el}</option>)}</select></label><label><span>{draft.environmentType === 'water' ? (en ? 'Sampling point' : 'Σημείο υδροληψίας') : (en ? 'Sampling point / location' : 'Σημείο / χώρος δειγματοληψίας')}</span><input value={draft.subjectName} onChange={event => { set('subjectName', event.target.value); set('subjectNameEn', event.target.value) }}/></label></>}
        <label><span>{t('department')}</span><select value={draft.departmentId} onChange={event => setDepartment(event.target.value)}><option value="">{en ? 'Select department' : 'Επιλέξτε τμήμα'}</option>{departments.map(item => <option key={item.id} value={item.id}>{language === 'el' ? item.name : (item.nameEn || item.name)}</option>)}</select></label>
        {subjectType === 'patient' && <><label><span>{t('sampleType')}</span><select value={draft.type} onChange={event => setType(event.target.value)}><option value="">{en ? 'Select sample type' : 'Επιλέξτε τύπο δείγματος'}</option><option value="bloodCulture">{t('bloodCulture')}</option><option value="urineCulture">{t('urineCulture')}</option><option value="respiratorySample">{t('respiratorySample')}</option><option value="woundCulture">{t('woundCulture')}</option></select></label>{draft.type && <label><span>{t('collectionSource')}</span><select value={draft.sourceCode} onChange={event => setSource(event.target.value)}><option value="">{en ? 'Select source' : 'Επιλέξτε πηγή'}</option>{(sourceOptions[draft.type] || []).map(([code]) => <option key={code} value={code}>{t(sampleSourceCatalog[code]?.label || code)}</option>)}</select></label>}<label><span>{t('anatomicalSite')}</span><input value={draft.anatomicalSite} onChange={event => set('anatomicalSite', event.target.value)}/></label></>}
        {subjectType === 'employee' && <label><span>{en ? 'Screening type' : 'Τύπος ελέγχου'}</span><select value={draft.sourceCode} onChange={event => setEmployeeSource(event.target.value)}><option value="">{en ? 'Select screening type' : 'Επιλέξτε τύπο ελέγχου'}</option><option value="nasalSwab">{en ? 'Nasal swab' : 'Ρινικό επίχρισμα'}</option><option value="handSwab">{en ? 'Hand swab' : 'Επίχρισμα χεριών'}</option><option value="throatSwab">{en ? 'Throat swab' : 'Φαρυγγικό επίχρισμα'}</option></select></label>}
        <label><span>{t('collectedLabel')}</span><input type="datetime-local" value={draft.collectedAt} onChange={event => set('collectedAt', event.target.value)}/></label><label><span>{t('priority')}</span><select value={draft.priority} onChange={event => set('priority', event.target.value)}><option value="">{en ? 'Select priority' : 'Επιλέξτε προτεραιότητα'}</option><option value="routine">{t('routine')}</option><option value="urgent">{t('urgent')}</option><option value="critical">{t('critical')}</option></select></label>
      </div></section>}
    </div>
    <footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><SaveButton disabled={!valid} onClick={() => onSave(draft)}>{t('save')}</SaveButton></footer></div></div>
}