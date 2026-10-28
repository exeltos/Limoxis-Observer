import { useEffect,useMemo,useRef,useState } from 'react'
import { AlertTriangle,CheckCircle2,Clock3,Pencil,Plus,Trash2,XCircle } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ExportMenu } from '../../design-system/ExportMenu'
import { SubTabs } from '../../design-system/SubTabs'
import { MultiSelect } from '../../design-system/MultiSelect'
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
// onSummaryChange: the figures for the page's cards; onExportChange: its «Export» items for the page's top bar.
export function TrainingCompetencePanel({state,employees=[],departments=[],language,locale,canManage,busy,onSaveRequirement,onDeleteRequirement,onSummaryChange,onExportChange}){
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

 const exportItems=[{id:'matrix',label:en?'Excel: competence matrix':'Excel: πίνακας επάρκειας',disabled:!matrix.rows.length,onClick:exportMatrix},{id:'plan',label:en?'Excel: retraining plan':'Excel: πλάνο επανεκπαίδευσης',disabled:!plan.length,onClick:exportPlan}]
 const exportRef=useRef(exportItems);exportRef.current=exportItems
 const summaryKey=`${matrix.rate}|${matrix.counts.missing}|${matrix.counts.expired}|${matrix.counts.expiring}|${matrix.rows.length}|${plan.length}|${department}`
 useEffect(()=>{onSummaryChange?.({rate:matrix.rate,...matrix.counts,people:matrix.rows.length,plan:plan.length,department})},[summaryKey]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!onExportChange)return undefined;onExportChange(exportRef.current.map(item=>({...item,onClick:()=>exportRef.current.find(x=>x.id===item.id)?.onClick()})));return()=>onExportChange(null)},[onExportChange,matrix.rows.length,plan.length,en])
 return <div className="training-competence">
  <div className="training-competence-summary">
   <div className="training-competence-tools">
    <label><span>{en?'Department':'Τμήμα'}</span><select value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">{en?'All':'Όλα'}</option>{departmentNames.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
    {!onExportChange&&<ExportMenu items={exportItems}/>}
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
 return <ObserverDialog width="wide" eyebrow={en?'Required training':'Απαιτούμενη εκπαίδευση'} title={value.title||(en?'New requirement':'Νέα απαίτηση')} onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={()=>onSave({...draft,title:draft.title.trim()})} disabled={!valid||busy} saveLabel={en?'Save':'Αποθήκευση'}/>}>
  <div className="training-requirement-form">
   <label className="span-2"><span>{en?'Title *':'Τίτλος *'}</span><input autoFocus value={draft.title} onChange={e=>set('title',e.target.value)} placeholder={en?'e.g. Hand hygiene (annual)':'π.χ. Υγιεινή χεριών (ετήσια)'}/></label>
   <label><span>{en?'Renewal (months, 0 = once)':'Ανανέωση (μήνες, 0 = μία φορά)'}</span><input type="number" min="0" value={draft.renewalMonths} onChange={e=>set('renewalMonths',Math.max(0,Number(e.target.value)||0))}/></label>
   <label className={`check-option training-requirement-active ${draft.active!==false?'selected':''}`}><input type="checkbox" checked={draft.active!==false} onChange={e=>set('active',e.target.checked)}/><span>{en?'Active':'Ενεργή'}</span></label>
   <fieldset className="span-2"><legend>{en?'Met by completing any of these programmes *':'Καλύπτεται με ολοκλήρωση οποιουδήποτε από τα προγράμματα *'}</legend><div className="training-requirement-options">{programs.map(p=><label key={p.id} className={`check-option ${draft.programIds.includes(p.id)?'selected':''}`}><input type="checkbox" checked={draft.programIds.includes(p.id)} onChange={()=>toggle('programIds',p.id)}/><span>{p.title}</span></label>)}</div></fieldset>
   <div className="span-2 training-requirement-scope">
    <MultiSelect label={en?'Professional categories':'Επαγγελματικές κατηγορίες'} options={professions.map(p=>({value:p,label:p}))} selected={draft.professions||[]} onChange={next=>set('professions',next)} placeholder={en?'All categories':'Όλες οι κατηγορίες'} searchPlaceholder={en?'Search category…':'Αναζήτηση κατηγορίας…'} emptyLabel={en?'No category matches':'Καμία κατηγορία δεν ταιριάζει'} selectAllLabel={en?'Select all':'Επιλογή όλων'} clearAllLabel={en?'Clear all':'Αποεπιλογή όλων'} countLabel={n=>en?`${n} categories`:`${n} κατηγορίες`}/>
    <MultiSelect label={en?'Job positions':'Θέσεις εργασίας'} options={positions.map(p=>({value:p,label:p}))} selected={draft.positions||[]} onChange={next=>set('positions',next)} disabled={!positions.length&&!(draft.positions||[]).length} placeholder={positions.length?(en?'All positions':'Όλες οι θέσεις'):(en?'Add positions in Management > Libraries.':'Προσθέστε θέσεις στο Κέντρο Διαχείρισης > Βιβλιοθήκες.')} searchPlaceholder={en?'Search position…':'Αναζήτηση θέσης…'} emptyLabel={en?'No position matches':'Καμία θέση δεν ταιριάζει'} selectAllLabel={en?'Select all':'Επιλογή όλων'} clearAllLabel={en?'Clear all':'Αποεπιλογή όλων'} countLabel={n=>en?`${n} positions`:`${n} θέσεις`}/>
    <MultiSelect label={en?'Departments':'Τμήματα'} options={departments.map(d=>({value:d,label:d}))} selected={draft.departments||[]} onChange={next=>set('departments',next)} placeholder={en?'All departments':'Όλα τα τμήματα'} searchPlaceholder={en?'Search department…':'Αναζήτηση τμήματος…'} emptyLabel={en?'No department matches':'Κανένα τμήμα δεν ταιριάζει'} selectAllLabel={en?'Select all':'Επιλογή όλων'} clearAllLabel={en?'Clear all':'Αποεπιλογή όλων'} countLabel={n=>en?`${n} departments`:`${n} τμήματα`}/>
   </div>
  </div>
 </ObserverDialog>
}
