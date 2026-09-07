import { useMemo,useState } from 'react'
import { FlaskConical,Users } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { DialogActions,ObserverDialog } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import { createEmployeeSurveillanceBatch,createEmployeeSurveillanceRecord } from './employeeSurveillanceCloudService'

const screeningCatalog=[
  {id:'handSwab',el:'Επίχρισμα χεριών',en:'Hand swab'},
  {id:'nasalSwab',el:'Ρινικό επίχρισμα',en:'Nasal swab'},
  {id:'throatSwab',el:'Φαρυγγικό επίχρισμα',en:'Throat swab'},
]

export function ProductionEmployeeSurveillanceFlow({mode='single',onClose,onCreated}){
  const {tenant}=useTenant()
  const {language}=useLanguage()
  const {notify,notifyError}=useFeedback()
  const {data:employeeRows=[]}=useEmployeesData()
  const [flowMode,setFlowMode]=useState(mode==='bulk'?'bulk':'single')
  const [employeeId,setEmployeeId]=useState('')
  const [department,setDepartment]=useState('all')
  const [selectedIds,setSelectedIds]=useState([])
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [types,setTypes]=useState(['nasalSwab'])
  const [notes,setNotes]=useState('')
  const [saving,setSaving]=useState(false)
  const activeEmployees=useMemo(()=>employeeRows.filter(row=>row.employmentStatus==='active'),[employeeRows])
  const departments=useMemo(()=>[...new Set(activeEmployees.map(row=>language==='el'?row.department:row.departmentEn).filter(Boolean))],[activeEmployees,language])
  const visible=activeEmployees.filter(row=>department==='all'||(language==='el'?row.department:row.departmentEn)===department)
  const selected=activeEmployees.find(row=>row.id===employeeId)
  const toggleType=id=>setTypes(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id])
  const toggleEmployee=id=>setSelectedIds(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id])
  const allVisible=visible.length>0&&visible.every(row=>selectedIds.includes(row.id))
  const toggleAll=()=>setSelectedIds(current=>allVisible?current.filter(id=>!visible.some(row=>row.id===id)):[...new Set([...current,...visible.map(row=>row.id)])])
  async function save(){
    if(saving||!tenant?.id||!date||!types.length)return
    setSaving(true)
    try{
      if(flowMode==='bulk'){
        const employees=activeEmployees.filter(row=>selectedIds.includes(row.id))
        if(!employees.length)return
        await createEmployeeSurveillanceBatch(tenant.id,employees,{startedAt:date,screeningTypes:types,departmentId:department==='all'?null:(employees[0]?.departmentId||null),notes})
        notify(language==='en'?'Bulk employee surveillance created.':'Η μαζική επιτήρηση εργαζομένων δημιουργήθηκε.','success')
      }else{
        if(!selected?.dbId)return
        await createEmployeeSurveillanceRecord(tenant.id,selected.dbId,{startedAt:date,screeningTypes:types,notes})
        notify(language==='en'?'Employee surveillance created.':'Η επιτήρηση εργαζομένου δημιουργήθηκε.','success')
      }
      onCreated?.()
      onClose()
    }catch(error){notifyError(error,'save',{operation:flowMode==='bulk'?'employee_surveillance_batch_create':'employee_surveillance_create'})}
    finally{setSaving(false)}
  }
  const en=language==='en'
  const valid=flowMode==='bulk'?selectedIds.length>0:Boolean(selected)
  return <ObserverDialog
    eyebrow={en?'Employee surveillance':'Επιτήρηση εργαζομένων'}
    title={flowMode==='bulk'?(en?'Bulk employee surveillance':'Μαζική επιτήρηση εργαζομένων'):(en?'New employee surveillance':'Νέα επιτήρηση εργαζομένου')}
    subtitle={en?'Choose individual or bulk screening. Records are stored for the current organization only.':'Επιλέξτε ατομικό ή μαζικό έλεγχο. Οι καταχωρίσεις αποθηκεύονται αποκλειστικά στον τρέχοντα οργανισμό.'}
    width={flowMode==='bulk'?'workspace':'wide'}
    className={flowMode==='bulk'?'bulk-surveillance-entry':'employee-surveillance-entry'}
    onClose={onClose}
    footer={<DialogActions onSave={save} saveLabel={saving?(en?'Saving…':'Αποθήκευση…'):(en?'Create surveillance':'Δημιουργία επιτήρησης')} disabled={saving||!date||!types.length||!valid}/>}
  >
    <nav className="tabs canonical-module-tabs surveillance-mode-tabs" aria-label={en?'Employee surveillance mode':'Τρόπος επιτήρησης εργαζομένων'}>
      <button type="button" className={`tab ${flowMode==='single'?'active':''}`} onClick={()=>setFlowMode('single')}><FlaskConical size={14}/>{en?'Individual':'Ατομική'}</button>
      <button type="button" className={`tab ${flowMode==='bulk'?'active':''}`} onClick={()=>setFlowMode('bulk')}><Users size={14}/>{en?'Bulk':'Μαζική'}</button>
    </nav>
    {flowMode==='bulk'?<>
      <div className="bulk-surveillance-controls"><label className="field"><span>{en?'Department':'Τμήμα'}</span><select value={department} onChange={event=>setDepartment(event.target.value)}><option value="all">{en?'All departments':'Όλα τα τμήματα'}</option>{departments.map(value=><option key={value} value={value}>{value}</option>)}</select></label><ManualDateField label={en?'Screening date':'Ημερομηνία ελέγχου'} value={date} onChange={setDate}/></div>
      <ScreeningTypes types={types} toggle={toggleType} en={en}/>
      <div className="bulk-employee-list"><div className="bulk-list-head"><Button variant="secondary" onClick={toggleAll}>{allVisible?(en?'Clear visible':'Καθαρισμός ορατών'):(en?'Select all visible':'Επιλογή όλων')}</Button><strong>{en?'Selected':'Επιλεγμένοι'}: {selectedIds.length}</strong></div>{visible.map(row=><label key={row.id} className={selectedIds.includes(row.id)?'selected':''}><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={()=>toggleEmployee(row.id)}/><span><strong>{language==='el'?`${row.lastName} ${row.firstName}`:`${row.firstNameEn} ${row.lastNameEn}`}</strong><small>{row.id} · {language==='el'?row.department:row.departmentEn}</small></span></label>)}</div>
    </>:<div className="entry-grid"><label className="field entry-span-2"><span>{en?'Employee':'Εργαζόμενος'}</span><select value={employeeId} onChange={event=>setEmployeeId(event.target.value)}><option value="">{en?'Select employee…':'Επιλογή εργαζομένου…'}</option>{activeEmployees.map(row=><option key={row.id} value={row.id}>{language==='el'?`${row.lastName} ${row.firstName}`:`${row.firstNameEn} ${row.lastNameEn}`} · {row.id}</option>)}</select></label>{selected&&<div className="entry-span-2 subject-summary"><strong>{language==='el'?`${selected.lastName} ${selected.firstName}`:`${selected.firstNameEn} ${selected.lastNameEn}`}</strong><span>{language==='el'?selected.department:selected.departmentEn} · {selected.id}</span></div>}<ManualDateField label={en?'Screening date':'Ημερομηνία ελέγχου'} value={date} onChange={setDate}/><ScreeningTypes types={types} toggle={toggleType} en={en}/></div>}
    <label className={flowMode==='bulk'?'field bulk-notes':'field entry-span-2'}><span>{en?'Notes':'Σημειώσεις'}</span><textarea rows={3} value={notes} onChange={event=>setNotes(event.target.value)}/></label>
  </ObserverDialog>
}

function ScreeningTypes({types,toggle,en}){return <div className="bulk-screening-types"><span>{en?'Screening type':'Τύπος ελέγχου'}</span><div className="screening-choice-list">{screeningCatalog.map(item=><Button variant="secondary" key={item.id} className={types.includes(item.id)?'selected':''} aria-pressed={types.includes(item.id)} onClick={()=>toggle(item.id)}>{en?item.en:item.el}</Button>)}</div></div>}
