import { useMemo, useState } from 'react'
import { CalendarClock, Check, Megaphone, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ROLES } from '../../core/permissions/roles'
import { demoLibrarySeed, demoUsers } from './managementData'

const roleOptions=[
 [ROLES.HOSPITAL_ADMIN,'Διαχειριστές'],[ROLES.INFECTION_CONTROL_LEAD,'Υπεύθυνοι Λοιμώξεων'],[ROLES.INFECTION_CONTROL_MEMBER,'Ομάδα Λοιμώξεων'],[ROLES.DEPARTMENT_MANAGER,'Προϊστάμενοι Τμημάτων'],[ROLES.DEPARTMENT_USER,'Χρήστες Τμημάτων'],[ROLES.LABORATORY,'Εργαστήριο'],[ROLES.HR_OFFICE,'HR'],[ROLES.PHARMACY,'Φαρμακείο'],[ROLES.OCCUPATIONAL_PHYSICIAN,'Ιατρός Εργασίας'],[ROLES.QUALITY_MANAGER,'Ποιότητα']
]
const empty={title:'',message:'',priority:'normal',audienceType:'all',audienceValues:[],requiresAck:false,startDate:'',startTime:'',endDate:'',endTime:'',startAt:'',endAt:''}
const combine=(date,time)=>date?`${date}T${time||'00:00'}:00`:''
const fmt=iso=>iso?new Date(iso).toLocaleString('el-GR',{dateStyle:'short',timeStyle:'short'}):'Χωρίς περιορισμό'
function audienceText(a){
 const vals=Array.isArray(a.audienceValues)?a.audienceValues:(a.audienceValue?[a.audienceValue]:[])
 if(a.audienceType==='all')return 'Όλο το νοσοκομείο'
 if(a.audienceType==='role')return `${vals.length} ρόλος/οι`
 if(a.audienceType==='department')return `${vals.length} τμήμα/τα`
 if(a.audienceType==='user')return `${vals.length} χρήστης/ες`
 return '—'
}
function prepEditor(a){
 const split=iso=>iso?String(iso).slice(0,16).split('T'):['','']
 const [sd,st]=split(a.startAt),[ed,et]=split(a.endAt)
 return {...empty,...a,audienceValues:Array.isArray(a.audienceValues)?a.audienceValues:(a.audienceValue?[a.audienceValue]:[]),startDate:sd,startTime:st,endDate:ed,endTime:et}
}
export function AnnouncementsPanel(){
 const n=useNotifications(); const {notify,notifyUndo,confirm}=useFeedback(); const [editor,setEditor]=useState(null); const [recipientQuery,setRecipientQuery]=useState('')
 const departments=useMemo(()=>demoLibrarySeed.departments.map(([el,en])=>({id:el,label:el,secondary:en})),[])
 const users=useMemo(()=>demoUsers.map(u=>({id:u.email,label:u.name,secondary:u.email})),[])
 const recipientOptions=editor?.audienceType==='department'?departments:editor?.audienceType==='user'?users:editor?.audienceType==='role'?roleOptions.map(([id,label])=>({id,label,secondary:id})):[]
 const filteredRecipients=recipientOptions.filter(x=>`${x.label} ${x.secondary}`.toLowerCase().includes(recipientQuery.toLowerCase()))
 const toggleRecipient=id=>setEditor(x=>({...x,audienceValues:x.audienceValues.includes(id)?x.audienceValues.filter(v=>v!==id):[...x.audienceValues,id]}))
 const save=()=>{
   if(!editor.title.trim()||!editor.message.trim())return notify('Συμπληρώστε τίτλο και μήνυμα.','warning')
   if(editor.audienceType!=='all'&&!editor.audienceValues.length)return notify('Επιλέξτε τουλάχιστον έναν παραλήπτη.','warning')
   const startAt=combine(editor.startDate,editor.startTime),endAt=combine(editor.endDate,editor.endTime)
   if(startAt&&endAt&&new Date(endAt)<=new Date(startAt))return notify('Η λήξη πρέπει να είναι μετά την έναρξη.','warning')
   const {startDate,startTime,endDate,endTime,...rest}=editor
   const payload={...rest,startAt,endAt,createdBy:'Διαχείριση Limoxis'}
   if(editor.id)n.updateAnnouncement(payload);else n.addAnnouncement(payload)
   setEditor(null);setRecipientQuery('');notify('Η ανακοίνωση αποθηκεύτηκε.','success')
 }
 return <section className="management-section management-scroll-section"><div className="section-toolbar"><div><h2>Ενημερώσεις & ανακοινώσεις</h2><p>Στοχευμένα μηνύματα με χρόνο εμφάνισης προς νοσοκομείο, ρόλους, τμήματα ή συγκεκριμένους χρήστες.</p></div><Button onClick={()=>setEditor({...empty})}><Plus size={15}/>Νέα ανακοίνωση</Button></div>
  <div className="announcement-admin-list">{n.announcements.map(a=><article key={a.id}><span className={`announcement-admin-icon ${a.priority}`}><Megaphone size={17}/></span><div><strong>{a.title}</strong><p>{a.message}</p><div className="announcement-admin-meta"><span><Users size={12}/>{audienceText(a)}</span><span><CalendarClock size={12}/>{a.startAt?fmt(a.startAt):'Άμεσα'} → {a.endAt?fmt(a.endAt):'χωρίς λήξη'}</span>{a.requiresAck&&<span><Check size={12}/>Απαιτεί γνώση</span>}</div></div><div className="record-inline-actions"><button title="Επεξεργασία" onClick={()=>setEditor(prepEditor(a))}><Pencil size={15}/></button><button className="danger" title="Διαγραφή" onClick={async()=>{if(await confirm({title:'Διαγραφή ανακοίνωσης',message:'Η ανακοίνωση θα αφαιρεθεί. Θέλετε να συνεχίσετε;',confirmLabel:'Διαγραφή',danger:true})){n.removeAnnouncement(a.id);notifyUndo('Η ανακοίνωση διαγράφηκε.',()=>n.addAnnouncement(a))}}}><Trash2 size={15}/></button></div></article>)}</div>
  {editor&&<div className="modal-backdrop"><div className="announcement-editor announcement-editor-wide" role="dialog" aria-modal="true"><header><div><h3>{editor.id?'Επεξεργασία ανακοίνωσης':'Νέα ανακοίνωση'}</h3><p>Περιεχόμενο, παραλήπτες και ακριβές χρονικό παράθυρο εμφάνισης.</p></div><button className="icon-button" onClick={()=>setEditor(null)}><X size={17}/></button></header>
   <div className="announcement-editor-body">
    <section className="announcement-form-section"><header><strong>Περιεχόμενο</strong><span>Το μήνυμα που θα εμφανιστεί στους επιλεγμένους χρήστες.</span></header><div className="entry-form-grid">
     <label className="field announcement-field entry-span-2"><span>Τίτλος</span><input className="announcement-control" value={editor.title} onChange={e=>setEditor(x=>({...x,title:e.target.value}))}/></label>
     <label className="field announcement-field entry-span-2"><span>Μήνυμα</span><textarea className="announcement-control announcement-textarea" rows="5" value={editor.message} onChange={e=>setEditor(x=>({...x,message:e.target.value}))}/></label>
     <label className="field announcement-field"><span>Προτεραιότητα</span><select className="announcement-control" value={editor.priority} onChange={e=>setEditor(x=>({...x,priority:e.target.value}))}><option value="normal">Κανονική</option><option value="high">Υψηλή</option><option value="critical">Κρίσιμη</option></select></label>
     <label className="field announcement-field"><span>Τύπος παραληπτών</span><select className="announcement-control" value={editor.audienceType} onChange={e=>{setRecipientQuery('');setEditor(x=>({...x,audienceType:e.target.value,audienceValues:[]}))}}><option value="all">Όλο το νοσοκομείο</option><option value="role">Ένας ή περισσότεροι ρόλοι</option><option value="department">Ένα ή περισσότερα τμήματα</option><option value="user">Ένας ή περισσότεροι χρήστες</option></select></label>
    </div></section>
    {editor.audienceType!=='all'&&<section className="announcement-form-section"><header><strong>Παραλήπτες</strong><span>Μπορείτε να επιλέξετε περισσότερους από έναν.</span></header><div className="recipient-picker"><label className="recipient-search"><Search size={15}/><input value={recipientQuery} onChange={e=>setRecipientQuery(e.target.value)} placeholder="Αναζήτηση..."/></label><div className="recipient-options">{filteredRecipients.map(item=><button type="button" key={item.id} className={editor.audienceValues.includes(item.id)?'selected':''} onClick={()=>toggleRecipient(item.id)}><span className="recipient-check">{editor.audienceValues.includes(item.id)&&<Check size={13}/>}</span><span><strong>{item.label}</strong><small>{item.secondary}</small></span></button>)}</div><div className="recipient-summary">{editor.audienceValues.length} επιλεγμένοι</div></div></section>}
    <section className="announcement-form-section"><header><strong>Πότε θα εμφανίζεται</strong><span>Αφήστε κενή την έναρξη για άμεση εμφάνιση και τη λήξη για να παραμένει ενεργή.</span></header><div className="announcement-schedule-grid">
     <label className="field announcement-field"><span>Ημερομηνία έναρξης</span><input className="announcement-control" type="date" value={editor.startDate} onChange={e=>setEditor(x=>({...x,startDate:e.target.value}))}/></label>
     <label className="field announcement-field"><span>Ώρα έναρξης</span><input className="announcement-control" type="time" value={editor.startTime} onChange={e=>setEditor(x=>({...x,startTime:e.target.value}))}/></label>
     <label className="field announcement-field"><span>Ημερομηνία λήξης</span><input className="announcement-control" type="date" value={editor.endDate} onChange={e=>setEditor(x=>({...x,endDate:e.target.value}))}/></label>
     <label className="field announcement-field"><span>Ώρα λήξης</span><input className="announcement-control" type="time" value={editor.endTime} onChange={e=>setEditor(x=>({...x,endTime:e.target.value}))}/></label>
    </div><label className="field checkbox-field acknowledgement-field"><input type="checkbox" checked={editor.requiresAck} onChange={e=>setEditor(x=>({...x,requiresAck:e.target.checked}))}/><span>Απαιτεί επιβεβαίωση «Έλαβα γνώση»</span></label></section>
   </div><footer><Button variant="secondary" onClick={()=>setEditor(null)}>Ακύρωση</Button><Button onClick={save}>Αποθήκευση</Button></footer></div></div>}
 </section>
}
