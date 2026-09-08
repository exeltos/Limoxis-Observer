import { useEffect,useMemo,useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadBundleClinicalOptions } from './bundleCloudService'

function scoreFor(answers={}){
 const applicable=Object.values(answers).filter(x=>x==='yes'||x==='no')
 if(!applicable.length)return null
 return Math.round(applicable.filter(x=>x==='yes').length/applicable.length*100)
}
function allOrNoneFor(answers={}){
 const applicable=Object.values(answers).filter(x=>x==='yes'||x==='no')
 return applicable.length>0&&applicable.every(x=>x==='yes')
}

export function BundleExecutionEditor({onCancel,onSave,fixedDepartment='',initialRecord=null,departments=[],templates=[]}){
 const {profile,user}=useAuth()
 const {tenant}=useTenant()
 const {language}=useLanguage();const en=language==='en'
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const firstTemplate=templates[0]
 const [saving,setSaving]=useState(false)
 const [clinicalLoading,setClinicalLoading]=useState(false)
 const [clinicalOptions,setClinicalOptions]=useState({patients:[],devices:[]})
 const [draft,setDraft]=useState(()=>initialRecord?JSON.parse(JSON.stringify(initialRecord)):{templateId:'',departmentEl:fixedDepartment||'',date:new Date().toISOString().slice(0,10),shift:'Πρωινή',context:'',patientId:'',patientRef:'',deviceId:'',deviceRef:'',answers:{},answerNotes:{},generalNotes:'',status:'draft'})

 useEffect(()=>{if(initialRecord)return;if(!draft.templateId&&firstTemplate?.id)setDraft(current=>({...current,templateId:firstTemplate.id}))},[firstTemplate?.id,initialRecord,draft.templateId])
 useEffect(()=>{if(!initialRecord&&fixedDepartment&&draft.departmentEl!==fixedDepartment)setDraft(current=>({...current,departmentEl:fixedDepartment}))},[fixedDepartment,initialRecord,draft.departmentEl])
 useEffect(()=>{
  if(!tenant?.id)return
  let active=true;setClinicalLoading(true)
  loadBundleClinicalOptions(tenant.id).then(data=>{if(active)setClinicalOptions(data)}).catch(()=>{if(active)setClinicalOptions({patients:[],devices:[]})}).finally(()=>{if(active)setClinicalLoading(false)})
  return()=>{active=false}
 },[tenant?.id])

 const template=templates.find(x=>x.id===draft.templateId||x.bundleKey===draft.templateId)||firstTemplate
 const elements=template?.elements||[]
 const score=scoreFor(draft.answers)
 const allOrNone=allOrNoneFor(draft.answers)
 const answered=elements.filter(([id])=>['yes','no','na'].includes(draft.answers[id])).length
 const applicable=elements.filter(([id])=>['yes','no'].includes(draft.answers[id])).length
 const failures=elements.filter(([id])=>draft.answers[id]==='no')
 const complete=elements.length>0&&answered===elements.length
 const canSave=Boolean(template&&draft.templateId&&draft.departmentEl&&draft.date)
 const set=(key,value)=>setDraft(current=>({...current,[key]:value}))
 const answer=(id,value)=>setDraft(current=>({...current,answers:{...current.answers,[id]:value}}))
 const note=(id,value)=>setDraft(current=>({...current,answerNotes:{...current.answerNotes,[id]:value}}))
 const elementLabel=(id,fallback)=>{const raw=(template?.rawElements||[]).find(item=>item.id===id);if(!raw)return fallback;return en?(raw.labelEn||raw.label_en||raw.labelEl||raw.label_el||fallback):(raw.labelEl||raw.label_el||raw.label||fallback)}
 const patients=clinicalOptions.patients||[]
 const selectedPatient=patients.find(item=>item.id===draft.patientId)||null
 const devices=(clinicalOptions.devices||[]).filter(item=>!draft.patientId||item.patientId===draft.patientId)
 const selectedDevice=devices.find(item=>item.id===draft.deviceId)||null
 const choosePatient=value=>{const patient=patients.find(item=>item.id===value);setDraft(current=>({...current,patientId:value,patientRef:patient?.label||'',deviceId:'',deviceRef:''}))}
 const chooseDevice=value=>{const device=devices.find(item=>item.id===value);setDraft(current=>({...current,deviceId:value,deviceRef:device?.label||''}))}
 async function submit(){
  if(!canSave||saving)return
  const now=new Date().toISOString();const dep=departments.find(x=>x.el===draft.departmentEl)
  const payload={...draft,bundle:template.id,templateName:template.name,templateTitle:en?(template.titleEn||template.title):template.title,templateVersion:template.version,templateSource:template.source,templateSnapshot:JSON.parse(JSON.stringify(template)),departmentEn:dep?.en||draft.departmentEl,score,allOrNone,patientRef:selectedPatient?.label||draft.patientRef||'',deviceRef:selectedDevice?.label||draft.deviceRef||'',applicableCount:applicable,failedCount:failures.length,findings:failures.map(([id,label])=>({id,label:elementLabel(id,label),note:draft.answerNotes[id]||''})),owner:actor.name,createdAt:initialRecord?.createdAt||now,createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,updatedAt:initialRecord?now:null,updatedBy:initialRecord?actor.name:null,updatedById:initialRecord?actor.id:null,status:complete?'completed':'draft',lifecycleStatus:complete?'finalized':'draft'}
  setSaving(true);try{await onSave?.(payload)}finally{setSaving(false)}
 }
 return <div className="bundle-page-editor">
  <div className="bundle-page-actor"><span>{en?'Recorded by':'Καταχώρηση από'}</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
  <section className="bundle-page-context"><div className="bundle-page-grid">
   <label><span>Bundle *</span><select value={draft.templateId} onChange={e=>setDraft(current=>({...current,templateId:e.target.value,answers:{},answerNotes:{}}))}><option value="">{en?'Select Bundle':'Επιλέξτε Bundle'}</option>{templates.map(item=><option key={item.id} value={item.id}>{item.name} — {en?(item.titleEn||item.title):item.title}</option>)}</select></label>
   <label><span>{en?'Department *':'Τμήμα *'}</span><select value={draft.departmentEl} disabled={Boolean(fixedDepartment)} onChange={e=>set('departmentEl',e.target.value)}><option value="">{en?'Select department':'Επιλέξτε τμήμα'}</option>{departments.map(item=><option key={item.id||item.el} value={item.el}>{en?(item.en||item.el):item.el}</option>)}</select></label>
   <ManualDateField label={en?'Date *':'Ημερομηνία *'} value={draft.date} onChange={value=>set('date',value)}/>
   <label><span>{en?'Shift / context':'Βάρδια / πλαίσιο'}</span><select value={draft.shift} onChange={e=>set('shift',e.target.value)}><option value="Πρωινή">{en?'Morning':'Πρωινή'}</option><option value="Απογευματινή">{en?'Afternoon':'Απογευματινή'}</option><option value="Νυχτερινή">{en?'Night':'Νυχτερινή'}</option><option value="Άλλο">{en?'Other':'Άλλο'}</option></select></label>
   <label><span>{en?'Patient':'Ασθενής'}</span><select value={draft.patientId||''} onChange={e=>choosePatient(e.target.value)} disabled={clinicalLoading}><option value="">{clinicalLoading?(en?'Loading patients…':'Φόρτωση ασθενών…'):(en?'Select patient (optional)':'Επιλέξτε ασθενή (προαιρετικό)')}</option>{patients.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
   <label><span>{en?'Device':'Συσκευή'}</span><select value={draft.deviceId||''} onChange={e=>chooseDevice(e.target.value)} disabled={clinicalLoading||!draft.patientId}><option value="">{!draft.patientId?(en?'Select patient first':'Επιλέξτε πρώτα ασθενή'):(clinicalLoading?(en?'Loading devices…':'Φόρτωση συσκευών…'):(en?'Select device (optional)':'Επιλέξτε συσκευή (προαιρετικό)'))}</option>{devices.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
  </div>{template&&<div className="bundle-page-template-meta"><span><b>{template.name}</b> · v{template.version}</span><span>{template.source}</span></div>}</section>
  {template?<section className="bundle-page-checklist"><div className="bundle-page-checklist-head"><div><strong>{en?'Bundle elements':'Στοιχεία Bundle'}</strong><small>{en?'You can save at any time. A complete checklist is finalized automatically.':'Μπορείτε να αποθηκεύσετε οποιαδήποτε στιγμή. Όταν απαντηθούν όλα τα στοιχεία, η αξιολόγηση ολοκληρώνεται αυτόματα.'}</small></div><div className="bundle-page-progress"><span>{en?'Answered':'Απαντημένα'} {answered}/{elements.length}</span><strong>{score===null?'—':`${score}%`}</strong><small>{allOrNone?'All-or-none ✓':'All-or-none —'}</small></div></div><div className="bundle-page-rows">{elements.map(([id,label],index)=>{const value=draft.answers[id];return <div className={`bundle-page-row ${value||'unanswered'}`} key={id}><div className="bundle-page-row-main"><span className="bundle-page-index">{index+1}</span><strong>{elementLabel(id,label)}</strong><div className="bundle-page-answers">{[['yes',en?'Yes':'Ναι'],['no',en?'No':'Όχι'],['na',en?'N/A':'Μ/Ε']].map(([answerValue,text])=><button type="button" key={answerValue} className={value===answerValue?'active':''} onClick={()=>answer(id,answerValue)}>{text}</button>)}</div></div>{value==='no'&&<div className="bundle-page-deviation"><ShieldAlert size={15}/><input value={draft.answerNotes[id]||''} onChange={e=>note(id,e.target.value)} placeholder={en?'Deviation / action required':'Απόκλιση / ενέργεια που απαιτείται'}/></div>}</div>})}</div></section>:<div className="inline-empty">{en?'No published bundle templates are available.':'Δεν υπάρχουν διαθέσιμα δημοσιευμένα Bundle templates.'}</div>}
  <div className="bundle-page-summary"><span><b>{en?'Answered':'Απαντημένα'}</b>{answered}/{elements.length}</span><span><b>{en?'Applicable':'Εφαρμόσιμα'}</b>{applicable}</span><span><b>{en?'Deviations':'Αποκλίσεις'}</b>{failures.length}</span><span><b>{en?'Compliance':'Συμμόρφωση'}</b>{score===null?'—':`${score}%`}</span><span><b>All-or-none</b>{applicable===0?'—':allOrNone?(en?'Yes':'Ναι'):(en?'No':'Όχι')}</span></div>
  {!complete&&elements.length>0&&<div className="bundle-page-hint">{en?`${elements.length-answered} element(s) remain. Saving now will keep this assessment as a draft.`:`Απομένουν ${elements.length-answered} στοιχείο/α. Η αποθήκευση τώρα θα κρατήσει την αξιολόγηση ως πρόχειρη.`}</div>}
  <label className="bundle-page-notes"><span>{en?'General notes':'Γενικές σημειώσεις'}</span><textarea rows="3" value={draft.generalNotes||''} onChange={e=>set('generalNotes',e.target.value)} placeholder={en?'Optional execution notes':'Προαιρετικές παρατηρήσεις για την εκτέλεση'}/></label>
  <div className="bundle-page-actions"><Button variant="secondary" onClick={onCancel}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton disabled={!canSave||saving} onClick={submit}>{saving?(en?'Saving…':'Αποθήκευση…'):complete?(en?'Complete assessment':'Ολοκλήρωση αξιολόγησης'):(en?'Save draft':'Αποθήκευση προχείρου')}</SaveButton></div>
 </div>
}
