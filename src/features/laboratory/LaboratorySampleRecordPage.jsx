import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Download, FileClock, FlaskConical, Microscope, Paperclip, Pencil, PhoneCall, Printer, ShieldAlert } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { AttachmentField } from '../../design-system/AttachmentField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { getLabSample } from './laboratoryDemoData'
import { Status } from './LaboratoryPage'

export function LaboratorySampleRecordPage(){
  const {sampleId}=useParams()
  const navigate=useNavigate()
  const {t,language,locale}=useLanguage()
  const {notify}=useFeedback()
  const {role,membership}=useTenant()
  const source=getLabSample(sampleId)
  const [sample,setSample]=useState(source?{...source}:null)
  const [tab,setTab]=useState('summary')
  const addOns=membership?.capabilities??[]; const custom=membership?.customCapabilities??[]
  const has=(cap)=>can(role,cap,addOns,custom)
  const canManage=has(CAPABILITIES.MANAGE_LAB_SAMPLES)
  const canValidate=has(CAPABILITIES.VALIDATE_LAB_RESULTS)
  const canCommunicate=has(CAPABILITIES.COMMUNICATE_CRITICAL_RESULTS)
  const canClassify=has(CAPABILITIES.CLASSIFY_RESISTANCE)
  const canAttach=has(CAPABILITIES.ATTACH_FILES)
  const canPrint=has(CAPABILITIES.PRINT_RECORDS)
  const canExport=has(CAPABILITIES.EXPORT_RECORDS)
  const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—'
  if(!sample)return <Page title={t('sample')}><div className="inline-empty">{t('noData')}</div></Page>
  const patientName=language==='el'?sample.patient:sample.patientEn
  const tabs=[
    {id:'summary',label:t('summary'),icon:FlaskConical},
    {id:'result',label:t('microbiologyResult'),icon:Microscope},
    {id:'ast',label:t('antimicrobialSusceptibility'),icon:ShieldAlert},
    {id:'communication',label:t('criticalCommunication'),icon:PhoneCall},
    {id:'documents',label:t('documents'),icon:Paperclip},
    {id:'history',label:t('history'),icon:FileClock},
  ]
  function update(patch,message='actionCompleted'){
    setSample(current=>({...current,...patch}))
    notify(t(message),'success')
  }
  function receiveSample(){
    const now=new Date().toISOString()
    update({status:'received',receivedAt:now,timeline:[{at:now,type:'sampleReceived',actor:t('currentUser')},...(sample.timeline||[])]},'sampleReceivedMessage')
  }
  return <Page fill>
    <EntityRecordShell
      className="laboratory-record-shell workspace-fill"
      avatar={<FlaskConical size={20}/>}
      eyebrow={sample.id}
      title={t(sample.type)}
      subtitle={`${patientName} · ${sample.patientId} · ${language==='el'?sample.department:sample.departmentEn}`}
      status={<><Status text={t(sample.status)} kind={sample.status}/>{sample.resistance&&<b className="amr-chip">{sample.resistance}</b>}</>}
      headerActions={<>{canPrint&&<button className="entity-record-icon-button" title={t('print')} aria-label={t('print')} onClick={()=>window.print()}><Printer size={15}/></button>}{canExport&&<button className="entity-record-icon-button" title={t('export')} aria-label={t('export')}><Download size={15}/></button>}</>}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
     
      backLabel={t('backToLaboratory')}
    >
      {tab==='summary'&&<SampleSummary sample={sample} t={t} language={language} fmt={fmt} canManage={canManage} onReceive={receiveSample}/>}
      {tab==='result'&&<ResultPanel sample={sample} setSample={setSample} t={t} language={language} fmt={fmt} canManage={canManage} canValidate={canValidate} canClassify={canClassify} notify={notify}/>}
      {tab==='ast'&&<AstPanel sample={sample} setSample={setSample} t={t} canManage={canManage} notify={notify}/>}
      {tab==='communication'&&<CriticalCommunicationPanel sample={sample} setSample={setSample} t={t} language={language} fmt={fmt} canCommunicate={canCommunicate} notify={notify}/>}
      {tab==='documents'&&<DocumentsPanel sample={sample} setSample={setSample} t={t} canAttach={canAttach}/>}
      {tab==='history'&&<LabHistory sample={sample} t={t} fmt={fmt}/>}
    </EntityRecordShell>
  </Page>
}

