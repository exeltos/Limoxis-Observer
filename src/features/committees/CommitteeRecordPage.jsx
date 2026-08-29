import { useMemo,useState } from 'react'
import { useNavigate,useParams } from 'react-router-dom'
import { AlertTriangle,CalendarDays,CheckCircle2,ClipboardList,FileClock,FileSignature,Mail,Paperclip,Pencil,Plus,ShieldCheck,Target,Trash2,Users } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { TimeField } from '../../design-system/TimeField'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { ExpandableTextBlock } from '../../design-system/ExpandableTextBlock'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { loadCommittees,saveCommittees } from './committeeData'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { AttachmentField } from '../../design-system/AttachmentField'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { loadEmployees } from '../employees/employeeStore'
import { ipcCommitteeById } from './ipcCommitteeCatalog'
import { approvalStatusFor,minutesApprovalSummary,requestCommitteeApproval,requestMinutesApprovals } from './committeeApprovals'

const todayIso=()=>new Date().toISOString().slice(0,10)
const fmtDate=value=>value?new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString('el-GR'):'—'
const isOverdue=item=>item?.dueDate&&item.status!=='completed'&&item.dueDate<todayIso()
const meetingStatusLabel=status=>status==='finalized'?'Οριστικοποιημένα':status==='approval_pending'?'Σε έγκριση':status==='draft'?'Πρόχειρο':'Προγραμματισμένη'

function quorumRequirement(rule,count){
  if(!count)return 0
  if(rule==='two_thirds')return Math.ceil(count*2/3)
  if(rule==='custom')return null
  return Math.floor(count/2)+1
}

function createAttendance(activeMembers,existing=[]){
  const byMember=new Map(existing.map(x=>[x.memberId,x]))
  return activeMembers.map(member=>{
    const old=byMember.get(member.id)
    return old||{memberId:member.id,employeeId:member.employeeId||'',name:member.name,email:member.email||'',voting:Boolean(member.voting),status:'not_recorded'}
  })
}

