import { useMemo, useState } from 'react'
import { FlaskConical, Users, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { employeeRows } from '../employees/employeeDemoData'
import { createEmployeeSurveillance, createEmployeeSurveillanceBatch, employeeScreeningCatalog } from './employeeSurveillanceData'

export function EmployeeSurveillanceFlow({employee=null,onClose,onCreated}){
  const actor=useAuditActor()
  const {t,language}=useLanguage()
  const {notify}=useFeedback()
  const [employeeId,setEmployeeId]=useState(employee?.id||'')
  const selected=employee||employeeRows.find(x=>x.id===employeeId)
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [types,setTypes]=useState(['nasalSwab'])
  const [notes,setNotes]=useState('')
  const toggle=id=>setTypes(rows=>rows.includes(id)?rows.filter(x=>x!==id):[...rows,id])
  function save(){
    if(!selected||!types.length||!date)return
    const record=createEmployeeSurveillance({employee:selected,screeningTypes:types,startedAt:date,notes,createdBy:actor.name,createdById:actor.id})
    notify(t('clinicalRecords.employeeSurveillanceCreated'),'success')
    onCreated?.(record)
    onClose()
  }
  return <div className="modal-backdrop"><div className="entry-card employee-surveillance-entry">
    <header><div><span className="eyebrow">{t('employeeSurveillance')}</span><h3>{t('clinicalRecords.newEmployeeSurveillance')}</h3><p>{t('clinicalRecords.employeeSurveillanceHelp')}</p></div><button className="icon-close" onClick={onClose}><X size={18}/></button></header>
    <div className="entry-grid">
      {!employee&&<label className="entry-span-2"><span>{t('employee')}</span><select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">{t('clinicalRecords.selectEmployee')}</option>{employeeRows.filter(x=>x.employmentStatus==='active').map(row=><option key={row.id} value={row.id}>{language==='el'?`${row.lastName} ${row.firstName}`:`${row.firstNameEn} ${row.lastNameEn}`} · {row.id}</option>)}</select></label>}
      {selected&&<div className="entry-span-2 subject-summary"><strong>{language==='el'?`${selected.lastName} ${selected.firstName}`:`${selected.firstNameEn} ${selected.lastNameEn}`}</strong><span>{language==='el'?selected.department:selected.departmentEn} · {selected.id}</span></div>}
      <ManualDateField label={t('screeningDate')} value={date} onChange={setDate}/>
      <label><span>{t('screeningType')}</span><div className="screening-choice-list">{employeeScreeningCatalog.map(item=><button type="button" key={item.id} className={types.includes(item.id)?'selected':''} onClick={()=>toggle(item.id)}>{t(item.label)}</button>)}</div></label>
      <label className="entry-span-2"><span>{t('notes')}</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    </div>
    <div className="source-truth-note">{t('clinicalRecords.employeeScreeningCreatesLabRequests')}</div>
    <footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={!selected||!date||!types.length} onClick={save}><FlaskConical size={15}/>{t('createSurveillance')}</Button></footer>
  </div></div>
}

export function BulkEmployeeSurveillanceFlow({onClose,onCreated}){
  const actor=useAuditActor()
  const {t,language}=useLanguage()
  const {notify}=useFeedback()
  const [department,setDepartment]=useState('all')
  const [selectedIds,setSelectedIds]=useState([])
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [types,setTypes]=useState(['nasalSwab'])
  const [notes,setNotes]=useState('')
  const departments=useMemo(()=>[...new Set(employeeRows.filter(x=>x.employmentStatus==='active').map(x=>language==='el'?x.department:x.departmentEn))],[language])
  const visible=employeeRows.filter(x=>x.employmentStatus==='active').filter(x=>department==='all'||(language==='el'?x.department:x.departmentEn)===department)
  const toggleEmployee=id=>setSelectedIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id])
  const toggleType=id=>setTypes(rows=>rows.includes(id)?rows.filter(x=>x!==id):[...rows,id])
  const allVisible=visible.length>0&&visible.every(x=>selectedIds.includes(x.id))
  function toggleAll(){setSelectedIds(ids=>allVisible?ids.filter(id=>!visible.some(x=>x.id===id)):[...new Set([...ids,...visible.map(x=>x.id)])])}
  function save(){
    const employees=employeeRows.filter(x=>selectedIds.includes(x.id))
    if(!employees.length||!types.length||!date)return
    const first=employees[0]
    const batch=createEmployeeSurveillanceBatch({
      employees,
      screeningTypes:types,
      startedAt:date,
      department:department==='all'?t('clinicalRecords.multipleDepartments'):(language==='el'?first.department:first.departmentEn),
      departmentEn:department==='all'?'Multiple departments':first.departmentEn,
      notes,
      createdBy:actor.name,
      createdById:actor.id,
    })
    notify(t('clinicalRecords.bulkEmployeeSurveillanceCreated').replace('{count}',String(employees.length)),'success')
    onCreated?.(batch)
    onClose()
  }
  return <div className="modal-backdrop"><div className="entry-card bulk-surveillance-entry">
    <header><div><span className="eyebrow">{t('employeeSurveillance')}</span><h3>{t('clinicalRecords.bulkEmployeeSurveillance')}</h3><p>{t('clinicalRecords.bulkEmployeeSurveillanceHelp')}</p></div><button className="icon-close" onClick={onClose}><X size={18}/></button></header>
    <div className="bulk-surveillance-controls">
      <label><span>{t('department')}</span><select value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</select></label>
      <ManualDateField label={t('screeningDate')} value={date} onChange={setDate}/>
    </div>
    <div className="bulk-screening-types"><span>{t('screeningType')}</span><div className="screening-choice-list">{employeeScreeningCatalog.map(item=><button type="button" key={item.id} className={types.includes(item.id)?'selected':''} onClick={()=>toggleType(item.id)}>{t(item.label)}</button>)}</div></div>
    <div className="bulk-employee-list">
      <div className="bulk-list-head"><button type="button" onClick={toggleAll}>{allVisible?t('clinicalRecords.clearVisible'):t('clinicalRecords.selectAllVisible')}</button><strong>{t('clinicalRecords.selectedEmployees')}: {selectedIds.length}</strong></div>
      {visible.map(row=><label key={row.id} className={selectedIds.includes(row.id)?'selected':''}><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={()=>toggleEmployee(row.id)}/><span><strong>{language==='el'?`${row.lastName} ${row.firstName}`:`${row.firstNameEn} ${row.lastNameEn}`}</strong><small>{row.id} · {language==='el'?row.department:row.departmentEn}</small></span></label>)}
    </div>
    <label className="bulk-notes"><span>{t('notes')}</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    <footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={!selectedIds.length||!types.length||!date} onClick={save}><Users size={15}/>{t('clinicalRecords.createBatch')}</Button></footer>
  </div></div>
}

