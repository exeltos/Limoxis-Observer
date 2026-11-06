import { useEffect,useMemo,useRef,useState } from 'react'
import { AlertTriangle,CheckCircle2,Clock3,Pencil,Plus,Trash2,XCircle } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ExportMenu } from '../../design-system/ExportMenu'
import { SubTabs } from '../../design-system/SubTabs'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { MultiSelect } from '../../design-system/MultiSelect'
import { ChoiceField } from '../../design-system/ChoiceField'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { exportRegistry } from '../../core/export/registryExports'
import { printReport } from '../../core/export/reportDocument'
import { ExcelFieldsDialog,pickColumns,tableFields } from '../../design-system/ExcelFieldsDialog'
import { PrintOptionsDialog } from '../../design-system/PrintOptionsDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { competenceReportDoc } from './trainingReports'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadManagementLibraries } from '../management/managementCloudService'
import { demoLibrarySeed } from '../management/managementData'
import { competenceMatrix,newRequirement,retrainingPlan } from './trainingCompetence'
import './trainingCompetence.css'
import { isStaffEmployee } from '../employees/staffCategory'

const STATE_ICON={valid:CheckCircle2,expiring:Clock3,expired:AlertTriangle,missing:XCircle}
// How often a requirement repeats, in words: «Κάθε χρόνο», «Κάθε 2 χρόνια», «Κάθε 6 μήνες», «Μία φορά».
export function renewalText(months,en){
 const m=Number(months)||0
 if(!m)return en?'Once':'Μία φορά'
 if(m%12===0)return m===12?(en?'Every year':'Κάθε χρόνο'):(en?`Every ${m/12} years`:`Κάθε ${m/12} χρόνια`)
 return en?`Every ${m} months`:`Κάθε ${m} μήνες`
}
// The programmes of a requirement, each title once with how many sessions carry it: «BLS-AED (19)».
export function programTitlesText(programIds,programs){
 const counts=new Map()
 for(const id of programIds||[]){const title=String(programs.find(p=>p.id===id)?.title||id).trim();const key=title.toLocaleUpperCase('el');const seen=counts.get(key);counts.set(key,{title:seen?.title||title,n:(seen?.n||0)+1})}
 return [...counts.values()].map(x=>x.n>1?`${x.title} (${x.n})`:x.title).join(' · ')
}
const PAGE=50
const stateText=(state,en)=>({valid:en?'Valid':'Σε ισχύ',expiring:en?'Expiring':'Λήγει',expired:en?'Expired':'Έληξε',missing:en?'Missing':'Λείπει'})[state]||state

