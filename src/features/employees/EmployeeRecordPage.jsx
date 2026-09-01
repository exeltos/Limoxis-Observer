import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, BriefcaseBusiness, CheckCircle2, FileCheck2, FileSignature, GraduationCap, HeartPulse, Pencil, ShieldCheck, Syringe, Trash2, UserRound, XCircle } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { demoLibrarySeed } from '../management/managementData'
import { AttachmentField } from '../../design-system/AttachmentField'
import { uploadAttachment } from '../../core/attachments/attachmentService'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { loadCertificates } from './employeeRecordsService'
import { loadOccupationalVisitsAsync, loadVaccinationsAsync, loadEmployeeTrainingAsync, loadEvaluationsAsync, loadCertificatesAsync, createCertificateAsync, updateCertificateAsync, certificatesCloudEnabled, saveCertificatesLocalFallback } from './employeeSubRecordsService'
import { useEmployeeSubRecords } from './useEmployeeSubRecords'
import { useEmployeesData } from './useEmployeesData'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { ManualDateField } from '../../design-system/ManualDateField'
import { EmployeeSurveillanceFlow } from '../surveillance/EmployeeSurveillanceFlow'
import { getEmployeeSurveillanceForEmployee } from '../surveillance/employeeSurveillanceData'
import { approvalsForEmployee, answerCommitteeApproval } from '../committees/committeeApprovals'
import { loadCommittees, saveCommittees } from '../committees/committeeData'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { useAuth } from '../../core/auth/AuthContext'

