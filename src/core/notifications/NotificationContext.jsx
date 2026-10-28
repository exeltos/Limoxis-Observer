import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useTenant } from '../tenant/TenantContext'
import { loadBirthdayEmployeesAsync } from '../../features/employees/employeeService'
import { useLanguage } from '../i18n/LanguageContext'
import { loadSnapshot, saveSnapshot } from '../data/repository'
import { processNotificationOutboxAsync } from './notificationEmailService'
import { useDataRefreshTick } from './useDataRefreshTick'
// The committee services (and their workflow module) load only when a real
// hospital session asks for its pending committee items, not with the app shell.
const membershipService=()=>import('../../features/committees/committeeMembershipService')
const minutesInboxService=()=>import('../../features/committees/committeeMinutesApprovalInboxService')
import { acknowledgeAnnouncement as acknowledgeAnnouncementCloud,loadAnnouncements,loadMyAnnouncementAcknowledgements } from '../../features/management/announcementCloudService'
import { loadDashboardMetrics } from '../../features/dashboard/dashboardCloudService'
import { DEPARTMENT_ROLES, dashboardTasks } from '../../features/dashboard/dashboardTasks'
import { can } from '../permissions/roles'
// The Demo counts read the sample hospital's records: loaded only in the Demo.
const demoMetricsModule=()=>import('../../features/dashboard/demoDashboardMetrics')
import { collectDemoOrganismClusters,loadActiveClustersAsync } from '../../features/surveillance/outbreakClusterService'
import { clusterAlertId } from '../../features/surveillance/clusterDetection'
import { loadPlatformAttentionItems } from '../../features/platform/platformAttentionService'
import { useOptionalFeedback } from '../feedback/FeedbackContext'
import { expiryAlerts } from '../../features/controls/controlExpiry'
// The control programme loads only to work out the expiry alerts.
const controlServiceModule=()=>import('../../features/controls/controlCloudService')
// Legislation loads only for the Platform Owner and the hospital's quality people.
const legislationModule=()=>Promise.all([import('../../features/legislation/legislationService'),import('../../features/legislation/legislationModel')])
const LEGISLATION_ROLES=['hospital_admin','quality_manager']
// Reports waiting for classification: only the people who classify them are reminded.
const REPORT_REMINDER_ROLES=['hospital_admin','quality_manager']
const REPORT_WAIT_DAYS=7
const qualityModule=()=>Promise.all([import('../../features/quality/qualityService'),import('../../features/quality/qualityRegister')])

// The bell's reads are not what the screen opened for: they start once the
// browser is idle after the first paint (or shortly after, without
// requestIdleCallback), so the page's own data goes first.
export function whenIdle(task){
 if(typeof window==='undefined')return()=>{}
 if(typeof window.requestIdleCallback==='function'){const id=window.requestIdleCallback(task,{timeout:2000});return()=>window.cancelIdleCallback?.(id)}
 const id=window.setTimeout(task,200);return()=>window.clearTimeout(id)
}

const NotificationContext=createContext(null)
const CLUSTER_ALERT_ROLES=['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']

