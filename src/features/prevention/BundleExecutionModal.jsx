import { useMemo,useState } from 'react'
import { ClipboardCheck,ShieldAlert } from 'lucide-react'
import { demoLibrarySeed } from '../management/managementData'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { bundleAllOrNone,bundleScore,getBundleTemplate,loadPublishedBundleTemplates } from './bundleTemplates'

export function BundleExecutionModal({onClose,onSave,fixedDepartment='',initialRecord=null}){
 const {profile,user}=useAuth()
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
   updatedAt:initialRecord?now:null,updatedBy:initialRecord?actor.name:null,status:'completed'})
 }

 return <div className="modal-backdrop"><div className="entry-card bundle-execution-card">
  <header><div className="prevention-entry-title"><ClipboardCheck size={20}/><div><span className="eyebrow">BUNDLE EXECUTION</span><h3>{initialRecord?'Επεξεργασία εκτέλεσης':'Νέα εκτέλεση Bundle'}</h3><p>Αξιολόγηση ανά στοιχείο, τεκμηρίωση αποκλίσεων και all-or-none συμμόρφωση.</p></div></div><button className="icon-close" onClick={onClose}>×</button></header>
  <div className="bundle-execution-body">
   <div className="prevention-entry-actor"><span>Καταχώρηση από</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
   <section className="bundle-context-card">
    <div className="entry-grid">
     <label><span>Bundle *</span><select value={draft.templateId} onChange={e=>setDraft(d=>({...d,templateId:e.target.value,answers:{},answerNotes:{}}))}>{templates.map(x=><option key={x.id} value={x.id}>{x.name} — {x.title}</option>)}</select></label>
     <label><span>Τμήμα *</span><select value={draft.departmentEl} disabled={Boolean(fixedDepartment)} onChange={e=>set('departmentEl',e.target.value)}>{departments.map(x=><option key={x.el}>{x.el}</option>)}</select></label>
     <label><span>Ημερομηνία *</span><input type="date" value={draft.date} onChange={e=>set('date',e.target.value)}/></label>
     <label><span>Βάρδια / πλαίσιο</span><select value={draft.shift} onChange={e=>set('shift',e.target.value)}><option>Πρωινή</option><option>Απογευματινή</option><option>Νυχτερινή</option><option>Άλλο</option></select></label>
     <label><span>Αναφορά ασθενή</span><input value={draft.patientRef||''} onChange={e=>set('patientRef',e.target.value)} placeholder="Προαιρετικό ID / κωδικός"/></label>
     <label><span>Αναφορά συσκευής</span><input value={draft.deviceRef||''} onChange={e=>set('deviceRef',e.target.value)} placeholder="π.χ. CVC / UC / ventilator"/></label>
    </div>
    <div className="bundle-template-meta"><span><b>{template.name}</b> · v{template.version}</span><span>{template.source}</span></div>
   </section>

   <section className="bundle-elements-card">
    <div className="bundle-section-title"><div><strong>Στοιχεία Bundle</strong><small>Ναι / Όχι / Μη εφαρμόσιμο. Κάθε «Όχι» δημιουργεί εύρημα στην εκτέλεση.</small></div><div className="bundle-score-live"><span>Score</span><strong>{score===null?'—':`${score}%`}</strong><small>{allOrNone?'All-or-none ✓':'All-or-none —'}</small></div></div>
    <div className="bundle-element-list">{template.elements.map(([id,label],i)=><div className={`bundle-element-row ${draft.answers[id]==='no'?'failed':draft.answers[id]==='yes'?'passed':''}`} key={id}>
     <div className="bundle-element-label"><span>{i+1}</span><strong>{label}</strong></div>
     <div className="bundle-answer-group">{[['yes','Ναι'],['no','Όχι'],['na','Μ/Ε']].map(([value,text])=><button type="button" key={value} className={draft.answers[id]===value?'active':''} onClick={()=>answer(id,value)}>{text}</button>)}</div>
     {draft.answers[id]==='no'&&<div className="bundle-finding-note"><ShieldAlert size={14}/><input value={draft.answerNotes[id]||''} onChange={e=>note(id,e.target.value)} placeholder="Απόκλιση / ενέργεια που απαιτείται"/></div>}
    </div>)}</div>
   </section>

   <section className="bundle-summary-card">
    <div><span>Εφαρμόσιμα</span><strong>{applicable}</strong></div><div><span>Αποκλίσεις</span><strong>{failures.length}</strong></div><div><span>Συμμόρφωση</span><strong>{score===null?'—':`${score}%`}</strong></div><div><span>All-or-none</span><strong>{allOrNone?'Ναι':'Όχι'}</strong></div>
   </section>
   <label className="bundle-general-notes"><span>Γενικές σημειώσεις</span><textarea rows="3" value={draft.generalNotes||''} onChange={e=>set('generalNotes',e.target.value)} placeholder="Προαιρετικές παρατηρήσεις για την εκτέλεση"/></label>
  </div>
  <footer><button className="button" onClick={onClose}>Ακύρωση</button><button className="button button-primary" disabled={!valid} onClick={submit}>{initialRecord?'Αποθήκευση αλλαγών':'Ολοκλήρωση εκτέλεσης'}</button></footer>
 </div></div>
}