export function EmployeeRecordPage({selfMode=false}){
  const {employeeId}=useParams()
  const navigate=useNavigate()
  const {data:employeeRows,loading:employeesLoading,error:employeesError,reload:reloadEmployees}=useEmployeesData()
  const {goBack,restored}=useContextualNavigation('/employees')
  const {t,language,locale}=useLanguage()
  const {confirm,notify}=useFeedback()
  const {role,membership,canAccessRecord,canSeeSensitiveEmployeeHealth,isDemo,tenant}=useTenant()
  const {user,profile}=useAuth()

  const selfEmployee=useMemo(()=>{
    if(!selfMode)return null
    const explicitId=membership?.employeeId||membership?.employee_id||membership?.profile?.employeeId||profile?.employeeId||profile?.employee_id
    if(explicitId){
      const exact=employeeRows.find(x=>x.id===explicitId)
      if(exact)return exact
    }
    const identityEmail=(profile?.email||user?.email||'').trim().toLowerCase()
    if(identityEmail){
      const byEmail=employeeRows.find(x=>(x.email||'').trim().toLowerCase()===identityEmail)
      if(byEmail)return byEmail
    }
    if(isDemo)return employeeRows.find(x=>x.id==='EMP-001')||employeeRows[0]||null
    return null
  },[selfMode,membership,profile,user?.email,isDemo,employeeRows])

  const id=selfMode?selfEmployee?.id:(employeeId||null)
  const employee=selfMode?selfEmployee:employeeRows.find(x=>x.id===id)||null
  const recordNavigation=useRecordSequenceNavigation({registry:'employees',currentId:id,pathForId:nextId=>`/employees/${nextId}`})

  const addOns=membership?.capabilities??[]
  const custom=membership?.customCapabilities??[]
  const canAdmin=can(role,CAPABILITIES.MANAGE_STAFF_ADMIN,addOns,custom) && !selfMode
  const canOccupational=(can(role,CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,addOns,custom) || can(role,CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH,addOns,custom)) && canSeeSensitiveEmployeeHealth
  const canTraining=can(role,CAPABILITIES.VIEW_TRAINING,addOns,custom)

  const tabs=useMemo(()=>[
    {id:'details',label:t('employeesRecords.employeeDetailsTab'),icon:UserRound,show:true},
    {id:'occupational',label:t('occupationalHealth'),icon:HeartPulse,show:canOccupational || selfMode},
    {id:'vaccinations',label:t('vaccinations'),icon:Syringe,show:canOccupational || selfMode},
    {id:'surveillance',label:t('surveillance'),icon:Activity,show:canSeeSensitiveEmployeeHealth && (canOccupational || selfMode)},
    {id:'training',label:t('training'),icon:GraduationCap,show:canTraining || selfMode},
    {id:'evaluations',label:t('evaluations'),icon:FileCheck2,show:canAdmin || selfMode},
    {id:'certificates',label:t('employeesRecords.certificatesDocuments'),icon:BriefcaseBusiness,show:true},
    {id:'history',label:t('history'),icon:ShieldCheck,show:canOccupational || canAdmin},
  ].filter(x=>x.show),[t,canAdmin,canOccupational,canTraining,canSeeSensitiveEmployeeHealth,selfMode])

  const [tab,setTab]=useState(()=>restored?.tab||'details')
  const [surveillanceOpen,setSurveillanceOpen]=useState(false)
  const [surveillanceVersion,setSurveillanceVersion]=useState(0)
  const actor=useAuditActor()
  const [,setCommitteeApprovalVersion]=useState(0)
  const committeeApprovals=employee?.id?approvalsForEmployee(employee.id):[]
  const pendingCommitteeApprovals=committeeApprovals.filter(x=>x.status==='pending')

  if(employeesLoading)return <RouteLoading/>
  if(employeesError)return <Page title={t('employees')}><div className="data-access-state error" role="alert"><span>{language==='en'?'Could not load employees.':'Δεν ήταν δυνατή η φόρτωση του προσωπικού.'}</span><button type="button" onClick={reloadEmployees}>{language==='en'?'Retry':'Επανάληψη'}</button></div></Page>
  if(!employee){
    return <Page title={selfMode?t('employeesRecords.myProfile'):t('employees')}>
      <div className="surface"><div className="inline-empty">
        {language==='en'?'No employee record is linked to this account.':'Δεν έχει συνδεθεί καρτέλα εργαζομένου με αυτόν τον λογαριασμό.'}
      </div></div>
    </Page>
  }

  const employeeInScope=selfMode||canAccessRecord({...employee,department:employee.department})
  if(!employeeInScope){
    return <Page title={t('employees')}><div className="inline-empty">
      {language==='en'?'You do not have access to this record.':'Δεν έχετε πρόσβαση σε αυτή την εγγραφή.'}
    </div></Page>
  }
  const name=language==='el'?`${employee.lastName} ${employee.firstName}`:`${employee.firstNameEn} ${employee.lastNameEn}`
  const fmt=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'
  async function deleteEmployee(){const ok=await confirm({title:t('employeesRecords.deleteEmployee'),message:t('employeesRecords.confirmEmployeeDelete'),confirmLabel:t('delete'),danger:true});if(ok){notify(t('employeesRecords.employeeDeleted'),'success');navigate('/employees')}}
  function answerCommitteeRequest(request,status){
    answerCommitteeApproval(request.id,status,actor)
    const now=new Date().toISOString()
    const committees=loadCommittees().map(c=>c.id===request.committeeId?{
      ...c,
      memberRefs:(c.memberRefs||[]).map(m=>m.employeeId===employee.id?{...m,approvalStatus:status,approvalAnsweredAt:now,approvalAnsweredBy:actor.name,approvalAnsweredById:actor.id}:m),
      history:[{at:now,actor:actor.name,actorId:actor.id,action:status==='approved'?(language==='en'?'Committee membership approved':'Έγκριση συμμετοχής μέλους'):(language==='en'?'Committee membership rejected':'Απόρριψη συμμετοχής μέλους'),reason:`${employee.firstName} ${employee.lastName} — ${request.context?.committeeTitle||(language==='en'?'Member':'Μέλος')}`},...(c.history||[])]
    }:c)
    saveCommittees(committees)
    setCommitteeApprovalVersion(v=>v+1)
    notify(status==='approved'?(language==='en'?'Committee membership approved.':'Η συμμετοχή στην επιτροπή εγκρίθηκε.'):(language==='en'?'Committee membership rejected.':'Η συμμετοχή στην επιτροπή απορρίφθηκε.'),status==='approved'?'success':'warning')
  }
  return <Page fill title={selfMode?t('employeesRecords.myProfile'):name} subtitle={selfMode?t('employeesRecords.myEmployeeRecordSubtitle'):t('employeesRecords.employeeFullRecordSubtitle')}>
    {selfMode&&pendingCommitteeApprovals.length>0&&<div className="committee-approval-banner"><div className="committee-approval-banner-icon"><FileSignature size={18}/></div><div className="committee-approval-banner-copy"><strong>{language==='en'?'Committee membership approval pending':'Εκκρεμεί έγκριση συμμετοχής σε επιτροπή'}</strong><span>{language==='en'?`You have ${pendingCommitteeApprovals.length} request${pendingCommitteeApprovals.length===1?'':'s'} requiring your electronic confirmation.`:`Έχετε ${pendingCommitteeApprovals.length} αίτημα${pendingCommitteeApprovals.length===1?'':'τα'} που απαιτεί προσωπική ηλεκτρονική επιβεβαίωση.`}</span></div><div className="committee-approval-banner-list">{pendingCommitteeApprovals.map(req=><div key={req.id} className="committee-approval-request"><div><strong>{req.committeeName}</strong><span>{req.context?.committeeTitle||'Μέλος'} · {req.context?.responsibilities||req.subject}</span></div><div className="record-inline-actions"><button className="approval-positive" title={language==='en'?'Approve':'Έγκριση'} onClick={()=>answerCommitteeRequest(req,'approved')}><CheckCircle2 size={16}/></button><button className="danger" title={language==='en'?'Reject':'Απόρριψη'} onClick={()=>answerCommitteeRequest(req,'rejected')}><XCircle size={16}/></button></div></div>)}</div></div>}
    <EntityRecordShell
      className="employee-record-shell workspace-fill"
      avatar={`${employee.firstName?.[0]||''}${employee.lastName?.[0]||''}`}
      eyebrow={employee.id}
      title={name}
      subtitle={`${language==='el'?employee.profession:employee.professionEn} · ${language==='el'?employee.department:employee.departmentEn}`}
      status={<span className={`status-badge ${employee.employmentStatus==='active'?'active':''}`}>{t(employee.employmentStatus)}</span>}
      recordNavigation={selfMode?null:recordNavigation}
      headerActions={<>{!selfMode&&canSeeSensitiveEmployeeHealth&&canOccupational&&<Button onClick={()=>setSurveillanceOpen(true)}>+ {t('newSurveillance')}</Button>}<PrintExportActions onExport={()=>downloadRecordJson(employee,{filename:employee.id})}/></>}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      onBack={selfMode?()=>navigate('/'):goBack}
      backLabel={t('back')}
    >
        <div className="employee-record-facts">
          <RecordFact label={t('department')} value={language==='el'?employee.department:employee.departmentEn}/>
          <RecordFact label={t('professionalCategory')} value={language==='el'?employee.profession:employee.professionEn}/>
          <RecordFact label={t('employeesRecords.hireDate')} value={fmt(employee.hireDate)}/>
          <RecordFact label={t('status')} value={t(employee.employmentStatus)} kind={employee.employmentStatus==='active'?'active':''}/>
        </div>
        {tab==='details'&&<Details employee={employee} t={t} language={language} fmt={fmt} canAdmin={canAdmin} deleteEmployee={deleteEmployee} notify={notify}/>} 
        {tab==='occupational'&&<Occupational employee={employee} t={t} fmt={fmt} organizationId={tenant?.id}/>} 
        {tab==='vaccinations'&&<Vaccinations employee={employee} t={t} fmt={fmt} organizationId={tenant?.id}/>} 
        {tab==='surveillance'&&<EmployeeSurveillance employee={employee} t={t} language={language} fmt={fmt} version={surveillanceVersion} onNew={()=>setSurveillanceOpen(true)}/>} 
        {tab==='training'&&<Training employee={employee} t={t} language={language} fmt={fmt} organizationId={tenant?.id}/>} 
        {tab==='evaluations'&&<Evaluations employee={employee} t={t} language={language} fmt={fmt} selfMode={selfMode} organizationId={tenant?.id}/>} 
        {tab==='certificates'&&<Certificates employee={employee} t={t} language={language} fmt={fmt} selfMode={selfMode} canAdmin={canAdmin} notify={notify} organizationId={tenant?.id}/>} 
        {tab==='history'&&<History t={t}/>} 
    </EntityRecordShell>
    {surveillanceOpen&&<EmployeeSurveillanceFlow employee={employee} onClose={()=>setSurveillanceOpen(false)} onCreated={()=>setSurveillanceVersion(v=>v+1)}/>} 
  </Page>
}
function RecordFact({label,value,kind=''}){return <div className={`employee-record-fact ${kind}`}><span>{label}</span><strong>{value||'—'}</strong></div>}
function Details({employee,t,language,fmt,canAdmin,deleteEmployee,notify}){
  const [editing,setEditing]=useState(false)
  const [record,setRecord]=useState({...employee})
  const set=(k,v)=>setRecord(r=>({...r,[k]:v}))
  const cancel=()=>{setRecord({...employee});setEditing(false)}
  const save=()=>{setEditing(false);notify(t('employeesRecords.employeeUpdated'),'success')}
  return <div className="record-section">
    <div className="record-section-header"><div><span className="eyebrow">{t('employeesRecords.employeeAdministrativeData')}</span><h3>{t('employeesRecords.basicDetails')}</h3></div>
      {canAdmin&&<div className="record-inline-actions">{!editing&&<><button className="edit" title={t('employeesRecords.editEmployee')} onClick={()=>setEditing(true)}><Pencil size={16}/></button><button className="danger" title={t('employeesRecords.deleteEmployee')} onClick={deleteEmployee}><Trash2 size={16}/></button></>}</div>}
    </div>
    <div className={`detail-grid employee-full-grid ${editing?'employee-inline-edit':''}`}>
      <InlineDetail editing={false} l={t('employeeCode')} v={record.id}/>
      <InlineDetail editing={editing} l={t('firstName')} v={record.firstName} onChange={v=>set('firstName',v)}/>
      <InlineDetail editing={editing} l={t('lastName')} v={record.lastName} onChange={v=>set('lastName',v)}/>
      <InlineDetail editing={editing} l={t('fatherName')} v={language==='el'?record.fatherName:record.fatherNameEn} onChange={v=>set(language==='el'?'fatherName':'fatherNameEn',v)}/>
      <InlineSelect editing={editing} l={t('department')} v={record.department} display={language==='el'?record.department:record.departmentEn} options={demoLibrarySeed.departments} language={language} onChange={v=>set('department',v)}/>
      <InlineSelect editing={editing} l={t('professionalCategory')} v={record.profession} display={language==='el'?record.profession:record.professionEn} options={demoLibrarySeed.professionalCategories} language={language} onChange={v=>set('profession',v)}/>
      <InlineDateDetail editing={editing} l={t('employeesRecords.hireDate')} v={record.hireDate} display={fmt(record.hireDate)} onChange={v=>set('hireDate',v)}/>
      <InlineDetail editing={editing} l={t('employeesRecords.email')} v={record.email} onChange={v=>set('email',v)}/>
      <InlineDetail editing={editing} l={t('phone')} v={record.phone} onChange={v=>set('phone',v)}/>
    </div>
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" onClick={cancel}>{t('cancel')}</Button><SaveButton onClick={save}>{t('save')}</SaveButton></div>}
  </div>
}
function InlineDetail({editing,l,v,display,onChange,type='text'}){if(editing&&type==='date')return <ManualDateField className="detail-item editable" label={l} value={v||''} onChange={onChange}/>;return <div className={`detail-item ${editing?'editable':''}`}><span>{l}</span>{editing?<input type={type} value={v||''} onChange={e=>onChange?.(e.target.value)}/>:<strong>{display??v??'—'}</strong>}</div>}
function InlineSelect({editing,l,v,display,options,language,onChange}){return <div className={`detail-item ${editing?'editable':''}`}><span>{l}</span>{editing?<select value={v||''} onChange={e=>onChange(e.target.value)}>{options.map(([el,en])=><option key={el} value={el}>{language==='el'?el:en}</option>)}</select>:<strong>{display||'—'}</strong>}</div>}
function Occupational({employee,t,fmt,organizationId}){
  const {data:rows}=useEmployeeSubRecords(loadOccupationalVisitsAsync,organizationId,employee.dbId,employee.id)
  const [attachments,setAttachments]=useState(()=>employee.occupationalAttachments||[])
  return <div className="record-section"><SectionTitle t={t} title="occupationalHealth"/><div className="record-card-list">{rows.length?rows.map(x=><article key={x.id} className="record-subcard"><strong>{fmt(x.date)}</strong><span>{t(x.type)}</span><small>{t('fitnessStatus')}: {t(x.fitStatus)} · {t('followUp')}: {fmt(x.followUpDate)}</small></article>):<Empty t={t}/>}</div><AttachmentField value={attachments} onChange={setAttachments}/></div>
}
function Vaccinations({employee,t,fmt,organizationId}){const {data:rows}=useEmployeeSubRecords(loadVaccinationsAsync,organizationId,employee.dbId,employee.id);return <div className="record-section"><SectionTitle t={t} title="vaccinations"/><div className="record-card-list">{rows.length?rows.map(x=><article key={x.id} className="record-subcard"><strong>{x.vaccine}</strong><span>{t('dose')}: {x.dose}</span><small>{fmt(x.date)} · {t('validUntil')}: {fmt(x.validUntil)} · {t(x.status)}</small></article>):<Empty t={t}/>}</div></div>}
function Training({employee,t,language,fmt,organizationId}){const {data:rows}=useEmployeeSubRecords(loadEmployeeTrainingAsync,organizationId,employee.dbId,employee.id);return <div className="record-section"><SectionTitle t={t} title="training"/>{rows.length?<div className="record-table-wrap"><table className="record-table"><thead><tr><th>{t('employeesRecords.trainingTitle')}</th><th>{t('date')}</th><th>{t('status')}</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><strong>{language==='el'?x.titleEl:x.titleEn}</strong></td><td>{fmt(x.date)}</td><td><span className="status-badge active">{t(x.status)}</span></td></tr>)}</tbody></table></div>:<Empty t={t}/>}</div>}
function Evaluations({employee,t,language,fmt,selfMode,organizationId}){const {data:rows}=useEmployeeSubRecords(loadEvaluationsAsync,organizationId,employee.dbId,employee.id);return <div className="record-section"><SectionTitle t={t} title="evaluations"/><div className="source-truth-note">{selfMode?t('employeesRecords.selfEvaluationReadOnly'):t('employeesRecords.evaluationGovernance')}</div><div className="record-card-list">{rows.length?rows.map(x=><article key={x.id} className="record-subcard"><strong>{language==='el'?x.titleEl:x.titleEn}</strong><span>{fmt(x.date)}</span><small>{language==='el'?x.resultEl:x.resultEn}</small></article>):<Empty t={t}/>}</div></div>}
function Certificates({employee,t,language,fmt,selfMode,canAdmin,notify,organizationId}){
  const emptyDraft={titleEl:'',titleEn:'',issuer:'',issueDate:'',validUntil:'',certificateNumber:'',attachments:[]}
  const cloud=certificatesCloudEnabled(employee.dbId)
  const [allRows,setAllRows]=useState(cloud?[]:loadCertificates)
  const [loading,setLoading]=useState(cloud)
  useEffect(()=>{
    if(!cloud)return
    let cancelled=false
    setLoading(true)
    loadCertificatesAsync(organizationId,employee.dbId,employee.id).then(rows=>{if(!cancelled)setAllRows(rows)}).catch(()=>{}).finally(()=>{if(!cancelled)setLoading(false)})
    return ()=>{cancelled=true}
  },[cloud,organizationId,employee.dbId,employee.id])
  const rows=cloud?allRows:allRows.filter(x=>x.employeeId===employee.id)
  const [open,setOpen]=useState(false)
  const [editingId,setEditingId]=useState(null)
  const [draft,setDraft]=useState(emptyDraft)
  const [saving,setSaving]=useState(false)
  const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
  const beginNew=()=>{setEditingId(null);setDraft(emptyDraft);setOpen(true)}
  const openExisting=(row)=>{setEditingId(row.id);setDraft({...emptyDraft,...row,attachments:row.attachments||[]});setOpen(true)}
  const close=()=>{setOpen(false);setEditingId(null);setDraft(emptyDraft)}
  async function save(){
    if(saving)return
    if(cloud){
      setSaving(true)
      try{
        if(editingId){
          const updated=await updateCertificateAsync(editingId,draft)
          setAllRows(allRows.map(row=>row.id===editingId?updated:row))
          notify(t('employeesRecords.certificateUpdated'),'success')
        }else{
          const created=await createCertificateAsync(organizationId,employee.dbId,draft)
          // The dialog's AttachmentField had no real certificate id yet while
          // this was a new record, so any file added just now is still only
          // a local, unpersisted staged copy (objectUrl/dataUrl in memory) —
          // never actually uploaded anywhere. Migrate each staged file to
          // real cloud storage now that the certificate has a real id,
          // instead of silently discarding it on the very next reload
          // (found live: exactly this — an attached file "disappeared").
          const staged=(draft.attachments||[]).filter(a=>a.objectUrl&&!a.storagePath)
          let migratedCount=0
          for(const att of staged){
            try{
              const blob=await fetch(att.objectUrl).then(r=>r.blob())
              const file=new File([blob],att.name,{type:att.type||undefined})
              await uploadAttachment(organizationId,'employee_certificate',created.id,file,{category:att.category,description:att.description})
              migratedCount++
            }catch{
              // Continue with the remaining files; report the partial failure below.
            }
          }
          if(staged.length&&migratedCount<staged.length){
            notify(language==='en'?'Certificate saved, but not every attachment could be uploaded — please re-add the missing file(s).':'Το πιστοποιητικό αποθηκεύτηκε, αλλά κάποια συνημμένα δεν ανέβηκαν — προσθέστε ξανά το/τα αρχείο/α που λείπουν.','danger')
          }else{
            notify(t('employeesRecords.certificateAdded'),'success')
          }
          setAllRows([{...created,attachments:new Array(migratedCount).fill(null)},...allRows])
        }
        close()
      }catch{
        notify(t('actionFailed')||'Could not save the certificate.','danger')
      }finally{
        setSaving(false)
      }
      return
    }
    let next
    if(editingId){
      next=allRows.map(row=>row.id===editingId?{...row,...draft,id:editingId,employeeId:employee.id}:row)
      notify(t('employeesRecords.certificateUpdated'),'success')
    }else{
      next=[...allRows,{...draft,id:`CERT-${Date.now()}`,employeeId:employee.id}]
      notify(t('employeesRecords.certificateAdded'),'success')
    }
    setAllRows(next)
    saveCertificatesLocalFallback(next)
    close()
  }
  return <div className="record-section">
    <div className="record-section-header"><div><span className="eyebrow">{t('employeesRecords.employeeRecord')}</span><h3>{t('employeesRecords.certificatesDocuments')}</h3></div>{canAdmin&&!selfMode&&<Button onClick={beginNew}>+ {t('employeesRecords.newCertificate')}</Button>}</div>
    {loading?<Empty t={t}/>:rows.length?<div className="record-table-wrap"><table className="record-table record-table-clickable"><thead><tr><th>{t('employeesRecords.certificate')}</th><th>{t('employeesRecords.issuer')}</th><th>{t('employeesRecords.certificateNumber')}</th><th>{t('employeesRecords.issueDate')}</th><th>{t('validUntil')}</th><th>{t('attachments')}</th></tr></thead><tbody>{rows.map(x=><tr key={x.id} tabIndex={0} onClick={()=>openExisting(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openExisting(x)}}} title={canAdmin&&!selfMode?t('employeesRecords.openCertificateEdit'):t('employeesRecords.openCertificateView')}><td><strong>{language==='el'?x.titleEl:x.titleEn}</strong></td><td>{x.issuer||'—'}</td><td>{x.certificateNumber||'—'}</td><td>{fmt(x.issueDate)}</td><td>{fmt(x.validUntil)}</td><td>{x.attachments?.length||0}</td></tr>)}</tbody></table></div>:<Empty t={t}/>}
    {open&&<div className="modal-backdrop"><div className="entry-card certificate-entry-card"><header><div><span className="eyebrow">{editingId?t('employeesRecords.certificate'):t('employeesRecords.newCertificate')}</span><h3>{editingId?(canAdmin&&!selfMode?t('employeesRecords.editCertificate'):t('employeesRecords.certificateDetails')):t('employeesRecords.certificateDetails')}</h3></div><button className="icon-close" onClick={close}>×</button></header><div className="entry-grid"><label><span>{t('employeesRecords.certificate')}</span><input disabled={!canAdmin||selfMode} value={language==='el'?draft.titleEl:draft.titleEn} onChange={e=>set(language==='el'?'titleEl':'titleEn',e.target.value)}/></label><label><span>{t('employeesRecords.issuer')}</span><input disabled={!canAdmin||selfMode} value={draft.issuer} onChange={e=>set('issuer',e.target.value)}/></label><label><span>{t('employeesRecords.certificateNumber')}</span><input disabled={!canAdmin||selfMode} value={draft.certificateNumber} onChange={e=>set('certificateNumber',e.target.value)}/></label><ManualDateField disabled={!canAdmin||selfMode} label={t('employeesRecords.issueDate')} value={draft.issueDate} onChange={v=>set('issueDate',v)}/><ManualDateField disabled={!canAdmin||selfMode} label={t('validUntil')} value={draft.validUntil} onChange={v=>set('validUntil',v)}/></div><AttachmentField disabled={!canAdmin||selfMode} value={draft.attachments} onChange={v=>set('attachments',v)} organizationId={organizationId} entityType="employee_certificate" entityId={editingId}/><footer><Button variant="secondary" onClick={close} disabled={saving}>{t('close')}</Button>{canAdmin&&!selfMode&&<SaveButton onClick={save} disabled={saving}>{saving?(t('saving')||'…'):t('save')}</SaveButton>}</footer></div></div>}
  </div>
}
function InlineDateDetail({editing,l,v,display,onChange}){return editing?<ManualDateField label={l} value={v||''} onChange={onChange}/>:<div className="detail-item"><span>{l}</span><strong>{display||'—'}</strong></div>} 
function EmployeeSurveillance({employee,t,fmt,version,onNew}){
  const rows=useMemo(()=>getEmployeeSurveillanceForEmployee(employee.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 'version' is a deliberate cache-bust counter bumped after mutations; not read directly but must stay in deps to force recompute.
    [employee.id,version])
  return <div className="record-section"><div className="record-section-header"><div><span className="eyebrow">{t('employeeSurveillance')}</span><h3>{t('surveillance')}</h3><p>{t('employeesRecords.employeeSurveillanceRecordHelp')}</p></div><Button onClick={onNew}>+ {t('newSurveillance')}</Button></div>
    {rows.length?<div className="record-table-wrap"><table className="record-table"><thead><tr><th>{t('surveillance')}</th><th>{t('screeningDate')}</th><th>{t('screeningType')}</th><th>{t('batch')}</th><th>{t('status')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.id}</strong></td><td>{fmt(row.startedAt)}</td><td>{row.screeningTypes.map(x=>t(x)).join(', ')}</td><td>{row.batchId||'—'}</td><td><span className={`status-badge ${row.status==='active'?'active':''}`}>{t(row.status)}</span></td></tr>)}</tbody></table></div>:<Empty t={t}/>}
  </div>
}
function History({t}){return <div className="record-section"><SectionTitle t={t} title="history"/><div className="timeline-line"><strong>{t('employeesRecords.employeeRecordCreated')}</strong><span>{t('employeesRecords.auditVisibleAccordingToRole')}</span></div></div>}
function SectionTitle({t,title}){return <div className="record-section-header"><div><span className="eyebrow">{t('employeesRecords.employeeRecord')}</span><h3>{t(title)}</h3></div></div>}
function Empty({t}){return <div className="inline-empty">{t('noData')}</div>}