function SampleSummary({sample,t,language,fmt,canManage,onReceive}){
  return <div className="record-section laboratory-summary">
    <div className="record-section-header"><div><span className="eyebrow">{t('sample')}</span><h3>{t('sampleDetails')}</h3></div>{canManage&&sample.status==='requested'&&<Button onClick={onReceive}>{t('receiveSample')}</Button>}</div>
    <div className="detail-grid lab-detail-grid">
      <Detail l={t('sampleCode')} v={sample.id}/>
      <Detail l={t('patient')} v={language==='el'?sample.patient:sample.patientEn}/>
      <Detail l={t('patientId')} v={sample.patientId}/>
      <Detail l={t('department')} v={language==='el'?sample.department:sample.departmentEn}/>
      <Detail l={t('sampleType')} v={t(sample.type)}/>
      <Detail l={t('source')} v={language==='el'?sample.source:sample.sourceEn}/>
      <Detail l={t('collected')} v={fmt(sample.collectedAt)}/>
      <Detail l={t('received')} v={fmt(sample.receivedAt)}/>
      <Detail l={t('priority')} v={t(sample.priority)}/>
      <Detail l={t('status')} v={t(sample.status)}/>
      <Detail l={t('linkedSurveillance')} v={sample.surveillanceCase||t('notLinked')}/>
      <Detail l={t('resultStatus')} v={t(sample.resultStatus||'draft')}/>
    </div>
    <div className="source-truth-note">{t('labSourceTruth')}</div>
  </div>
}

function ResultPanel({sample,setSample,t,language,fmt,canManage,canValidate,canClassify,notify}){
  const [editing,setEditing]=useState(false)
  const [draft,setDraft]=useState({result:sample.result||'',organism:sample.organism||'',critical:Boolean(sample.critical),resistance:sample.resistance||'',resultStatus:sample.resultStatus||'draft'})
  const set=(k,v)=>setDraft(x=>({...x,[k]:v}))
  function save(){
    const now=new Date().toISOString()
    const amended=sample.resultStatus==='validated'
    const nextStatus=amended?'amended':draft.resultStatus
    setSample(s=>({...s,...draft,resultStatus:nextStatus,resultedAt:s.resultedAt||now,status:draft.result?'completed':s.status,timeline:[{at:now,type:amended?'resultAmended':'resultUpdated',actor:t('currentUser')},...(s.timeline||[])]}))
    setDraft(d=>({...d,resultStatus:nextStatus}))
    setEditing(false);notify(t(amended?'resultAmendedMessage':'resultSaved'),'success')
  }
  function validate(){
    const now=new Date().toISOString()
    setSample(s=>({...s,resultStatus:'validated',validatedAt:now,validatedBy:t('currentUser'),status:'completed',timeline:[{at:now,type:'resultValidated',actor:t('currentUser')},...(s.timeline||[])]}))
    setDraft(d=>({...d,resultStatus:'validated'}));notify(t('resultValidatedMessage'),'success')
  }
  return <div className="record-section">
    <div className="record-section-header"><div><span className="eyebrow">{t('microbiologyResult')}</span><h3>{t('resultAndOrganism')}</h3></div><div className="record-inline-actions">{canManage&&!editing&&<button title={sample.resultStatus==='validated'?t('amendResult'):t('edit')} onClick={()=>setEditing(true)}><Pencil size={16}/></button>}{canValidate&&sample.result&&sample.resultStatus!=='validated'&&<Button onClick={validate}><CheckCircle2 size={15}/>{t('validateResult')}</Button>}</div></div>
    <div className={`detail-grid lab-result-grid ${editing?'employee-inline-edit':''}`}>
      <EditableSelect editing={editing} label={t('result')} value={draft.result} display={draft.result?t(draft.result):'—'} onChange={v=>set('result',v)} options={[['',t('select')],['positive',t('positive')],['negative',t('negative')]]}/>
      <EditableField editing={editing} label={t('organism')} value={draft.organism} onChange={v=>set('organism',v)}/>
      <EditableSelect editing={editing&&canClassify} label={t('resistanceClass')} value={draft.resistance} display={draft.resistance||'—'} onChange={v=>set('resistance',v)} options={[['','—'],['MDR','MDR'],['XDR','XDR'],['PDR','PDR']]}/>
      <EditableSelect editing={editing} label={t('criticalResult')} value={draft.critical?'yes':'no'} display={draft.critical?t('yes'):t('no')} onChange={v=>set('critical',v==='yes')} options={[['no',t('no')],['yes',t('yes')]]}/>
      <Detail l={t('resultStatus')} v={t(sample.resultStatus||'draft')}/>
      <Detail l={t('resultedAt')} v={fmt(sample.resultedAt)}/>
      <Detail l={t('validatedAt')} v={fmt(sample.validatedAt)}/>
      <Detail l={t('validatedBy')} v={sample.validatedBy||'—'}/>
    </div>
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" onClick={()=>{setDraft({result:sample.result||'',organism:sample.organism||'',critical:Boolean(sample.critical),resistance:sample.resistance||'',resultStatus:sample.resultStatus||'draft'});setEditing(false)}}>{t('cancel')}</Button><Button onClick={save}>{t('save')}</Button></div>}
    {sample.resultStatus==='validated'&&<div className="validated-result-note"><CheckCircle2 size={16}/><span>{t('validatedResultReadOnlyHint')}</span></div>}
  </div>
}

