import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BriefcaseBusiness, Download, FileCheck2, GraduationCap, HeartPulse, Pencil, Printer, ShieldCheck, Syringe, Trash2, UserRound } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { demoLibrarySeed } from '../management/managementData'
import { AttachmentField } from '../../design-system/AttachmentField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { employeeRows, employeeVaccinations, occupationalVisits, employeeTraining, employeeEvaluations, employeeCertificates } from './employeeDemoData'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { ManualDateField } from '../../design-system/ManualDateField'

export function EmployeeRecordPage({selfMode=false}){
  const {employeeId}=useParams(); const navigate=useNavigate(); const {goBack,restored}=useContextualNavigation('/employees'); const {t,language,locale}=useLanguage(); const {confirm,notify}=useFeedback(); const {role,membership}=useTenant()
  const id=selfMode?(employeeRows[0]?.id):(employeeId||employeeRows[0]?.id)
  const employee=employeeRows.find(x=>x.id===id) || employeeRows[0]
  const addOns=membership?.capabilities??[]; const custom=membership?.customCapabilities??[]
  const canAdmin=can(role,CAPABILITIES.MANAGE_STAFF_ADMIN,addOns,custom) && !selfMode
  const canOccupational=can(role,CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,addOns,custom) || can(role,CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH,addOns,custom)
  const canTraining=can(role,CAPABILITIES.VIEW_TRAINING,addOns,custom)
  const tabs=useMemo(()=>[
    {id:'details',label:t('employeeDetailsTab'),icon:UserRound,show:true},
    {id:'occupational',label:t('occupationalHealth'),icon:HeartPulse,show:canOccupational || selfMode},
    {id:'vaccinations',label:t('vaccinations'),icon:Syringe,show:canOccupational || selfMode},
    {id:'training',label:t('training'),icon:GraduationCap,show:canTraining || selfMode},
    {id:'evaluations',label:t('evaluations'),icon:FileCheck2,show:canAdmin || selfMode},
    {id:'certificates',label:t('certificatesDocuments'),icon:BriefcaseBusiness,show:true},
    {id:'history',label:t('history'),icon:ShieldCheck,show:canAdmin || canOccupational},
  ].filter(x=>x.show),[t,canAdmin,canOccupational,canTraining,selfMode])
  const [tab,setTab]=useState(()=>restored?.tab||'details')
  const name=language==='el'?`${employee.lastName} ${employee.firstName}`:`${employee.firstNameEn} ${employee.lastNameEn}`
  const fmt=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'
  async function deleteEmployee(){const ok=await confirm({title:t('deleteEmployee'),message:t('confirmEmployeeDelete'),confirmLabel:t('delete'),danger:true});if(ok){notify(t('employeeDeleted'),'success');navigate('/employees')}}
  return <Page fill title={selfMode?t('myProfile'):name} subtitle={selfMode?t('myEmployeeRecordSubtitle'):t('employeeFullRecordSubtitle')}>
    <EntityRecordShell
      className="employee-record-shell workspace-fill"
      avatar={`${employee.firstName?.[0]||''}${employee.lastName?.[0]||''}`}
      eyebrow={employee.id}
      title={name}
      subtitle={`${language==='el'?employee.profession:employee.professionEn} · ${language==='el'?employee.department:employee.departmentEn}`}
      status={<span className={`status-badge ${employee.employmentStatus==='active'?'active':''}`}>{t(employee.employmentStatus)}</span>}
      headerActions={<><button className="entity-record-icon-button" title={t('print')} aria-label={t('print')} onClick={()=>window.print()}><Printer size={15}/></button><button className="entity-record-icon-button" title={t('export')} aria-label={t('export')}><Download size={15}/></button></>}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      onBack={selfMode?()=>navigate('/'):goBack}
      backLabel={t('back')}
    >
        {tab==='details'&&<Details employee={employee} t={t} language={language} fmt={fmt} canAdmin={canAdmin} deleteEmployee={deleteEmployee} notify={notify}/>} 
        {tab==='occupational'&&<Occupational employee={employee} t={t} fmt={fmt}/>} 
        {tab==='vaccinations'&&<Vaccinations employee={employee} t={t} fmt={fmt}/>} 
        {tab==='training'&&<Training employee={employee} t={t} language={language} fmt={fmt}/>} 
        {tab==='evaluations'&&<Evaluations employee={employee} t={t} language={language} fmt={fmt} selfMode={selfMode}/>} 
        {tab==='certificates'&&<Certificates employee={employee} t={t} language={language} fmt={fmt} selfMode={selfMode} canAdmin={canAdmin} notify={notify}/>} 
        {tab==='history'&&<History t={t}/>} 
    </EntityRecordShell>
  </Page>
}
function Details({employee,t,language,fmt,canAdmin,deleteEmployee,notify}){
  const [editing,setEditing]=useState(false)
  const [record,setRecord]=useState({...employee})
  const set=(k,v)=>setRecord(r=>({...r,[k]:v}))
  const cancel=()=>{setRecord({...employee});setEditing(false)}
  const save=()=>{setEditing(false);notify(t('employeeUpdated'),'success')}
  return <div className="record-section">
    <div className="record-section-header"><div><span className="eyebrow">{t('employeeAdministrativeData')}</span><h3>{t('basicDetails')}</h3></div>
      {canAdmin&&<div className="record-inline-actions">{!editing&&<><button title={t('editEmployee')} onClick={()=>setEditing(true)}><Pencil size={16}/></button><button className="danger" title={t('deleteEmployee')} onClick={deleteEmployee}><Trash2 size={16}/></button></>}</div>}
    </div>
    <div className={`detail-grid employee-full-grid ${editing?'employee-inline-edit':''}`}>
      <InlineDetail editing={false} l={t('employeeCode')} v={record.id}/>
      <InlineDetail editing={editing} l={t('firstName')} v={record.firstName} onChange={v=>set('firstName',v)}/>
      <InlineDetail editing={editing} l={t('lastName')} v={record.lastName} onChange={v=>set('lastName',v)}/>
      <InlineDetail editing={editing} l={t('fatherName')} v={language==='el'?record.fatherName:record.fatherNameEn} onChange={v=>set(language==='el'?'fatherName':'fatherNameEn',v)}/>
      <InlineSelect editing={editing} l={t('department')} v={record.department} display={language==='el'?record.department:record.departmentEn} options={demoLibrarySeed.departments} language={language} onChange={v=>set('department',v)}/>
      <InlineSelect editing={editing} l={t('professionalCategory')} v={record.profession} display={language==='el'?record.profession:record.professionEn} options={demoLibrarySeed.professionalCategories} language={language} onChange={v=>set('profession',v)}/>
      <InlineDetail editing={editing} type="date" l={t('hireDate')} v={record.hireDate} display={fmt(record.hireDate)} onChange={v=>set('hireDate',v)}/>
      <InlineDetail editing={editing} l={t('email')} v={record.email} onChange={v=>set('email',v)}/>
      <InlineDetail editing={editing} l={t('phone')} v={record.phone} onChange={v=>set('phone',v)}/>
    </div>
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" onClick={cancel}>{t('cancel')}</Button><Button onClick={save}>{t('save')}</Button></div>}
  </div>
}
function InlineDetail({editing,l,v,display,onChange,type='text'}){return <div className={`detail-item ${editing?'editable':''}`}><span>{l}</span>{editing?<input type={type} value={v||''} onChange={e=>onChange?.(e.target.value)}/>:<strong>{display??v??'—'}</strong>}</div>}
function InlineSelect({editing,l,v,display,options,language,onChange}){return <div className={`detail-item ${editing?'editable':''}`}><span>{l}</span>{editing?<select value={v||''} onChange={e=>onChange(e.target.value)}>{options.map(([el,en])=><option key={el} value={el}>{language==='el'?el:en}</option>)}</select>:<strong>{display||'—'}</strong>}</div>}
function Occupational({employee,t,fmt}){const rows=occupationalVisits.filter(x=>x.employeeId===employee.id);return <div className="record-section"><SectionTitle t={t} title="occupationalHealth"/><div className="record-card-list">{rows.length?rows.map(x=><article key={x.id} className="record-subcard"><strong>{fmt(x.date)}</strong><span>{t(x.type)}</span><small>{t('fitnessStatus')}: {t(x.fitStatus)} · {t('followUp')}: {fmt(x.followUpDate)}</small></article>):<Empty t={t}/>}</div><AttachmentField/></div>}
function Vaccinations({employee,t,fmt}){const rows=employeeVaccinations.filter(x=>x.employeeId===employee.id);return <div className="record-section"><SectionTitle t={t} title="vaccinations"/><div className="record-card-list">{rows.length?rows.map(x=><article key={x.id} className="record-subcard"><strong>{x.vaccine}</strong><span>{t('dose')}: {x.dose}</span><small>{fmt(x.date)} · {t('validUntil')}: {fmt(x.validUntil)} · {t(x.status)}</small></article>):<Empty t={t}/>}</div></div>}
function Training({employee,t,language,fmt}){const rows=employeeTraining.filter(x=>x.employeeId===employee.id);return <div className="record-section"><SectionTitle t={t} title="training"/>{rows.length?<div className="record-table-wrap"><table className="record-table"><thead><tr><th>{t('trainingTitle')}</th><th>{t('date')}</th><th>{t('status')}</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><strong>{language==='el'?x.titleEl:x.titleEn}</strong></td><td>{fmt(x.date)}</td><td><span className="status-badge active">{t(x.status)}</span></td></tr>)}</tbody></table></div>:<Empty t={t}/>}</div>}
function Evaluations({employee,t,language,fmt,selfMode}){const rows=employeeEvaluations.filter(x=>x.employeeId===employee.id);return <div className="record-section"><SectionTitle t={t} title="evaluations"/><div className="source-truth-note">{selfMode?t('selfEvaluationReadOnly'):t('evaluationGovernance')}</div><div className="record-card-list">{rows.length?rows.map(x=><article key={x.id} className="record-subcard"><strong>{language==='el'?x.titleEl:x.titleEn}</strong><span>{fmt(x.date)}</span><small>{language==='el'?x.resultEl:x.resultEn}</small></article>):<Empty t={t}/>}</div></div>}
function Certificates({employee,t,language,fmt,selfMode,canAdmin,notify}){
  const emptyDraft={titleEl:'',titleEn:'',issuer:'',issueDate:'',validUntil:'',certificateNumber:'',attachments:[]}
  const [rows,setRows]=useState(employeeCertificates.filter(x=>x.employeeId===employee.id))
  const [open,setOpen]=useState(false)
  const [editingId,setEditingId]=useState(null)
  const [draft,setDraft]=useState(emptyDraft)
  const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
  const beginNew=()=>{setEditingId(null);setDraft(emptyDraft);setOpen(true)}
  const openExisting=(row)=>{setEditingId(row.id);setDraft({...emptyDraft,...row,attachments:row.attachments||[]});setOpen(true)}
  const close=()=>{setOpen(false);setEditingId(null);setDraft(emptyDraft)}
  const save=()=>{
    if(editingId){
      setRows(r=>r.map(row=>row.id===editingId?{...row,...draft,id:editingId,employeeId:employee.id}:row))
      notify(t('certificateUpdated'),'success')
    }else{
      setRows(r=>[...r,{...draft,id:`CERT-${Date.now()}`,employeeId:employee.id}])
      notify(t('certificateAdded'),'success')
    }
    close()
  }
  return <div className="record-section">
    <div className="record-section-header"><div><span className="eyebrow">{t('employeeRecord')}</span><h3>{t('certificatesDocuments')}</h3></div>{canAdmin&&!selfMode&&<Button onClick={beginNew}>+ {t('newCertificate')}</Button>}</div>
    {rows.length?<div className="record-table-wrap"><table className="record-table record-table-clickable"><thead><tr><th>{t('certificate')}</th><th>{t('issuer')}</th><th>{t('certificateNumber')}</th><th>{t('issueDate')}</th><th>{t('validUntil')}</th><th>{t('attachments')}</th></tr></thead><tbody>{rows.map(x=><tr key={x.id} tabIndex={0} onClick={()=>openExisting(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openExisting(x)}}} title={canAdmin&&!selfMode?t('openCertificateEdit'):t('openCertificateView')}><td><strong>{language==='el'?x.titleEl:x.titleEn}</strong></td><td>{x.issuer||'—'}</td><td>{x.certificateNumber||'—'}</td><td>{fmt(x.issueDate)}</td><td>{fmt(x.validUntil)}</td><td>{x.attachments?.length||0}</td></tr>)}</tbody></table></div>:<Empty t={t}/>}
    {open&&<div className="modal-backdrop"><div className="entry-card certificate-entry-card"><header><div><span className="eyebrow">{editingId?t('certificate'):t('newCertificate')}</span><h3>{editingId?(canAdmin&&!selfMode?t('editCertificate'):t('certificateDetails')):t('certificateDetails')}</h3></div><button className="icon-close" onClick={close}>×</button></header><div className="entry-grid"><label><span>{t('certificate')}</span><input disabled={!canAdmin||selfMode} value={language==='el'?draft.titleEl:draft.titleEn} onChange={e=>set(language==='el'?'titleEl':'titleEn',e.target.value)}/></label><label><span>{t('issuer')}</span><input disabled={!canAdmin||selfMode} value={draft.issuer} onChange={e=>set('issuer',e.target.value)}/></label><label><span>{t('certificateNumber')}</span><input disabled={!canAdmin||selfMode} value={draft.certificateNumber} onChange={e=>set('certificateNumber',e.target.value)}/></label><ManualDateField disabled={!canAdmin||selfMode} label={t('issueDate')} value={draft.issueDate} onChange={v=>set('issueDate',v)}/><ManualDateField disabled={!canAdmin||selfMode} label={t('validUntil')} value={draft.validUntil} onChange={v=>set('validUntil',v)}/></div><AttachmentField disabled={!canAdmin||selfMode} value={draft.attachments} onChange={v=>set('attachments',v)}/><footer><Button variant="secondary" onClick={close}>{t('close')}</Button>{canAdmin&&!selfMode&&<Button onClick={save}>{t('save')}</Button>}</footer></div></div>}
  </div>
}
function History({t}){return <div className="record-section"><SectionTitle t={t} title="history"/><div className="timeline-line"><strong>{t('employeeRecordCreated')}</strong><span>{t('auditVisibleAccordingToRole')}</span></div></div>}
function SectionTitle({t,title}){return <div className="record-section-header"><div><span className="eyebrow">{t('employeeRecord')}</span><h3>{t(title)}</h3></div></div>}
function Empty({t}){return <div className="inline-empty">{t('noData')}</div>}

