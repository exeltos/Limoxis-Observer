import { useMemo,useState } from 'react'
import { ClipboardCheck,ShieldAlert } from 'lucide-react'
import { demoLibrarySeed } from '../management/managementData'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { bundleAllOrNone,bundleScore,getBundleTemplate,loadPublishedBundleTemplates } from './bundleTemplates'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function BundleExecutionModal({onClose,onSave,fixedDepartment='',initialRecord=null}){
 const {profile,user}=useAuth()
 const {language}=useLanguage(); const en=language==='en'
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const departments=demoLibrarySeed.departments.map(([el,en])=>({el,en}))
 const [templates]=useState(()=>loadPublishedBundleTemplates())
 const [draft,setDraft]=useState(()=>initialRecord?JSON.parse(JSON.stringify(initialRecord)):{
  templateId:loadPublishedBundleTemplates()[0]?.id||'CLABSI',departmentEl:fixedDepartment||departments[0]?.el||'',date:new Date().toISOString().slice(0,10),
  shift:'Πρωινή',context:'',patientRef:'',deviceRef:'',answers:{},answerNotes:{},generalNotes:'',status:'completed'
 })
 const template=templates.find(x=>x.id===draft.templateId)||getBundleTemplate(draft.templateId)
 const score=bundleScore(draft.answers)
 const allOrNone=bundleAllOrNone(draft.answers)
 const applicable=template.elements.filter(([id])=>['yes','no'].includes(draft.answers[id])).length
 const failures=template.elements.filter(([id])=>draft.answers[id]==='no')
 const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
 const answer=(id,value)=>setDraft(d=>({...d,answers:{...d.answers,[id]:value}}))
 const note=(id,value)=>setDraft(d=>({...d,answerNotes:{...d.answerNotes,[id]:value}}))
 const valid=Boolean(draft.templateId&&draft.departmentEl&&draft.date&&applicable>0)

 function submit(){
  if(!valid)return
  const now=new Date().toISOString()
  const dep=departments.find(x=>x.el===draft.departmentEl)
  onSave({...draft,bundle:template.id,templateName:template.name,templateTitle:template.title,templateVersion:template.version,
   templateSource:template.source,templateSnapshot:JSON.parse(JSON.stringify(template)),departmentEn:dep?.en||draft.departmentEl,score:score??0,allOrNone,
   applicableCount:applicable,failedCount:failures.length,findings:failures.map(([id,label])=>({id,label,note:draft.answerNotes[id]||''})),
   owner:actor.name,createdAt:initialRecord?.createdAt||now,createdBy:initialRecord?.createdBy||actor.name,createdById:initialRecord?.createdById||actor.id,
   updatedAt:initialRecord?now:null,updatedBy:initialRecord?actor.name:null,updatedById:initialRecord?actor.id:null,status:'completed',lifecycleStatus:'finalized',finalizedAt:initialRecord?.finalizedAt||now,finalizedBy:initialRecord?.finalizedBy||actor.name,finalizedById:initialRecord?.finalizedById||actor.id})
 }

 return <div className="modal-backdrop"><div className="entry-card bundle-execution-card">
  <header><div className="prevention-entry-title"><ClipboardCheck size={20}/><div><span className="eyebrow">BUNDLE EXECUTION</span><h3>{initialRecord?(en?'Edit bundle execution':'Επεξεργασία εκτέλεσης'):(en?'New Bundle execution':'Νέα εκτέλεση Bundle')}</h3><p>{en?'Element-by-element assessment, documented deviations and all-or-none compliance.':'Αξιολόγηση ανά στοιχείο, τεκμηρίωση αποκλίσεων και all-or-none συμμόρφωση.'}</p></div></div><button className="icon-close" onClick={onClose}>×</button></header>
  <div className="bundle-execution-body">
   <div className="prevention-entry-actor"><span>{en?'Recorded by':'Καταχώρηση από'}</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
   <section className="bundle-context-card">
    <div className="entry-grid">
     <label><span>Bundle *</span><select value={draft.templateId} onChange={e=>setDraft(d=>({...d,templateId:e.target.value,answers:{},answerNotes:{}}))}>{templates.map(x=><option key={x.id} value={x.id}>{x.name} — {x.title}</option>)}</select></label>
     <label><span>{en?'Department *':'Τμήμα *'}</span><select value={draft.departmentEl} disabled={Boolean(fixedDepartment)} onChange={e=>set('departmentEl',e.target.value)}>{departments.map(x=><option key={x.el} value={x.el}>{en?(x.en||x.el):x.el}</option>)}</select></label>
     <ManualDateField label={en?'Date *':'Ημερομηνία *'} value={draft.date} onChange={v=>set('date',v)}/>
     <label><span>{en?'Shift / context':'Βάρδια / πλαίσιο'}</span><select value={draft.shift} onChange={e=>set('shift',e.target.value)}><option value="Πρωινή">{en?'Morning':'Πρωινή'}</option><option value="Απογευματινή">{en?'Afternoon':'Απογευματινή'}</option><option value="Νυχτερινή">{en?'Night':'Νυχτερινή'}</option><option value="Άλλο">{en?'Other':'Άλλο'}</option></select></label>
     <label><span>{en?'Patient reference':'Αναφορά ασθενή'}</span><input value={draft.patientRef||''} onChange={e=>set('patientRef',e.target.value)} placeholder={en?'Optional ID / code':'Προαιρετικό ID / κωδικός'}/></label>
     <label><span>{en?'Device reference':'Αναφορά συσκευής'}</span><input value={draft.deviceRef||''} onChange={e=>set('deviceRef',e.target.value)} placeholder={en?'e.g. CVC / UC / ventilator':'π.χ. CVC / UC / αναπνευστήρας'}/></label>
    </div>
    <div className="bundle-template-meta"><span><b>{template.name}</b> · v{template.version}</span><span>{template.source}</span></div>
   </section>

   <section className="bundle-elements-card">
    <div className="bundle-section-title"><div><strong>{en?'Bundle elements':'Στοιχεία Bundle'}</strong><small>{en?'Yes / No / Not applicable. Every No creates a finding in this execution.':'Ναι / Όχι / Μη εφαρμόσιμο. Κάθε «Όχι» δημιουργεί εύρημα στην εκτέλεση.'}</small></div><div className="bundle-score-live"><span>Score</span><strong>{score===null?'—':`${score}%`}</strong><small>{allOrNone?'All-or-none ✓':'All-or-none —'}</small></div></div>
    <div className="bundle-element-list">{template.elements.map(([id,label],i)=><div className={`bundle-element-row ${draft.answers[id]==='no'?'failed':draft.answers[id]==='yes'?'passed':''}`} key={id}>
     <div className="bundle-element-label"><span>{i+1}</span><strong>{label}</strong></div>
     <div className="bundle-answer-group">{[['yes',en?'Yes':'Ναι'],['no',en?'No':'Όχι'],['na',en?'N/A':'Μ/Ε']].map(([value,text])=><button type="button" key={value} className={draft.answers[id]===value?'active':''} onClick={()=>answer(id,value)}>{text}</button>)}</div>
     {draft.answers[id]==='no'&&<div className="bundle-finding-note"><ShieldAlert size={14}/><input value={draft.answerNotes[id]||''} onChange={e=>note(id,e.target.value)} placeholder={en?'Deviation / action required':'Απόκλιση / ενέργεια που απαιτείται'}/></div>}
    </div>)}</div>
   </section>

   <section className="bundle-summary-card">
    <div><span>{en?'Applicable':'Εφαρμόσιμα'}</span><strong>{applicable}</strong></div><div><span>{en?'Deviations':'Αποκλίσεις'}</span><strong>{failures.length}</strong></div><div><span>{en?'Compliance':'Συμμόρφωση'}</span><strong>{score===null?'—':`${score}%`}</strong></div><div><span>All-or-none</span><strong>{allOrNone?(en?'Yes':'Ναι'):(en?'No':'Όχι')}</strong></div>
   </section>
   <label className="bundle-general-notes"><span>{en?'General notes':'Γενικές σημειώσεις'}</span><textarea rows="3" value={draft.generalNotes||''} onChange={e=>set('generalNotes',e.target.value)} placeholder={en?'Optional execution notes':'Προαιρετικές παρατηρήσεις για την εκτέλεση'}/></label>
  </div>
  <footer><button className="button" onClick={onClose}>{en?'Cancel':'Ακύρωση'}</button><button className="button button-primary" disabled={!valid} onClick={submit}>{initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Complete execution':'Ολοκλήρωση εκτέλεσης')}</button></footer>
 </div></div>
}
