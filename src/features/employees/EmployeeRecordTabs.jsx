import { useEffect,useState } from 'react'
import { Plus } from 'lucide-react'
import { ActionButton } from '../../design-system/ActionButton'
import { Button } from '../../design-system/Button'
import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'
import { useEmployeeSubRecords } from './useEmployeeSubRecords'
import { loadEmployeeHistoryAsync } from './employeeHistoryService'
import { demoEmployeeDocuments } from './employeeDemoData'
import { loadTrainingState } from '../training/trainingData'
import { getEmployeeSurveillanceForEmployee,updateEmployeeSurveillanceRecord } from '../surveillance/employeeSurveillanceData'
import { EmployeeSurveillanceRecordDialog } from '../surveillance/EmployeeSurveillanceRecordDialog'
import { loadEmployeeSurveillanceRecords } from '../surveillance/employeeSurveillanceCloudService'
import { loadLaboratorySamples } from '../laboratory/laboratoryCloudService'
import { laboratorySamples as demoLaboratorySamples } from '../laboratory/laboratoryDemoData'
import { SectionTitle,Empty,State,Pager,RegistryFilter,useRegistryRows,statusClass,label,compactEpisodeCode } from './employeeRecordShared'
import './employeeRecordTabsRefinements.css'
export { EmployeeHealthTab,EmployeeOccupationalTab,EmployeeVaccinationsTab,EmployeeExposureIncidentsTab } from './EmployeeHealthTabs'
export { EmployeeTrainingTab } from './EmployeeTrainingTab'
export { EmployeeEvaluationsTab } from './EmployeeEvaluationsTab'


export function EmployeeCertificatesTab({employee,language,organizationId,canEdit=false,isDemo=false}){
  const [demoFiles,setDemoFiles]=useState(()=>isDemo?demoEmployeeDocuments(employee,loadTrainingState().certificates,language==='en'):[])
  return <DocumentsWorkspace
    title={language==='en'?'Documents & certifications':'Έγγραφα & Πιστοποιήσεις'}
    subtitle={language==='en'?'Licences, certifications and training certificates of the employee.':'Άδειες, πιστοποιήσεις και πιστοποιητικά εκπαίδευσης του εργαζομένου.'}
    disabled={!canEdit}
    organizationId={isDemo?null:organizationId}
    entityType="employee-certificate"
    entityId={employee.dbId||employee.id}
    value={isDemo?demoFiles:undefined}
    onChange={isDemo?setDemoFiles:undefined}
  />
}

export function EmployeeSurveillanceTab({employee,t,language,fmt,version,onNew,readOnly=false,isDemo=false,organizationId=null,canManageFollowup=false}){
  const demoRows=isDemo?getEmployeeSurveillanceForEmployee(employee.id):[]
  const [cloudRecords,setCloudRecords]=useState([])
  const [cloudSamples,setCloudSamples]=useState([])
  const [selected,setSelected]=useState(null)
  const [loading,setLoading]=useState(!isDemo)
  const [loadError,setLoadError]=useState(null)
  const [reloadToken,setReloadToken]=useState(0)
  useEffect(()=>{if(isDemo||!organizationId||!employee?.dbId){setLoading(false);setLoadError(null);return}let active=true;setLoading(true);setLoadError(null);Promise.all([loadEmployeeSurveillanceRecords(organizationId),loadLaboratorySamples(organizationId)]).then(([records,samples])=>{if(!active)return;setCloudRecords(records.filter(row=>row.employeeDbId===employee.dbId));setCloudSamples(samples)}).catch(error=>{if(active){setCloudRecords([]);setCloudSamples([]);setLoadError(error)}}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[isDemo,organizationId,employee?.dbId,version,reloadToken])
  const rows=isDemo?demoRows:cloudRecords
  const registry=useRegistryRows(rows)
  const paging=registry.paging
  if(loadError)return <section className="record-section record-secondary-registry"><SectionTitle title={language==='en'?'Surveillance':'Επιτήρηση'} subtitle={language==='en'?'Employee screening episodes and their linked laboratory samples.':'Επεισόδια επιτήρησης εργαζομένου και τα συνδεδεμένα εργαστηριακά δείγματα.'}/><div className="data-access-state error"><span>{language==='en'?'Could not load employee surveillance data.':'Δεν ήταν δυνατή η φόρτωση των δεδομένων επιτήρησης του εργαζομένου.'}</span><Button variant="secondary" onClick={()=>setReloadToken(value=>value+1)}>{language==='en'?'Retry':'Επανάληψη'}</Button></div></section>
  const selectedSamples=selected?(isDemo?demoLaboratorySamples.filter(sample=>sample.employeeSurveillanceCase===selected.id):cloudSamples.filter(sample=>sample.employeeSurveillanceId===selected.recordId)):[]
  const saveDemoFollowup=(record,patch)=>Promise.resolve(updateEmployeeSurveillanceRecord(record.id,{...patch,updatedAt:new Date().toISOString()}))
  return <section className="record-section record-secondary-registry"><SectionTitle title={language==='en'?'Surveillance':'Επιτήρηση'} subtitle={language==='en'?'Employee screening episodes and their linked laboratory samples.':'Επεισόδια επιτήρησης εργαζομένου και τα συνδεδεμένα εργαστηριακά δείγματα.'} action={!readOnly&&<ActionButton tone="primary" label={t('newSurveillance')} onClick={onNew}><Plus size={15}/><span>{t('newSurveillance')}</span></ActionButton>}/>{!loading&&<RegistryFilter query={registry.query} setQuery={registry.setQuery} language={language} count={registry.filtered.length}/>} {loading?<div className="inline-empty">{language==='en'?'Loading…':'Φόρτωση…'}</div>:registry.filtered.length?<><div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{language==='en'?'Episode':'Επεισόδιο'}</th><th>{language==='en'?'Start date':'Έναρξη'}</th><th>{language==='en'?'Screening':'Έλεγχος'}</th><th>{language==='en'?'Status':'Κατάσταση'}</th></tr></thead><tbody>{paging.paged.map(row=><tr key={row.id} tabIndex={0} onClick={()=>setSelected(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row)}}}><td><strong className="employee-code-compact" title={row.id}>{compactEpisodeCode(row.id)}</strong></td><td>{fmt(row.startedAt)}</td><td>{row.screeningTypes?.map(type=>label(type,t)).join(', ')||'—'}</td><td><span className={`status-badge ${statusClass(row.status)}`}>{label(row.status,t)}</span></td></tr>)}</tbody></table></div><Pager paging={paging} total={registry.filtered.length} language={language}/></>:<Empty language={language} title={language==='en'?'No surveillance episodes':'Δεν υπάρχουν επεισόδια επιτήρησης'}/>} {selected&&<EmployeeSurveillanceRecordDialog organizationId={organizationId} record={selected} samples={selectedSamples} canManage={canManageFollowup} t={t} language={language} fmt={fmt} onClose={()=>setSelected(null)} onSaveFollowup={isDemo?saveDemoFollowup:undefined} onUpdated={updated=>{if(!isDemo)setCloudRecords(current=>current.map(row=>row.recordId===updated.recordId?updated:row));setSelected(updated)}}/>}</section>
}

