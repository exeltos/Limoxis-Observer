import { useState } from 'react'
import { BookOpenCheck } from 'lucide-react'
import { useLocation,useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadCommittees,nextCommitteeId,saveCommittees } from './committeeData'
import { createCommitteeAsync,getNextCommitteeCodeAsync } from './committeeService'
import { IPC_COMMITTEE_CATALOG,ipcCommitteeById } from './ipcCommitteeCatalog'
import { useLanguage } from '../../core/i18n/LanguageContext'

const frequencies=[['monthly','Μηνιαία','Monthly'],['bimonthly','Ανά δίμηνο','Every two months'],['quarterly','Τριμηνιαία','Quarterly'],['semiannual','Εξαμηνιαία','Semiannual'],['annual','Ετήσια','Annual'],['as_needed','Όποτε απαιτείται','As needed']]

export function CommitteeCreatePage(){
 const navigate=useNavigate(),location=useLocation(),actor=useAuditActor(),{notify}=useFeedback(),{goBack}=useContextualNavigation('/committees'),{language}=useLanguage(),en=language==='en',{tenant}=useTenant()
 const [saving,setSaving]=useState(false),first=IPC_COMMITTEE_CATALOG.find(x=>x.id==='custom')||IPC_COMMITTEE_CATALOG[0]
 const [draft,setDraft]=useState({templateId:first.id,name:'',shortName:'',committeeRole:'',mandate:'',legalBasis:'',decisionNumber:'',termStart:'',termEnd:'',meetingFrequency:'quarterly',quorumRule:'simple_majority',notes:''})
 const set=(k,v)=>setDraft(x=>({...x,[k]:v})),template=ipcCommitteeById(draft.templateId),datesValid=!draft.termStart||!draft.termEnd||new Date(draft.termEnd)>=new Date(draft.termStart),valid=draft.name.trim()&&draft.committeeRole.trim()&&draft.mandate.trim()&&draft.termStart&&draft.termEnd&&datesValid
 function chooseTemplate(id){const t=ipcCommitteeById(id);setDraft(x=>({...x,templateId:id,name:t.id==='custom'?x.name:t.name,shortName:t.id==='custom'?x.shortName:t.code,committeeRole:t.id==='custom'?'':t.role,mandate:t.id==='custom'?'':t.duties.join('\n'),legalBasis:t.id==='custom'?'':t.source}))}
 async function save(){
  if(!valid||saving)return
  setSaving(true)
  try{
   const rows=loadCommittees(),id=(await getNextCommitteeCodeAsync(tenant?.id??null))||nextCommitteeId(rows),now=new Date().toISOString()
   const localRecord={id,name:draft.name.trim(),shortName:draft.shortName.trim(),status:'active',templateId:draft.templateId,structureKind:template.kind,isCoreCommittee:template.core,committeeRole:draft.committeeRole.trim(),mandate:draft.mandate.trim(),legalBasis:draft.legalBasis.trim(),officialRelation:template.relation,roleGuidance:template.roleGuidance||[],requiredFunctions:template.requiredFunctions,decisionNumber:draft.decisionNumber.trim(),termStart:draft.termStart,termEnd:draft.termEnd,meetingFrequency:draft.meetingFrequency,quorumRule:draft.quorumRule,notes:draft.notes.trim(),chair:'',secretary:'',memberRefs:[],members:[],meetings:[],decisions:[],annualPlan:[],documents:[],createdAt:now,createdBy:actor.name,createdById:actor.id,updatedAt:now,updatedBy:actor.name,updatedById:actor.id,history:[{at:now,actor:actor.name,actorId:actor.id,action:'Δημιουργία',reason:draft.name.trim()}]}
   let record=localRecord
   const cloud=await createCommitteeAsync(tenant?.id??null,localRecord)
   if(cloud)record=cloud;else saveCommittees([localRecord,...rows])
   notify(en?'Committee created. Continue with members and governance details.':'Η επιτροπή δημιουργήθηκε. Συνεχίστε με μέλη και στοιχεία διακυβέρνησης.','success')
   navigate(`/committees/${record.id}`,{replace:true,state:{limoxisFrom:location.state?.limoxisFrom}})
  }catch(err){notify(err.message==='DUPLICATE_COMMITTEE_CODE'?(en?'This committee code is already in use.':'Αυτός ο κωδικός επιτροπής χρησιμοποιείται ήδη.'):(en?'Could not save the committee.':'Δεν ήταν δυνατή η αποθήκευση της επιτροπής.'),'danger')}finally{setSaving(false)}
 }
 return <Page><EntityRecordShell className="committee-create-shell" avatar={<BookOpenCheck size={19}/>} eyebrow={en?'Committees':'Επιτροπές'} title={en?'New committee / group':'Νέα επιτροπή / ομάδα'} subtitle={en?'Create committee record':'Δημιουργία καρτέλας επιτροπής'} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={goBack}>
  <div className="record-section committee-create-form">
   <div className="entry-grid">
    <label><span>{en?'Committee / group type *':'Τύπος επιτροπής / ομάδας *'}</span><select value={draft.templateId} onChange={e=>chooseTemplate(e.target.value)}>{IPC_COMMITTEE_CATALOG.map(x=><option key={x.id} value={x.id}>{x.code?`${x.code} — `:''}{x.name}</option>)}</select></label>
    <label><span>{en?'Short name':'Σύντομη ονομασία'}</span><input value={draft.shortName} onChange={e=>set('shortName',e.target.value)}/></label>
    <label className="entry-span-2"><span>{en?'Name *':'Ονομασία *'}</span><input autoFocus value={draft.name} onChange={e=>set('name',e.target.value)}/></label>
    <label><span>{en?'Decision no.':'Αρ. απόφασης'}</span><input value={draft.decisionNumber} onChange={e=>set('decisionNumber',e.target.value)}/></label>
    <label><span>{en?'Institutional basis':'Θεσμική βάση'}</span><input value={draft.legalBasis} onChange={e=>set('legalBasis',e.target.value)}/></label>
    <label className="entry-span-2"><span>{en?'Committee role *':'Ρόλος επιτροπής *'}</span><textarea rows="2" value={draft.committeeRole} onChange={e=>set('committeeRole',e.target.value)}/></label>
    <label className="entry-span-2"><span>{en?'Responsibilities *':'Αρμοδιότητες *'}</span><textarea rows="3" value={draft.mandate} onChange={e=>set('mandate',e.target.value)}/></label>
    <ManualDateField label={en?'Term start *':'Έναρξη θητείας *'} value={draft.termStart} onChange={v=>set('termStart',v)}/>
    <ManualDateField label={en?'Term end *':'Λήξη θητείας *'} value={draft.termEnd} onChange={v=>set('termEnd',v)}/>
    <label><span>{en?'Meeting frequency':'Συχνότητα συνεδριάσεων'}</span><select value={draft.meetingFrequency} onChange={e=>set('meetingFrequency',e.target.value)}>{frequencies.map(([v,l,lEn])=><option key={v} value={v}>{en?lEn:l}</option>)}</select></label>
    <label><span>{en?'Quorum':'Απαρτία'}</span><select value={draft.quorumRule} onChange={e=>set('quorumRule',e.target.value)}><option value="simple_majority">{en?'Simple majority':'Απλή πλειοψηφία ενεργών μελών'}</option><option value="two_thirds">2/3</option><option value="custom">{en?'According to regulations':'Σύμφωνα με τον κανονισμό'}</option></select></label>
    <label className="entry-span-2"><span>{en?'Notes':'Σημειώσεις'}</span><textarea rows="2" value={draft.notes} onChange={e=>set('notes',e.target.value)}/></label>
   </div>
   {!datesValid&&<div className="source-truth-note">{en?'Term end must be after term start.':'Η λήξη θητείας πρέπει να είναι μετά την έναρξη.'}</div>}
   <div className="source-truth-note">{en?'After saving, the committee workspace opens so members, meetings, decisions, annual plan, documents and history can be managed in their dedicated tabs.':'Μετά την αποθήκευση ανοίγει η καρτέλα της επιτροπής, όπου διαχειρίζεστε μέλη, συνεδριάσεις, αποφάσεις, ετήσιο σχέδιο, έγγραφα και ιστορικό στις αντίστοιχες καρτέλες.'}</div>
   <div className="inline-edit-footer"><Button variant="secondary" onClick={goBack}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton loading={saving} disabled={!valid||saving} onClick={save}>{en?'Save':'Αποθήκευση'}</SaveButton></div>
  </div>
 </EntityRecordShell></Page>
}
