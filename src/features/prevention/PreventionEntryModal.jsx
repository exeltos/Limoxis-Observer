import { useMemo,useState } from 'react'
import { ClipboardCheck,Droplets,Recycle,ShieldCheck } from 'lucide-react'
import { demoLibrarySeed } from '../management/managementData'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'
import { ManualDateField } from '../../design-system/ManualDateField'

const config={
 handHygiene:{title:'Νέα παρατήρηση Υγιεινής Χεριών',icon:ShieldCheck},
 waste:{title:'Νέα καταγραφή αποβλήτων',icon:Recycle},
 antiseptics:{title:'Νέα καταγραφή αντισηπτικού',icon:Droplets},
 bundles:{title:'Νέα αξιολόγηση bundle',icon:ClipboardCheck},
}

export function PreventionEntryModal({tab,onClose,onSave,fixedDepartment='',initialRecord=null}) {
 const {profile,user}=useAuth()
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
  const common={...draft,departmentEn,createdAt:new Date().toISOString(),createdBy:actor.name,createdById:actor.id}
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
  <header><div className="prevention-entry-title"><Icon size={20}/><div><span className="eyebrow">ΚΕΝΤΡΟ ΠΡΟΛΗΨΗΣ</span><h3>{initialRecord?'Επεξεργασία εγγραφής':item.title}</h3></div></div><button className="icon-close" onClick={onClose}>×</button></header>
  <div className="prevention-entry-body">
   <div className="prevention-entry-actor"><span>Καταχώρηση από</span><strong>{actor.name}</strong><small>{actor.email}</small></div>
   <div className="entry-grid">
    {tab==='handHygiene'&&<>
     <ManualDateField label="Ημερομηνία *" value={draft.date} onChange={v=>set('date',v)}/>
     <DepartmentField value={draft.departmentEl} onChange={v=>set('departmentEl',v)} departments={departments} fixed={Boolean(fixedDepartment)}/>
     <label><span>Επαγγελματική κατηγορία *</span><select value={draft.profession} onChange={e=>set('profession',e.target.value)}><option value="nursing">Νοσηλευτικό προσωπικό</option><option value="medical">Ιατρικό προσωπικό</option><option value="other">Άλλο προσωπικό</option></select></label>
     <label><span>Παρατηρήσεις *</span><input type="number" min="0" value={draft.observations} onChange={e=>set('observations',e.target.value)}/></label>
     <label><span>Συμμορφούμενες *</span><input type="number" min="0" max={draft.observations||undefined} value={draft.compliant} onChange={e=>set('compliant',e.target.value)}/></label>
     <label><span>Παρατηρητής</span><input value={draft.observer} readOnly/></label>
    </>}
    {tab==='waste'&&<>
     <ManualDateField label="Ημερομηνία *" value={draft.date} onChange={v=>set('date',v)}/>
     <DepartmentField value={draft.departmentEl} onChange={v=>set('departmentEl',v)} departments={departments} fixed={Boolean(fixedDepartment)}/>
     <label className="entry-span-2"><span>Τύπος αποβλήτου *</span><select value={draft.type} onChange={e=>set('type',e.target.value)}><option value="infectiousWaste">Μολυσματικά απόβλητα</option><option value="mixedHazardousWaste">Μικτά επικίνδυνα απόβλητα</option><option value="otherWaste">Άλλο</option></select></label>
     <label><span>Βάρος (kg) *</span><input type="number" min="0" step="0.1" value={draft.weight} onChange={e=>set('weight',e.target.value)}/></label>
     <label><span>Περιέκτες *</span><input type="number" min="0" value={draft.containers} onChange={e=>set('containers',e.target.value)}/></label>
    </>}
    {tab==='antiseptics'&&<>
     <label><span>Περίοδος *</span><input type="month" value={draft.period} onChange={e=>set('period',e.target.value)}/></label>
     <DepartmentField value={draft.departmentEl} onChange={v=>set('departmentEl',v)} departments={departments} fixed={Boolean(fixedDepartment)}/>
     <label className="entry-span-2"><span>Προϊόν *</span><input value={draft.product} onChange={e=>set('product',e.target.value)} placeholder="π.χ. Alcohol hand rub 500 ml"/></label>
     <label><span>Κατανάλωση (L) *</span><input type="number" min="0" step="0.1" value={draft.litres} onChange={e=>set('litres',e.target.value)}/></label>
    </>}
    {tab==='bundles'&&<>
     <label><span>Περίοδος *</span><input type="month" value={draft.period} onChange={e=>set('period',e.target.value)}/></label>
     <DepartmentField value={draft.departmentEl} onChange={v=>set('departmentEl',v)} departments={departments} fixed={Boolean(fixedDepartment)}/>
     <label><span>Bundle *</span><select value={draft.bundle} onChange={e=>set('bundle',e.target.value)}><option value="clabsiBundle">CLABSI bundle</option><option value="cautiBundle">CAUTI bundle</option><option value="vapBundle">VAP bundle</option></select></label>
     <label><span>Συμμόρφωση (%) *</span><input type="number" min="0" max="100" step="0.1" value={draft.score} onChange={e=>set('score',e.target.value)}/></label>
    </>}
   </div>
  </div>
  <footer><button className="button" onClick={onClose}>Ακύρωση</button><button className="button button-primary" disabled={!valid} onClick={submit}>{initialRecord?'Αποθήκευση αλλαγών':'Αποθήκευση'}</button></footer>
 </div></div>
}

function DepartmentField({value,onChange,departments,fixed}){
 return <label><span>Τμήμα *</span><select value={value} disabled={fixed} onChange={e=>onChange(e.target.value)}>{departments.map(d=><option key={d.el} value={d.el}>{d.el}</option>)}</select></label>
}