const demoAnnouncements=[
 {id:'ANN-001',title:'Ενημέρωση Επιτήρησης',message:'Παρακαλούμε να ολοκληρωθούν οι εκκρεμείς επανεκτιμήσεις απομόνωσης.',priority:'high',audienceType:'all',audienceValues:[],createdBy:'Υπεύθυνος Λοιμώξεων',createdAt:'2026-08-29T07:30:00',requiresAck:true,startAt:'',endAt:''},
 {id:'ANN-002',title:'Υπενθύμιση εκπαίδευσης',message:'Η νέα ενότητα πρόληψης λοιμώξεων είναι διαθέσιμη στο Κέντρο Εκπαίδευσης.',priority:'normal',audienceType:'all',audienceValues:[],createdBy:'Διαχειριστής',createdAt:'2026-08-28T12:00:00',requiresAck:false,startAt:'',endAt:''},
]
function valuesFor(a){return Array.isArray(a.audienceValues)?a.audienceValues:(a.audienceValue?[a.audienceValue]:[])}
function applies(a,{role,membership,user,profile}){const vals=valuesFor(a);if(a.audienceType==='all')return true;if(a.audienceType==='role')return vals.includes(role);if(a.audienceType==='department'){const own=[...(membership?.departmentIds||[]),membership?.previewDepartment].filter(Boolean);return vals.some(v=>own.includes(v))}if(a.audienceType==='user')return vals.some(v=>[user?.id,user?.email,profile?.id,profile?.email].filter(Boolean).includes(v));return false}
function withinWindow(a,now=Date.now()){const start=a.startAt?new Date(a.startAt).getTime():null,end=a.endAt?new Date(a.endAt).getTime():null;return (!start||Number.isNaN(start)||now>=start)&&(!end||Number.isNaN(end)||now<=end)}
export const demoAnnouncementText={el:{'ANN-001':{title:'Ενημέρωση Επιτήρησης',message:'Παρακαλούμε να ολοκληρωθούν οι εκκρεμείς επανεκτιμήσεις απομόνωσης.'},'ANN-002':{title:'Υπενθύμιση εκπαίδευσης',message:'Η νέα ενότητα πρόληψης λοιμώξεων είναι διαθέσιμη στο Κέντρο Εκπαίδευσης.'}},en:{'ANN-001':{title:'Surveillance update',message:'Please complete the pending isolation reassessments.'},'ANN-002':{title:'Training reminder',message:'The new infection prevention module is available in the Training Center.'}}}