function createTopic(){return {id:`TOP-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,subject:'',decision:'',followUp:false,action:'',owner:'',dueDate:'',priority:'medium'}}

export function CommitteeRecordPage(){
  const {committeeId}=useParams()
  const navigate=useNavigate()
  const actor=useAuditActor()
  const {role,membership}=useTenant()
  const {notify}=useFeedback()
  const [rows,setRows]=useState(loadCommittees)
  const record=rows.find(x=>x.id===committeeId)
  const [tab,setTab]=useState('overview')
  const [modal,setModal]=useState(null)
  const [removeTarget,setRemoveTarget]=useState(null)
  const canManage=can(role,CAPABILITIES.MANAGE_COMMITTEES,membership?.capabilities??[],membership?.customCapabilities??[])
  const staff=useMemo(()=>loadEmployees().filter(x=>x.employmentStatus==='active').map(x=>({id:x.id,name:`${x.firstName} ${x.lastName}`,department:x.department,profession:x.profession,email:x.email||''})),[])

  if(!record)return <Page title="Επιτροπές"><div className="inline-empty">Η επιτροπή δεν βρέθηκε.</div></Page>

  const template=ipcCommitteeById(record.templateId||'custom')
  const staffById=new Map(staff.map(x=>[x.id,x]))
  const enrichedMemberRefs=(record.memberRefs||[]).map(member=>({...member,email:member.email||staffById.get(member.employeeId)?.email||''}))
  const activeMembers=enrichedMemberRefs.filter(x=>x.active!==false)

  function persist(next){
    const all=rows.map(x=>x.id===record.id?next:x)
    setRows(all)
    saveCommittees(all)
  }
  function syncLegacy(next){
    const active=(next.memberRefs||[]).filter(x=>x.active!==false)
    const chair=active.find(x=>['Πρόεδρος','Συντονιστής'].includes(x.committeeTitle))
    const secretary=active.find(x=>x.committeeTitle==='Γραμματέας'||x.committeeTitle?.includes('Γραμματέας'))
    return {...next,members:active.map(x=>x.name),chair:chair?.name||next.chair||'',chairEmployeeId:chair?.employeeId||next.chairEmployeeId||'',secretary:secretary?.name||next.secretary||'',secretaryEmployeeId:secretary?.employeeId||next.secretaryEmployeeId||''}
  }
  function addMember(data){
    const person=staff.find(x=>x.id===data.employeeId)
    if(!person)return
    const now=new Date().toISOString()
    const member={id:`CM-${Date.now()}`,employeeId:person.id,name:person.name,email:person.email,department:person.department,profession:person.profession,committeeTitle:data.committeeTitle||'Μέλος',responsibilities:data.responsibilities||'',voting:Boolean(data.voting),memberType:data.memberType||'regular',approvalRequired:Boolean(data.approvalRequired),approvalStatus:data.approvalRequired?'pending':'not_required',active:true,startedAt:now,endedAt:null,addedBy:actor.name,addedById:actor.id}
    const next=syncLegacy({...record,memberRefs:[...(record.memberRefs||[]),member],history:[{at:now,actor:actor.name,actorId:actor.id,action:'Προσθήκη μέλους',reason:`${member.name} — ${member.committeeTitle}`},...(record.history||[])]})
    persist(next)
    if(member.approvalRequired)requestCommitteeApproval({committeeId:record.id,committeeName:record.name,employeeId:member.employeeId,memberName:member.name,subject:'Έγκριση συμμετοχής στην επιτροπή',requestedBy:actor.name,requestedById:actor.id,context:{committeeTitle:member.committeeTitle,responsibilities:member.responsibilities}})
    setModal(null)
    notify('Το μέλος προστέθηκε και καταγράφηκε στο ιστορικό.','success')
  }
  function removeMember(reason){
    if(!removeTarget)return
    const now=new Date().toISOString()
    const memberRefs=(record.memberRefs||[]).map(x=>x.id===removeTarget.id?{...x,active:false,endedAt:now,endedBy:actor.name,endedById:actor.id,endReason:reason}:x)
    persist(syncLegacy({...record,memberRefs,history:[{at:now,actor:actor.name,actorId:actor.id,action:'Λήξη συμμετοχής μέλους',reason:`${removeTarget.name} — ${reason}`},...(record.history||[])]}))
    setRemoveTarget(null)
    notify('Η συμμετοχή έληξε. Το μέλος διατηρείται στο ιστορικό.','success')
  }
  function resendApproval(member){
    requestCommitteeApproval({committeeId:record.id,committeeName:record.name,employeeId:member.employeeId,memberName:member.name,subject:'Έγκριση συμμετοχής στην επιτροπή',requestedBy:actor.name,requestedById:actor.id,context:{committeeTitle:member.committeeTitle,responsibilities:member.responsibilities}})
    notify('Δημιουργήθηκε νέο αίτημα έγκρισης συμμετοχής.','success')
  }
  function addMeeting(data){
    const id=`MTG-${Date.now()}`
    const meeting={id,...data,status:'planned',minutesNo:'',attendanceRecords:createAttendance(activeMembers),quorum:null,topics:(data.topics||[]).length?data.topics:[createTopic()],generalNotes:'',approvalState:'not_started'}
    persist({...record,meetings:[meeting,...(record.meetings||[])],history:[{at:new Date().toISOString(),actor:actor.name,actorId:actor.id,action:'Δημιουργία συνεδρίασης',reason:data.title},...(record.history||[])]})
    setModal({type:'meeting',meetingId:id})
    notify('Η συνεδρίαση δημιουργήθηκε. Μπορείτε να συνεχίσετε με παρουσίες και πρακτικά.','success')
  }
  function saveMeeting(draft,{finalize=false}={}){
    const now=new Date().toISOString()
    const voting=draft.attendanceRecords.filter(x=>x.voting)
    const presentVoting=voting.filter(x=>x.status==='present').length
    const required=quorumRequirement(record.quorumRule||'simple_majority',voting.length)
    const quorum=required===null?null:presentVoting>=required
    let updated={...draft,quorum,attendance: draft.attendanceRecords.filter(x=>x.status==='present').length,updatedAt:now,updatedBy:actor.name}
    let nextDecisions=record.decisions||[]
    let historyAction='Ενημέρωση συνεδρίασης'

    if(finalize){
      const present=draft.attendanceRecords.filter(x=>x.status==='present')
      if(!present.length){notify('Καταγράψτε τουλάχιστον ένα παρόν μέλος πριν την ολοκλήρωση.','error');return false}
       if(required!==null&&!quorum){notify('Δεν μπορεί να ολοκληρωθεί η συνεδρίαση χωρίς την απαιτούμενη απαρτία.','error');return false}
      const incompleteTopic=(draft.topics||[]).some(x=>x.subject.trim()&&!x.decision.trim())
      if(incompleteTopic){notify('Κάθε καταγεγραμμένο θέμα πρέπει να έχει απόφαση / συμπέρασμα.','error');return false}
      const {requests,queued}=requestMinutesApprovals({committee:record,meeting:updated,presentMembers:present,requestedBy:actor.name,requestedById:actor.id})
      updated={...updated,status:requests.length?'approval_pending':'finalized',approvalState:requests.length?'pending':'not_required',approvalRequestedAt:now,approvalRecipients:requests.map(x=>x.id),finalizedAt:requests.length?null:now,finalizedBy:requests.length?null:actor.name}
      const generated=(updated.topics||[]).filter(x=>x.followUp&&x.action.trim()).filter(topic=>!nextDecisions.some(d=>d.meetingId===updated.id&&d.topicId===topic.id)).map(topic=>({id:`DEC-${Date.now()}-${topic.id}`,meetingId:updated.id,topicId:topic.id,title:topic.subject,action:topic.action,owner:topic.owner,dueDate:topic.dueDate,priority:topic.priority||'medium',status:'open'}))
      nextDecisions=[...generated,...nextDecisions]
      historyAction='Ολοκλήρωση συνεδρίασης και αίτημα έγκρισης πρακτικών'
      notify(requests.length?`Δημιουργήθηκαν ${requests.length} αιτήματα έγκρισης για τα παρόντα μέλη${queued.length?` και ${queued.length} email μπήκαν στο outbox`:''}.`:'Η συνεδρίαση οριστικοποιήθηκε.','success')
    }else{
      notify('Οι αλλαγές της συνεδρίασης αποθηκεύτηκαν.','success')
    }

    const meetings=(record.meetings||[]).map(x=>x.id===updated.id?updated:x)
    persist({...record,meetings,decisions:nextDecisions,history:[{at:now,actor:actor.name,actorId:actor.id,action:historyAction,reason:updated.title},...(record.history||[])]})
    if(finalize)setModal(null)
    return true
  }
  function addDecision(data){
    const id=`DEC-${Date.now()}`
    persist({...record,decisions:[{id,...data,status:'open'},...(record.decisions||[])],history:[{at:new Date().toISOString(),actor:actor.name,actorId:actor.id,action:'Καταχώρηση απόφασης',reason:data.title},...(record.history||[])]})
    setModal(null)
    notify('Η απόφαση καταχωρήθηκε.','success')
  }
  function editDecision(data){
    const now=new Date().toISOString()
    persist({...record,decisions:(record.decisions||[]).map(x=>x.id===data.id?{...x,...data,updatedAt:now,updatedBy:actor.name,updatedById:actor.id}:x),history:[{at:now,actor:actor.name,actorId:actor.id,action:'Επεξεργασία απόφασης / ενέργειας',reason:data.title},...(record.history||[])]})
    setModal(null)
    notify('Η απόφαση ενημερώθηκε.','success')
  }
  function updateDecision(id,status){
    const item=record.decisions.find(x=>x.id===id)
    persist({...record,decisions:record.decisions.map(x=>x.id===id?{...x,status,updatedAt:new Date().toISOString(),updatedBy:actor.name}:x),history:[{at:new Date().toISOString(),actor:actor.name,actorId:actor.id,action:'Ενημέρωση κατάστασης απόφασης',reason:`${item?.title||id} → ${status==='completed'?'Ολοκληρωμένη':status==='in_progress'?'Σε εξέλιξη':'Ανοιχτή'}`},...(record.history||[])]})
    notify('Η κατάσταση της ενέργειας ενημερώθηκε.','success')
  }
  function addObjective(data){
    const id=`OBJ-${Date.now()}`
    persist({...record,annualPlan:[...(record.annualPlan||[]),{id,...data,status:'open'}],history:[{at:new Date().toISOString(),actor:actor.name,actorId:actor.id,action:'Προσθήκη στόχου ετήσιου σχεδίου',reason:data.title},...(record.history||[])]})
    setModal(null)
    notify('Ο στόχος προστέθηκε στο ετήσιο σχέδιο δράσης.','success')
  }
  function editObjective(data){
    const now=new Date().toISOString()
    persist({...record,annualPlan:(record.annualPlan||[]).map(x=>x.id===data.id?{...x,...data,updatedAt:now,updatedBy:actor.name,updatedById:actor.id}:x),history:[{at:now,actor:actor.name,actorId:actor.id,action:'Επεξεργασία στόχου ετήσιου σχεδίου',reason:data.title},...(record.history||[])]})
    setModal(null)
    notify('Ο στόχος ενημερώθηκε.','success')
  }
  function updateObjective(id,status){
    const item=record.annualPlan.find(x=>x.id===id)
    persist({...record,annualPlan:record.annualPlan.map(x=>x.id===id?{...x,status,updatedAt:new Date().toISOString(),updatedBy:actor.name}:x),history:[{at:new Date().toISOString(),actor:actor.name,actorId:actor.id,action:'Ενημέρωση στόχου ετήσιου σχεδίου',reason:`${item?.title||id} → ${status==='completed'?'Ολοκληρώθηκε':status==='in_progress'?'Σε εξέλιξη':'Ανοιχτός'}`},...(record.history||[])]})
    notify('Ο στόχος ενημερώθηκε.','success')
  }

  const tabs=[{id:'overview',label:'Σύνοψη',icon:CheckCircle2},{id:'members',label:'Μέλη',icon:Users},{id:'plan',label:'Ετήσιο σχέδιο',icon:Target},{id:'meetings',label:'Συνεδριάσεις',icon:CalendarDays},{id:'decisions',label:'Αποφάσεις & ενέργειες',icon:ClipboardList},{id:'guidance',label:'Ρόλος & πλαίσιο',icon:ShieldCheck},{id:'documents',label:'Έγγραφα',icon:Paperclip},{id:'history',label:'Ιστορικό',icon:FileClock}]
  const selectedMeeting=modal?.type==='meeting'?(record.meetings||[]).find(x=>x.id===modal.meetingId):null

  return <Page fill>
    <EntityRecordShell avatar={<Users size={19}/>} eyebrow={record.id} title={record.name} subtitle={`${record.shortName||''}${record.chair?` · ${record.chair}`:''}`} status={<span className={`status-badge ${record.status==='active'?'active':''}`}>{record.status==='active'?'Ενεργή':'Ανενεργή'}</span>} onBack={()=>navigate('/committees')} headerActions={<PrintExportActions onExport={()=>downloadRecordJson(record,{filename:record.id})}/>} tabs={tabs} activeTab={tab} onTabChange={setTab}>
      {tab==='overview'&&<Overview r={record} activeMembers={activeMembers}/>} 
      {tab==='members'&&<section className="record-section"><SectionHead title="Μέλη επιτροπής" subtitle="Η σύνθεση είναι ιστορική: λήξη συμμετοχής αντί για διαγραφή, με χρόνο και αιτιολογία." action={canManage&&<Button onClick={()=>setModal({type:'member'})}><Plus size={15}/> Προσθήκη μέλους</Button>}/><MembersTable rows={enrichedMemberRefs} canManage={canManage} onRemove={setRemoveTarget} onResend={resendApproval} committeeId={record.id}/></section>}
      {tab==='plan'&&<AnnualPlan rows={record.annualPlan||[]} canManage={canManage} onAdd={()=>setModal({type:'objective'})} onEdit={objective=>setModal({type:'objective',objective})} onStatus={updateObjective}/>} 
      {tab==='meetings'&&<section className="record-section"><SectionHead title="Συνεδριάσεις & πρακτικά" subtitle="Καταγραφή συνεδρίασης, πραγματικών παρουσιών, θεμάτων, αποφάσεων και έγκρισης πρακτικών." action={canManage&&<Button onClick={()=>setModal({type:'newMeeting'})}><Plus size={15}/> Νέα συνεδρίαση</Button>}/><Meetings rows={record.meetings||[]} committeeId={record.id} onOpen={meeting=>setModal({type:'meeting',meetingId:meeting.id})}/></section>}
      {tab==='decisions'&&<section className="record-section"><SectionHead title="Αποφάσεις & παρακολούθηση ενεργειών" subtitle="Κάθε απόφαση αποκτά υπεύθυνο, προθεσμία και κατάσταση μέχρι να κλείσει." action={canManage&&<Button onClick={()=>setModal({type:'decision'})}><Plus size={15}/> Νέα απόφαση</Button>}/><Decisions rows={record.decisions||[]} canManage={canManage} onEdit={decision=>setModal({type:'decision',decision})} onStatus={updateDecision}/></section>}
      {tab==='guidance'&&<Guidance record={record} template={template}/>} 
      {tab==='documents'&&<section className="record-section"><SectionHead title="Έγγραφα & τεκμήρια" subtitle="Αποφάσεις συγκρότησης, πρακτικά και αποδεικτικά εφαρμογής."/><AttachmentField disabled={!canManage} value={record.documents||[]} onChange={documents=>{const now=new Date().toISOString();persist({...record,documents,updatedAt:now,updatedBy:actor.name,updatedById:actor.id,history:[{at:now,actor:actor.name,actorId:actor.id,action:'Ενημέρωση εγγράφων επιτροπής',reason:`${documents.length} συνημμένα`},...(record.history||[])]});notify('Τα έγγραφα της επιτροπής ενημερώθηκαν.','success')}}/></section>}
      {tab==='history'&&<CommitteeHistory rows={record.history||[]}/>} 
    </EntityRecordShell>

    {modal?.type==='member'&&<MemberDialog staff={staff} roles={template.requiredFunctions||[]} onClose={()=>setModal(null)} onSave={addMember}/>} 
    {modal?.type==='newMeeting'&&<NewMeetingDialog onClose={()=>setModal(null)} onSave={addMeeting}/>} 
    {selectedMeeting&&<MeetingDialog committee={record} meeting={selectedMeeting} activeMembers={activeMembers} canManage={canManage} onClose={()=>setModal(null)} onSave={saveMeeting}/>} 
    {modal?.type==='decision'&&<DecisionDialog initial={modal.decision||null} members={activeMembers} meetings={record.meetings||[]} onClose={()=>setModal(null)} onSave={modal.decision?editDecision:addDecision}/>} 
    {modal?.type==='objective'&&<ObjectiveDialog initial={modal.objective||null} members={activeMembers} onClose={()=>setModal(null)} onSave={modal.objective?editObjective:addObjective}/>} 
    <GovernedReasonDialog open={Boolean(removeTarget)} title="Λήξη συμμετοχής μέλους" description="Το μέλος δεν θα διαγραφεί. Η συμμετοχή θα κλείσει με χρόνο, χρήστη και αιτιολογία ώστε να διατηρείται πλήρης ιστορικότητα." confirmLabel="Λήξη συμμετοχής" danger onCancel={()=>setRemoveTarget(null)} onConfirm={removeMember}/>
  </Page>
}

function Overview({r,activeMembers}){
 const meetings=r.meetings||[],decisions=r.decisions||[],plan=r.annualPlan||[]
 const openActions=decisions.filter(x=>x.status!=='completed')
 const overdue=openActions.filter(isOverdue)
 const completedPlan=plan.filter(x=>x.status==='completed').length
 const nextMeeting=[...meetings].filter(x=>x.date>=todayIso()&&x.status!=='finalized').sort((a,b)=>a.date.localeCompare(b.date))[0]
 return <section className="record-section"><div className="module-summary-strip">
   <SharedKpi icon={Users} label="Ενεργά μέλη" value={activeMembers.length}/>
   <SharedKpi icon={CalendarDays} label="Συνεδριάσεις" value={meetings.length}/>
   <SharedKpi icon={ClipboardList} label="Ανοιχτές ενέργειες" value={openActions.length}/>
   <SharedKpi icon={Target} label="Στόχοι σχεδίου" value={`${completedPlan}/${plan.length}`}/>
  </div>
  <div className="record-section-header"><div><span className="eyebrow">Επιτροπές</span><h3>Βασικά στοιχεία</h3></div></div>
  <div className="details-grid"><div><span>Πρόεδρος / Συντονιστής</span><strong>{r.chair||'—'}</strong></div><div><span>Γραμματέας</span><strong>{r.secretary||'—'}</strong></div><div><span>Θητεία</span><strong>{fmtDate(r.termStart)} → {fmtDate(r.termEnd)}</strong></div><div><span>Επόμενη συνεδρίαση</span><strong>{nextMeeting?`${fmtDate(nextMeeting.date)} · ${nextMeeting.title}`:'Δεν έχει προγραμματιστεί'}</strong></div><div><span>Εκπρόθεσμες ενέργειες</span><strong>{overdue.length||'Καμία'}</strong></div><div><span>Αρ. πράξης σύστασης</span><strong>{r.decisionNumber||'—'}</strong></div></div>
  <ExpandableTextBlock label="Ρόλος επιτροπής" value={r.committeeRole}/>
  <ExpandableTextBlock label="Αρμοδιότητα / σκοπός" value={r.mandate}/>
 </section>
}
function SharedKpi({icon:Icon,label,value}){return <div className="module-summary-metric"><Icon size={15}/><div><strong>{value}</strong><span>{label}</span></div></div>}
function SectionHead({title,subtitle,action}){return <div className="record-section-header"><div><span className="eyebrow">Επιτροπές</span><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}

function AnnualPlan({rows,canManage,onAdd,onEdit,onStatus}){
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all')
 const filtered=rows.filter(x=>(status==='all'||x.status===status)&&`${x.title} ${x.indicator} ${x.owner}`.toLowerCase().includes(query.toLowerCase()))
 const complete=rows.filter(x=>x.status==='completed').length,overdue=rows.filter(isOverdue).length
 return <section className="record-section"><SectionHead title="Ετήσιο σχέδιο δράσης" subtitle="Μετρήσιμοι στόχοι, δείκτες, υπεύθυνοι και προθεσμίες σε μία κοινή λίστα." action={canManage&&<Button onClick={onAdd}><Plus size={15}/> Νέος στόχος</Button>}/>
  <div className="module-summary-strip"><SharedKpi icon={Target} label="Σύνολο στόχων" value={rows.length}/><SharedKpi icon={CheckCircle2} label="Ολοκληρωμένοι" value={complete}/><SharedKpi icon={AlertTriangle} label="Εκπρόθεσμοι" value={overdue}/></div>
  <FilterBar query={query} onQueryChange={setQuery} placeholder="Αναζήτηση στόχου, δείκτη ή υπευθύνου..." activeAdvancedCount={status!=='all'?1:0} onClear={()=>{setQuery('');setStatus('all')}}><FilterSelect label="Κατάσταση" value={status} onChange={setStatus}><option value="all">Όλες</option><option value="open">Ανοιχτοί</option><option value="in_progress">Σε εξέλιξη</option><option value="completed">Ολοκληρωμένοι</option></FilterSelect></FilterBar>
  <div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>Στόχος / δράση</th><th>Δείκτης</th><th>Βάση → στόχος</th><th>Υπεύθυνος</th><th>Προθεσμία</th><th>Κατάσταση</th>{canManage&&<th></th>}</tr></thead><tbody>{filtered.map(x=><tr key={x.id} className={isOverdue(x)?'committee-row-overdue':''}><td><strong>{x.title}</strong></td><td>{x.indicator||'—'}</td><td>{x.baseline||'—'} → <strong>{x.target||'—'}</strong></td><td>{x.owner||'—'}</td><td>{fmtDate(x.dueDate)}{isOverdue(x)&&<small className="committee-overdue-label">Εκπρόθεσμο</small>}</td><td>{canManage?<StatusSelect value={x.status} onChange={v=>onStatus(x.id,v)} type="objective"/>:<StatusBadge value={x.status}/>}</td>{canManage&&<td><div className="record-inline-actions"><button onClick={()=>onEdit(x)} title="Επεξεργασία στόχου" aria-label="Επεξεργασία στόχου"><Pencil size={15}/></button></div></td>}</tr>)}</tbody></table>{filtered.length===0&&<div className="inline-empty">Δεν βρέθηκαν στόχοι με τα επιλεγμένα φίλτρα.</div>}</div>
 </section>
}

function Guidance({record,template}){return <section className="record-section"><SectionHead title="Ρόλος & θεσμικό πλαίσιο" subtitle="Η θεσμική βάση παραμένει ξεχωριστή από τις τοπικές αρμοδιότητες και μπορεί να ενημερώνεται ελεγχόμενα."/><div className="details-grid"><div><span>Κατηγορία</span><strong>{template.code||record.shortName||'Τοπική επιτροπή'}</strong></div><div><span>Θεσμική / κατευθυντήρια βάση</span><strong>{record.legalBasis||template.source||'Δεν έχει οριστεί'}</strong></div><div><span>Σχέση / πλαίσιο</span><strong>{template.relation||'Τοπικό πλαίσιο λειτουργίας'}</strong></div><div><span>Πρότυπο</span><strong>{template.core?'Βασική δομή IPC':'Τοπική / υποστηρικτική δομή'}</strong></div></div><ExpandableTextBlock label="Ρόλος" value={record.committeeRole||template.role}/>{template.roleGuidance?.length>0&&<div className="source-truth-note">{template.roleGuidance.map((g,i)=><div key={i}><strong>{g.label}</strong><span>{g.roles.join(' · ')}</span></div>)}</div>}</section>}

function MembersTable({rows,canManage,onRemove,onResend,committeeId}){
  return <div className="scroll-table"><table className="data-table committee-members-table"><thead><tr><th>Μέλος</th><th>Ιδιότητα</th><th>Αρμοδιότητες</th><th>Ψήφος</th><th>Έγκριση</th><th>Περίοδος</th>{canManage&&<th></th>}</tr></thead><tbody>{rows.map(m=>{const approval=m.employeeId?approvalStatusFor(committeeId,m.employeeId)||m.approvalStatus:m.approvalStatus;return <tr key={m.id} className={m.active===false?'committee-member-inactive':''}><td><strong>{m.name}</strong><small>{[m.profession,m.department].filter(Boolean).join(' · ')||'—'}</small></td><td>{m.committeeTitle||'Μέλος'}{m.memberType==='alternate'&&<small>Αναπληρωματικό</small>}</td><td className="committee-responsibilities">{m.responsibilities||'—'}</td><td>{m.voting?'Ναι':'Όχι'}</td><td><span className={`status-badge ${approval==='approved'?'active':''}`}>{approval==='approved'?'Εγκρίθηκε':approval==='rejected'?'Απορρίφθηκε':approval==='pending'?'Αναμένει':'Δεν απαιτείται'}</span></td><td>{m.startedAt?fmtDate(m.startedAt):'—'}{m.endedAt?` → ${fmtDate(m.endedAt)}`:' → σήμερα'}</td>{canManage&&<td><div className="record-inline-actions">{m.active!==false&&m.employeeId&&m.approvalRequired&&approval!=='approved'&&<button title="Νέο αίτημα έγκρισης" aria-label="Νέο αίτημα έγκρισης" onClick={()=>onResend(m)}><FileSignature size={15}/></button>}{m.active!==false&&<button className="danger" title="Λήξη συμμετοχής" aria-label="Λήξη συμμετοχής" onClick={()=>onRemove(m)}><Trash2 size={15}/></button>}</div></td>}</tr>})}</tbody></table></div>
}

function Meetings({rows,committeeId,onOpen}){
  return <div className="scroll-table"><table className="data-table record-table-clickable"><thead><tr><th>Ημερομηνία</th><th>Συνεδρίαση</th><th>Αρ. πρακτικού</th><th>Απαρτία</th><th>Έγκριση</th><th>Κατάσταση</th></tr></thead><tbody>{rows.map(x=>{const approval=minutesApprovalSummary(committeeId,x.id);return <tr key={x.id} tabIndex={0} onClick={()=>onOpen(x)} onKeyDown={e=>e.key==='Enter'&&onOpen(x)}><td>{fmtDate(x.date)}{x.time&&<small>{x.time}</small>}</td><td><strong>{x.title}</strong><small>{x.meetingType==='extraordinary'?'Έκτακτη':'Τακτική'} · {x.topics?.filter(t=>t.subject).length||x.agenda?.length||0} θέματα{x.location?` · ${x.location}`:''}</small></td><td>{x.minutesNo||'—'}</td><td>{x.quorum===true?'Ναι':x.quorum===false?'Όχι':'—'}</td><td>{approval.total?<span className={`status-badge ${approval.pending===0&&approval.changes===0?'active':''}`}>{approval.approved}/{approval.total}{approval.pending?` · ${approval.pending} αναμένουν`:''}{approval.changes?` · ${approval.changes} αλλαγές`:''}</span>:'—'}</td><td><span className={`status-badge ${x.status==='finalized'?'active':''}`}>{meetingStatusLabel(x.status)}</span></td></tr>})}</tbody></table>{rows.length===0&&<div className="inline-empty">Δεν υπάρχουν ακόμη συνεδριάσεις.</div>}</div>
}

function Decisions({rows,canManage,onEdit,onStatus}){
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all')
 const filtered=rows.filter(x=>(status==='all'||x.status===status)&&`${x.title} ${x.action} ${x.owner}`.toLowerCase().includes(query.toLowerCase()))
 const open=rows.filter(x=>x.status==='open').length,inProgress=rows.filter(x=>x.status==='in_progress').length,overdue=rows.filter(isOverdue).length
 return <div className="workspace-column workspace-fill">
  <div className="module-summary-strip"><SharedKpi icon={ClipboardList} label="Ανοιχτές" value={open}/><SharedKpi icon={Target} label="Σε εξέλιξη" value={inProgress}/><SharedKpi icon={AlertTriangle} label="Εκπρόθεσμες" value={overdue}/></div>
  <FilterBar query={query} onQueryChange={setQuery} placeholder="Αναζήτηση απόφασης, ενέργειας ή υπευθύνου..." activeAdvancedCount={status!=='all'?1:0} onClear={()=>{setQuery('');setStatus('all')}}><FilterSelect label="Κατάσταση" value={status} onChange={setStatus}><option value="all">Όλες</option><option value="open">Ανοιχτές</option><option value="in_progress">Σε εξέλιξη</option><option value="completed">Ολοκληρωμένες</option></FilterSelect></FilterBar>
  <div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>Απόφαση</th><th>Υπεύθυνος</th><th>Προθεσμία</th><th>Προτεραιότητα</th><th>Κατάσταση</th>{canManage&&<th></th>}</tr></thead><tbody>{filtered.map(x=><tr key={x.id} className={isOverdue(x)?'committee-row-overdue':''}><td><strong>{x.title}</strong><small>{x.action}</small></td><td>{x.owner||'—'}</td><td>{fmtDate(x.dueDate)}{isOverdue(x)&&<small className="committee-overdue-label">Εκπρόθεσμο</small>}</td><td>{x.priority==='high'?'Υψηλή':x.priority==='medium'?'Μέση':'Κανονική'}</td><td>{canManage?<StatusSelect value={x.status} onChange={v=>onStatus(x.id,v)}/>:<StatusBadge value={x.status}/>}</td>{canManage&&<td><div className="record-inline-actions"><button onClick={()=>onEdit(x)} title="Επεξεργασία απόφασης" aria-label="Επεξεργασία απόφασης"><Pencil size={15}/></button></div></td>}</tr>)}</tbody></table>{filtered.length===0&&<div className="inline-empty">Δεν βρέθηκαν αποφάσεις με τα επιλεγμένα φίλτρα.</div>}</div>
 </div>
}
function StatusSelect({value,onChange,type}){return <select className="committee-status-select" value={value||'open'} onChange={e=>onChange(e.target.value)} aria-label="Κατάσταση"><option value="open">{type==='objective'?'Ανοιχτός':'Ανοιχτή'}</option><option value="in_progress">Σε εξέλιξη</option><option value="completed">{type==='objective'?'Ολοκληρώθηκε':'Ολοκληρωμένη'}</option></select>}
function StatusBadge({value}){return <span className={`status-badge ${value==='completed'?'active':''}`}>{value==='in_progress'?'Σε εξέλιξη':value==='completed'?'Ολοκληρωμένη':'Ανοιχτή'}</span>}

function CommitteeHistory({rows}){
 const [query,setQuery]=useState(''),[kind,setKind]=useState('all')
 const kinds=[...new Set(rows.map(x=>x.action).filter(Boolean))]
 const filtered=rows.filter(x=>(kind==='all'||x.action===kind)&&`${x.action} ${x.actor} ${x.reason||''}`.toLowerCase().includes(query.toLowerCase()))
 return <section className="record-section"><SectionHead title="Ιστορικό μεταβολών" subtitle="Χρονολογική εικόνα διοικητικών και λειτουργικών αλλαγών με χρήστη, χρόνο και αιτιολογία."/>
  <FilterBar query={query} onQueryChange={setQuery} placeholder="Αναζήτηση ενέργειας, χρήστη ή αιτιολογίας..." activeAdvancedCount={kind!=='all'?1:0} onClear={()=>{setQuery('');setKind('all')}}><FilterSelect label="Ενέργεια" value={kind} onChange={setKind}><option value="all">Όλες</option>{kinds.map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect></FilterBar>
  <div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>Ημερομηνία / ώρα</th><th>Ενέργεια</th><th>Χρήστης</th><th>Αιτιολογία / στοιχεία</th></tr></thead><tbody>{filtered.map((h,i)=><tr key={`${h.at}-${i}`}><td>{h.at?new Date(h.at).toLocaleString('el-GR'):'—'}</td><td><strong>{h.action||'—'}</strong></td><td>{h.actor||'—'}</td><td>{h.reason||'—'}</td></tr>)}</tbody></table>{filtered.length===0&&<div className="inline-empty">Δεν βρέθηκαν μεταβολές με τα επιλεγμένα φίλτρα.</div>}</div>
 </section>
}

function MemberDialog({staff,roles,onClose,onSave}){
  const [d,setD]=useState({employeeId:'',committeeTitle:'',responsibilities:'',voting:true,memberType:'regular',approvalRequired:false})
  const valid=d.employeeId&&d.committeeTitle.trim()&&d.responsibilities.trim()
  return <ObserverDialog eyebrow="Μέλη επιτροπής" title="Προσθήκη μέλους" subtitle="Ορίστε την ιδιότητα και τις πραγματικές αρμοδιότητες του μέλους μέσα στην επιτροπή." onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={()=>onSave(d)} disabled={!valid}/> }>
    <div className="entry-grid">
      <label><span>Εργαζόμενος *</span><select value={d.employeeId} onChange={e=>setD({...d,employeeId:e.target.value})}><option value="">Επιλογή εργαζομένου</option>{staff.map(x=><option key={x.id} value={x.id}>{x.name} · {x.department}</option>)}</select></label>
      <label><span>Ιδιότητα στην επιτροπή *</span><input list="committee-member-role-list" value={d.committeeTitle} onChange={e=>setD({...d,committeeTitle:e.target.value})} placeholder="π.χ. Πρόεδρος, Γραμματέας, Μέλος"/><datalist id="committee-member-role-list">{[...new Set(['Πρόεδρος','Αντιπρόεδρος','Συντονιστής','Γραμματέας','Μέλος','Αναπληρωματικό μέλος',...roles])].map(x=><option key={x} value={x}/>)}</datalist></label>
      <label><span>Συμμετοχή</span><select value={d.memberType} onChange={e=>setD({...d,memberType:e.target.value})}><option value="regular">Τακτικό μέλος</option><option value="alternate">Αναπληρωματικό μέλος</option></select></label>
      <div className="observer-check-grid"><label className="observer-check"><input type="checkbox" checked={d.voting} onChange={e=>setD({...d,voting:e.target.checked})}/><span>Δικαίωμα ψήφου</span></label><label className="observer-check"><input type="checkbox" checked={d.approvalRequired} onChange={e=>setD({...d,approvalRequired:e.target.checked})}/><span>Ηλεκτρονική αποδοχή συμμετοχής</span></label></div>
      <label className="entry-span-2"><span>Αρμοδιότητες / τι κάνει *</span><textarea rows="4" value={d.responsibilities} onChange={e=>setD({...d,responsibilities:e.target.value})} placeholder="Καταγράψτε συνοπτικά τις πραγματικές αρμοδιότητες του μέλους..."/></label>
    </div>
  </ObserverDialog>
}

function NewMeetingDialog({onClose,onSave}){
  const [d,setD]=useState({title:'',meetingType:'regular',date:'',time:'',location:'',topics:[createTopic()]})
  const valid=d.title.trim()&&d.date
  return <ObserverDialog eyebrow="Συνεδριάσεις" title="Νέα συνεδρίαση" subtitle="Καταχωρίστε τα βασικά στοιχεία. Οι παρουσίες και τα πρακτικά συμπληρώνονται στη συνέχεια στην ίδια καρτέλα." onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={()=>onSave(d)} saveLabel="Δημιουργία & συνέχεια" disabled={!valid}/> }>
    <div className="entry-grid">
      <label><span>Τίτλος *</span><input value={d.title} onChange={e=>setD({...d,title:e.target.value})} placeholder="π.χ. Τακτική συνεδρίαση Σεπτεμβρίου"/></label>
      <label><span>Τύπος συνεδρίασης</span><select value={d.meetingType} onChange={e=>setD({...d,meetingType:e.target.value})}><option value="regular">Τακτική</option><option value="extraordinary">Έκτακτη</option></select></label>
      <ManualDateField label="Ημερομηνία *" value={d.date} onChange={v=>setD({...d,date:v})}/>
      <TimeField label="Ώρα" value={d.time} onChange={v=>setD({...d,time:v})}/>
      <label className="entry-span-2"><span>Χώρος / τρόπος συνεδρίασης</span><input value={d.location} onChange={e=>setD({...d,location:e.target.value})} placeholder="π.χ. Αίθουσα ΔΣ / τηλεδιάσκεψη"/></label>
    </div>
  </ObserverDialog>
}

function MeetingDialog({committee,meeting,activeMembers,canManage,onClose,onSave}){
  const {confirm}=useFeedback()
  const [d,setD]=useState(()=>({...meeting,attendanceRecords:createAttendance(activeMembers,meeting.attendanceRecords||[]),topics:(meeting.topics&&meeting.topics.length?meeting.topics:(meeting.agenda||[]).map((subject,i)=>({id:`LEG-${meeting.id}-${i}`,subject,decision:i===0&&meeting.notes?meeting.notes:'',followUp:false,action:'',owner:'',dueDate:'',priority:'medium'}))).length? (meeting.topics&&meeting.topics.length?meeting.topics:(meeting.agenda||[]).map((subject,i)=>({id:`LEG-${meeting.id}-${i}`,subject,decision:i===0&&meeting.notes?meeting.notes:'',followUp:false,action:'',owner:'',dueDate:'',priority:'medium'}))) : [createTopic()]}))
  const locked=d.status==='finalized'||d.status==='approval_pending'
  const voting=d.attendanceRecords.filter(x=>x.voting)
  const presentVoting=voting.filter(x=>x.status==='present').length
  const present=d.attendanceRecords.filter(x=>x.status==='present')
  const required=quorumRequirement(committee.quorumRule||'simple_majority',voting.length)
  const quorum=required===null?null:presentVoting>=required
  const approvals=minutesApprovalSummary(committee.id,d.id)
  const set=(k,v)=>setD(x=>({...x,[k]:v}))
  const patchAttendance=(memberId,status)=>setD(x=>({...x,attendanceRecords:x.attendanceRecords.map(a=>a.memberId===memberId?{...a,status}:a)}))
  const patchTopic=(id,k,v)=>setD(x=>({...x,topics:x.topics.map(topic=>topic.id===id?{...topic,[k]:v}:topic)}))
  const addTopic=()=>setD(x=>({...x,topics:[...x.topics,createTopic()]}))
  const removeTopic=async id=>{const ok=await confirm({title:'Αφαίρεση θέματος',message:'Το θέμα και τα μη αποθηκευμένα στοιχεία του θα αφαιρεθούν από τη συνεδρίαση. Θέλετε να συνεχίσετε;',confirmLabel:'Αφαίρεση',danger:true});if(!ok)return;setD(x=>({...x,topics:x.topics.length===1?[createTopic()]:x.topics.filter(topic=>topic.id!==id)}))}
  return <ObserverDialog eyebrow="Συνεδρίαση & πρακτικά" title={d.title} subtitle="Μία ενιαία ροή: στοιχεία, παρουσίες, θέματα και αποφάσεις. Η έγκριση αποστέλλεται μόνο στα μέλη που καταγράφονται ως παρόντα." onClose={onClose} width="wide" className="committee-meeting-dialog" footer={canManage&&!locked?<><Button variant="secondary" onClick={onClose}>Ακύρωση</Button><Button variant="secondary" onClick={()=>onSave(d)}>Αποθήκευση</Button><Button onClick={()=>onSave(d,{finalize:true})} disabled={!present.length}>Ολοκλήρωση & αποστολή έγκρισης</Button></>:<Button variant="secondary" onClick={onClose}>Κλείσιμο</Button>}>
    <div className="observer-form-section">
      <div className="observer-form-section-title"><div><strong>Στοιχεία συνεδρίασης</strong><span>Βασικά στοιχεία και αριθμός πρακτικού.</span></div></div>
      <div className="entry-grid compact">
        <label><span>Τίτλος *</span><input disabled={locked} value={d.title} onChange={e=>set('title',e.target.value)}/></label>
        <label><span>Τύπος συνεδρίασης</span><select disabled={locked} value={d.meetingType||'regular'} onChange={e=>set('meetingType',e.target.value)}><option value="regular">Τακτική</option><option value="extraordinary">Έκτακτη</option></select></label>
        <label><span>Αριθμός πρακτικού</span><input disabled={locked} value={d.minutesNo||''} onChange={e=>set('minutesNo',e.target.value)} placeholder="π.χ. 05/2026"/></label>
        <ManualDateField label="Ημερομηνία *" value={d.date} disabled={locked} onChange={v=>set('date',v)}/>
        <TimeField label="Ώρα" disabled={locked} value={d.time||''} onChange={v=>set('time',v)}/>
        <label className="entry-span-2"><span>Χώρος / τρόπος συνεδρίασης</span><input disabled={locked} value={d.location||''} onChange={e=>set('location',e.target.value)}/></label>
      </div>
    </div>

    <div className="observer-form-section">
      <div className="observer-form-section-title"><div><strong>Παρουσίες & απαρτία</strong><span>{present.length} παρόντες · {presentVoting}/{voting.length} με δικαίωμα ψήφου</span></div><span className={`status-badge ${quorum===true?'active':quorum===false?'danger':''}`}>{required===null?'Απαρτία: σύμφωνα με κανονισμό':`Απαρτία: ${quorum?'Ναι':'Όχι'} · απαιτούνται ${required}`}</span></div>
      <div className="committee-attendance-list">{d.attendanceRecords.map(item=><div className="committee-attendance-row" key={item.memberId}><div><strong>{item.name}</strong><span>{item.voting?'Με δικαίωμα ψήφου':'Χωρίς δικαίωμα ψήφου'}{item.email?` · ${item.email}`:''}</span></div><select disabled={locked} value={item.status} onChange={e=>patchAttendance(item.memberId,e.target.value)} aria-label={`Παρουσία ${item.name}`}><option value="not_recorded">Δεν καταγράφηκε</option><option value="present">Παρών / Παρούσα</option><option value="absent">Απών / Απούσα</option><option value="excused">Δικαιολογημένη απουσία</option></select></div>)}</div>
    </div>

    <div className="observer-form-section">
      <div className="observer-form-section-title"><div><strong>Θέματα συζήτησης & αποφάσεις</strong><span>Ένα θέμα ανά γραμμή. Η ενέργεια follow-up είναι προαιρετική και περνά αυτόματα στην παρακολούθηση ενεργειών.</span></div>{!locked&&<Button onClick={addTopic}><Plus size={15}/> Προσθήκη θέματος</Button>}</div>
      <div className="committee-topic-list">{d.topics.map((topic,index)=><article className="committee-topic-card" key={topic.id}><header><strong>{String(index+1).padStart(2,'0')}</strong><span>Θέμα συνεδρίασης</span>{!locked&&<button type="button" className="entity-record-icon-button danger compact" onClick={()=>removeTopic(topic.id)} title="Αφαίρεση θέματος" aria-label="Αφαίρεση θέματος"><Trash2 size={14}/></button>}</header><div className="entry-grid compact"><label className="entry-span-2"><span>Θέμα συζήτησης *</span><input disabled={locked} value={topic.subject} onChange={e=>patchTopic(topic.id,'subject',e.target.value)} placeholder="π.χ. Δείκτες λοιμώξεων ΜΕΘ"/></label><label className="entry-span-2"><span>Απόφαση / συμπέρασμα *</span><textarea disabled={locked} rows="3" value={topic.decision} onChange={e=>patchTopic(topic.id,'decision',e.target.value)} placeholder="Τι αποφασίστηκε για το συγκεκριμένο θέμα;"/></label></div>{!locked&&<label className="observer-check topic-followup"><input type="checkbox" checked={topic.followUp} onChange={e=>patchTopic(topic.id,'followUp',e.target.checked)}/><span>Δημιουργία ενέργειας follow-up</span></label>}{topic.followUp&&<div className="entry-grid compact topic-followup-fields"><label className="entry-span-2"><span>Ενέργεια / παραδοτέο</span><textarea disabled={locked} rows="2" value={topic.action} onChange={e=>patchTopic(topic.id,'action',e.target.value)}/></label><label><span>Υπεύθυνος</span><input disabled={locked} list={`owners-${topic.id}`} value={topic.owner} onChange={e=>patchTopic(topic.id,'owner',e.target.value)}/><datalist id={`owners-${topic.id}`}>{activeMembers.map(x=><option key={x.id} value={x.name}/>)}</datalist></label><ManualDateField label="Προθεσμία" value={topic.dueDate} disabled={locked} onChange={v=>patchTopic(topic.id,'dueDate',v)}/><label><span>Προτεραιότητα</span><select disabled={locked} value={topic.priority||'medium'} onChange={e=>patchTopic(topic.id,'priority',e.target.value)}><option value="low">Κανονική</option><option value="medium">Μέση</option><option value="high">Υψηλή</option></select></label></div>}</article>)}</div>
      <label className="observer-notes-field"><span>Γενικές σημειώσεις συνεδρίασης</span><textarea disabled={locked} rows="3" value={d.generalNotes||''} onChange={e=>set('generalNotes',e.target.value)} placeholder="Προαιρετικές σημειώσεις που δεν αντιστοιχούν σε συγκεκριμένο θέμα..."/></label>
    </div>

    <div className="observer-form-section approval-summary-section">
      <div className="observer-form-section-title"><div><strong>Έγκριση πρακτικών</strong><span>Κατά την ολοκλήρωση δημιουργείται συνοπτικό αίτημα μόνο για τους παρόντες.</span></div><Mail size={18}/></div>
      {approvals.total?<div className="committee-approval-summary"><strong>{approvals.approved}/{approvals.total} εγκρίσεις</strong><span>{approvals.pending?`${approvals.pending} αναμένουν απάντηση`:approvals.changes?`${approvals.changes} ζήτησαν αλλαγές`:'Η έγκριση ολοκληρώθηκε'}</span></div>:<div className="committee-approval-preview"><span>Παραλήπτες κατά την ολοκλήρωση</span><div>{present.length?present.map(x=><small key={x.memberId}>{x.name}{x.email?` · ${x.email}`:' · χωρίς email'}</small>):<small>Δεν έχουν δηλωθεί ακόμη παρόντες.</small>}</div></div>}
    </div>
  </ObserverDialog>
}

function DecisionDialog({initial,members,meetings,onClose,onSave}){
  const [d,setD]=useState(initial||{title:'',action:'',owner:'',dueDate:'',priority:'medium',meetingId:''})
  const valid=d.title.trim()&&d.action.trim()&&d.owner.trim()
  return <ObserverDialog eyebrow="Αποφάσεις & ενέργειες" title={initial?'Επεξεργασία απόφασης / ενέργειας':'Νέα απόφαση / ενέργεια'} subtitle="Καταγράψτε τι αποφασίστηκε, τι πρέπει να γίνει, από ποιον και μέχρι πότε." onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={()=>onSave(d)} disabled={!valid}/> }>
    <div className="entry-grid">
      <label className="entry-span-2"><span>Απόφαση *</span><textarea rows="3" value={d.title} onChange={e=>setD({...d,title:e.target.value})}/></label>
      <label className="entry-span-2"><span>Ενέργεια / παραδοτέο *</span><textarea rows="3" value={d.action} onChange={e=>setD({...d,action:e.target.value})}/></label>
      <label><span>Υπεύθυνος *</span><input list="decision-owner-list" value={d.owner} onChange={e=>setD({...d,owner:e.target.value})}/><datalist id="decision-owner-list">{members.map(x=><option key={x.id} value={x.name}/>)}</datalist></label>
      <ManualDateField label="Προθεσμία" value={d.dueDate} onChange={v=>setD({...d,dueDate:v})}/>
      <label><span>Προτεραιότητα</span><select value={d.priority} onChange={e=>setD({...d,priority:e.target.value})}><option value="low">Κανονική</option><option value="medium">Μέση</option><option value="high">Υψηλή</option></select></label>
      <label><span>Σύνδεση με συνεδρίαση</span><select value={d.meetingId} onChange={e=>setD({...d,meetingId:e.target.value})}><option value="">Χωρίς σύνδεση</option>{meetings.map(x=><option key={x.id} value={x.id}>{fmtDate(x.date)} · {x.title}</option>)}</select></label>
    </div>
  </ObserverDialog>
}

function ObjectiveDialog({initial,members,onClose,onSave}){
  const [d,setD]=useState(initial||{title:'',indicator:'',baseline:'',target:'',owner:'',dueDate:''})
  const valid=d.title.trim()&&d.indicator.trim()&&d.target.trim()&&d.owner.trim()
  return <ObserverDialog eyebrow="Ετήσιο σχέδιο" title={initial?'Επεξεργασία στόχου':'Νέος στόχος'} subtitle="Ο στόχος πρέπει να είναι μετρήσιμος και να έχει σαφή υπεύθυνο και επιθυμητό αποτέλεσμα." onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={()=>onSave(d)} disabled={!valid}/> }>
    <div className="entry-grid">
      <label className="entry-span-2"><span>Στόχος / δράση *</span><input value={d.title} onChange={e=>setD({...d,title:e.target.value})}/></label>
      <label><span>Δείκτης παρακολούθησης *</span><input value={d.indicator} onChange={e=>setD({...d,indicator:e.target.value})}/></label>
      <label><span>Υπεύθυνος *</span><input list="objective-owner-list" value={d.owner} onChange={e=>setD({...d,owner:e.target.value})}/><datalist id="objective-owner-list">{members.map(x=><option key={x.id} value={x.name}/>)}</datalist></label>
      <label><span>Τιμή βάσης</span><input value={d.baseline} onChange={e=>setD({...d,baseline:e.target.value})}/></label>
      <label><span>Επιθυμητός στόχος *</span><input value={d.target} onChange={e=>setD({...d,target:e.target.value})}/></label>
      <ManualDateField label="Προθεσμία" value={d.dueDate} onChange={v=>setD({...d,dueDate:v})}/>
    </div>
  </ObserverDialog>
}
