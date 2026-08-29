import { useMemo,useState } from 'react'
import { ClipboardCheck,Droplets,Recycle,ShieldCheck } from 'lucide-react'
import { demoLibrarySeed } from '../management/managementData'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'

const config={
 handHygiene:{title:'Νέα παρατήρηση Υγιεινής Χεριών',titleEn:'New Hand Hygiene observation',icon:ShieldCheck},
 waste:{title:'Νέα καταγραφή αποβλήτων',titleEn:'New waste entry',icon:Recycle},
 antiseptics:{title:'Νέα καταγραφή αντισηπτικού',titleEn:'New antiseptic entry',icon:Droplets},
 bundles:{title:'Νέα αξιολόγηση bundle',titleEn:'New bundle assessment',icon:ClipboardCheck},
}

export function PreventionEntryModal({tab,onClose,onSave,fixedDepartment='',initialRecord=null}) {
 const {profile,user}=useAuth()
 const {language}=useLanguage(); const en=language==='en'
 const actor=useMemo(()=>controlActorFromAuth({profile,user}),[profile,user])
 const departments=useMemo(()=>demoLibrarySeed.departments.map(([el,en])=>({el,en})),[])
 const today=new Date().toISOString().slice(0,10)
 const month=today.slice(0,7)
 const [draft,setDraft]=useState(()=>{
  if(initialRecord)return JSON.parse(JSON.stringify(initialRecord))
  if(tab==='handHygiene')return {date:today,departmentEl:fixedDepartment||departments[0]?.el||'',profession:'nursing',observations:'',compliant:'',observer:actor.name}
  if(tab==='waste')return {date:today,departmentEl:fixedDepartment||departments[0]?.el||'',type:'infectiousWaste',weight:'',containers:'',status:'completed'}
  if(tab==='antiseptics')return {period:month,departmentEl:fixedDepartment||departments[0]?.el||'',product:'Alcohol hand rub 500 ml',litres:''}
  return {bundle:'clabsiBundle',departmentEl:fixedDepartment||departments[0]?.el||'',period:month,score:'',status:'active'}
 })
 const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
 const item=config[tab]||config.handHygiene
 const Icon=item.icon
 const departmentEn=departments.find(d=>d.el===draft.departmentEl)?.en||draft.departmentEl

 let valid=false
 if(tab==='handHygiene')valid=Boolean(draft.date&&draft.departmentEl&&Number(draft.observations)>=0&&Number(draft.compliant)>=0&&Number(draft.compliant)<=Number(draft.observations))
 if(tab==='waste')valid=Boolean(draft.date&&draft.departmentEl&&Number(draft.weight)>=0&&Number(draft.containers)>=0)
 if(tab==='antiseptics')valid=Boolean(draft.period&&draft.departmentEl&&draft.product.trim()&&Number(draft.litres)>=0)
 if(tab==='bundles')valid=Boolean(draft.period&&draft.departmentEl&&Number(draft.score)>=0&&Number(draft.score)<=100)

 function submit(){
  if(!valid)return
  const now=new Date().toISOString()
  const common={...draft,departmentEn,createdAt:now,createdBy:actor.name,createdById:actor.id,updatedAt:now,updatedBy:actor.name,updatedById:actor.id}
  if(tab==='handHygiene'){
   const observations=Number(draft.observations),compliant=Number(draft.compliant)
   onSave({...common,observations,compliant,rate:observations?Number(((compliant/observations)*100).toFixed(1)):0})
  } else if(tab==='waste'){
   onSave({...common,weight:Number(draft.weight),containers:Number(draft.containers)})
  } else if(tab==='antiseptics'){
   onSave({...common,litres:Number(draft.litres)})
  } else onSave({...common,score:Number(draft.score)})
 }

 return <div className="modal-backdrop"><div className="entry-card prevention-entry-card">
  <header><div className="prevention-entry-title"><Icon size={20}/><div><span className="eyebrow">{en?'PREVENTION CENTER':'ΚΕΝΤΡΟ ΠΡΟΛΗΨΗΣ'}</span><h3>{initialRecord?(en?'Edit record':'Επεξεργασία εγγραφής'):(en?item.titleEn:item.title)}</h3></div></div><button className="icon-close" onClick={onClose}>×</button></header>
  <div className="prevention-entry-body">
   <div className="prevention-entry-actor"><span>{en?'Recorded by':'Καταχώρηση από'}</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
   <div className="entry-grid">
    {tab==='handHygiene'&&<>
     <ManualDateField label={en?'Date *':'Ημερομηνία *'} value={draft.date} onChange={v=>set('date',v)}/>
     <DepartmentField value={draft.departmentEl} onChange={v=>set('departmentEl',v)} departments={departments} fixed={Boolean(fixedDepartment)}/>
     <label><span>{en?'Professional category *':'Επαγγελματική κατηγορία *'}</span><select value={draft.profession} onChange={e=>set('profession',e.target.value)}><option value="nursing">{en?'Nursing staff':'Νοσηλευτικό προσωπικό'}</option><option value="medical">{en?'Medical staff':'Ιατρικό προσωπικό'}</option><option value="other">{en?'Other staff':'Άλλο προσωπικό'}</option></select></label>
     <label><span>{en?'Observations *':'Παρατηρήσεις *'}</span><input type="number" min="0" value={draft.observations} onChange={e=>set('observations',e.target.value)}/></label>
     <label><span>{en?'Compliant *':'Συμμορφούμενες *'}</span><input type="number" min="0" max={draft.observations||undefined} value={draft.compliant} onChange={e=>set('compliant',e.target.value)}/></label>
     <label><span>{en?'Observer':'Παρατηρητής'}</span><input value={draft.observer} readOnly/></label>
    </>}
    {tab==='waste'&&<>
     <ManualDateField label={en?'Date *':'Ημερομηνία *'} value={draft.date} onChange={v=>set('date',v)}/>
     <DepartmentField value={draft.departmentEl} onChange={v=>set('departmentEl',v)} departments={departments} fixed={Boolean(fixedDepartment)}/>
     <label className="entry-span-2"><span>{en?'Waste type *':'Τύπος αποβλήτου *'}</span><select value={draft.type} onChange={e=>set('type',e.target.value)}><option value="infectiousWaste">{en?'Infectious waste':'Μολυσματικά απόβλητα'}</option><option value="mixedHazardousWaste">{en?'Mixed hazardous waste':'Μικτά επικίνδυνα απόβλητα'}</option><option value="otherWaste">{en?'Other':'Άλλο'}</option></select></label>
     <label><span>{en?'Weight (kg) *':'Βάρος (kg) *'}</span><input type="number" min="0" step="0.1" value={draft.weight} onChange={e=>set('weight',e.target.value)}/></label>
     <label><span>{en?'Containers *':'Περιέκτες *'}</span><input type="number" min="0" value={draft.containers} onChange={e=>set('containers',e.target.value)}/></label>
    </>}
    {tab==='antiseptics'&&<>
     <label><span>{en?'Period *':'Περίοδος *'}</span><input type="month" value={draft.period} onChange={e=>set('period',e.target.value)}/></label>
     <DepartmentField value={draft.departmentEl} onChange={v=>set('departmentEl',v)} departments={departments} fixed={Boolean(fixedDepartment)}/>
     <label className="entry-span-2"><span>{en?'Product *':'Προϊόν *'}</span><input value={draft.product} onChange={e=>set('product',e.target.value)} placeholder={en?'e.g. Alcohol hand rub 500 ml':'π.χ. Alcohol hand rub 500 ml'}/></label>
     <label><span>{en?'Consumption (L) *':'Κατανάλωση (L) *'}</span><input type="number" min="0" step="0.1" value={draft.litres} onChange={e=>set('litres',e.target.value)}/></label>
    </>}
    {tab==='bundles'&&<>
     <label><span>{en?'Period *':'Περίοδος *'}</span><input type="month" value={draft.period} onChange={e=>set('period',e.target.value)}/></label>
     <DepartmentField value={draft.departmentEl} onChange={v=>set('departmentEl',v)} departments={departments} fixed={Boolean(fixedDepartment)}/>
     <label><span>Bundle *</span><select value={draft.bundle} onChange={e=>set('bundle',e.target.value)}><option value="clabsiBundle">CLABSI bundle</option><option value="cautiBundle">CAUTI bundle</option><option value="vapBundle">VAP bundle</option></select></label>
     <label><span>{en?'Compliance (%) *':'Συμμόρφωση (%) *'}</span><input type="number" min="0" max="100" step="0.1" value={draft.score} onChange={e=>set('score',e.target.value)}/></label>
    </>}
   </div>
  </div>
  <footer><button className="button" onClick={onClose}>{en?'Cancel':'Ακύρωση'}</button><button className="button button-primary" disabled={!valid} onClick={submit}>{initialRecord?(en?'Save changes':'Αποθήκευση αλλαγών'):(en?'Save':'Αποθήκευση')}</button></footer>
 </div></div>
}

function DepartmentField({value,onChange,departments,fixed}){
 const {language}=useLanguage()
 return <label><span>{language==='en'?'Department *':'Τμήμα *'}</span><select value={value} disabled={fixed} onChange={e=>onChange(e.target.value)}>{departments.map(d=><option key={d.el} value={d.el}>{language==='en'?(d.en||d.el):d.el}</option>)}</select></label>
}