function AstPanel({sample,setSample,t,canManage,notify}){
  const [open,setOpen]=useState(false)
  const [draft,setDraft]=useState({drug:'',sir:'S',mic:'',method:'MIC',standard:'EUCAST',version:'16.0'})
  function add(){
    if(!draft.drug.trim())return
    setSample(s=>({...s,ast:[...s.ast,draft],timeline:[{at:new Date().toISOString(),type:'astUpdated',actor:t('currentUser')},...(s.timeline||[])]}))
    setDraft({drug:'',sir:'S',mic:'',method:'MIC',standard:'EUCAST',version:'16.0'});setOpen(false);notify(t('astSaved'),'success')
  }
  return <div className="record-section">
    <div className="record-section-header"><div><span className="eyebrow">{t('antimicrobialSusceptibility')}</span><h3>{t('astResults')}</h3></div>{canManage&&<Button onClick={()=>setOpen(true)}>+ {t('addAstResult')}</Button>}</div>
    <div className="ast-governance-note"><ShieldAlert size={16}/><span>{t('eucastSirHint')}</span></div>
    {sample.ast.length?<div className="record-table-wrap"><table className="record-table ast-record-table"><thead><tr><th>{t('antimicrobial')}</th><th>{t('sir')}</th><th>{t('mic')}</th><th>{t('method')}</th><th>{t('breakpointStandard')}</th></tr></thead><tbody>{sample.ast.map((row,index)=><tr key={`${row.drug}-${index}`}><td><strong>{row.drug}</strong></td><td><b className={`sir ${row.sir.toLowerCase()}`}>{row.sir}</b></td><td>{row.mic||'—'}</td><td>{row.method||'—'}</td><td>{row.standard||'EUCAST'} {row.version||''}</td></tr>)}</tbody></table></div>:<div className="inline-empty">{t('noAstResults')}</div>}
    {open&&<div className="modal-backdrop"><div className="entry-card ast-entry-card"><header><div><span className="eyebrow">{t('antimicrobialSusceptibility')}</span><h3>{t('addAstResult')}</h3></div><button className="icon-close" onClick={()=>setOpen(false)}>×</button></header><div className="entry-grid"><label><span>{t('antimicrobial')}</span><input value={draft.drug} onChange={e=>setDraft(d=>({...d,drug:e.target.value}))}/></label><label><span>{t('sir')}</span><select value={draft.sir} onChange={e=>setDraft(d=>({...d,sir:e.target.value}))}><option>S</option><option>I</option><option>R</option></select></label><label><span>{t('mic')}</span><input value={draft.mic} onChange={e=>setDraft(d=>({...d,mic:e.target.value}))}/></label><label><span>{t('method')}</span><input value={draft.method} onChange={e=>setDraft(d=>({...d,method:e.target.value}))}/></label><label><span>{t('breakpointStandard')}</span><input value={draft.standard} onChange={e=>setDraft(d=>({...d,standard:e.target.value}))}/></label><label><span>{t('version')}</span><input value={draft.version} onChange={e=>setDraft(d=>({...d,version:e.target.value}))}/></label></div><footer><Button variant="secondary" onClick={()=>setOpen(false)}>{t('cancel')}</Button><Button onClick={add}>{t('save')}</Button></footer></div></div>}
  </div>
}

