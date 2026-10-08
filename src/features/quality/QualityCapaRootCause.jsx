import { useEffect,useMemo,useState } from 'react'
import { Pencil,Plus,X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { auditEvent } from '../../core/audit/actor'
import { saveQualityRecord } from './qualityService'
import { ISHIKAWA_CATEGORIES,WHY_COUNT,analysisProgress,cleanAnalysis,normalizeAnalysis } from './rootCauseAnalysis'
import './rootCause.css'

// CAPA tab "Root causes": the problem, 5 Whys, and an Ishikawa diagram whose
// head is the problem and whose bones are the healthcare cause categories.
export function QualityCapaRootCause({record,setRecord,canManage,finalized,organizationId,actor,notify,language,locale}){
 const en=language==='en'
 const saved=useMemo(()=>normalizeAnalysis(record.rootCauseAnalysis),[record.rootCauseAnalysis])
 const [draft,setDraft]=useState(saved)
 const [editing,setEditing]=useState(false)
 const [saving,setSaving]=useState(false)
 const [newCause,setNewCause]=useState({})
 useEffect(()=>{if(!editing)setDraft(saved)},[saved,editing])
 const editable=canManage&&!finalized
 const progress=analysisProgress(saved)
 const view=editing?draft:saved
 const label=row=>en?row[2]:row[1]

 const setWhy=(index,value)=>setDraft(current=>({...current,whys:current.whys.map((w,i)=>i===index?value:w)}))
 function addCause(key){
  const text=String(newCause[key]||'').trim()
  if(!text)return
  setDraft(current=>({...current,causes:{...current.causes,[key]:[...current.causes[key],text]}}))
  setNewCause(current=>({...current,[key]:''}))
 }
 const removeCause=(key,index)=>setDraft(current=>({...current,causes:{...current.causes,[key]:current.causes[key].filter((_,i)=>i!==index)}}))

 async function save(){
  setSaving(true)
  try{
   const analysis=cleanAnalysis(draft,{actorName:actor?.name||''})
   const event=auditEvent('recordUpdated',{actor,detail:{field:'rootCauseAnalysis'}})
   const next=await saveQualityRecord('capas',organizationId,{...record,rootCauseAnalysis:analysis,updatedAt:new Date().toISOString(),history:[event,...(record.history||[])]})
   setRecord({...next})
   setEditing(false)
   notify(en?'Root cause analysis saved.':'Η ανάλυση αιτίων αποθηκεύτηκε.','success')
  }catch(error){
   console.error(error)
   notify(en?'The analysis could not be saved.':'Δεν ήταν δυνατή η αποθήκευση της ανάλυσης.','error')
  }finally{setSaving(false)}
 }

 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):''
 const bone=row=>{
  const [key]=row
  const causes=view.causes[key]
  return <div key={key} className="rca-bone">
   <strong>{label(row)}</strong>
   <ul>{causes.map((cause,index)=><li key={`${cause}-${index}`}>{cause}{editing&&<button type="button" aria-label={en?'Remove':'Αφαίρεση'} onClick={()=>removeCause(key,index)}><X size={12}/></button>}</li>)}{!causes.length&&!editing&&<li className="rca-empty">—</li>}</ul>
   {editing&&<div className="rca-add"><input value={newCause[key]||''} onChange={e=>setNewCause(current=>({...current,[key]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCause(key)}}} placeholder={en?'Add a cause':'Προσθήκη αιτίας'}/><button type="button" aria-label={en?'Add':'Προσθήκη'} onClick={()=>addCause(key)}><Plus size={14}/></button></div>}
  </div>
 }

 return <section className="record-section quality-rca">
  <div className="record-section-header">
   <div><span className="eyebrow">{en?'Root cause analysis':'Ανάλυση αιτίων'}</span><h3>{en?'Why did it happen?':'Γιατί συνέβη;'}</h3></div>
   {editable&&!editing&&<Button variant="secondary" onClick={()=>{setDraft(saved);setEditing(true)}}><Pencil size={15}/>{progress.started?(en?' Edit':' Επεξεργασία'):(en?' Start analysis':' Έναρξη ανάλυσης')}</Button>}
  </div>

  <div className="rca-problem">
   <span>{en?'Problem':'Πρόβλημα'}</span>
   {editing?<textarea rows={2} value={draft.problem} onChange={e=>setDraft(current=>({...current,problem:e.target.value}))} placeholder={en?'What happened, where and how often':'Τι συνέβη, πού και πόσο συχνά'}/>:<p>{saved.problem||record.description||'—'}</p>}
  </div>

  <div className="rca-columns">
   <div className="rca-whys">
    <h4>{en?'5 Whys':'5 Γιατί'}</h4>
    <ol>{Array.from({length:WHY_COUNT},(_,index)=><li key={index} className={view.whys[index]?'':'rca-why-empty'}>
     <span className="rca-why-label">{en?`Why ${index+1}`:`Γιατί ${index+1}`}</span>
     {editing?<input value={draft.whys[index]} onChange={e=>setWhy(index,e.target.value)} placeholder={index===0?(en?'Why did the problem happen?':'Γιατί συνέβη το πρόβλημα;'):(en?'Why did that happen?':'Γιατί συνέβη αυτό;')}/>:<span>{view.whys[index]||'—'}</span>}
    </li>)}</ol>
   </div>
   <div className="rca-conclusion">
    <h4>{en?'Root cause':'Βασική αιτία'}</h4>
    {editing?<textarea rows={5} value={draft.rootCause} onChange={e=>setDraft(current=>({...current,rootCause:e.target.value}))} placeholder={en?'The cause the corrective action has to remove':'Η αιτία που πρέπει να εξαλείψει η διορθωτική ενέργεια'}/>:<p className={saved.rootCause?'':'rca-empty'}>{saved.rootCause||(en?'Not concluded yet':'Δεν έχει καταλήξει ακόμη')}</p>}
   </div>
  </div>

  <h4 className="rca-fishbone-title">{en?'Ishikawa diagram':'Διάγραμμα Ishikawa'}</h4>
  <div className="rca-fishbone">
   <div className="rca-bones top">{ISHIKAWA_CATEGORIES.slice(0,3).map(bone)}</div>
   <div className="rca-spine" aria-hidden="true"/>
   <div className="rca-head">{(editing?draft.problem:saved.problem)||record.title||(en?'Problem':'Πρόβλημα')}</div>
   <div className="rca-bones bottom">{ISHIKAWA_CATEGORIES.slice(3).map(bone)}</div>
  </div>

  {saved.updatedAt&&!editing&&<p className="rca-meta">{en?'Last updated':'Τελευταία ενημέρωση'} {fmt(saved.updatedAt)}{saved.updatedBy?` · ${saved.updatedBy}`:''}</p>}
  {editing&&<div className="inline-edit-footer"><Button variant="secondary" onClick={()=>{setDraft(saved);setEditing(false)}} disabled={saving}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton loading={saving} disabled={saving} onClick={()=>void save()}>{en?'Save':'Αποθήκευση'}</SaveButton></div>}
 </section>
}
