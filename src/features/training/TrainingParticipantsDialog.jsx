import { useMemo,useState } from 'react'
import { Plus,Search,Trash2,UserRoundPlus,Users } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { BackButton } from '../../design-system/BackButton'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { IconButton } from '../../design-system/IconButton'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { RegistryTable } from '../../design-system/RegistryTable'

const emptyManual={name:'',department:'',email:''}
const makeManualId=()=>`MAN-${Date.now()}-${Math.random().toString(36).slice(2,7)}`

export function TrainingParticipantsDialog({employees=[],alreadyAssignedIds=[],departments=[],onClose,onSave,busy=false,en=false}){
 const [mode,setMode]=useState(employees.length?'registry':'manual'),[ids,setIds]=useState([]),[query,setQuery]=useState(''),[department,setDepartment]=useState('all'),[manualDraft,setManualDraft]=useState(emptyManual),[manualEntries,setManualEntries]=useState([])
 const assignedSet=useMemo(()=>new Set((alreadyAssignedIds||[]).map(String)),[alreadyAssignedIds])
 const departmentNames=useMemo(()=>[...new Set(employees.map(x=>x.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el')),[employees])
 const visible=useMemo(()=>employees.filter(x=>(department==='all'||x.department===department)&&`${x.firstName||''} ${x.lastName||''} ${x.id||''} ${x.employeeCode||''} ${x.email||''} ${x.department||''}`.toLowerCase().includes(query.toLowerCase())),[employees,department,query])
 const selectableVisible=useMemo(()=>visible.filter(x=>!assignedSet.has(String(x.id||x.employeeCode||''))),[visible,assignedSet])
 const selected=useMemo(()=>employees.filter(x=>ids.includes(x.id)&&!assignedSet.has(String(x.id||x.employeeCode||''))),[employees,ids,assignedSet])
 const availableCount=useMemo(()=>employees.filter(x=>!assignedSet.has(String(x.id||x.employeeCode||''))).length,[employees,assignedSet])
 const total=selected.length+manualEntries.length,allVisibleSelected=selectableVisible.length>0&&selectableVisible.every(x=>ids.includes(x.id))
 function toggleAll(){const visibleIds=selectableVisible.map(x=>x.id);setIds(current=>allVisibleSelected?current.filter(id=>!visibleIds.includes(id)):[...new Set([...current,...visibleIds])])}
 function addManual(){const name=manualDraft.name.trim();if(!name)return;setManualEntries(rows=>[...rows,{...manualDraft,id:makeManualId(),name,department:manualDraft.department.trim(),email:manualDraft.email.trim()}]);setManualDraft(emptyManual)}
 return <Page fill className="training-participant-page" navigation={<BackButton onClick={onClose} label={en?'Back to participants':'Πίσω στους συμμετέχοντες'}/>} title={en?'Add participants':'Προσθήκη συμμετεχόντων'} subtitle={en?'Select staff or add external participants manually.':'Επιλέξτε εργαζομένους ή προσθέστε χειροκίνητα εξωτερικούς συμμετέχοντες.'} actions={<div className="training-participant-page-actions"><span className="training-selection-count">{total} {en?'ready':'έτοιμοι'}</span><SaveButton loading={busy} disabled={busy||!total} onClick={()=>onSave({selected,manualEntries})}>{en?'Save participants':'Αποθήκευση συμμετεχόντων'}</SaveButton></div>}>
  <section className="surface training-participant-page-shell workspace-column workspace-fill">
   <ModuleTabs
    className="training-participant-mode"
    activeId={mode}
    onChange={setMode}
    ariaLabel={en?'Participant source':'Πηγή συμμετεχόντων'}
    tabs={[
     {id:'registry',icon:Users,label:<><strong>{en?'From staff registry':'Από το προσωπικό'}</strong><small>{availableCount} {en?'available':'διαθέσιμοι'}</small></>},
     {id:'manual',icon:UserRoundPlus,label:<><strong>{en?'Manual entry':'Χειροκίνητη καταχώρηση'}</strong><small>{manualEntries.length} {en?'staged':'σε αναμονή'}</small></>},
    ]}
   />
   <div className="training-participant-basket-summary"><strong>{en?'Ready to save':'Έτοιμοι για αποθήκευση'}: {total}</strong><span>{selected.length} {en?'from staff':'από προσωπικό'} · {manualEntries.length} {en?'manual':'χειροκίνητοι'}</span></div>
   <div className="training-participant-stage">
   {mode==='registry'&&<section className="training-participant-panel">
    <div className="training-participant-panel-heading"><div><span className="eyebrow">{en?'Employee registry':'Μητρώο εργαζομένων'}</span><h3>{en?'Select participants':'Επιλογή συμμετεχόντων'}</h3></div><span className="training-selection-count">{selected.length} {en?'selected':'επιλεγμένοι'}</span></div>
    {employees.length?<><div className="training-participant-filters"><label className="training-participant-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={en?'Search name, code, email...':'Αναζήτηση ονόματος, κωδικού, email...'}/></label><select value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">{en?'All departments':'Όλα τα τμήματα'}</option>{departmentNames.map(name=><option key={name} value={name}>{name}</option>)}</select></div><div className="training-participant-list-head"><Button variant="quiet" type="button" disabled={!selectableVisible.length} onClick={toggleAll}>{allVisibleSelected?(en?'Clear available':'Αποεπιλογή διαθέσιμων'):(en?'Select available':'Επιλογή διαθέσιμων')}</Button><span>{visible.length} {en?'results':'αποτελέσματα'} · {selectableVisible.length} {en?'available':'διαθέσιμοι'}</span></div><RegistryTable
      wrapperClassName="scroll-table training-participant-table-wrap"
      className="training-participant-table"
      columns={[{key:'select',label:'',className:'training-check-col'},{key:'employee',label:en?'Employee':'Εργαζόμενος'},{key:'code',label:en?'Code / status':'Κωδικός / κατάσταση'},{key:'department',label:en?'Department':'Τμήμα'},{key:'email',label:'Email'}]}
      rows={visible}
      rowKey={x=>x.dbId||x.id}
      rowProps={x=>{const key=String(x.id||x.employeeCode||''),alreadyAssigned=assignedSet.has(key),checked=!alreadyAssigned&&ids.includes(x.id);return {'aria-disabled':alreadyAssigned?'true':undefined,className:checked?'training-row-selected':'',onClick:()=>{if(alreadyAssigned)return;setIds(current=>current.includes(x.id)?current.filter(v=>v!==x.id):[...current,x.id])}}}}
      renderRow={x=>{const key=String(x.id||x.employeeCode||''),alreadyAssigned=assignedSet.has(key),checked=!alreadyAssigned&&ids.includes(x.id);return <><td className="training-check-col"><input type="checkbox" disabled={alreadyAssigned} checked={checked} onClick={e=>e.stopPropagation()} onChange={()=>{if(alreadyAssigned)return;setIds(current=>current.includes(x.id)?current.filter(v=>v!==x.id):[...current,x.id])}}/></td><td><strong>{`${x.firstName||''} ${x.lastName||''}`.trim()||'—'}</strong><small>{x.profession||'—'}</small></td><td>{alreadyAssigned?<span className="status-badge active">{en?'Already participating':'Ήδη συμμετέχει'}</span>:(x.id||x.employeeCode||'—')}</td><td>{x.department||'—'}</td><td>{x.email||'—'}</td></>}}
     />{visible.length===0&&<div className="registry-empty-state"><strong>{en?'No staff match the current filters.':'Δεν βρέθηκαν εργαζόμενοι με τα συγκεκριμένα φίλτρα.'}</strong></div>}</>:<div className="registry-empty-state"><Users size={24}/><strong>{en?'No staff records are available.':'Δεν υπάρχουν διαθέσιμες καρτέλες εργαζομένων.'}</strong><Button variant="secondary" onClick={()=>setMode('manual')}>{en?'Use manual entry':'Χειροκίνητη καταχώρηση'}</Button></div>}
   </section>}
   {mode==='manual'&&<section className="training-participant-panel training-participant-manual">
    <div className="training-participant-panel-heading"><div><span className="eyebrow">{en?'Manual entry':'Χειροκίνητη καταχώρηση'}</span><h3>{en?'Add participants':'Προσθήκη συμμετεχόντων'}</h3></div></div>
    <div className="training-manual-form-row"><label><span>{en?'Full name *':'Ονοματεπώνυμο *'}</span><input value={manualDraft.name} onChange={e=>setManualDraft(x=>({...x,name:e.target.value}))}/></label><label><span>{en?'Department / organization':'Τμήμα / φορέας'}</span><input list="training-manual-departments" value={manualDraft.department} onChange={e=>setManualDraft(x=>({...x,department:e.target.value}))}/><datalist id="training-manual-departments">{departments.map(x=><option key={x.id||x.name} value={x.name||x.label||''}/>)}</datalist></label><label><span>Email</span><input type="email" value={manualDraft.email} onChange={e=>setManualDraft(x=>({...x,email:e.target.value}))}/></label><div className="training-manual-add-cell"><Button type="button" variant="secondary" disabled={!manualDraft.name.trim()} onClick={addManual}><Plus size={15}/>{en?'Add to list':'Προσθήκη στη λίστα'}</Button></div></div>
    <div className="training-manual-list-slot">{manualEntries.length>0?<RegistryTable
      wrapperClassName="scroll-table training-manual-table-wrap"
      columns={[{key:'participant',label:en?'Participant':'Συμμετέχων'},{key:'department',label:en?'Department / organization':'Τμήμα / φορέας'},{key:'email',label:'Email'},{key:'actions',label:''}]}
      rows={manualEntries}
      rowKey={item=>item.id}
      renderRow={item=><><td><strong>{item.name}</strong></td><td>{item.department||'—'}</td><td>{item.email||'—'}</td><td className="open-record-cell"><IconButton tone="danger" size="sm" label={en?'Remove':'Αφαίρεση'} onClick={()=>setManualEntries(rows=>rows.filter(x=>x.id!==item.id))}><Trash2 size={14}/></IconButton></td></>}
     />:<div className="registry-empty-state"><UserRoundPlus size={24}/><strong>{en?'No manual participants yet.':'Δεν έχουν προστεθεί χειροκίνητοι συμμετέχοντες.'}</strong><span>{en?'Complete the fields above and add participants to the list.':'Συμπληρώστε τα πεδία και προσθέστε συμμετέχοντες στη λίστα.'}</span></div>}</div>
   </section>}
   </div>
  </section>
 </Page>
}
