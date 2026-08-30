import { useMemo, useState } from 'react'
import { CalendarClock, Check, Megaphone, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ROLES } from '../../core/permissions/roles'
import { demoLibrarySeed, demoUsers } from './managementData'
import { useLanguage } from '../../core/i18n/LanguageContext'

const roleOptions=[
 [ROLES.HOSPITAL_ADMIN,'Διαχειριστές','Administrators'],[ROLES.INFECTION_CONTROL_LEAD,'Υπεύθυνοι Λοιμώξεων','Infection Control Leads'],[ROLES.INFECTION_CONTROL_MEMBER,'Ομάδα Λοιμώξεων','Infection Control Team'],[ROLES.DEPARTMENT_MANAGER,'Προϊστάμενοι Τμημάτων','Department Managers'],[ROLES.DEPARTMENT_USER,'Χρήστες Τμημάτων','Department Users'],[ROLES.LABORATORY,'Εργαστήριο','Laboratory'],[ROLES.HR_OFFICE,'HR','HR'],[ROLES.PHARMACY,'Φαρμακείο','Pharmacy'],[ROLES.OCCUPATIONAL_PHYSICIAN,'Ιατρός Εργασίας','Occupational Physician'],[ROLES.QUALITY_MANAGER,'Ποιότητα','Quality']
]
const empty={title:'',message:'',priority:'normal',audienceType:'all',audienceValues:[],requiresAck:false,startDate:'',startTime:'',endDate:'',endTime:'',startAt:'',endAt:''}
const combine=(date,time)=>date?`${date}T${time||'00:00'}:00`:''
const fmt=(iso,locale='el-GR',en=false)=>iso?new Date(iso).toLocaleString(locale,{dateStyle:'short',timeStyle:'short'}):(en?'No restriction':'Χωρίς περιορισμό')
function audienceText(a,en=false){
 const vals=Array.isArray(a.audienceValues)?a.audienceValues:(a.audienceValue?[a.audienceValue]:[])
 if(a.audienceType==='all')return en?'Whole hospital':'Όλο το νοσοκομείο'
 if(a.audienceType==='role')return en?`${vals.length} role(s)`:`${vals.length} ρόλος/οι`
 if(a.audienceType==='department')return en?`${vals.length} department(s)`:`${vals.length} τμήμα/τα`
 if(a.audienceType==='user')return en?`${vals.length} user(s)`:`${vals.length} χρήστης/ες`
 return '—'
}
function prepEditor(a){
 const split=iso=>iso?String(iso).slice(0,16).split('T'):['','']
 const [sd,st]=split(a.startAt),[ed,et]=split(a.endAt)
 return {...empty,...a,audienceValues:Array.isArray(a.audienceValues)?a.audienceValues:(a.audienceValue?[a.audienceValue]:[]),startDate:sd,startTime:st,endDate:ed,endTime:et}
}
export function AnnouncementsPanel(){
 const n=useNotifications(); const {notify,notifyUndo,confirm}=useFeedback(); const {language,locale}=useLanguage();const en=language==='en'; const [editor,setEditor]=useState(null); const [recipientQuery,setRecipientQuery]=useState('')
 const departments=useMemo(()=>demoLibrarySeed.departments.map(([el,enLabel])=>({id:el,label:en?enLabel:el,secondary:en?el:enLabel})),[en])
 const users=useMemo(()=>demoUsers.map(u=>({id:u.email,label:u.name,secondary:u.email})),[])
 const recipientOptions=editor?.audienceType==='department'?departments:editor?.audienceType==='user'?users:editor?.audienceType==='role'?roleOptions.map(([id,el,enLabel])=>({id,label:en?enLabel:el,secondary:id})):[]
 const filteredRecipients=recipientOptions.filter(x=>`${x.label} ${x.secondary}`.toLowerCase().includes(recipientQuery.toLowerCase()))
 const toggleRecipient=id=>setEditor(x=>({...x,audienceValues:x.audienceValues.includes(id)?x.audienceValues.filter(v=>v!==id):[...x.audienceValues,id]}))
 const save=()=>{
   if(!editor.title.trim()||!editor.message.trim())return notify(en?'Enter a title and message.':'Συμπληρώστε τίτλο και μήνυμα.','warning')
   if(editor.audienceType!=='all'&&!editor.audienceValues.length)return notify(en?'Select at least one recipient.':'Επιλέξτε τουλάχιστον έναν παραλήπτη.','warning')
   const startAt=combine(editor.startDate,editor.startTime),endAt=combine(editor.endDate,editor.endTime)
   if(startAt&&endAt&&new Date(endAt)<=new Date(startAt))return notify(en?'End must be after start.':'Η λήξη πρέπει να είναι μετά την έναρξη.','warning')
    const payload={...editor,startAt,endAt,createdBy:en?'Limoxis Management':'Διαχείριση Limoxis'}
    delete payload.startDate; delete payload.startTime; delete payload.endDate; delete payload.endTime
   if(editor.id)n.updateAnnouncement(payload);else n.addAnnouncement(payload)
   setEditor(null);setRecipientQuery('');notify(en?'Announcement saved.':'Η ανακοίνωση αποθηκεύτηκε.','success')
 }
 return <section className="management-section management-scroll-section"><div className="section-toolbar"><div><h2>{en?'Updates & announcements':'Ενημερώσεις & ανακοινώσεις'}</h2><p>{en?'Targeted messages with a display window for the hospital, roles, departments or specific users.':'Στοχευμένα μηνύματα με χρόνο εμφάνισης προς νοσοκομείο, ρόλους, τμήματα ή συγκεκριμένους χρήστες.'}</p></div><Button onClick={()=>setEditor({...empty})}><Plus size={15}/>{en?'New announcement':'Νέα ανακοίνωση'}</Button></div>
  <div className="announcement-admin-list">{n.announcements.map(a=><article key={a.id}><span className={`announcement-admin-icon ${a.priority}`}><Megaphone size={17}/></span><div><strong>{a.title}</strong><p>{a.message}</p><div className="announcement-admin-meta"><span><Users size={12}/>{audienceText(a,en)}</span><span><CalendarClock size={12}/>{a.startAt?fmt(a.startAt,locale,en):(en?'Immediately':'Άμεσα')} → {a.endAt?fmt(a.endAt,locale,en):(en?'no expiry':'χωρίς λήξη')}</span>{a.requiresAck&&<span><Check size={12}/>{en?'Acknowledgement required':'Απαιτεί γνώση'}</span>}</div></div><div className="record-inline-actions"><button className="edit" title={en?'Edit':'Επεξεργασία'} onClick={()=>setEditor(prepEditor(a))}><Pencil size={15}/></button><button className="danger" title={en?'Delete':'Διαγραφή'} onClick={async()=>{if(await confirm({title:en?'Delete announcement':'Διαγραφή ανακοίνωσης',message:en?'The announcement will be removed. Continue?':'Η ανακοίνωση θα αφαιρεθεί. Θέλετε να συνεχίσετε;',confirmLabel:en?'Delete':'Διαγραφή',danger:true})){n.removeAnnouncement(a.id);notifyUndo(en?'Announcement deleted.':'Η ανακοίνωση διαγράφηκε.',()=>n.addAnnouncement(a))}}}><Trash2 size={15}/></button></div></article>)}</div>
  {editor&&<div className="modal-backdrop"><div className="announcement-editor announcement-editor-wide" role="dialog" aria-modal="true"><header><div><h3>{editor.id?(en?'Edit announcement':'Επεξεργασία ανακοίνωσης'):(en?'New announcement':'Νέα ανακοίνωση')}</h3><p>{en?'Content, recipients and exact display window.':'Περιεχόμενο, παραλήπτες και ακριβές χρονικό παράθυρο εμφάνισης.'}</p></div><button className="icon-button" onClick={()=>setEditor(null)}><X size={17}/></button></header>
   <div className="announcement-editor-body">
    <section className="announcement-form-section"><header><strong>{en?'Content':'Περιεχόμενο'}</strong><span>{en?'The message shown to selected users.':'Το μήνυμα που θα εμφανιστεί στους επιλεγμένους χρήστες.'}</span></header><div className="entry-form-grid">
     <label className="field announcement-field entry-span-2"><span>{en?'Title':'Τίτλος'}</span><input className="announcement-control" value={editor.title} onChange={e=>setEditor(x=>({...x,title:e.target.value}))}/></label>
     <label className="field announcement-field entry-span-2"><span>{en?'Message':'Μήνυμα'}</span><textarea className="announcement-control announcement-textarea" rows="5" value={editor.message} onChange={e=>setEditor(x=>({...x,message:e.target.value}))}/></label>
     <label className="field announcement-field"><span>{en?'Priority':'Προτεραιότητα'}</span><select className="announcement-control" value={editor.priority} onChange={e=>setEditor(x=>({...x,priority:e.target.value}))}><option value="normal">{en?'Normal':'Κανονική'}</option><option value="high">{en?'High':'Υψηλή'}</option><option value="critical">{en?'Critical':'Κρίσιμη'}</option></select></label>
     <label className="field announcement-field"><span>{en?'Recipient type':'Τύπος παραληπτών'}</span><select className="announcement-control" value={editor.audienceType} onChange={e=>{setRecipientQuery('');setEditor(x=>({...x,audienceType:e.target.value,audienceValues:[]}))}}><option value="all">{en?'Whole hospital':'Όλο το νοσοκομείο'}</option><option value="role">{en?'One or more roles':'Ένας ή περισσότεροι ρόλοι'}</option><option value="department">{en?'One or more departments':'Ένα ή περισσότερα τμήματα'}</option><option value="user">{en?'One or more users':'Ένας ή περισσότεροι χρήστες'}</option></select></label>
    </div></section>
    {editor.audienceType!=='all'&&<section className="announcement-form-section"><header><strong>{en?'Recipients':'Παραλήπτες'}</strong><span>{en?'You can select more than one.':'Μπορείτε να επιλέξετε περισσότερους από έναν.'}</span></header><div className="recipient-picker"><label className="recipient-search"><Search size={15}/><input value={recipientQuery} onChange={e=>setRecipientQuery(e.target.value)} placeholder={en?'Search...':'Αναζήτηση...'}/></label><div className="recipient-options">{filteredRecipients.map(item=><button type="button" key={item.id} className={editor.audienceValues.includes(item.id)?'selected':''} onClick={()=>toggleRecipient(item.id)}><span className="recipient-check">{editor.audienceValues.includes(item.id)&&<Check size={13}/>}</span><span><strong>{item.label}</strong><small>{item.secondary}</small></span></button>)}</div><div className="recipient-summary">{editor.audienceValues.length} {en?'selected':'επιλεγμένοι'}</div></div></section>}
    <section className="announcement-form-section"><header><strong>{en?'Display window':'Πότε θα εμφανίζεται'}</strong><span>{en?'Leave start blank for immediate display and end blank to keep it active.':'Αφήστε κενή την έναρξη για άμεση εμφάνιση και τη λήξη για να παραμένει ενεργή.'}</span></header><div className="announcement-schedule-grid">
     <ManualDateField className="announcement-field" label={en?'Start date':'Ημερομηνία έναρξης'} value={editor.startDate} onChange={value=>setEditor(x=>({...x,startDate:value}))} optional/>
     <TimeField className="announcement-field" label={en?'Start time':'Ώρα έναρξης'} value={editor.startTime} onChange={value=>setEditor(x=>({...x,startTime:value}))}/>
     <ManualDateField className="announcement-field" label={en?'End date':'Ημερομηνία λήξης'} value={editor.endDate} onChange={value=>setEditor(x=>({...x,endDate:value}))} optional/>
     <TimeField className="announcement-field" label={en?'End time':'Ώρα λήξης'} value={editor.endTime} onChange={value=>setEditor(x=>({...x,endTime:value}))}/>
    </div><label className="field checkbox-field acknowledgement-field"><input type="checkbox" checked={editor.requiresAck} onChange={e=>setEditor(x=>({...x,requiresAck:e.target.checked}))}/><span>{en?'Requires “Acknowledged” confirmation':'Απαιτεί επιβεβαίωση «Έλαβα γνώση»'}</span></label></section>
   </div><footer><Button variant="secondary" onClick={()=>setEditor(null)}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton onClick={save}>{en?'Save':'Αποθήκευση'}</SaveButton></footer></div></div>}
 </section>
}