export function SurveillanceSubjectChooser({onClose,onPatient,onEmployee,onBulkEmployee,onEnvironmental}){
  const {t}=useLanguage()
  return <div className="modal-backdrop"><div className="entry-card surveillance-subject-chooser">
    <header><div><span className="eyebrow">{t('surveillance')}</span><h3>{t('newSurveillance')}</h3><p>{t('clinicalRecords.chooseSurveillanceSubject')}</p></div><button className="icon-close" onClick={onClose}><X size={18}/></button></header>
    <div className="subject-choice-grid">
      <button onClick={onPatient}><span>01</span><strong>{t('patient')}</strong><small>{t('clinicalRecords.patientSurveillanceChoiceHelp')}</small></button>
      <button onClick={onEmployee}><span>02</span><strong>{t('employee')}</strong><small>{t('clinicalRecords.employeeSurveillanceChoiceHelp')}</small></button>
      <button onClick={onBulkEmployee}><span>03</span><strong>{t('clinicalRecords.bulkEmployeeSurveillance')}</strong><small>{t('clinicalRecords.bulkEmployeeChoiceHelp')}</small></button>
      <button onClick={onEnvironmental}><span>04</span><strong>{t('environmentalSurveillance')}</strong><small>{t('clinicalRecords.environmentalSurveillanceChoiceHelp')}</small></button>
    </div>
  </div></div>
}