export function EmployeeHistoryTab({employee,language}){
  const state=useEmployeeSubRecords(loadEmployeeHistoryAsync,employee.organizationId,employee.dbId,employee.id)
  const fallback=[]
  if(employee.createdAt)fallback.push({id:'legacy-created',action:'insert',at:employee.createdAt,actorName:'',actorRole:'',changedFields:[]})
  if(employee.updatedAt&&employee.updatedAt!==employee.createdAt)fallback.push({id:'legacy-updated',action:'update',at:employee.updatedAt,actorName:'',actorRole:'',changedFields:[]})
  const rows=(state.data.length?state.data:fallback).slice().sort((a,b)=>new Date(b.at||0)-new Date(a.at||0))
  const registry=useRegistryRows(rows)
  const paging=registry.paging
  const format=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat(language==='en'?'en-GB':'el-GR',{dateStyle:'medium',timeStyle:'short'}).format(d)}
  const eventLabel=action=>action==='insert'?(language==='en'?'Employee record created':'Δημιουργία καρτέλας εργαζομένου'):action==='delete'?(language==='en'?'Employee record deleted':'Διαγραφή καρτέλας εργαζομένου'):(language==='en'?'Employee record updated':'Ενημέρωση καρτέλας εργαζομένου')
  const fieldLabels={employee_code:['Κωδικός εργαζομένου','Employee code'],department_id:['Τμήμα','Department'],department_name:['Τμήμα','Department'],department_name_en:['Τμήμα (EN)','Department (EN)'],first_name:['Όνομα','First name'],first_name_en:['Όνομα (EN)','First name (EN)'],last_name:['Επώνυμο','Last name'],last_name_en:['Επώνυμο (EN)','Last name (EN)'],father_name:['Πατρώνυμο','Father name'],profession_name:['Ιδιότητα','Profession'],profession_name_en:['Ιδιότητα (EN)','Profession (EN)'],employment_status:['Κατάσταση εργασίας','Employment status'],email:['Email','Email'],phone:['Τηλέφωνο','Phone'],hire_date:['Ημερομηνία πρόσληψης','Hire date'],birth_date:['Ημερομηνία γέννησης','Birth date'],user_id:['Σύνδεση λογαριασμού','Account link']}
  const changedLabel=fields=>fields?.length?fields.map(key=>fieldLabels[key]?.[language==='en'?1:0]||key).join(' · '):'—'
  const actorLabel=row=>row.actorName?`${row.actorName}${row.actorRole?` · ${row.actorRole.replaceAll('_',' ')}`:''}`:'—'
  return <section className="record-section record-secondary-registry">
    <SectionTitle title={language==='en'?'History':'Ιστορικό'} subtitle={language==='en'?'Administrative lifecycle of the employee record. Clinical events remain in their own governed tabs.':'Διοικητικό ιστορικό της καρτέλας εργαζομένου. Τα κλινικά συμβάντα παραμένουν στις αντίστοιχες ελεγχόμενες καρτέλες.'}/>
    <State {...state} language={language} onRetry={state.reload}/>
    {!state.loading&&!state.error&&<RegistryFilter query={registry.query} setQuery={registry.setQuery} language={language} count={registry.filtered.length}/>}
    {!state.loading&&!state.error&&(registry.filtered.length?<><div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{language==='en'?'Event':'Ενέργεια'}</th><th>{language==='en'?'Changes':'Μεταβολές'}</th><th>{language==='en'?'User':'Χρήστης'}</th><th>{language==='en'?'Date / time':'Ημερομηνία / ώρα'}</th></tr></thead><tbody>{paging.paged.map(row=><tr key={row.id}><td><strong>{eventLabel(row.action)}</strong></td><td>{row.action==='update'?changedLabel(row.changedFields):'—'}</td><td>{actorLabel(row)}</td><td>{format(row.at)}</td></tr>)}</tbody></table></div><Pager paging={paging} total={registry.filtered.length} language={language}/></>:<Empty language={language} title={language==='en'?'No lifecycle history is available':'Δεν υπάρχει διαθέσιμο ιστορικό καρτέλας'}/>) }
  </section>
}

