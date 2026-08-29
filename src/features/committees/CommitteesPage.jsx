
import { useMemo,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpenCheck, CalendarDays, CheckCircle2, Clock3, Plus, Trash2 } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { loadCommittees,nextCommitteeId,saveCommittees } from './committeeData'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { loadEmployees } from '../employees/employeeStore'
import { IPC_COMMITTEE_CATALOG,ipcCommitteeById } from './ipcCommitteeCatalog'
import { requestCommitteeApproval } from './committeeApprovals'

export function CommitteesPage(){
 const navigate=useNavigate();const {role,membership}=useTenant();const {notify}=useFeedback();const actor=useAuditActor()
 const [rows,setRows]=useState(loadCommittees);const [createOpen,setCreateOpen]=useState(false);const [query,setQuery]=useState('');const [status,setStatus]=useState('all')
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const canManage=can(role,CAPABILITIES.MANAGE_COMMITTEES,addOns,custom)
 const filtered=useMemo(()=>rows.filter(x=>(status==='all'||x.status===status)&&`${x.name} ${x.shortName} ${x.chair}`.toLowerCase().includes(query.toLowerCase())),[rows,query,status])
 const meetings=rows.flatMap(x=>x.meetings||[]),decisions=rows.flatMap(x=>x.decisions||[])
 const overdue=decisions.filter(x=>!['completed','closed'].includes(x.status)&&x.dueDate&&new Date(x.dueDate)<new Date()).length
 function exportCsv(){const text=[['Κωδικός','Επιτροπή','Πρόεδρος','Κατάσταση'],...filtered.map(x=>[x.id,x.name,x.chair,x.status])].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv'}));a.download='committees.csv';a.click();URL.revokeObjectURL(a.href)}
 function pageAction(action){if(action===UI_ACTIONS.CREATE){setCreateOpen(true);return}if(action===UI_ACTIONS.PRINT){window.print();return}if(action===UI_ACTIONS.EXPORT){exportCsv()}}
 return <Page fill title="Επιτροπές" subtitle="Διακυβέρνηση επιτροπών, συνεδριάσεων, πρακτικών, αποφάσεων και ενεργειών."
   actions={<RecordActions actions={[...(canManage?[UI_ACTIONS.CREATE]:[]),UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} resourceCapability={CAPABILITIES.VIEW_COMMITTEES} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_COMMITTEES,[UI_ACTIONS.PRINT]:CAPABILITIES.PRINT_RECORDS,[UI_ACTIONS.EXPORT]:CAPABILITIES.EXPORT_RECORDS}} onAction={pageAction}/>}>
   <div className="module-summary-strip">
    <Metric icon={BookOpenCheck} label="Ενεργές επιτροπές" value={rows.filter(x=>x.status==='active').length}/>
    <Metric icon={CalendarDays} label="Συνεδριάσεις" value={meetings.length}/>
    <Metric icon={CheckCircle2} label="Ανοιχτές αποφάσεις" value={decisions.filter(x=>!['completed','closed'].includes(x.status)).length}/>
    <Metric icon={Clock3} label="Εκπρόθεσμες ενέργειες" value={overdue}/>
   </div>
   <section className="surface committee-registry">
    <FilterBar query={query} onQueryChange={setQuery} placeholder="Αναζήτηση επιτροπής ή προέδρου..." activeAdvancedCount={status!=='all'?1:0} onClear={()=>{setQuery('');setStatus('all')}}>
      <FilterSelect label="Κατάσταση" value={status} onChange={setStatus}><option value="all">Όλες</option><option value="active">Ενεργή</option><option value="inactive">Ανενεργή</option></FilterSelect>
    </FilterBar>
    <div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>Κωδικός</th><th>Επιτροπή</th><th>Πρόεδρος</th><th>Θητεία</th><th>Μέλη</th><th>Εκκρεμείς αποφάσεις</th><th>Κατάσταση</th></tr></thead><tbody>
      {filtered.map(row=><tr key={row.id} tabIndex={0} onClick={()=>navigate(`/committees/${row.id}`)} onKeyDown={e=>e.key==='Enter'&&navigate(`/committees/${row.id}`)}>
        <td><strong>{row.id}</strong></td><td><strong>{row.name}</strong><small>{row.shortName}</small></td><td>{row.chair||'—'}</td><td>{row.termStart||'—'} → {row.termEnd||'—'}</td><td>{row.members?.length||0}</td><td>{row.decisions?.filter(x=>!['completed','closed'].includes(x.status)).length||0}</td><td><span className={`status-badge ${row.status==='active'?'active':''}`}>{row.status==='active'?'Ενεργή':'Ανενεργή'}</span></td>
      </tr>)}
    </tbody></table></div>
   </section>
   {createOpen&&<CommitteeCreateDialog actor={actor} onClose={()=>setCreateOpen(false)} onCreated={record=>{const next=[record,...rows];setRows(next);saveCommittees(next);setCreateOpen(false);notify('Η επιτροπή δημιουργήθηκε.','success');navigate(`/committees/${record.id}`)}}/>}
 </Page>
}
function Metric({icon:Icon,label,value}){return <div className="module-summary-metric"><Icon size={15}/><div><strong>{value}</strong><span>{label}</span></div></div>}


