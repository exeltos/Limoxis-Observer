import { useMemo,useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { DialogActions,ObserverDialog } from '../../design-system/ObserverDialog'

function scoreFor(answers={}){
 const applicable=Object.values(answers).filter(x=>x==='yes'||x==='no')
 if(!applicable.length)return null
 return Math.round(applicable.filter(x=>x==='yes').length/applicable.length*100)
}
function allOrNoneFor(answers={}){
 const applicable=Object.values(answers).filter(x=>x==='yes'||x==='no')
 return applicable.length>0&&applicable.every(x=>x==='yes')
}

export function BundleExecutionModal({onClose,onSave,fixedDepartment='',initialRecord=null,departments=[],templates=[]}){
 const {profile,user}=useAuth()
 const {language}=useLanguage(); const en=language==='en'
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const firstTemplate=templates[0]
 const [draft,setDraft]=useState(()=>initialRecord?JSON.parse(JSON.stringify(initialRecord)):{
  templateId:firstTemplate?.id||'',departmentEl:fixedDepartment||departments[0]?.el||'',date:new Date().toISOString().slice(0,10),
  shift:'Πρωινή',context:'',patientRef:'',deviceRef:'',answers:{},answerNotes:{},generalNotes:'',status:'completed'
 })
 const template=templates.find(x=>x.id===draft.templateId||x.bundleKey===draft.templateId)||firstTemplate
 const elements=template?.elements||[]
 const score=scoreFor(draft.answers)
 const allOrNone=allOrNoneFor(draft.answers)
 const answered=elements.filter(([id])=>['yes','no','na'].includes(draft.answers[id])).length
 const applicable=elements.filter(([id])=>['yes','no'].includes(draft.answers[id])).length
 const failures=elements.filter(([id])=>draft.answers[id]==='no')
 const complete=elements.length>0&&answered===elements.length
 const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
 const answer=(id,value)=>setDraft(d=>({...d,answers:{...d.answers,[id]:value}}))
 const note=(id,value)=>setDraft(d=>({...d,answerNotes:{...d.answerNotes,[id]:value}}))
 const valid=Boolean(template&&draft.templateId&&draft.departmentEl&&draft.date&&complete&&applicable>0)
 const elementLabel=(id,fallback)=>{
  const raw=(template?.rawElements||[]).find(item=>item.id===id)
  if(!raw)return fallback
  return en?(raw.labelEn||raw.label_en||raw.labelEl||raw.label_el||fallback):(raw.labelEl||raw.label_el||raw.label||fallback)
 }

 function submit(){
  if(!valid)return
  const now=new Date().toISOString()
  const dep=departments.find(x=>x.el===draft.departmentEl)
  onSave({...draft,bundle:template.id,templateName:template.name,templateTitle:en?(template.titleEn||template.title):template.title,templateVersion:template.version,
   templateSource:template.source,templateSnapshot:JSON.parse(JSON.stringify(template)),departmentEn:dep?.en||draft.departmentEl,score:score??0,allOrNone,
   applicableCount:applicable,failedCount:failures.length,findings:failures.map(([id,label])=>({id,label:elementLabel(id,label),note:draft.answerNotes[id]||''})),
   owner:actor.name,createdAt:initialRecord?.createdAt||now,createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,
   updatedAt:initialRecord?now:null,updatedBy:initialRecord?actor.name:null,updatedById:initialRecord?actor.id:null,status:'completed',lifecycleStatus:'finalized'})
 }

 return <ObserverDialog
  eyebrow="BUNDLE EXECUTION"
  title={initialRecord?(en?'Edit bundle execution':'Επεξεργασία εκτέλεσης'):(en?'New Bundle execution':'Νέα εκτέλεση Bundle')}
  subtitle={en?'Element-by-element assessment, documented deviations and all-or-none compliance.':'Αξιολόγηση ανά στοιχείο, τεκμηρίωση αποκλίσεων και all-or-none συμμόρφωση.'}
  width="workspace"
  presentation="workspace"
  className="bundle-execution-card"
  onClose={onClose}
  footer={<DialogActions showCancel onCancel={onClose} onSave={submit} disabled={!valid} saveLabel={initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Complete execution':'Ολοκλήρωση εκτέλεσης')}/>}
 >
  <div className="bundle-execution-body">
   <div className="prevention-entry-actor"><span>{en?'Recorded by':'Καταχώρηση από'}</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
   <section className="bundle-context-card">
    <div className="entry-grid">
     <label><span>Bundle *</span><select value={draft.templateId} onChange={e=>setDraft(d=>({...d,templateId:e.target.value,answers:{},answerNotes:{}}))}>{templates.map(x=><option key={x.id} value={x.id}>{x.name} — {en?(x.titleEn||x.title):x.title}</option>)}</select></label>
     <label><span>{en?'Department *':'Τμήμα *'}</span><select value={draft.departmentEl} disabled={Boolean(fixedDepartment)} onChange={e=>set('departmentEl',e.target.value)}>{departments.map(x=><option key={x.id||x.el} value={x.el}>{en?(x.en||x.el):x.el}</option>)}</select></label>
     <ManualDateField label={en?'Date *':'Ημερομηνία *'} value={draft.date} onChange={v=>set('date',v)}/>
     <label><span>{en?'Shift / context':'Βάρδια / πλαίσιο'}</span><select value={draft.shift} onChange={e=>set('shift',e.target.value)}><option value="Πρωινή">{en?'Morning':'Πρωινή'}</option><option value="Απογευματινή">{en?'Afternoon':'Απογευματινή'}</option><option value="Νυχτερινή">{en?'Night':'Νυχτερινή'}</option><option value="Άλλο">{en?'Other':'Άλλο'}</option></select></label>
     <label><span>{en?'Patient reference':'Αναφορά ασθενή'}</span><input value={draft.patientRef||''} onChange={e=>set('patientRef',e.target.value)} placeholder={en?'Optional ID / code':'Προαιρετικό ID / κωδικός'}/></label>
     <label><span>{en?'Device reference':'Αναφορά συσκευής'}</span><input value={draft.deviceRef||''} onChange={e=>set('deviceRef',e.target.value)} placeholder={en?'e.g. CVC / UC / ventilator':'π.χ. CVC / UC / αναπνευστήρας'}/></label>
    </div>
    {template&&<div className="bundle-template-meta"><span><b>{template.name}</b> · v{template.version}</span><span>{template.source}</span></div>}
   </section>

   {template?<section className="bundle-elements-card">
    <div className="bundle-section-title"><div><strong>{en?'Bundle elements':'Στοιχεία Bundle'}</strong><small>{en?'Every element must be answered Yes / No / Not applicable before completion. Every No is retained as a documented deviation.':'Κάθε στοιχείο πρέπει να απαντηθεί Ναι / Όχι / Μη εφαρμόσιμο πριν από την ολοκλήρωση. Κάθε «Όχι» διατηρείται ως τεκμηριωμένη απόκλιση.'}</small></div><div className="bundle-score-live"><span>{en?'Answered':'Απαντημένα'} {answered}/{elements.length}</span><strong>{score===null?'—':`${score}%`}</strong><small>{allOrNone?'All-or-none ✓':'All-or-none —'}</small></div></div>
    <div className="bundle-element-list">{elements.map(([id,label],i)=>{const displayLabel=elementLabel(id,label);return <div className={`bundle-element-row ${draft.answers[id]==='no'?'failed':draft.answers[id]==='yes'?'passed':draft.answers[id]==='na'?'na':''}`} key={id}>
     <div className="bundle-element-label"><span>{i+1}</span><strong>{displayLabel}</strong></div>
     <div className="bundle-answer-group">{[['yes',en?'Yes':'Ναι'],['no',en?'No':'Όχι'],['na',en?'N/A':'Μ/Ε']].map(([value,text])=><button type="button" key={value} className={draft.answers[id]===value?'active':''} onClick={()=>answer(id,value)}>{text}</button>)}</div>
     {draft.answers[id]==='no'&&<div className="bundle-finding-note"><ShieldAlert size={14}/><input value={draft.answerNotes[id]||''} onChange={e=>note(id,e.target.value)} placeholder={en?'Deviation / action required':'Απόκλιση / ενέργεια που απαιτείται'}/></div>}
    </div>})}</div>
   </section>:<div className="inline-empty">{en?'No published bundle templates are available.':'Δεν υπάρχουν διαθέσιμα δημοσιευμένα Bundle templates.'}</div>}

   <section className="bundle-summary-card"><div><span>{en?'Answered':'Απαντημένα'}</span><strong>{answered}/{elements.length}</strong></div><div><span>{en?'Applicable':'Εφαρμόσιμα'}</span><strong>{applicable}</strong></div><div><span>{en?'Deviations':'Αποκλίσεις'}</span><strong>{failures.length}</strong></div><div><span>{en?'Compliance':'Συμμόρφωση'}</span><strong>{score===null?'—':`${score}%`}</strong></div><div><span>All-or-none</span><strong>{allOrNone?(en?'Yes':'Ναι'):(en?'No':'Όχι')}</strong></div></section>
   {!complete&&elements.length>0&&<div className="bundle-completion-hint">{en?`${elements.length-answered} element(s) still need an answer before completion.`:`Απομένουν ${elements.length-answered} στοιχείο/α χωρίς απάντηση πριν από την ολοκλήρωση.`}</div>}
   <label className="bundle-general-notes"><span>{en?'General notes':'Γενικές σημειώσεις'}</span><textarea rows="3" value={draft.generalNotes||''} onChange={e=>set('generalNotes',e.target.value)} placeholder={en?'Optional execution notes':'Προαιρετικές παρατηρήσεις για την εκτέλεση'}/></label>
  </div>
 </ObserverDialog>
}