function CriticalCommunicationPanel({sample,setSample,t,language,fmt,canCommunicate,notify}){
  const [open,setOpen]=useState(false)
  const [draft,setDraft]=useState({to:'',toEn:'',method:'phone',readBack:true,notes:'',notesEn:''})
  function save(){
    const at=new Date().toISOString()
    const row={id:`COMM-${Date.now()}`,at,by:t('currentUser'),...draft}
    setSample(s=>({...s,communications:[row,...(s.communications||[])],timeline:[{at,type:'criticalCommunicated',actor:t('currentUser')},...(s.timeline||[])]}))
    setOpen(false);setDraft({to:'',toEn:'',method:'phone',readBack:true,notes:'',notesEn:''});notify(t('criticalCommunicationSaved'),'success')
  }
  return <div className="record-section">
    <div className="record-section-header"><div><span className="eyebrow">{t('criticalResult')}</span><h3>{t('criticalCommunication')}</h3></div>{sample.critical&&canCommunicate&&<Button onClick={()=>setOpen(true)}>+ {t('newCommunication')}</Button>}</div>
    {!sample.critical&&<div className="source-truth-note">{t('notMarkedCritical')}</div>}
    {sample.critical&&!(sample.communications?.length)&&<div className="critical-box open"><AlertTriangle size={17}/><div><strong>{t('criticalCommunicationRequired')}</strong><span>{t('criticalCommunicationRequiredHint')}</span></div></div>}
    {(sample.communications||[]).length?<div className="record-table-wrap"><table className="record-table"><thead><tr><th>{t('date')}</th><th>{t('recipient')}</th><th>{t('method')}</th><th>{t('communicatedBy')}</th><th>{t('readBack')}</th><th>{t('notes')}</th></tr></thead><tbody>{sample.communications.map(row=><tr key={row.id}><td>{fmt(row.at)}</td><td>{language==='el'?row.to:row.toEn||row.to}</td><td>{t(row.method)}</td><td>{row.by}</td><td>{row.readBack?t('yes'):t('no')}</td><td>{language==='el'?row.notes:row.notesEn||row.notes}</td></tr>)}</tbody></table></div>:null}
    {open&&<div className="modal-backdrop"><div className="entry-card communication-entry-card"><header><div><span className="eyebrow">{t('criticalCommunication')}</span><h3>{t('newCommunication')}</h3></div><button className="icon-close" onClick={()=>setOpen(false)}>×</button></header><div className="entry-grid"><label><span>{t('recipient')}</span><input value={language==='el'?draft.to:draft.toEn} onChange={e=>setDraft(d=>({...d,[language==='el'?'to':'toEn']:e.target.value}))}/></label><label><span>{t('method')}</span><select value={draft.method} onChange={e=>setDraft(d=>({...d,method:e.target.value}))}><option value="phone">{t('phone')}</option><option value="in_person">{t('inPerson')}</option><option value="secure_message">{t('secureMessage')}</option><option value="other">{t('other')}</option></select></label><label><span>{t('readBack')}</span><select value={draft.readBack?'yes':'no'} onChange={e=>setDraft(d=>({...d,readBack:e.target.value==='yes'}))}><option value="yes">{t('yes')}</option><option value="no">{t('no')}</option></select></label><label className="entry-span-2"><span>{t('notes')}</span><textarea rows={3} value={language==='el'?draft.notes:draft.notesEn} onChange={e=>setDraft(d=>({...d,[language==='el'?'notes':'notesEn']:e.target.value}))}/></label></div><footer><Button variant="secondary" onClick={()=>setOpen(false)}>{t('cancel')}</Button><Button disabled={!(draft.to||draft.toEn)} onClick={save}>{t('save')}</Button></footer></div></div>}
  </div>
}

function DocumentsPanel({sample,setSample,t,canAttach}){
  return <div className="record-section"><div className="record-section-header"><div><span className="eyebrow">{t('sample')}</span><h3>{t('documents')}</h3></div></div><AttachmentField disabled={!canAttach} value={sample.attachments||[]} onChange={files=>setSample(s=>({...s,attachments:files}))}/></div>
}
function LabHistory({sample,t,fmt}){
  const rows=useMemo(()=>[...(sample.timeline||[])].sort((a,b)=>new Date(b.at)-new Date(a.at)),[sample.timeline])
  return <div className="record-section"><div className="record-section-header"><div><span className="eyebrow">{t('sample')}</span><h3>{t('history')}</h3></div></div><div className="lab-history-list">{rows.map((row,index)=><div key={`${row.at}-${index}`} className="lab-history-row"><time>{fmt(row.at)}</time><strong>{t(row.type)}</strong><span>{row.actor||'—'}</span></div>)}</div></div>
}
function Detail({l,v}){return <div className="detail-item"><span>{l}</span><strong>{v||'—'}</strong></div>}
function EditableField({editing,label,value,onChange}){return <div className={`detail-item ${editing?'editable':''}`}><span>{label}</span>{editing?<input value={value||''} onChange={e=>onChange(e.target.value)}/>:<strong>{value||'—'}</strong>}</div>}
function EditableSelect({editing,label,value,display,onChange,options}){return <div className={`detail-item ${editing?'editable':''}`}><span>{label}</span>{editing?<select value={typeof value==='boolean'?(value?'yes':'no'):value} onChange={e=>onChange(e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:<strong>{display||'—'}</strong>}</div>}