const frequencies=[['monthly','Μηνιαία'],['bimonthly','Ανά δίμηνο'],['quarterly','Τριμηνιαία'],['semiannual','Εξαμηνιαία'],['annual','Ετήσια'],['as_needed','Όποτε απαιτείται']]

function CommitteeCreateDialog({actor,onClose,onCreated}){
 const {confirm}=useFeedback()
 const staff=useMemo(()=>loadEmployees().filter(x=>x.employmentStatus==='active').map(x=>({id:x.id,name:`${x.firstName} ${x.lastName}`,department:x.department,profession:x.profession,email:x.email||''})),[])
 const first=IPC_COMMITTEE_CATALOG[0]
 const [draft,setDraft]=useState({templateId:first.id,name:first.name,shortName:first.code,committeeRole:first.role,mandate:first.duties.join('\n'),legalBasis:first.source,decisionNumber:'',termStart:'',termEnd:'',meetingFrequency:'quarterly',quorumRule:'simple_majority',notes:'',members:[]})
 const set=(k,v)=>setDraft(x=>({...x,[k]:v})),template=ipcCommitteeById(draft.templateId)
 const ids=draft.members.map(x=>x.employeeId).filter(Boolean)
 const datesValid=!draft.termStart||!draft.termEnd||new Date(draft.termEnd)>=new Date(draft.termStart)
 const membersValid=draft.members.length>0&&draft.members.every(x=>x.employeeId&&x.title.trim()&&x.responsibilities.trim())&&new Set(ids).size===ids.length
 const valid=draft.name.trim()&&draft.committeeRole.trim()&&draft.mandate.trim()&&draft.termStart&&draft.termEnd&&datesValid&&membersValid
 function chooseTemplate(id){const t=ipcCommitteeById(id);setDraft(x=>({...x,templateId:id,name:t.id==='custom'?x.name:t.name,shortName:t.id==='custom'?x.shortName:t.code,committeeRole:t.id==='custom'?'':t.role,mandate:t.id==='custom'?'':t.duties.join('\n'),legalBasis:t.id==='custom'?'':t.source}))}
 function addMember(){setDraft(x=>({...x,members:[...x.members,{id:`m-${Date.now()}`,employeeId:'',title:'',responsibilities:'',voting:true,approvalRequired:false,memberType:'regular'}]}))}
 function patchMember(id,k,v){setDraft(x=>({...x,members:x.members.map(m=>m.id===id?{...m,[k]:v}:m)}))}
 async function removeMember(id){const ok=await confirm({title:'Αφαίρεση μέλους',message:'Το μέλος θα αφαιρεθεί από τη νέα επιτροπή πριν από την αποθήκευση. Θέλετε να συνεχίσετε;',confirmLabel:'Αφαίρεση',danger:true});if(!ok)return;setDraft(x=>({...x,members:x.members.filter(m=>m.id!==id)}))}
 function save(){
  if(!valid)return
  const rows=loadCommittees(),id=nextCommitteeId(rows),now=new Date().toISOString()
  const memberRefs=draft.members.map((m,i)=>{const person=staff.find(x=>x.id===m.employeeId);return {id:`CM-${Date.now()}-${i}`,employeeId:m.employeeId,name:person?.name||'',email:person?.email||'',department:person?.department||'',profession:person?.profession||'',committeeTitle:m.title.trim(),responsibilities:m.responsibilities.trim(),voting:m.voting,memberType:m.memberType||'regular',approvalRequired:m.approvalRequired,approvalStatus:m.approvalRequired?'pending':'not_required',active:true,startedAt:now,endedAt:null}})
  const chair=memberRefs.find(x=>/πρόεδ|συντον/i.test(x.committeeTitle)),secretary=memberRefs.find(x=>/γραμματ/i.test(x.committeeTitle))
  const record={id,name:draft.name.trim(),shortName:draft.shortName.trim(),status:'active',templateId:draft.templateId,structureKind:template.kind,isCoreCommittee:template.core,committeeRole:draft.committeeRole.trim(),mandate:draft.mandate.trim(),legalBasis:draft.legalBasis.trim(),officialRelation:template.relation,roleGuidance:template.roleGuidance||[],requiredFunctions:template.requiredFunctions,decisionNumber:draft.decisionNumber.trim(),termStart:draft.termStart,termEnd:draft.termEnd,meetingFrequency:draft.meetingFrequency,quorumRule:draft.quorumRule,notes:draft.notes.trim(),chair:chair?.name||'',secretary:secretary?.name||'',memberRefs,members:memberRefs.map(x=>x.name),meetings:[],decisions:[],annualPlan:[],createdAt:now,createdBy:actor.name,createdById:actor.id,updatedAt:now,updatedBy:actor.name,updatedById:actor.id,history:[{at:now,actor:actor.name,actorId:actor.id,action:'Δημιουργία',reason:draft.name},{at:now,actor:actor.name,actorId:actor.id,action:'Αρχική σύνθεση',reason:`${memberRefs.length} μέλη`}]}
  memberRefs.filter(x=>x.approvalRequired).forEach(m=>requestCommitteeApproval({committeeId:id,committeeName:record.name,employeeId:m.employeeId,memberName:m.name,committeeTitle:m.committeeTitle,responsibilities:m.responsibilities,requestedBy:actor.name,requestedById:actor.id}))
  onCreated(record)
 }
 return <ObserverDialog width="wide" eyebrow="Επιτροπές" title="Νέα επιτροπή / ομάδα" subtitle="Σύσταση, σύνθεση και βασικοί κανόνες λειτουργίας" onClose={onClose} footer={<DialogActions onCancel={onClose} disabled={!valid} onSave={save} saveLabel="Αποθήκευση"/>}>
  <div className="committee-create-dialog-content">
   <section className="observer-form-section"><div className="observer-form-section-title"><div><strong>Βασικά στοιχεία</strong><span>Επιλέξτε πρότυπο ή δημιουργήστε τοπική επιτροπή. Τα στοιχεία παραμένουν επεξεργάσιμα.</span></div></div><div className="entry-grid compact">
    <label><span>Τύπος επιτροπής / ομάδας *</span><select value={draft.templateId} onChange={e=>chooseTemplate(e.target.value)}>{IPC_COMMITTEE_CATALOG.map(x=><option key={x.id} value={x.id}>{x.code?`${x.code} — `:''}{x.name}</option>)}</select></label>
    <label><span>Σύντομη ονομασία</span><input value={draft.shortName} onChange={e=>set('shortName',e.target.value)}/></label>
    <label className="entry-span-2"><span>Ονομασία *</span><input value={draft.name} onChange={e=>set('name',e.target.value)}/></label>
    <label><span>Αρ. απόφασης / πράξης σύστασης</span><input value={draft.decisionNumber} onChange={e=>set('decisionNumber',e.target.value)}/></label>
    <label><span>Θεσμική / κατευθυντήρια βάση</span><input value={draft.legalBasis} onChange={e=>set('legalBasis',e.target.value)}/></label>
    <label className="entry-span-2"><span>Ρόλος της επιτροπής *</span><textarea rows="2" value={draft.committeeRole} onChange={e=>set('committeeRole',e.target.value)}/></label>
    <label className="entry-span-2"><span>Αρμοδιότητες *</span><textarea rows="3" value={draft.mandate} onChange={e=>set('mandate',e.target.value)}/></label>
   </div></section>
   <section className="observer-form-section"><div className="observer-form-section-title"><div><strong>Σύνθεση</strong><span>Τα πραγματικά μέλη, η ιδιότητα και η αρμοδιότητά τους.</span></div><Button onClick={addMember}><Plus size={15}/> Προσθήκη μέλους</Button></div>
    {draft.members.length?<div className="committee-member-list">{draft.members.map((m,i)=><CommitteeDialogMember key={m.id} m={m} index={i} staff={staff} suggestions={[...new Set(['Πρόεδρος','Αντιπρόεδρος','Συντονιστής','Γραμματέας','Μέλος','Αναπληρωματικό μέλος',...(template.requiredFunctions||[])])]} onChange={(k,v)=>patchMember(m.id,k,v)} onRemove={()=>removeMember(m.id)}/>)}</div>:<div className="inline-empty">Δεν έχουν προστεθεί μέλη.</div>}
    {!membersValid&&draft.members.length>0&&<div className="source-truth-note">Συμπληρώστε εργαζόμενο, ιδιότητα και αρμοδιότητα για κάθε μέλος. Δεν επιτρέπεται διπλή καταχώρηση.</div>}
   </section>
   <section className="observer-form-section"><div className="observer-form-section-title"><div><strong>Θητεία & λειτουργία</strong><span>Οι βασικοί κανόνες που απαιτούνται για συνεδριάσεις και ιστορικότητα.</span></div></div><div className="entry-grid compact">
    <ManualDateField label="Έναρξη θητείας *" value={draft.termStart} onChange={v=>set('termStart',v)}/><ManualDateField label="Λήξη θητείας *" value={draft.termEnd} onChange={v=>set('termEnd',v)}/>
    <label><span>Συχνότητα συνεδριάσεων</span><select value={draft.meetingFrequency} onChange={e=>set('meetingFrequency',e.target.value)}>{frequencies.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label><span>Απαρτία</span><select value={draft.quorumRule} onChange={e=>set('quorumRule',e.target.value)}><option value="simple_majority">Απλή πλειοψηφία ενεργών μελών</option><option value="two_thirds">2/3 ενεργών μελών</option><option value="custom">Σύμφωνα με τον κανονισμό</option></select></label>
    <label className="entry-span-2"><span>Σημειώσεις / ειδικοί κανόνες</span><textarea rows="2" value={draft.notes} onChange={e=>set('notes',e.target.value)}/></label>
    {!datesValid&&<div className="source-truth-note entry-span-2">Η λήξη δεν μπορεί να προηγείται της έναρξης.</div>}
   </div></section>
  </div>
 </ObserverDialog>
}

function CommitteeDialogMember({m,index,staff,suggestions,onChange,onRemove}){
 const person=staff.find(x=>x.id===m.employeeId)
 return <div className="committee-member"><div className="committee-member-head"><div><strong>{person?.name||`Μέλος ${index+1}`}</strong><small>{person?[person.profession,person.department].filter(Boolean).join(' · '):'Επιλέξτε εργαζόμενο'}</small></div><div className="record-inline-actions"><button type="button" className="danger" onClick={onRemove} title="Αφαίρεση μέλους"><Trash2 size={15}/></button></div></div><div className="entry-grid compact">
  <label><span>Εργαζόμενος *</span><select value={m.employeeId} onChange={e=>onChange('employeeId',e.target.value)}><option value="">Επιλογή</option>{staff.map(x=><option key={x.id} value={x.id}>{x.name} · {x.department}</option>)}</select></label>
  <label><span>Ιδιότητα στην επιτροπή *</span><input list={`committee-role-${index}`} value={m.title} onChange={e=>onChange('title',e.target.value)} placeholder="π.χ. Πρόεδρος, Γραμματέας, Μέλος"/><datalist id={`committee-role-${index}`}>{suggestions.map(x=><option key={x} value={x}/>)}</datalist></label>
  <label><span>Συμμετοχή</span><select value={m.memberType||'regular'} onChange={e=>onChange('memberType',e.target.value)}><option value="regular">Τακτικό</option><option value="alternate">Αναπληρωματικό</option></select></label>
  <label><span>Αρμοδιότητα *</span><input value={m.responsibilities} onChange={e=>onChange('responsibilities',e.target.value)}/></label>
 </div><div className="committee-member-options"><label><input type="checkbox" checked={m.voting} onChange={e=>onChange('voting',e.target.checked)}/><span>Δικαίωμα ψήφου</span></label><label><input type="checkbox" checked={m.approvalRequired} onChange={e=>onChange('approvalRequired',e.target.checked)}/><span>Απαιτείται προσωπική ηλεκτρονική έγκριση</span></label></div></div>
}
