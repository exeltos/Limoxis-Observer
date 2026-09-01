import { useMemo,useState } from 'react'
import { BookOpenCheck, CalendarDays, CheckCircle2, Info, Plus, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useLocation,useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useEmployeesData } from '../employees/useEmployeesData'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadCommittees,nextCommitteeId,saveCommittees } from './committeeData'
import { createCommitteeAsync } from './committeeService'
import { IPC_COMMITTEE_CATALOG,ipcCommitteeById } from './ipcCommitteeCatalog'
import { requestCommitteeApproval } from './committeeApprovals'
import { useLanguage } from '../../core/i18n/LanguageContext'

const frequencies=[['monthly','Μηνιαία','Monthly'],['bimonthly','Ανά δίμηνο','Every two months'],['quarterly','Τριμηνιαία','Quarterly'],['semiannual','Εξαμηνιαία','Semiannual'],['annual','Ετήσια','Annual'],['as_needed','Όποτε απαιτείται','As needed']]

export function CommitteeCreatePage(){
 const navigate=useNavigate(),location=useLocation(),actor=useAuditActor(),{notify,confirm}=useFeedback(),{goBack}=useContextualNavigation('/committees')
 const {language}=useLanguage();const en=language==='en'
 const {tenant}=useTenant()
 const [saving,setSaving]=useState(false)
 const {data:staffRows}=useEmployeesData()
 const staff=useMemo(()=>staffRows.filter(x=>x.employmentStatus==='active').map(x=>({id:x.id,name:`${x.firstName} ${x.lastName}`,department:x.department,profession:x.profession})),[staffRows])
 const first=IPC_COMMITTEE_CATALOG[0]
 const [draft,setDraft]=useState({templateId:first.id,name:first.name,shortName:first.code,committeeRole:first.role,mandate:first.duties.join('\n'),legalBasis:first.source,decisionNumber:'',termStart:'',termEnd:'',meetingFrequency:'quarterly',quorumRule:'simple_majority',notes:'',members:[]})
 const set=(k,v)=>setDraft(x=>({...x,[k]:v}));const template=ipcCommitteeById(draft.templateId)
 const datesValid=!draft.termStart||!draft.termEnd||new Date(draft.termEnd)>=new Date(draft.termStart)
 const ids=draft.members.map(x=>x.employeeId).filter(Boolean)
 const membersValid=draft.members.length>0&&draft.members.every(x=>x.employeeId&&x.title.trim()&&x.responsibilities.trim())&&new Set(ids).size===ids.length
 const valid=draft.name.trim()&&draft.committeeRole.trim()&&draft.mandate.trim()&&draft.termStart&&draft.termEnd&&datesValid&&membersValid
 function chooseTemplate(id){const t=ipcCommitteeById(id);setDraft(x=>({...x,templateId:id,name:t.id==='custom'?x.name:t.name,shortName:t.id==='custom'?x.shortName:t.code,committeeRole:t.id==='custom'?'':t.role,mandate:t.id==='custom'?'':t.duties.join('\n'),legalBasis:t.id==='custom'?'':t.source}))}
 function addMember(){setDraft(x=>({...x,members:[...x.members,{id:`m-${Date.now()}`,employeeId:'',title:'',responsibilities:'',voting:true,approvalRequired:false,memberType:'regular'}]}))}
 function patchMember(id,k,v){setDraft(x=>({...x,members:x.members.map(m=>m.id===id?{...m,[k]:v}:m)}))}
 async function removeMember(id){const ok=await confirm({title:en?'Remove member':'Αφαίρεση μέλους',message:en?'The member will be removed from the new committee. Continue?':'Το μέλος θα αφαιρεθεί από τη νέα επιτροπή. Θέλετε να συνεχίσετε;',confirmLabel:en?'Remove':'Αφαίρεση',danger:true});if(!ok)return;setDraft(x=>({...x,members:x.members.filter(m=>m.id!==id)}))}
 async function save(){
  if(!valid||saving)return;setSaving(true)
  try{
   const rows=loadCommittees(),id=nextCommitteeId(rows),now=new Date().toISOString()
   const memberRefs=draft.members.map((m,i)=>{const person=staff.find(x=>x.id===m.employeeId);return {id:`CM-${Date.now()}-${i}`,employeeId:m.employeeId,name:person?.name||'',department:person?.department||'',profession:person?.profession||'',committeeTitle:m.title.trim(),responsibilities:m.responsibilities.trim(),voting:m.voting,memberType:m.memberType||'regular',approvalRequired:m.approvalRequired,approvalStatus:m.approvalRequired?'pending':'not_required',active:true,startedAt:now,endedAt:null}})
   const chair=memberRefs.find(x=>/πρόεδ|συντον/i.test(x.committeeTitle)),secretary=memberRefs.find(x=>/γραμματ/i.test(x.committeeTitle))
   const localRecord={id,name:draft.name.trim(),shortName:draft.shortName.trim(),status:'active',templateId:draft.templateId,structureKind:template.kind,isCoreCommittee:template.core,committeeRole:draft.committeeRole.trim(),mandate:draft.mandate.trim(),legalBasis:draft.legalBasis.trim(),officialRelation:template.relation,roleGuidance:template.roleGuidance||[],requiredFunctions:template.requiredFunctions,decisionNumber:draft.decisionNumber.trim(),termStart:draft.termStart,termEnd:draft.termEnd,meetingFrequency:draft.meetingFrequency,quorumRule:draft.quorumRule,notes:draft.notes.trim(),chair:chair?.name||'',secretary:secretary?.name||'',memberRefs,members:memberRefs.map(x=>x.name),meetings:[],decisions:[],createdAt:now,createdBy:actor.name,createdById:actor.id,updatedAt:now,updatedBy:actor.name,updatedById:actor.id,history:[{at:now,actor:actor.name,actorId:actor.id,action:'Δημιουργία',reason:draft.name},{at:now,actor:actor.name,actorId:actor.id,action:'Αρχική σύνθεση',reason:`${memberRefs.length} μέλη`}]}
   let record=localRecord
   const cloudRecord=await createCommitteeAsync(tenant?.id??null,{...localRecord,memberRefs})
   if(cloudRecord){record=cloudRecord}else{saveCommittees([localRecord,...rows])}
   memberRefs.filter(x=>x.approvalRequired).forEach(m=>requestCommitteeApproval({committeeId:record.id,committeeName:record.name,employeeId:m.employeeId,memberName:m.name,committeeTitle:m.committeeTitle,responsibilities:m.responsibilities,requestedBy:actor.name,requestedById:actor.id}))
   notify(en?'Committee created.':'Η επιτροπή δημιουργήθηκε.','success');navigate(`/committees/${record.id}`,{replace:true,state:{limoxisFrom:location.state?.limoxisFrom}})
  }catch(err){
   if(err.message==='DUPLICATE_COMMITTEE_CODE'){notify(en?'This committee code is already in use.':'Αυτός ο κωδικός επιτροπής χρησιμοποιείται ήδη.','danger')}
   else{notify(en?'Could not save the committee.':'Δεν ήταν δυνατή η αποθήκευση της επιτροπής.','danger')}
  }finally{
   setSaving(false)
  }
 }
 return <Page fill><EntityRecordShell className="committee-create-shell workspace-fill" avatar={<BookOpenCheck size={19}/>} eyebrow={en?'Committees':'Επιτροπές'} title={en?'New committee / group':'Νέα επιτροπή / ομάδα'} subtitle={en?'Establishment, composition and basic operating rules':'Σύσταση, σύνθεση και βασικοί κανόνες λειτουργίας'} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={goBack}>
  <div className="committee-create-scroll">
   <div className="committee-create-layout">
    <main className="committee-create-main">
     <section className="committee-create-card"><SectionTitle icon={BookOpenCheck} title={en?'Identity & institutional framework':'Ταυτότητα & θεσμικό πλαίσιο'} subtitle={en?'Select a template or create a local committee. All details remain editable.':'Επίλεξε έτοιμο πρότυπο ή δημιούργησε τοπική επιτροπή. Τα στοιχεία παραμένουν πλήρως επεξεργάσιμα.'}/>
      <div className="entry-grid committee-create-grid">
       <label><span>{en?'Committee / group type *':'Τύπος επιτροπής / ομάδας *'}</span><select value={draft.templateId} onChange={e=>chooseTemplate(e.target.value)}>{IPC_COMMITTEE_CATALOG.map(x=><option key={x.id} value={x.id}>{x.code?`${x.code} — `:''}{x.name}</option>)}</select></label>
       <label><span>{en?'Short name':'Σύντομη ονομασία'}</span><input value={draft.shortName} onChange={e=>set('shortName',e.target.value)}/></label>
       <label className="entry-span-2"><span>{en?'Name *':'Ονομασία *'}</span><input value={draft.name} onChange={e=>set('name',e.target.value)}/></label>
       <label><span>{en?'Decision / establishment act no.':'Αρ. απόφασης / πράξης σύστασης'}</span><input value={draft.decisionNumber} onChange={e=>set('decisionNumber',e.target.value)} placeholder={en?'e.g. Board Decision 124/2026':'π.χ. Απόφαση ΔΣ 124/2026'}/></label>
       <label><span>{en?'Institutional / guidance basis':'Θεσμική / κατευθυντήρια βάση'}</span><input value={draft.legalBasis} onChange={e=>set('legalBasis',e.target.value)}/></label>
       <label className="entry-span-2"><span>{en?'Committee role *':'Ρόλος της επιτροπής *'}</span><textarea rows="2" value={draft.committeeRole} onChange={e=>set('committeeRole',e.target.value)}/></label>
       <label className="entry-span-2"><span>{en?'Responsibilities *':'Αρμοδιότητες *'}</span><textarea rows="4" value={draft.mandate} onChange={e=>set('mandate',e.target.value)}/></label>
      </div>
      {template.id!=='custom'&&<TemplateGuidance template={template} en={en}/>} 
     </section>

     <section className="committee-create-card"><SectionTitle icon={Users} title={en?'Composition':'Σύνθεση'} subtitle={en?'Define who participates, in what capacity and what each member is responsible for.':'Εσύ ορίζεις ποιοι συμμετέχουν, με ποια ιδιότητα και τι ακριβώς αναλαμβάνει ο καθένας.'}/>
      <div className="committee-member-list">{draft.members.map((m,i)=><MemberRow en={en} key={m.id} m={m} index={i} staff={staff} suggestions={[...new Set(['Πρόεδρος','Αντιπρόεδρος','Συντονιστής','Γραμματέας','Μέλος','Αναπληρωματικό μέλος',...(template.requiredFunctions||[])])]} onChange={(k,v)=>patchMember(m.id,k,v)} onRemove={()=>removeMember(m.id)}/>)}</div>
      {draft.members.length===0&&<div className="committee-members-empty"><Users size={18}/><div><strong>{en?'No members added':'Δεν έχουν προστεθεί μέλη'}</strong><span>{en?'Add the actual committee members. Role templates are guidance, not a locked composition.':'Πρόσθεσε τα πραγματικά μέλη της επιτροπής. Τα πρότυπα ρόλων λειτουργούν ως βοήθεια και όχι ως κλειδωμένη σύνθεση.'}</span></div></div>}
      {!membersValid&&draft.members.length>0&&<div className="committee-validation">{en?'Complete employee, committee role and responsibility for each member. Duplicate employees are not allowed.':'Συμπλήρωσε εργαζόμενο, ιδιότητα και αρμοδιότητα για κάθε μέλος. Δεν επιτρέπεται διπλή καταχώρηση του ίδιου εργαζομένου.'}</div>}
      <button type="button" className="action-button committee-add-member" onClick={addMember}><Plus size={15}/>{en?'Add member':'Προσθήκη μέλους'}</button>
     </section>

     <section className="committee-create-card"><SectionTitle icon={CalendarDays} title={en?'Term & operating rules':'Θητεία & κανόνες λειτουργίας'} subtitle={en?'Core information required for meetings, quorum and historical traceability.':'Τα βασικά στοιχεία που χρειάζονται για συνεδριάσεις, απαρτία και ιστορικότητα.'}/>
      <div className="entry-grid committee-create-grid"><ManualDateField label={en?'Term start *':'Έναρξη θητείας *'} value={draft.termStart} onChange={v=>set('termStart',v)}/><ManualDateField label={en?'Term end *':'Λήξη θητείας *'} value={draft.termEnd} onChange={v=>set('termEnd',v)}/>{!datesValid&&<div className="entry-span-2 committee-validation">{en?'End date cannot precede start date.':'Η λήξη δεν μπορεί να προηγείται της έναρξης.'}</div>}<label><span>{en?'Meeting frequency':'Συχνότητα συνεδριάσεων'}</span><select value={draft.meetingFrequency} onChange={e=>set('meetingFrequency',e.target.value)}>{frequencies.map(([v,l,lEn])=><option key={v} value={v}>{en?lEn:l}</option>)}</select></label><label><span>{en?'Quorum':'Απαρτία'}</span><select value={draft.quorumRule} onChange={e=>set('quorumRule',e.target.value)}><option value="simple_majority">{en?'Simple majority of active members':'Απλή πλειοψηφία ενεργών μελών'}</option><option value="two_thirds">{en?'2/3 of active members':'2/3 ενεργών μελών'}</option><option value="custom">{en?'According to regulations':'Σύμφωνα με τον κανονισμό'}</option></select></label><label className="entry-span-2"><span>{en?'Notes / special rules':'Σημειώσεις / ειδικοί κανόνες'}</span><textarea rows="3" value={draft.notes} onChange={e=>set('notes',e.target.value)}/></label></div>
     </section>
    </main>
    <aside className="committee-create-aside">
     <div className="committee-create-summary-card"><span className="eyebrow">{en?'Preview':'Προεπισκόπηση'}</span><strong>{draft.shortName||(en?'New committee':'Νέα επιτροπή')}</strong><h3>{draft.name||(en?'Unnamed':'Χωρίς ονομασία')}</h3><div className="committee-summary-lines"><SummaryLine label={en?'Members':'Μέλη'} value={draft.members.length}/><SummaryLine label={en?'Term':'Θητεία'} value={draft.termStart&&draft.termEnd?`${draft.termStart} → ${draft.termEnd}`:(en?'Not set':'Δεν ορίστηκε')}/><SummaryLine label={en?'Meetings':'Συνεδριάσεις'} value={frequencies.find(x=>x[0]===draft.meetingFrequency)?.[en?2:1]||'—'}/></div></div>
     <div className="committee-create-assurance"><ShieldCheck size={17}/><div><strong>Governance by design</strong><span>{en?'Composition and membership changes retain history. Institutional requirements are distinguished from recommended practices and local choices.':'Η σύνθεση και οι μεταβολές μελών διατηρούν ιστορικό. Οι θεσμικές απαιτήσεις ξεχωρίζουν από τις προτεινόμενες πρακτικές και τις τοπικές επιλογές.'}</span></div></div>
     <div className={`committee-create-readiness ${valid?'ready':''}`}><CheckCircle2 size={17}/><div><strong>{valid?(en?'Ready to save':'Έτοιμη για αποθήκευση'):(en?'Information pending':'Εκκρεμούν στοιχεία')}</strong><span>{valid?(en?'The core establishment details are complete.':'Έχουν συμπληρωθεί τα βασικά στοιχεία σύστασης.'):(en?'Name, role, responsibilities, term and at least one complete member are required.':'Χρειάζονται ονομασία, ρόλος, αρμοδιότητες, θητεία και τουλάχιστον ένα πλήρες μέλος.')}</span></div></div>
    </aside>
   </div>
  </div><div className="committee-create-footer"><Button variant="secondary" onClick={goBack}>{en?'Cancel':'Ακύρωση'}</Button><Button disabled={!valid||saving} onClick={save}>{saving?(en?'Saving…':'Αποθήκευση…'):(en?'Save committee':'Αποθήκευση επιτροπής')}</Button></div>
 </EntityRecordShell></Page>
}
function TemplateGuidance({template,en}){return <div className="committee-template-panel"><div className="committee-template-head"><div><span className="committee-template-code">{template.code}</span><strong>{template.relation}</strong></div><span className="status-badge active">{en?'Template':'Πρότυπο'}</span></div><div className="committee-guidance-legend"><span><i className="legal"/>{en?'Institutional':'Θεσμικό'}</span><span><i className="recommended"/>{en?'Recommended':'Προτεινόμενο'}</span><span><i className="local"/>{en?'Local choice':'Τοπική επιλογή'}</span></div>{(template.roleGuidance||[]).map(group=><div className="committee-guidance-group" key={group.level}><div className={`committee-guidance-label ${group.level}`}><Info size={13}/>{group.label}</div><div>{group.roles.map(x=><small key={x}>{x}</small>)}</div></div>)}</div>}
function MemberRow({m,index,staff,suggestions,onChange,onRemove,en}){const p=staff.find(x=>x.id===m.employeeId);return <div className="committee-member-card"><div className="committee-member-card-head"><div className="committee-member-number">{index+1}</div><div><strong>{p?.name||(en?`Member ${index+1}`:`Μέλος ${index+1}`)}</strong><span>{p?`${p.profession} · ${p.department}`:(en?'Select employee':'Επίλεξε εργαζόμενο')}</span></div><button type="button" className="entity-record-icon-button danger" onClick={onRemove} title={en?'Remove':'Αφαίρεση'}><Trash2 size={15}/></button></div><div className="committee-member-fields"><label><span>{en?'Employee *':'Εργαζόμενος *'}</span><select value={m.employeeId} onChange={e=>onChange('employeeId',e.target.value)}><option value="">{en?'Select':'Επιλογή'}</option>{staff.map(x=><option key={x.id} value={x.id}>{x.name} · {x.department}</option>)}</select></label><label><span>{en?'Committee role *':'Ιδιότητα στην επιτροπή *'}</span><input list={`role-${index}`} value={m.title} onChange={e=>onChange('title',e.target.value)} placeholder={en?'e.g. Chair, Secretary, Member':'π.χ. Πρόεδρος, Γραμματέας, Μέλος'}/><datalist id={`role-${index}`}>{suggestions.map(x=><option key={x} value={x}/>)}</datalist></label><label><span>{en?'Membership type':'Συμμετοχή'}</span><select value={m.memberType||'regular'} onChange={e=>onChange('memberType',e.target.value)}><option value="regular">{en?'Regular':'Τακτικό'}</option><option value="alternate">{en?'Alternate':'Αναπληρωματικό'}</option></select></label><label className="committee-member-duty"><span>{en?'Responsibility *':'Τι κάνει / αρμοδιότητα *'}</span><input value={m.responsibilities} onChange={e=>onChange('responsibilities',e.target.value)} placeholder={en?'e.g. monitors indicators, proposes measures, coordinates...':'π.χ. παρακολουθεί δείκτες, εισηγείται μέτρα, συντονίζει...'}/></label></div><div className="committee-member-options"><label><input type="checkbox" checked={m.voting} onChange={e=>onChange('voting',e.target.checked)}/><span>{en?'Voting right':'Δικαίωμα ψήφου'}</span></label><label title={en?'Request personal electronic approval from profile':'Να ζητηθεί προσωπική ηλεκτρονική έγκριση από το προφίλ'}><input type="checkbox" checked={m.approvalRequired} onChange={e=>onChange('approvalRequired',e.target.checked)}/><span>{en?'Electronic participation acceptance':'Ηλεκτρονική αποδοχή συμμετοχής'}</span></label></div></div>}
function SummaryLine({label,value}){return <div><span>{label}</span><strong>{value}</strong></div>}
function SectionTitle({icon:Icon,title,subtitle}){return <div className="record-section-header committee-create-heading"><div className="committee-section-icon"><Icon size={16}/></div><div><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div></div>}