// "Competence" view of Training: which staff need which training (by
// professional category and department), who is covered, and who has to be
// trained and by when.
// onSummaryChange: the figures for the page's cards; onExportChange: its «Export» items for the page's top bar.
export function TrainingCompetencePanel({state,employees=[],departments=[],language,locale,canManage,busy,onSaveRequirement,onDeleteRequirement,onSummaryChange,onExportChange,monthly=null,monthlyCount=null}){
 const en=language==='en'
 const {tenant,isDemo}=useTenant()
 const {notify}=useFeedback()
 const [positionOptions,setPositionOptions]=useState([])
 useEffect(()=>{let active=true;if(isDemo){setPositionOptions(demoLibrarySeed.positions||[]);return()=>{active=false}}if(!tenant?.id)return()=>{active=false};loadManagementLibraries(tenant.id).then(libraries=>{if(active)setPositionOptions(libraries?.positions||[])}).catch(()=>{if(active)setPositionOptions([])});return()=>{active=false}},[isDemo,tenant?.id])
 const {t}=useLanguage()
 const [dialog,setDialog]=useState(null)
 const [view,setView]=useState('matrix')
 const [department,setDepartment]=useState('all')
 const [query,setQuery]=useState(''),[stateFilter,setStateFilter]=useState(''),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(PAGE)
 const [editing,setEditing]=useState(null)
 const today=new Date().toISOString().slice(0,10)
 const activeEmployees=useMemo(()=>employees.filter(e=>isStaffEmployee(e)&&(!e.employmentStatus||String(e.employmentStatus).toLowerCase()==='active')),[employees])
 const scoped=useMemo(()=>activeEmployees.filter(e=>department==='all'||e.department===department),[activeEmployees,department])
 const matrix=useMemo(()=>competenceMatrix({requirements:state.requirements||[],employees:scoped,assignments:state.assignments||[],certificates:state.certificates||[],today}),[state,scoped,today])
 const plan=useMemo(()=>retrainingPlan(matrix,{today}),[matrix,today])
 // The search (name) and a state picked from the totals narrow what the matrix and the list show; the printouts keep it all.
 const q=query.trim().toLocaleLowerCase('el')
 const matchName=e=>!q||[e.lastName,e.firstName,e.lastNameEn,e.firstNameEn,e.department,e.profession].filter(Boolean).join(' ').toLocaleLowerCase('el').includes(q)
 const shownRows=useMemo(()=>matrix.rows.filter(row=>matchName(row.employee)&&(!stateFilter||row.cells.some(cell=>cell?.state===stateFilter))),[matrix,q,stateFilter]) // eslint-disable-line react-hooks/exhaustive-deps
 const shownPlan=useMemo(()=>plan.filter(item=>matchName(item.employee)&&(!stateFilter||item.state===stateFilter)),[plan,q,stateFilter]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{setPage(1)},[q,stateFilter,department,view])
 const listed=view==='plan'?shownPlan:shownRows
 const totalPages=Math.max(1,Math.ceil(listed.length/pageSize)),safePage=Math.min(page,totalPages)
 const paged=list=>list.slice((safePage-1)*pageSize,safePage*pageSize)
 const professions=useMemo(()=>[...new Set(activeEmployees.map(e=>e.profession).filter(Boolean))].sort((a,b)=>a.localeCompare(b,language)),[activeEmployees,language])
 const positions=useMemo(()=>[...new Set([...positionOptions.map(row=>row?.[0]),...activeEmployees.map(e=>e.position)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,language)),[positionOptions,activeEmployees,language])
 const departmentNames=useMemo(()=>[...new Set([...departments.map(d=>d.name),...activeEmployees.map(e=>e.department)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,language)),[departments,activeEmployees,language])
 const fmt=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'
 const name=e=>en?[e.firstNameEn||e.firstName,e.lastNameEn||e.lastName].filter(Boolean).join(' '):[e.lastName,e.firstName].filter(Boolean).join(' ')
 // Who a requirement covers, in words: «Όλο το προσωπικό» when it names no category, position or department.
 const appliesText=r=>{const parts=[(r.professions||[]).join(', '),(r.positions||[]).join(', '),(r.departments||[]).join(', ')].filter(Boolean);return parts.length?parts.join(' · '):(en?'All staff':'Όλο το προσωπικό')}

 function matrixExport(){
  return ({name:en?'training-competence':'eparkeia-ekpaideusis',
   headers:[en?'Person':'Άτομο',en?'Department':'Τμήμα',en?'Category':'Κατηγορία',en?'Position':'Θέση',...matrix.requirements.map(r=>r.title)],
   rows:matrix.rows.map(row=>[name(row.employee),row.employee.department,row.employee.profession,row.employee.position||'',...row.cells.map(cell=>cell?`${stateText(cell.state,en)}${cell.validUntil?` (${fmt(cell.validUntil)})`:''}`:'')])})
 }
 function planExport(){
  return ({name:en?'retraining-plan':'plano-epanekpaideusis',
   headers:en?['Due by','Person','Department','Category','Required training','Status','Valid until']:['Έως','Άτομο','Τμήμα','Κατηγορία','Απαιτούμενη εκπαίδευση','Κατάσταση','Ισχύς έως'],
   rows:plan.map(item=>[fmt(item.due),name(item.employee),item.employee.department,item.employee.profession,item.requirement.title,stateText(item.state,en),fmt(item.validUntil)])})
 }

 const printBlocked=()=>notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')
 // One print (matrix or retraining plan, chosen in a dialog) and one Excel with a field choice.
 const exportItems=[
  {id:'competence-print',kind:'print',label:en?'Print: competence':'Εκτύπωση: επάρκεια',disabled:!matrix.rows.length,onClick:()=>setDialog('print')},
  {id:'competence-excel',kind:'excel',label:t('exportFields.menuLabel'),disabled:!matrix.rows.length,onClick:()=>setDialog('excel')},
 ]
 const tableOf=content=>content==='plan'?planExport():matrixExport()
 const printCompetence=({content})=>{setDialog(null);if(!printReport(competenceReportDoc({matrix,plan,content,department,language,personName:name,today})))printBlocked()}
 const exportRef=useRef(exportItems);exportRef.current=exportItems
 const summaryKey=`${matrix.rate}|${matrix.counts.missing}|${matrix.counts.expired}|${matrix.counts.expiring}|${matrix.rows.length}|${plan.length}|${department}`
 useEffect(()=>{onSummaryChange?.({rate:matrix.rate,...matrix.counts,people:matrix.rows.length,plan:plan.length,department})},[summaryKey]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!onExportChange)return undefined;onExportChange(exportRef.current.map(item=>({...item,onClick:()=>exportRef.current.find(x=>x.id===item.id)?.onClick()})));return()=>onExportChange(null)},[onExportChange,matrix.rows.length,plan.length,en])
 const contentChoices=[{value:'matrix',label:en?'Competence matrix':'Πίνακας επάρκειας'},{value:'plan',label:en?'Retraining plan (by month)':'Πλάνο επανεκπαίδευσης (ανά μήνα)'}]
 return <div className="training-competence">
  {dialog==='print'&&<PrintOptionsDialog storageKey="limoxis.training.competence.print" title={en?'Print competence':'Εκτύπωση επάρκειας'} options={[{key:'content',label:en?'Content':'Περιεχόμενο',choices:contentChoices,initial:view==='plan'?'plan':'matrix'}]} onConfirm={printCompetence} onClose={()=>setDialog(null)}/>}
  {dialog==='excel'&&<ExcelFieldsDialog storageKey="limoxis.training.competence.excel" layouts={contentChoices} fields={content=>tableFields(tableOf(content))} onClose={()=>setDialog(null)} onConfirm={(keys,content)=>{exportRegistry(pickColumns(tableOf(content),keys));setDialog(null)}}/>}
  {view!=='rules'&&view!=='monthly'&&<FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search person or department…':'Αναζήτηση ατόμου ή τμήματος…'} activeAdvancedCount={department==='all'?0:1} onClear={()=>{setQuery('');setDepartment('all');setStateFilter('')}}
   end={<RegistryTotals label={en?'Totals':'Σύνολα'} items={[
    {key:'rate',always:true,value:matrix.rate??0,display:`${matrix.rate??0}%`,label:en?'covered':'κάλυψη'},
    ...['valid','expiring','expired','missing'].map(key=>({key,value:matrix.counts[key],label:stateText(key,en).toLocaleLowerCase(en?'en':'el'),active:stateFilter===key,onClick:()=>setStateFilter(current=>current===key?'':key)})),
   ]}/>}>
   <FilterSelect label={en?'Department':'Τμήμα'} value={department} onChange={setDepartment}><option value="all">{en?'All':'Όλα'}</option>{departmentNames.map(d=><option key={d} value={d}>{d}</option>)}</FilterSelect>
  </FilterBar>}
  {!onExportChange&&<div className="training-competence-tools"><ExportMenu items={exportItems}/></div>}
  <SubTabs activeId={view} onChange={setView} ariaLabel={en?'Competence view':'Προβολή επάρκειας'} tabs={[{id:'matrix',label:en?'Matrix':'Πίνακας'},{id:'plan',label:en?'Who needs training':'Ποιοι χρειάζονται εκπαίδευση',count:plan.length},...(monthly?[{id:'monthly',label:en?'Retraining by month':'Επανεκπαίδευση ανά μήνα',count:monthlyCount}]:[]),{id:'rules',label:en?'Requirements':'Απαιτήσεις',count:matrix.requirements.length}]}/>

  {view==='matrix'&&<div className="scroll-table">
   {matrix.requirements.length?<table className="data-table sticky-table training-competence-matrix">
    <thead><tr><th>{en?'Person':'Άτομο'}</th>{matrix.requirements.map(r=><th key={r.id} title={r.title}><span>{r.title}</span><small>{renewalText(r.renewalMonths,en)}</small></th>)}</tr></thead>
    <tbody>{paged(shownRows).map(row=><tr key={row.employee.id}><td><strong>{name(row.employee)}</strong><small>{[row.employee.department,row.employee.position||row.employee.profession].filter(Boolean).join(' · ')}</small></td>{row.cells.map((cell,index)=>{if(!cell)return <td key={index} className="training-competence-na">—</td>;const Icon=STATE_ICON[cell.state];return <td key={index} className={`training-competence-cell ${cell.state}`} title={`${stateText(cell.state,en)}${cell.completedOn?` · ${en?'completed':'ολοκλήρωση'} ${fmt(cell.completedOn)}`:''}${cell.validUntil?` · ${en?'valid until':'ισχύει έως'} ${fmt(cell.validUntil)}`:''}`}><span className={`training-competence-chip ${cell.state}`}><Icon size={14} aria-hidden="true"/>{cell.state==='missing'||cell.state==='expired'&&!cell.validUntil?stateText(cell.state,en):fmt(cell.validUntil)||stateText(cell.state,en)}</span></td>})}</tr>)}</tbody>
   </table>:<div className="registry-empty-state"><strong>{en?'No required training yet':'Δεν έχουν οριστεί απαιτούμενες εκπαιδεύσεις'}</strong><span>{en?'Add requirements in the Requirements tab: which training each professional category or department needs and how often.':'Ορίστε στην καρτέλα «Απαιτήσεις» ποια εκπαίδευση χρειάζεται κάθε επαγγελματική κατηγορία ή τμήμα και κάθε πότε.'}</span></div>}
   {matrix.requirements.length>0&&!shownRows.length&&<div className="registry-empty-state"><strong>{matrix.rows.length?(en?'No one matches the search':'Κανείς δεν ταιριάζει στην αναζήτηση'):(en?'No staff match the requirements':'Κανένας εργαζόμενος δεν αντιστοιχεί στις απαιτήσεις')}</strong></div>}
  </div>}
  {view==='matrix'&&<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={shownRows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>}

  {view==='monthly'&&monthly}

  {view==='plan'&&<div className="scroll-table"><table className="data-table sticky-table">
   <thead><tr><th>{en?'Due by':'Έως'}</th><th>{en?'Person':'Άτομο'}</th><th>{en?'Department':'Τμήμα'}</th><th>{en?'Required training':'Απαιτούμενη εκπαίδευση'}</th><th>{en?'Last completed':'Τελευταία φορά'}</th><th>{en?'Status':'Κατάσταση'}</th></tr></thead>
   <tbody>{paged(shownPlan).map(item=><tr key={item.key}><td><span className={item.due<=today?'training-competence-late':''}>{item.state==='missing'?(en?'Now':'Άμεσα'):fmt(item.due)}</span></td><td><strong>{name(item.employee)}</strong><small>{item.employee.profession}</small></td><td>{item.employee.department||'—'}</td><td>{item.requirement.title}<small>{renewalText(item.requirement.renewalMonths,en)}</small></td><td>{item.completedOn?fmt(item.completedOn):(en?'Never':'Ποτέ')}</td><td><span className={`status-badge ${item.state==='expiring'?'warning':'danger'}`}>{stateText(item.state,en)}</span></td></tr>)}</tbody>
  </table>{!shownPlan.length&&<div className="registry-empty-state"><strong>{plan.length?(en?'No one matches the search':'Κανείς δεν ταιριάζει στην αναζήτηση'):(en?'Everyone is covered':'Όλοι καλύπτονται')}</strong></div>}</div>}
  {view==='plan'&&<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={shownPlan.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>}

  {view==='rules'&&<div className="training-competence-rules">
   {canManage&&<div className="training-competence-rules-head"><Button onClick={()=>setEditing(newRequirement())}><Plus size={15}/>{en?' Add requirement':' Νέα απαίτηση'}</Button></div>}
   <div className="scroll-table"><table className="data-table sticky-table">
    <thead><tr><th>{en?'Requirement':'Απαίτηση'}</th><th>{en?'Met by programme':'Καλύπτεται από'}</th><th>{en?'Applies to':'Ισχύει για'}</th><th>{en?'Repeats':'Επανάληψη'}</th><th className="training-competence-menu-col"></th></tr></thead>
    <tbody>{(state.requirements||[]).map(r=><tr key={r.id} className={r.active===false?'training-competence-inactive':''}><td><strong>{r.title}</strong></td><td>{programTitlesText(r.programIds,state.programs||[])||'—'}</td><td>{appliesText(r)}</td><td className="training-competence-nowrap">{renewalText(r.renewalMonths,en)}</td><td className="training-competence-menu-col">{canManage&&<OverflowMenu label={en?'Requirement actions':'Ενέργειες απαίτησης'} items={[{id:'edit',label:en?'Edit':'Επεξεργασία',icon:Pencil,onClick:()=>setEditing({...r})},{id:'delete',label:en?'Delete':'Διαγραφή',icon:Trash2,tone:'danger',separatorBefore:true,disabled:busy,onClick:()=>onDeleteRequirement(r)}]}/>}</td></tr>)}</tbody>
   </table></div>
  </div>}

  {editing&&<RequirementDialog value={editing} programs={state.programs||[]} professions={professions} positions={positions} departments={departmentNames} en={en} busy={busy} onClose={()=>setEditing(null)} onSave={async next=>{if(await onSaveRequirement(next))setEditing(null)}}/>}
 </div>
}

function RequirementDialog({value,programs,professions,positions=[],departments,en,busy,onClose,onSave}){
 const [draft,setDraft]=useState(value)
 const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
 const valid=draft.title.trim()&&draft.programIds.length>0
 // A title held by many sessions (e.g. 19 × «BLS-AED») is one choice that picks all of them.
 const programGroups=useMemo(()=>{const groups=new Map();for(const p of programs){const title=String(p.title||p.id).trim();const key=title.toLocaleUpperCase('el');const g=groups.get(key)||{key,title,ids:[]};g.ids.push(p.id);groups.set(key,g)}return [...groups.values()].sort((a,b)=>a.title.localeCompare(b.title,'el'))},[programs])
 return <ObserverDialog width="wide" eyebrow={en?'Required training':'Απαιτούμενη εκπαίδευση'} title={value.title||(en?'New requirement':'Νέα απαίτηση')} onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={()=>onSave({...draft,title:draft.title.trim()})} disabled={!valid||busy} saveLabel={en?'Save':'Αποθήκευση'}/>}>
  <div className="training-requirement-form">
   <label className="span-2"><span>{en?'Title *':'Τίτλος *'}</span><input autoFocus value={draft.title} onChange={e=>set('title',e.target.value)} placeholder={en?'e.g. Hand hygiene (annual)':'π.χ. Υγιεινή χεριών (ετήσια)'}/></label>
   <ChoiceField label={en?'Repeats':'Επανάληψη'} value={String(draft.renewalMonths||0)} onChange={value=>set('renewalMonths',Number(value)||0)} options={[...new Set([0,6,12,24,36,60,Number(draft.renewalMonths)||0])].sort((a,b)=>(a||999)-(b||999)).map(m=>({value:String(m),label:renewalText(m,en)}))}/>
   <label className={`check-option training-requirement-active ${draft.active!==false?'selected':''}`}><input type="checkbox" checked={draft.active!==false} onChange={e=>set('active',e.target.checked)}/><span>{en?'Active':'Ενεργή'}</span></label>
   <fieldset className="span-2"><legend>{en?'Met by completing any of these programmes *':'Καλύπτεται με ολοκλήρωση οποιουδήποτε από τα προγράμματα *'}</legend><div className="training-requirement-options">{programGroups.map(g=>{const on=g.ids.some(id=>draft.programIds.includes(id));return <label key={g.key} className={`check-option ${on?'selected':''}`}><input type="checkbox" checked={on} onChange={()=>setDraft(d=>({...d,programIds:on?d.programIds.filter(id=>!g.ids.includes(id)):[...new Set([...d.programIds,...g.ids])]}))}/><span>{g.title}{g.ids.length>1?` (${g.ids.length})`:''}</span></label>})}</div></fieldset>
   <div className="span-2 training-requirement-scope">
    <MultiSelect label={en?'Professional categories':'Επαγγελματικές κατηγορίες'} options={professions.map(p=>({value:p,label:p}))} selected={draft.professions||[]} onChange={next=>set('professions',next)} placeholder={en?'All categories':'Όλες οι κατηγορίες'} searchPlaceholder={en?'Search category…':'Αναζήτηση κατηγορίας…'} emptyLabel={en?'No category matches':'Καμία κατηγορία δεν ταιριάζει'} selectAllLabel={en?'Select all':'Επιλογή όλων'} clearAllLabel={en?'Clear all':'Αποεπιλογή όλων'} countLabel={n=>en?`${n} categories`:`${n} κατηγορίες`}/>
    <MultiSelect label={en?'Job positions':'Θέσεις εργασίας'} options={positions.map(p=>({value:p,label:p}))} selected={draft.positions||[]} onChange={next=>set('positions',next)} disabled={!positions.length&&!(draft.positions||[]).length} placeholder={positions.length?(en?'All positions':'Όλες οι θέσεις'):(en?'Add positions in Management > Libraries.':'Προσθέστε θέσεις στο Κέντρο Διαχείρισης > Βιβλιοθήκες.')} searchPlaceholder={en?'Search position…':'Αναζήτηση θέσης…'} emptyLabel={en?'No position matches':'Καμία θέση δεν ταιριάζει'} selectAllLabel={en?'Select all':'Επιλογή όλων'} clearAllLabel={en?'Clear all':'Αποεπιλογή όλων'} countLabel={n=>en?`${n} positions`:`${n} θέσεις`}/>
    <MultiSelect label={en?'Departments':'Τμήματα'} options={departments.map(d=>({value:d,label:d}))} selected={draft.departments||[]} onChange={next=>set('departments',next)} placeholder={en?'All departments':'Όλα τα τμήματα'} searchPlaceholder={en?'Search department…':'Αναζήτηση τμήματος…'} emptyLabel={en?'No department matches':'Κανένα τμήμα δεν ταιριάζει'} selectAllLabel={en?'Select all':'Επιλογή όλων'} clearAllLabel={en?'Clear all':'Αποεπιλογή όλων'} countLabel={n=>en?`${n} departments`:`${n} τμήματα`}/>
   </div>
  </div>
 </ObserverDialog>
}
