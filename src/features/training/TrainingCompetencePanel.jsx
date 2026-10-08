import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,CheckCircle2,Clock3,Pencil,Plus,Trash2,XCircle } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { DownloadMenu } from '../../design-system/DownloadMenu'
import { SubTabs } from '../../design-system/SubTabs'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { exportRegistry } from '../../core/export/registryExports'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadManagementLibraries } from '../management/managementCloudService'
import { demoLibrarySeed } from '../management/managementData'
import { competenceMatrix,newRequirement,retrainingPlan } from './trainingCompetence'
import './trainingCompetence.css'

const STATE_ICON={valid:CheckCircle2,expiring:Clock3,expired:AlertTriangle,missing:XCircle}
const stateText=(state,en)=>({valid:en?'Valid':'Σε ισχύ',expiring:en?'Expiring':'Λήγει',expired:en?'Expired':'Έληξε',missing:en?'Missing':'Λείπει'})[state]||state

// "Competence" view of Training: which staff need which training (by
// professional category and department), who is covered, and who has to be
// trained and by when.
export function TrainingCompetencePanel({state,employees=[],departments=[],language,locale,canManage,busy,onSaveRequirement,onDeleteRequirement}){
 const en=language==='en'
 const {tenant,isDemo}=useTenant()
 const [positionOptions,setPositionOptions]=useState([])
 useEffect(()=>{let active=true;if(isDemo){setPositionOptions(demoLibrarySeed.positions||[]);return()=>{active=false}}if(!tenant?.id)return()=>{active=false};loadManagementLibraries(tenant.id).then(libraries=>{if(active)setPositionOptions(libraries?.positions||[])}).catch(()=>{if(active)setPositionOptions([])});return()=>{active=false}},[isDemo,tenant?.id])
 const [view,setView]=useState('matrix')
 const [department,setDepartment]=useState('all')
 const [editing,setEditing]=useState(null)
 const today=new Date().toISOString().slice(0,10)
 const activeEmployees=useMemo(()=>employees.filter(e=>!e.employmentStatus||String(e.employmentStatus).toLowerCase()==='active'),[employees])
 const scoped=useMemo(()=>activeEmployees.filter(e=>department==='all'||e.department===department),[activeEmployees,department])
 const matrix=useMemo(()=>competenceMatrix({requirements:state.requirements||[],employees:scoped,assignments:state.assignments||[],certificates:state.certificates||[],today}),[state,scoped,today])
 const plan=useMemo(()=>retrainingPlan(matrix,{today}),[matrix,today])
 const professions=useMemo(()=>[...new Set(activeEmployees.map(e=>e.profession).filter(Boolean))].sort((a,b)=>a.localeCompare(b,language)),[activeEmployees,language])
 const positions=useMemo(()=>[...new Set([...positionOptions.map(row=>row?.[0]),...activeEmployees.map(e=>e.position)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,language)),[positionOptions,activeEmployees,language])
 const departmentNames=useMemo(()=>[...new Set([...departments.map(d=>d.name),...activeEmployees.map(e=>e.department)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,language)),[departments,activeEmployees,language])
 const fmt=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'
 const name=e=>en?[e.firstNameEn||e.firstName,e.lastNameEn||e.lastName].filter(Boolean).join(' '):[e.lastName,e.firstName].filter(Boolean).join(' ')
 const programTitle=id=>(state.programs||[]).find(p=>p.id===id)?.title||id

 function exportMatrix(){
  exportRegistry({name:en?'training-competence':'eparkeia-ekpaideusis',
   headers:[en?'Person':'Άτομο',en?'Department':'Τμήμα',en?'Category':'Κατηγορία',en?'Position':'Θέση',...matrix.requirements.map(r=>r.title)],
   rows:matrix.rows.map(row=>[name(row.employee),row.employee.department,row.employee.profession,row.employee.position||'',...row.cells.map(cell=>cell?`${stateText(cell.state,en)}${cell.validUntil?` (${fmt(cell.validUntil)})`:''}`:'')])})
 }
 function exportPlan(){
  exportRegistry({name:en?'retraining-plan':'plano-epanekpaideusis',
   headers:en?['Due by','Person','Department','Category','Required training','Status','Valid until']:['Έως','Άτομο','Τμήμα','Κατηγορία','Απαιτούμενη εκπαίδευση','Κατάσταση','Ισχύς έως'],
   rows:plan.map(item=>[fmt(item.due),name(item.employee),item.employee.department,item.employee.profession,item.requirement.title,stateText(item.state,en),fmt(item.validUntil)])})
 }

 return <div className="training-competence">
  <div className="training-competence-summary">
   <span><strong className={`training-competence-rate ${matrix.rate==null?'':matrix.rate>=90?'good':matrix.rate>=70?'fair':'low'}`}>{matrix.rate==null?'—':`${matrix.rate}%`}</strong>{en?'covered':'κάλυψη'}</span>
   <span><strong>{matrix.counts.missing}</strong>{en?'missing':'λείπουν'}</span>
   <span><strong className="danger">{matrix.counts.expired}</strong>{en?'expired':'έληξαν'}</span>
   <span><strong className="warning">{matrix.counts.expiring}</strong>{en?`expire within 60 days`:'λήγουν σε 60 ημέρες'}</span>
   <div className="training-competence-tools">
    <label><span>{en?'Department':'Τμήμα'}</span><select value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">{en?'All':'Όλα'}</option>{departmentNames.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
    <DownloadMenu items={[{id:'matrix',label:en?'Excel: competence matrix':'Excel: πίνακας επάρκειας',disabled:!matrix.rows.length,onClick:exportMatrix},{id:'plan',label:en?'Excel: retraining plan':'Excel: πλάνο επανεκπαίδευσης',disabled:!plan.length,onClick:exportPlan}]}/>
   </div>
  </div>
  <SubTabs activeId={view} onChange={setView} ariaLabel={en?'Competence view':'Προβολή επάρκειας'} tabs={[{id:'matrix',label:en?'Matrix':'Πίνακας'},{id:'plan',label:en?'Who needs training':'Ποιοι χρειάζονται εκπαίδευση',count:plan.length},{id:'rules',label:en?'Requirements':'Απαιτήσεις',count:matrix.requirements.length}]}/>

  {view==='matrix'&&<div className="scroll-table">
   {matrix.requirements.length?<table className="data-table sticky-table training-competence-matrix">
    <thead><tr><th>{en?'Person':'Άτομο'}</th>{matrix.requirements.map(r=><th key={r.id} title={r.title}><span>{r.title}</span><small>{r.renewalMonths?`${en?'every':'ανά'} ${r.renewalMonths} ${en?'mo.':'μήνες'}`:(en?'once':'μία φορά')}</small></th>)}</tr></thead>
    <tbody>{matrix.rows.map(row=><tr key={row.employee.id}><td><strong>{name(row.employee)}</strong><small>{[row.employee.department,row.employee.position||row.employee.profession].filter(Boolean).join(' · ')}</small></td>{row.cells.map((cell,index)=>{if(!cell)return <td key={index} className="training-competence-na">—</td>;const Icon=STATE_ICON[cell.state];return <td key={index} className={`training-competence-cell ${cell.state}`} title={`${stateText(cell.state,en)}${cell.completedOn?` · ${en?'completed':'ολοκλήρωση'} ${fmt(cell.completedOn)}`:''}${cell.validUntil?` · ${en?'valid until':'ισχύει έως'} ${fmt(cell.validUntil)}`:''}`}><Icon size={15} aria-hidden="true"/><span>{cell.state==='missing'?stateText(cell.state,en):fmt(cell.validUntil)||stateText(cell.state,en)}</span></td>})}</tr>)}</tbody>
   </table>:<div className="registry-empty-state"><strong>{en?'No required training yet':'Δεν έχουν οριστεί απαιτούμενες εκπαιδεύσεις'}</strong><span>{en?'Add requirements in the Requirements tab: which training each professional category or department needs and how often.':'Ορίστε στην καρτέλα «Απαιτήσεις» ποια εκπαίδευση χρειάζεται κάθε επαγγελματική κατηγορία ή τμήμα και κάθε πότε.'}</span></div>}
   {matrix.requirements.length>0&&!matrix.rows.length&&<div className="registry-empty-state"><strong>{en?'No staff match the requirements':'Κανένας εργαζόμενος δεν αντιστοιχεί στις απαιτήσεις'}</strong></div>}
  </div>}

  {view==='plan'&&<div className="scroll-table"><table className="data-table sticky-table">
   <thead><tr><th>{en?'Due by':'Έως'}</th><th>{en?'Person':'Άτομο'}</th><th>{en?'Department':'Τμήμα'}</th><th>{en?'Required training':'Απαιτούμενη εκπαίδευση'}</th><th>{en?'Status':'Κατάσταση'}</th></tr></thead>
   <tbody>{plan.map(item=><tr key={item.key}><td className={item.due<=today?'training-competence-late':''}>{item.state==='missing'?(en?'Now':'Άμεσα'):fmt(item.due)}</td><td><strong>{name(item.employee)}</strong><small>{item.employee.profession}</small></td><td>{item.employee.department||'—'}</td><td>{item.requirement.title}<small>{(item.requirement.programIds||[]).map(programTitle).join(' · ')}</small></td><td><span className={`status-badge ${item.state==='expiring'?'warning':'danger'}`}>{stateText(item.state,en)}</span></td></tr>)}</tbody>
  </table>{!plan.length&&<div className="registry-empty-state"><strong>{en?'Everyone is covered':'Όλοι καλύπτονται'}</strong></div>}</div>}

  {view==='rules'&&<div className="training-competence-rules">
   {canManage&&<div className="training-competence-rules-head"><Button onClick={()=>setEditing(newRequirement())}><Plus size={15}/>{en?' Add requirement':' Νέα απαίτηση'}</Button></div>}
   <div className="scroll-table"><table className="data-table sticky-table">
    <thead><tr><th>{en?'Requirement':'Απαίτηση'}</th><th>{en?'Met by programme':'Καλύπτεται από'}</th><th>{en?'Applies to':'Ισχύει για'}</th><th>{en?'Renewal':'Ανανέωση'}</th><th className="training-competence-menu-col"></th></tr></thead>
    <tbody>{(state.requirements||[]).map(r=><tr key={r.id} className={r.active===false?'training-competence-inactive':''}><td><strong>{r.title}</strong></td><td>{(r.programIds||[]).map(programTitle).join(' · ')||'—'}</td><td>{[(r.professions||[]).join(', ')||(en?'All categories':'Όλες οι κατηγορίες'),(r.positions||[]).length?(r.positions||[]).join(', '):'',(r.departments||[]).join(', ')||(en?'all departments':'όλα τα τμήματα')].filter(Boolean).join(' · ')}</td><td>{r.renewalMonths?`${r.renewalMonths} ${en?'months':'μήνες'}`:(en?'Once':'Μία φορά')}</td><td className="training-competence-menu-col">{canManage&&<OverflowMenu label={en?'Requirement actions':'Ενέργειες απαίτησης'} items={[{id:'edit',label:en?'Edit':'Επεξεργασία',icon:Pencil,onClick:()=>setEditing({...r})},{id:'delete',label:en?'Delete':'Διαγραφή',icon:Trash2,tone:'danger',separatorBefore:true,disabled:busy,onClick:()=>onDeleteRequirement(r)}]}/>}</td></tr>)}</tbody>
   </table></div>
  </div>}

  {editing&&<RequirementDialog value={editing} programs={state.programs||[]} professions={professions} positions={positions} departments={departmentNames} en={en} busy={busy} onClose={()=>setEditing(null)} onSave={async next=>{if(await onSaveRequirement(next))setEditing(null)}}/>}
 </div>
}

function RequirementDialog({value,programs,professions,positions=[],departments,en,busy,onClose,onSave}){
 const [draft,setDraft]=useState(value)
 const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
 const toggle=(k,item)=>setDraft(d=>({...d,[k]:(d[k]||[]).includes(item)?d[k].filter(x=>x!==item):[...(d[k]||[]),item]}))
 const valid=draft.title.trim()&&draft.programIds.length>0
 return <ObserverDialog width="wide" eyebrow={en?'Required training':'Απαιτούμενη εκπαίδευση'} title={value.title||(en?'New requirement':'Νέα απαίτηση')} onClose={onClose} footer={<DialogActions showCancel onCancel={onClose} onSave={()=>onSave({...draft,title:draft.title.trim()})} disabled={!valid||busy} saveLabel={en?'Save':'Αποθήκευση'}/>}>
  <div className="training-requirement-form">
   <label className="span-2"><span>{en?'Title *':'Τίτλος *'}</span><input autoFocus value={draft.title} onChange={e=>set('title',e.target.value)} placeholder={en?'e.g. Hand hygiene (annual)':'π.χ. Υγιεινή χεριών (ετήσια)'}/></label>
   <label><span>{en?'Renewal (months, 0 = once)':'Ανανέωση (μήνες, 0 = μία φορά)'}</span><input type="number" min="0" value={draft.renewalMonths} onChange={e=>set('renewalMonths',Math.max(0,Number(e.target.value)||0))}/></label>
   <label className={`check-option training-requirement-active ${draft.active!==false?'selected':''}`}><input type="checkbox" checked={draft.active!==false} onChange={e=>set('active',e.target.checked)}/><span>{en?'Active':'Ενεργή'}</span></label>
   <fieldset className="span-2"><legend>{en?'Met by completing any of these programmes *':'Καλύπτεται με ολοκλήρωση οποιουδήποτε από τα προγράμματα *'}</legend><div className="training-requirement-options">{programs.map(p=><label key={p.id} className={`check-option ${draft.programIds.includes(p.id)?'selected':''}`}><input type="checkbox" checked={draft.programIds.includes(p.id)} onChange={()=>toggle('programIds',p.id)}/><span>{p.title}</span></label>)}</div></fieldset>
   <fieldset><legend>{en?'Professional categories (none = all)':'Επαγγελματικές κατηγορίες (καμία = όλες)'}</legend><div className="training-requirement-options">{professions.map(p=><label key={p} className={`check-option ${(draft.professions||[]).includes(p)?'selected':''}`}><input type="checkbox" checked={(draft.professions||[]).includes(p)} onChange={()=>toggle('professions',p)}/><span>{p}</span></label>)}</div></fieldset>
   <fieldset><legend>{en?'Job positions (none = all)':'Θέσεις εργασίας (καμία = όλες)'}</legend><div className="training-requirement-options">{positions.map(p=><label key={p} className={`check-option ${(draft.positions||[]).includes(p)?'selected':''}`}><input type="checkbox" checked={(draft.positions||[]).includes(p)} onChange={()=>toggle('positions',p)}/><span>{p}</span></label>)}{!positions.length&&<small>{en?'Add positions in Management > Libraries.':'Προσθέστε θέσεις στο Κέντρο Διαχείρισης > Βιβλιοθήκες.'}</small>}</div></fieldset>
   <fieldset><legend>{en?'Departments (none = all)':'Τμήματα (κανένα = όλα)'}</legend><div className="training-requirement-options">{departments.map(d=><label key={d} className={`check-option ${(draft.departments||[]).includes(d)?'selected':''}`}><input type="checkbox" checked={(draft.departments||[]).includes(d)} onChange={()=>toggle('departments',d)}/><span>{d}</span></label>)}</div></fieldset>
  </div>
 </ObserverDialog>
}