export function NotificationProvider({children}){
 const {user,profile}=useAuth(); const {role,membership,tenant,isDemo,reloadMemberships,canAccessRecord}=useTenant(); const {language}=useLanguage()
 const [announcements,setAnnouncements]=useState(()=>isDemo?(loadSnapshot('announcements',null)||demoAnnouncements):[]),[reads,setReads]=useState(()=>loadSnapshot('notification_reads',{})),[announcementAcknowledgements,setAnnouncementAcknowledgements]=useState(()=>new Set()),[committeeMemberships,setCommitteeMemberships]=useState([]),[committeeMinutesApprovals,setCommitteeMinutesApprovals]=useState([]),[liveOperational,setLiveOperational]=useState([]),[clusterAlerts,setClusterAlerts]=useState([]),[clock,setClock]=useState(Date.now())
 useEffect(()=>{const id=window.setInterval(()=>setClock(Date.now()),60000);return()=>window.clearInterval(id)},[])
 const announcementsMounted=useRef(false),readsMounted=useRef(false)
 useEffect(()=>{if(!isDemo)return;if(!announcementsMounted.current){announcementsMounted.current=true;return}saveSnapshot('announcements',announcements)},[announcements,isDemo])
 useEffect(()=>{if(!readsMounted.current){readsMounted.current=true;return}saveSnapshot('notification_reads',reads)},[reads])
 const reloadAnnouncements=useCallback(async()=>{if(isDemo){setAnnouncementAcknowledgements(new Set());return}if(!tenant?.id||!user?.id){setAnnouncements([]);setAnnouncementAcknowledgements(new Set());return}try{const [items,acks]=await Promise.all([loadAnnouncements(tenant.id),loadMyAnnouncementAcknowledgements(tenant.id,user.id)]);setAnnouncements(items);setAnnouncementAcknowledgements(acks)}catch{setAnnouncements([]);setAnnouncementAcknowledgements(new Set())}},[isDemo,tenant?.id,user?.id])
 useEffect(()=>{void reloadAnnouncements()},[reloadAnnouncements])
 const reloadCommitteeMemberships=useCallback(async()=>{if(isDemo||!tenant?.id||!user?.id){setCommitteeMemberships([]);return}try{setCommitteeMemberships(await (await membershipService()).loadMyPendingCommitteeMembershipsAsync(tenant.id,user.id))}catch{setCommitteeMemberships([])}},[isDemo,tenant?.id,user?.id])
 const reloadCommitteeMinutesApprovals=useCallback(async()=>{if(isDemo||!tenant?.id||!user?.id){setCommitteeMinutesApprovals([]);return}try{setCommitteeMinutesApprovals(await (await minutesInboxService()).loadMyPendingCommitteeMinutesApprovalsAsync(tenant.id,user.id))}catch{setCommitteeMinutesApprovals([])}},[isDemo,tenant?.id,user?.id])
 const reloadLiveOperational=useCallback(async()=>{if(!isDemo&&!tenant?.id&&profile?.isPlatformOwner){try{setLiveOperational(await loadPlatformAttentionItems(language))}catch{setLiveOperational([])}return}if(isDemo){const demoRole=role==='demo'||role==='platform_owner'?'hospital_admin':role;try{const {metrics}=(await demoMetricsModule()).collectDemoDashboardMetrics({department:DEPARTMENT_ROLES.has(demoRole)?membership?.previewDepartment||null:null});setLiveOperational(dashboardTasks(demoRole,metrics,language,{canUse:capability=>can(demoRole,capability,membership?.capabilities??[],membership?.customCapabilities??[])}))}catch{setLiveOperational([])}return}if(!tenant?.id){setLiveOperational([]);return}// Inside a hospital the Platform Owner has the hospital administrator's work (as on the home page).
const hospitalRole=role==='platform_owner'?'hospital_admin':role;try{const metrics=await loadDashboardMetrics(tenant.id,{departmentIds:DEPARTMENT_ROLES.has(hospitalRole)?membership?.departmentIds:null});setLiveOperational(dashboardTasks(hospitalRole,metrics,language,{canUse:capability=>can(hospitalRole,capability,membership?.capabilities??[],membership?.customCapabilities??[])}))}catch{setLiveOperational([])}},[isDemo,tenant?.id,role,language,profile?.isPlatformOwner,membership?.previewDepartment,membership?.departmentIds,membership?.capabilities,membership?.customCapabilities])
 // Medicines and supplies that expire soon or have expired, one item per
 // control and department the user can see (Controls › expiry checks).
 const [expiryProgramme,setExpiryProgramme]=useState([])
 const reloadExpiryAlerts=useCallback(async()=>{if(!tenant?.id||!role||role==='platform_owner'&&!isDemo){setExpiryProgramme([]);return}try{setExpiryProgramme(await (await controlServiceModule()).loadExpiryProgramme(tenant.id))}catch{setExpiryProgramme([])}},[tenant?.id,role,isDemo])
 const reloadClusterAlerts=useCallback(async()=>{if(!CLUSTER_ALERT_ROLES.includes(role)){setClusterAlerts([]);return}if(isDemo){try{setClusterAlerts(await collectDemoOrganismClusters())}catch{setClusterAlerts([])}return}if(!tenant?.id){setClusterAlerts([]);return}try{setClusterAlerts(await loadActiveClustersAsync(tenant.id))}catch{setClusterAlerts([])}},[isDemo,tenant?.id,role])
 // Legislation: what the automatic check found (Platform Owner), new texts and updates to review (the hospital).
 const [legislationItems,setLegislationItems]=useState([])
 const reloadLegislation=useCallback(async()=>{const en=language==='en';try{const [service,model]=await legislationModule();const items=[]
  if(profile?.isPlatformOwner&&!isDemo){const count=await service.pendingCandidateCount();if(count)items.push({id:`legislation-review:${count}`,type:'legislation',title:en?'Legislation to review':'Νομοθεσία προς έλεγχο',message:en?`${count} items found by the automatic check`:`${count} ευρήματα από τον αυτόματο έλεγχο`,to:'/legislation?tab=review'})}
  if((tenant?.id||isDemo)&&(LEGISLATION_ROLES.includes(role)||(isDemo&&role==='demo'))){const data=await service.loadRegister(tenant?.id);const entries=model.buildRegister(data.versions,data.rows).filter(entry=>entry.state==='new'||entry.state==='update');if(entries.length)items.push({id:`legislation-register:${entries.map(entry=>`${entry.text.id}.${entry.text.version}`).join(',')}`,type:'legislation',title:en?'Legislation updates':'Ενημερώσεις νομοθεσίας',message:entries.map(entry=>entry.text.title).slice(0,3).join(' · '),to:entries.length===1?`/legislation/${entries[0].text.id}`:'/documents?tab=legislation'})}
  setLegislationItems(items)}catch{setLegislationItems([])}},[profile?.isPlatformOwner,isDemo,tenant?.id,role,language])
 useEffect(()=>{const cancel=whenIdle(()=>void reloadLegislation());const id=window.setInterval(()=>void reloadLegislation(),30*60000);return()=>{cancel();window.clearInterval(id)}},[reloadLegislation])
 // Quality: one reminder a day while reports wait for their classification.
 const [staleReportCount,setStaleReportCount]=useState(0)
 const reloadStaleReports=useCallback(async()=>{if(!REPORT_REMINDER_ROLES.includes(role)||(!tenant?.id&&!isDemo)){setStaleReportCount(0);return}try{const [service,register]=await qualityModule();const incidents=await service.loadQualityRecords('incidents',tenant?.id);setStaleReportCount(register.staleReports(incidents,{today:new Date().toISOString().slice(0,10),days:REPORT_WAIT_DAYS}).length)}catch{setStaleReportCount(0)}},[role,tenant?.id,isDemo])
 // Counts and pending items: on entry and every DATA_REFRESH_MS while the page is in view (not on the one-minute clock).
 const dataTick=useDataRefreshTick()
 useEffect(()=>whenIdle(()=>{void reloadCommitteeMemberships();void reloadCommitteeMinutesApprovals();void reloadLiveOperational();void reloadClusterAlerts();void reloadExpiryAlerts();void reloadStaleReports()}),[reloadCommitteeMemberships,reloadCommitteeMinutesApprovals,reloadLiveOperational,reloadClusterAlerts,reloadExpiryAlerts,reloadStaleReports,dataTick])
 // The e-mail outbox follows the same tick: every DATA_REFRESH_MS while the page
 // is in view, not every minute in every open tab (each run is an edge function call).
 useEffect(()=>{if(isDemo||!tenant?.id)return;return whenIdle(()=>void processNotificationOutboxAsync(tenant.id).catch(()=>{}))},[isDemo,tenant?.id,dataTick])
 const audience=useMemo(()=>({role,membership,user,profile}),[role,membership,user,profile])
 const visibleAnnouncements=useMemo(()=>announcements.filter(a=>(!isDemo||applies(a,audience))&&withinWindow(a,clock)).map(a=>{const localized=isDemo?demoAnnouncementText[language]?.[a.id]:null;return {...a,...(localized||{}),acknowledged:announcementAcknowledgements.has(a.id)}}).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))),[announcements,isDemo,audience,clock,language,announcementAcknowledgements])
 // Birthdays: only the active employees with a birth date, and only these columns (not the employee register).
 const [employeeRows,setEmployeeRows]=useState([])
 useEffect(()=>{let alive=true;const cancel=whenIdle(()=>{Promise.resolve().then(()=>loadBirthdayEmployeesAsync(tenant?.id)).then(rows=>{if(alive)setEmployeeRows(rows)}).catch(()=>{if(alive)setEmployeeRows([])})});return()=>{alive=false;cancel()}},[tenant?.id])
 const birthday=useMemo(()=>{const today=new Date(clock),md=`${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;return employeeRows.filter(e=>e.employmentStatus==='active'&&String(e.birthDate||'').slice(5)===md)},[clock,employeeRows])
 const operational=liveOperational
 // What evaluators just did in their Demos (sign-up, evaluation) also pops up
 // for the Platform Owner, once each: the newest three not seen yet.
 const feedback=useOptionalFeedback()
 useEffect(()=>{const fresh=liveOperational.filter(item=>item.popup);if(!fresh.length||!feedback)return
  const seen=new Set(loadSnapshot('platform_popup_seen',[])||[]);const unseen=fresh.filter(item=>!seen.has(item.id));if(!unseen.length)return
  unseen.slice(0,3).forEach(item=>feedback.notify(`${item.title} · ${item.message}`,'success',{operation:'platform_demo_activity'}))
  saveSnapshot('platform_popup_seen',[...seen,...unseen.map(item=>item.id)].slice(-200))},[liveOperational,feedback])
 const membershipItems=useMemo(()=>committeeMemberships.map(item=>({...item,title:language==='en'?'Committee membership approval':'Αποδοχή συμμετοχής σε επιτροπή',message:`${item.committeeName}${item.committeeTitle?` · ${item.committeeTitle}`:''}`,to:item.committeeId?`/committees/${item.committeeId}`:'/meetings',read:false})),[committeeMemberships,language])
 const minutesApprovalItems=useMemo(()=>committeeMinutesApprovals.map(item=>({...item,title:language==='en'?'Minutes approval required':'Απαιτείται έγκριση πρακτικών',message:`${item.committeeName}${item.meetingTitle?` · ${item.meetingTitle}`:''}`,read:false})),[committeeMinutesApprovals,language])
 const clusterItems=useMemo(()=>{const en=language==='en';return clusterAlerts.map(cluster=>{const id=clusterAlertId(cluster);return {id,type:'cluster',title:en?'Possible infection cluster':'Πιθανό cluster λοίμωξης',message:`${cluster.organism} · ${cluster.department} · ${cluster.count} ${en?'cases in':'περιστατικά σε'} ${cluster.windowDays} ${en?'days':'ημέρες'}${cluster.resistanceLabels?.length?` · ${cluster.resistanceLabels.join(', ')}`:''}`,to:'/laboratory',read:Boolean(reads[id])}})},[clusterAlerts,language,reads])
 const expiryItemsForBell=useMemo(()=>expiryAlerts(expiryProgramme,{language,now:new Date(clock),canSee:(record,dep)=>canAccessRecord?canAccessRecord({department:dep,departmentId:record.departmentIdByName?.[dep]||null}):true}).map(item=>({...item,read:Boolean(reads[item.id])})),[expiryProgramme,language,clock,canAccessRecord,reads])
 const staleReportItems=useMemo(()=>{if(!staleReportCount)return[];const en=language==='en',id=`reports-waiting:${new Date(clock).toISOString().slice(0,10)}:${staleReportCount}`;return[{id,type:'quality',title:en?'Reports waiting for classification':'Αναφορές που περιμένουν ταξινόμηση',message:en?`${staleReportCount} ${staleReportCount===1?'report has':'reports have'} waited over ${REPORT_WAIT_DAYS} days`:`${staleReportCount} ${staleReportCount===1?'αναφορά περιμένει':'αναφορές περιμένουν'} πάνω από ${REPORT_WAIT_DAYS} ημέρες`,to:'/quality?tab=reports',read:Boolean(reads[id])}]},[staleReportCount,language,clock,reads])
 const notificationItems=useMemo(()=>[...minutesApprovalItems,...membershipItems,...staleReportItems,...clusterItems,...expiryItemsForBell,...legislationItems.map(item=>({...item,read:Boolean(reads[item.id])})),...visibleAnnouncements.map(a=>({...a,type:'announcement',read:a.requiresAck?!a.acknowledged?false:true:Boolean(reads[a.id]),to:a.linkPath||'/'})),...operational.map(o=>({...o,read:Boolean(reads[o.id])}))],[minutesApprovalItems,membershipItems,staleReportItems,clusterItems,expiryItemsForBell,legislationItems,visibleAnnouncements,operational,reads])
 const unreadItems=useMemo(()=>notificationItems.filter(x=>!x.read),[notificationItems]),unreadCount=unreadItems.length
 const requiredAckIds=useMemo(()=>new Set(visibleAnnouncements.filter(a=>a.requiresAck&&!a.acknowledged).map(a=>a.id)),[visibleAnnouncements])
 const markRead=useCallback(id=>{if(requiredAckIds.has(id))return;setReads(r=>({...r,[id]:true}))},[requiredAckIds]),markUnread=useCallback(id=>setReads(r=>{const next={...r};delete next[id];return next}),[]),markAllRead=useCallback(()=>setReads(r=>({...r,...Object.fromEntries(notificationItems.filter(x=>!['committee_membership','committee_minutes_approval'].includes(x.type)&&!(x.type==='announcement'&&x.requiresAck&&!x.acknowledged)).map(x=>[x.id,true]))})),[notificationItems])
 const acknowledgeAnnouncement=useCallback(async id=>{const item=announcements.find(a=>a.id===id);if(!item?.requiresAck)return;if(isDemo){setAnnouncementAcknowledgements(s=>new Set([...s,id]));setReads(r=>({...r,[id]:true}));return}if(!tenant?.id||!user?.id)throw new Error('Organization and user are required');await acknowledgeAnnouncementCloud(tenant.id,id,user.id);setAnnouncementAcknowledgements(s=>new Set([...s,id]));setReads(r=>({...r,[id]:true}))},[announcements,isDemo,tenant?.id,user?.id])
 const answerCommitteeMembership=useCallback(async(item,status)=>{await (await membershipService()).answerMyCommitteeMembershipAsync(item,status);await Promise.all([reloadCommitteeMemberships(),reloadMemberships()])},[reloadCommitteeMemberships,reloadMemberships])
 const answerCommitteeMinutesApproval=useCallback(async(item,status,comment='')=>{await (await minutesInboxService()).answerMyCommitteeMinutesApprovalAsync(item,status,comment);await reloadCommitteeMinutesApprovals()},[reloadCommitteeMinutesApprovals])
 const addAnnouncement=useCallback(a=>{if(!isDemo)return;setAnnouncements(rows=>[{...a,id:a.id||`ANN-${Date.now()}`,createdAt:a.createdAt||new Date().toISOString()},...rows])},[isDemo]),updateAnnouncement=useCallback(a=>{if(!isDemo)return;setAnnouncements(rows=>rows.map(x=>x.id===a.id?a:x))},[isDemo]),removeAnnouncement=useCallback(id=>{if(!isDemo)return;setAnnouncements(rows=>rows.filter(x=>x.id!==id))},[isDemo]),resetDemoReads=useCallback(()=>setReads({}),[])
 const value=useMemo(()=>({announcements,visibleAnnouncements,notificationItems,unreadItems,unreadCount,birthday,operational,committeeMemberships,committeeMinutesApprovals,answerCommitteeMembership,answerCommitteeMinutesApproval,reloadCommitteeMinutesApprovals,reloadAnnouncements,acknowledgeAnnouncement,markRead,markUnread,markAllRead,addAnnouncement,updateAnnouncement,removeAnnouncement,resetDemoReads}),[announcements,visibleAnnouncements,notificationItems,unreadItems,unreadCount,birthday,operational,committeeMemberships,committeeMinutesApprovals,answerCommitteeMembership,answerCommitteeMinutesApproval,reloadCommitteeMinutesApprovals,reloadAnnouncements,acknowledgeAnnouncement,markRead,markUnread,markAllRead,addAnnouncement,updateAnnouncement,removeAnnouncement,resetDemoReads])
 return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}
export function useNotifications(){const v=useContext(NotificationContext);if(!v)throw new Error('useNotifications must be used inside NotificationProvider');return v}
