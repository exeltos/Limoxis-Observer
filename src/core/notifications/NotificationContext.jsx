import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useTenant } from '../tenant/TenantContext'
import { loadEmployees } from '../../features/employees/employeeStore'

const NotificationContext=createContext(null)
const ANN_KEY='limoxis.announcements.v2'
const READ_KEY='limoxis.notificationReads.v1'

const demoAnnouncements=[
 {id:'ANN-001',title:'Ενημέρωση Επιτήρησης',message:'Παρακαλούμε να ολοκληρωθούν οι εκκρεμείς επανεκτιμήσεις απομόνωσης.',priority:'high',audienceType:'all',audienceValues:[],createdBy:'Υπεύθυνος Λοιμώξεων',createdAt:'2026-08-29T07:30:00',requiresAck:true,startAt:'',endAt:''},
 {id:'ANN-002',title:'Υπενθύμιση εκπαίδευσης',message:'Η νέα ενότητα πρόληψης λοιμώξεων είναι διαθέσιμη στο Κέντρο Εκπαίδευσης.',priority:'normal',audienceType:'all',audienceValues:[],createdBy:'Διαχειριστής',createdAt:'2026-08-28T12:00:00',requiresAck:false,startAt:'',endAt:''},
]
function readJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}}
function valuesFor(a){return Array.isArray(a.audienceValues)?a.audienceValues:(a.audienceValue?[a.audienceValue]:[])}
function applies(a,{role,membership,user,profile}){
 const vals=valuesFor(a)
 if(a.audienceType==='all')return true
 if(a.audienceType==='role')return vals.includes(role)
 if(a.audienceType==='department'){
   const own=[...(membership?.departmentIds||[]),membership?.previewDepartment].filter(Boolean)
   return vals.some(v=>own.includes(v))
 }
 if(a.audienceType==='user')return vals.some(v=>[user?.id,user?.email,profile?.id,profile?.email].filter(Boolean).includes(v))
 return false
}
function withinWindow(a,now=Date.now()){
 const start=a.startAt?new Date(a.startAt).getTime():null
 const end=a.endAt?new Date(a.endAt).getTime():null
 return (!start||Number.isNaN(start)||now>=start)&&(!end||Number.isNaN(end)||now<=end)
}
export function NotificationProvider({children}){
 const {user,profile}=useAuth(); const {role,membership}=useTenant()
 const [announcements,setAnnouncements]=useState(()=>readJson(ANN_KEY,null)||demoAnnouncements)
 const [reads,setReads]=useState(()=>readJson(READ_KEY,{}))
 const [clock,setClock]=useState(Date.now())
 useEffect(()=>{const id=window.setInterval(()=>setClock(Date.now()),60000);return()=>window.clearInterval(id)},[])
 useEffect(()=>{try{localStorage.setItem(ANN_KEY,JSON.stringify(announcements))}catch{/* storage unavailable */}},[announcements])
 useEffect(()=>{try{localStorage.setItem(READ_KEY,JSON.stringify(reads))}catch{/* storage unavailable */}},[reads])
 const audience=useMemo(()=>({role,membership,user,profile}),[role,membership,user,profile])
 const visibleAnnouncements=useMemo(()=>announcements.filter(a=>applies(a,audience)&&withinWindow(a,clock)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))),[announcements,audience,clock])
 const birthday=useMemo(()=>{
   const today=new Date(); const md=`${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
   return loadEmployees().filter(e=>e.employmentStatus==='active'&&String(e.birthDate||'').slice(5)===md)
 },[clock])
 const operational=useMemo(()=>{
   const base={
    infection_control_lead:[['Επανεκτιμήσεις απομόνωσης','4','/surveillance'],['Εκπρόθεσμοι έλεγχοι','3','/controls'],['Εκκρεμείς εγκρίσεις','5','/pharmacy']],
    infection_control_member:[['Ενεργές επιτηρήσεις','6','/surveillance'],['Νέα εργαστηριακά αποτελέσματα','2','/laboratory']],
    laboratory:[['Αποτελέσματα προς επικύρωση','3','/laboratory'],['Κρίσιμα αποτελέσματα','1','/laboratory']],
    department_manager:[['Εκκρεμότητες τμήματος','3','/my-department'],['Εκπαίδευση σε εκκρεμότητα','2','/training']],
    department_user:[['Ανατεθειμένη εκπαίδευση','1','/training']],
    occupational_physician:[['Επανέλεγχοι εργαζομένων','2','/occupational-health']],
    pharmacy:[['Εγκρίσεις αντιβιοτικών','3','/pharmacy']],
    quality_manager:[['CAPA εκπρόθεσμα','2','/quality']],
    doctor_reviewer:[['Ιατρικές εγκρίσεις','4','/surveillance']],
    hospital_admin:[['Εκκρεμότητες διαχείρισης','3','/management'],['Alerts συστήματος','2','/management']],
    platform_owner:[['Ενεργοποιήσεις οργανισμών','2','/management']],
   }
   return (base[role]||[]).map((x,i)=>({id:`TASK-${role}-${i}`,title:x[0],count:x[1],to:x[2],type:'task'}))
 },[role])
 const notificationItems=useMemo(()=>[
   ...visibleAnnouncements.map(a=>({...a,type:'announcement',read:Boolean(reads[a.id]),to:'/'})),
   ...operational.map(o=>({...o,read:Boolean(reads[o.id])}))
 ],[visibleAnnouncements,operational,reads])
 const unreadItems=useMemo(()=>notificationItems.filter(x=>!x.read),[notificationItems])
 const unreadCount=unreadItems.length
 const markRead=useCallback(id=>setReads(r=>({...r,[id]:true})),[])
 const markUnread=useCallback(id=>setReads(r=>{const next={...r};delete next[id];return next}),[])
 const markAllRead=useCallback(()=>setReads(r=>({...r,...Object.fromEntries(notificationItems.map(x=>[x.id,true]))})),[notificationItems])
 const addAnnouncement=useCallback(a=>setAnnouncements(rows=>[{...a,id:a.id||`ANN-${Date.now()}`,createdAt:a.createdAt||new Date().toISOString()},...rows]),[])
 const updateAnnouncement=useCallback(a=>setAnnouncements(rows=>rows.map(x=>x.id===a.id?a:x)),[])
 const removeAnnouncement=useCallback(id=>setAnnouncements(rows=>rows.filter(x=>x.id!==id)),[])
 const resetDemoReads=useCallback(()=>setReads({}),[])
 const value=useMemo(()=>({announcements,visibleAnnouncements,notificationItems,unreadItems,unreadCount,birthday,operational,markRead,markUnread,markAllRead,addAnnouncement,updateAnnouncement,removeAnnouncement,resetDemoReads}),[announcements,visibleAnnouncements,notificationItems,unreadItems,unreadCount,birthday,operational,markRead,markUnread,markAllRead,addAnnouncement,updateAnnouncement,removeAnnouncement,resetDemoReads])
 return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}
export function useNotifications(){const v=useContext(NotificationContext);if(!v)throw new Error('useNotifications must be used inside NotificationProvider');return v}
