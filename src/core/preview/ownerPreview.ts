import { hospitalDate } from '../dates/hospitalDate'
// Platform Owner preview: the help-preview frame opened with ?helpOwner=1
// shows the Platform Owner screens with sample hospitals, users, demos and
// events, so they can be documented and checked without a live owner
// account. Only inside the help-preview iframe; real sessions never see it.
// Saving from these screens is not supported here (the services stay live).

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sample rows, read in the shape of each service
type Row = any

// Decided once, from the address the app was opened with: navigating inside
// the preview drops the query string.
let ownerPreview: boolean | undefined
export function isOwnerPreview(): boolean {
 if(ownerPreview===undefined){
  if(typeof window==='undefined'||window.self===window.top)ownerPreview=false
  else{const params=new URLSearchParams(window.location.search);ownerPreview=params.get('helpPreview')==='1'&&params.get('helpOwner')==='1'}
 }
 return ownerPreview
}

export const OWNER_PREVIEW_USER=Object.freeze({id:'owner-preview',email:'owner@limoxis-observer.local',fullName:'Άρης Ιωάννου',isPlatformOwner:true,isDemo:false})

const day=(offset: number)=>{const d=new Date();d.setDate(d.getDate()+offset);return hospitalDate(d)}
const at=(offsetDays: number,hour=10)=>{const d=new Date();d.setDate(d.getDate()+offsetDays);d.setHours(hour,12,0,0);return d.toISOString()}

const ORGANIZATIONS=[
 {id:'11111111-0000-4000-8000-000000000001',name:'Γ.Ν. Θεσσαλονίκης «Παπανικολάου»',code:'GNT-PAP',type:'hospital',status:'active',region:'Κεντρική Μακεδονία',health_region:'3η ΥΠΕ Μακεδονίας',city:'Θεσσαλονίκη',country:'Ελλάδα',contact_email:'ipc@papanikolaou.example',contact_phone:'2313 307000',bed_capacity:780,is_demo:false,operating_profile:'full',enabled_addons:['occupational_health','pharmacy','lira'],enabled_modules:null,idle_lock_minutes:15,branding:{},paused_at:null},
 {id:'11111111-0000-4000-8000-000000000002',name:'Γ.Ν. Κομοτηνής «Σισμανόγλειο»',code:'GNK-SIS',type:'hospital',status:'active',region:'Ανατολική Μακεδονία και Θράκη',health_region:'4η ΥΠΕ Μακεδονίας και Θράκης',city:'Κομοτηνή',country:'Ελλάδα',contact_email:'quality@sismanoglio.example',contact_phone:'25310 22222',bed_capacity:260,is_demo:false,operating_profile:'surveillance',enabled_addons:[],enabled_modules:null,idle_lock_minutes:10,branding:{},paused_at:null},
 {id:'11111111-0000-4000-8000-000000000003',name:'Κλινική Αγία Ειρήνη',code:'KL-AGEIR',type:'clinic',status:'suspended',region:'Αττική',health_region:'1η ΥΠΕ Αττικής',city:'Αθήνα',country:'Ελλάδα',contact_email:'admin@agiairini.example',contact_phone:'210 0000000',bed_capacity:90,is_demo:false,operating_profile:'basic',enabled_addons:[],enabled_modules:null,idle_lock_minutes:0,branding:{},paused_at:at(-12)},
]

const PEOPLE: Record<string, string[][]>={
 '11111111-0000-4000-8000-000000000001':[['hospital_admin','active','Μαρία Γεωργίου','m.georgiou','Διευθύντρια Νοσηλευτικής'],['infection_control_lead','active','Δρ. Νίκος Αλεξίου','n.alexiou','Πρόεδρος ΕΝΛ'],['quality_manager','active','Ελένη Παπά','e.papa','Υπεύθυνη Ποιότητας'],['department_manager','active','Κώστας Δήμου','k.dimou','Προϊστάμενος ΜΕΘ'],['staff_user','invited','Άννα Βλάχου','a.vlachou','Νοσηλευτής/τρια']],
 '11111111-0000-4000-8000-000000000002':[['hospital_admin','invited','Γιώργος Σταύρου','g.stavrou','Διοικητικός Διευθυντής'],['infection_control_lead','active','Δρ. Σοφία Ιωάννου','s.ioannou','ΝΕΛ']],
 '11111111-0000-4000-8000-000000000003':[['hospital_admin','disabled','Πέτρος Λάμπρου','p.lamprou','Διευθυντής']],
}

export const previewMemberships=()=>ORGANIZATIONS.map(organization=>({id:`platform-owner:${organization.id}`,role:'platform_owner',status:'active',organization,departmentIds:[],capabilities:[],customCapabilities:[],assignments:[],platformSynthetic:true}))

export const previewPlatformMembers=()=>Object.entries(PEOPLE).flatMap(([orgId,list])=>{const organization=ORGANIZATIONS.find(o=>o.id===orgId);return list.map(([role,status],index)=>({id:`m-${orgId.slice(-1)}-${index}`,organization_id:orgId,user_id:`u-${orgId.slice(-1)}-${index}`,role,status,organization:{id:orgId,name:organization!.name,code:organization!.code,is_demo:false}}))})

export const previewOrganizationMembers=(organizationId: string | null | undefined)=>(PEOPLE[organizationId as string]||[]).map(([role,status,name,username,jobTitle],index)=>({id:`m-${organizationId!.slice(-1)}-${index}`,userId:`u-${organizationId!.slice(-1)}-${index}`,role,status,username,name,email:`${username}@example.org`,phone:'',jobTitle,invitationStatus:status==='invited'?'pending':'accepted',invitationCreatedAt:status==='invited'?at(-2):null,invitationExpiresAt:status==='invited'?at(5):null,createdAt:day(-200+index*9)}))

export const previewDemos=()=>[
 {id:'demo-1',label:'Γ.Ν. Λάρισας — αξιολόγηση',contact_name:'Δρ. Αθηνά Κ.',contact_email:'athina@larisa.example',valid_from:day(-20),valid_until:day(10),status:'active',organization_id:'demo-org-1',demo_user_id:'demo-u-1',organization:{id:'demo-org-1',name:'Demo · Γ.Ν. Λάρισας',code:'DEMO-LAR',is_demo:true}},
 {id:'demo-2',label:'Ιδιωτική κλινική Πάτρας',contact_name:'Ιωάννα Μ.',contact_email:'ioanna@patra.example',valid_from:day(-28),valid_until:day(2),status:'active',organization_id:'demo-org-2',demo_user_id:'demo-u-2',organization:{id:'demo-org-2',name:'Demo · Κλινική Πάτρας',code:'DEMO-PAT',is_demo:true}},
 {id:'demo-3',label:'Π.Γ.Ν. Ηρακλείου — ΕΝΛ',contact_name:'Μιχάλης Τ.',contact_email:'michalis@pagni.example',valid_from:day(-40),valid_until:day(-3),status:'expired',organization_id:'demo-org-3',demo_user_id:'demo-u-3',organization:{id:'demo-org-3',name:'Demo · ΠΑΓΝΗ',code:'DEMO-HER',is_demo:true}},
 {id:'demo-4',label:'ΚΑΤ — Ποιότητα',contact_name:'Ε. Ζαχαρίου',contact_email:'ez@kat.example',valid_from:day(-6),valid_until:day(24),status:'paused',organization_id:'demo-org-4',demo_user_id:'demo-u-4',organization:{id:'demo-org-4',name:'Demo · ΚΑΤ',code:'DEMO-KAT',is_demo:true}},
 {id:'demo-5',label:'Γ.Ν. Κέρκυρας',contact_name:'Σ. Βλάχου',contact_email:'sv@corfu.example',valid_from:day(-42),valid_until:day(-12),status:'active',organization_id:'demo-org-5',demo_user_id:'demo-u-5',organization:{id:'demo-org-5',name:'Demo · Γ.Ν. Κέρκυρας',code:'DEMO-CFU',is_demo:true}},
]

// Everyone on the platform, as listPlatformUsers returns them, for the preview.
export const previewPlatformUsers=(): Row[]=>[
 {id:'owner',userId:'owner',name:'Platform Owner',email:'owner@example.org',username:'owner',role:'platform_owner',status:'active',invitation:null,organization:null,kind:'platform',createdAt:day(-400)},
 ...Object.keys(PEOPLE).flatMap(orgId=>{const organization=ORGANIZATIONS.find(o=>o.id===orgId);return previewOrganizationMembers(orgId).map((m,index)=>({id:m.id,userId:m.userId,name:m.name,email:m.email,username:m.username,role:m.role,status:m.status,invitation:m.status==='invited'?'pending':'accepted',organization:organization&&{id:organization.id,name:organization.name,code:organization.code,is_demo:false},kind:'hospital',createdAt:day(-200+index*9)}))}),
 ...previewDemos().map((d,index)=>({id:`dm-${d.id}`,userId:d.demo_user_id,name:d.contact_name,email:d.contact_email,username:d.contact_email.split('@')[0],role:'hospital_admin',status:index%2?'invited':'active',invitation:index%2?(index===3?'expired':'pending'):'accepted',organization:d.organization,demoId:d.id,kind:'demo',createdAt:d.valid_from})),
]

// What deleting the given organizations would remove, for the preview's delete dialog.
const PREVIEW_IMPACT: Record<string, number[]>={'demo-org-3':[1284,96,12,8400000,4,4],'demo-org-5':[0,74,0,0,1,0],'demo-org-1':[642,74,5,2100000,3,3],'demo-org-2':[210,74,1,300000,2,2],'demo-org-4':[388,74,2,900000,2,1]}
export const previewDeletionImpact=(ids: readonly unknown[])=>(ids as string[]).map(id=>{
 const organization=ORGANIZATIONS.find(o=>o.id===id)||previewDemos().find(d=>d.organization_id===id)?.organization
 if(!organization)return null
 const [records,systemRecords,files,bytes,members,accountsDeleted]=PREVIEW_IMPACT[id]||[3912+6240,74,418,1288490188,(PEOPLE[id]||[]).length,Math.max(0,(PEOPLE[id]||[]).length-1)]
 const status=(organization as { status?: string }).status||'active'
 const blockers=[!organization.is_demo&&status!=='suspended'?'not_suspended':null].filter(Boolean)
 return {organizationId:id,name:organization.name,code:organization.code,isDemo:Boolean(organization.is_demo),status,records,systemRecords,files,bytes,members,accountsDeleted,accountsKept:Math.max(0,members-accountsDeleted),blockers}
}).filter(Boolean)

export const previewAuditEvents=()=>[
 ['owner',ORGANIZATIONS[1].id,'platform_owner','update','organization',ORGANIZATIONS[1].id,-0.1],
 ['Μαρία Γεωργίου',ORGANIZATIONS[0].id,'hospital_admin','create','organization_member','u-1-4',-0.4],
 ['Μαρία Γεωργίου',ORGANIZATIONS[0].id,'hospital_admin','update','organization',ORGANIZATIONS[0].id,-1],
 ['Μαρία Γεωργίου',ORGANIZATIONS[0].id,'hospital_admin','update','organization_member','u-1-2',-2],
 ['Μαρία Γεωργίου',ORGANIZATIONS[0].id,'hospital_admin','suspend','organization_member','u-1-3',-6],
 ['Μαρία Γεωργίου',ORGANIZATIONS[0].id,'hospital_admin','create','organization_member','u-1-3',-9],
 ['owner',ORGANIZATIONS[2].id,'platform_owner','suspend','organization',ORGANIZATIONS[2].id,-12],
 ['owner','','platform_owner','update','platform_settings','global',-15],
].map(([actor,organizationId,actorRole,eventType,entityType,entityId,offset]: Row,index)=>({id:`audit-${index}`,organizationId,actorId:actor==='Μαρία Γεωργίου'?'u-1-0':actor,actorName:actor==='owner'?'Platform Owner':actor,actorRole,eventType,entityType,entityId,metadata:{},createdAt:at(offset)}))

export const previewRuntimeEvents=(organizationId?: string | null)=>[
 ['error','surveillance','/surveillance/new','Η αποθήκευση απέτυχε: λήξη χρόνου σύνδεσης.','DB-TIMEOUT',-0.2],
 ['warning','controls','/controls','Ο έλεγχος δεν φόρτωσε τα συνημμένα.','STORAGE-403',-1],
 ['info','training','/training','Αποστολή προσκλήσεων εκπαίδευσης (12).','',-2],
].map(([severity,module,route,userMessage,diagnosticCode,offset]: Row,index)=>({id:`ev-${organizationId?.slice(-1)||'x'}-${index}`,organizationId,actorId:'',actorName:'Ελένη Παπά',actorJobTitle:'Υπεύθυνη Ποιότητας',role:'quality_manager',severity,eventType:'ui_feedback',module,route,operation:'',userMessage,message:userMessage,diagnosticCode,appVersion:'0.47.6',occurredAt:at(offset)}))

// The Overview's hospital activity: last recorded activity, errors of the last 24 hours and one count per day of the last 14.
const PREVIEW_ACTIVITY: Record<string, [offsetDays: number, errors24h: number, activity: number[]]>={
 '11111111-0000-4000-8000-000000000001':[-2/24,0,[4,6,3,8,5,9,7,2,3,10,8,6,11,9]],
 '11111111-0000-4000-8000-000000000002':[-1,0,[1,0,2,0,1,3,0,1,0,2,1,0,1,2]],
 '11111111-0000-4000-8000-000000000003':[-12,0,[0,0,0,0,0,0,0,0,0,0,0,0,0,0]],
}
export const previewHospitalHealth=(now=Date.now())=>Object.fromEntries(Object.entries(PREVIEW_ACTIVITY).map(([id,[offset,errors24h,activity]])=>[id,{lastActivityAt:new Date(now+offset*86400000).toISOString(),errors24h,activity}]))

export const previewPlatformSettings=()=>({id:'global',supportEmail:'support@limoxis.example',defaultDemoDurationDays:30,demoAutoPurgeAfterDays:14,organizationDeletionGraceDays:30,maxDemoUsers:5,maintenanceNoticeEnabled:false,maintenanceNoticeEl:'',maintenanceNoticeEn:'',publicName:'Exeltos',publicEmail:'info@exeltos.com',publicPhone:'694 247 1022',publicWebsite:'https://exeltos.com/',updatedAt:at(-15)})

// The owner's announcements to the hospital administrators, as loadPlatformAnnouncements returns them.
export const previewPlatformAnnouncements=()=>[
 {id:'ann-1',kind:'announcement',titleEl:'Προγραμματισμένη συντήρηση το Σάββατο',titleEn:'Scheduled maintenance on Saturday',bodyEl:'Το Σάββατο 06:00–08:00 η εφαρμογή θα είναι διαθέσιμη μόνο για ανάγνωση.',bodyEn:'On Saturday 06:00–08:00 the application will be read-only.',ctaLabelEl:'',ctaLabelEn:'',ctaUrl:'',imageUrl:'',attachmentPath:'',attachmentName:'',attachmentType:'',showInDemo:false,startsAt:at(-2),endsAt:at(5),audience:[],frequency:'once',status:'active',createdAt:at(-2),seenCount:7},
 {id:'ann-2',kind:'promotion',titleEl:'Νέα ενότητα: Κουζίνα & HACCP',titleEn:'New module: Kitchen & HACCP',bodyEl:'Η ενότητα Κουζίνα & HACCP είναι διαθέσιμη. Ζητήστε ενεργοποίηση από την υποστήριξη.',bodyEn:'The Kitchen & HACCP module is available. Ask support to enable it.',ctaLabelEl:'Μάθετε περισσότερα',ctaLabelEn:'Learn more',ctaUrl:'https://limoxis.example/kitchen',imageUrl:'',attachmentPath:'',attachmentName:'',attachmentType:'',showInDemo:true,startsAt:at(-20),endsAt:at(-1),audience:[ORGANIZATIONS[0].id,ORGANIZATIONS[1].id],frequency:'every_visit',status:'stopped',createdAt:at(-20),seenCount:3},
]

// What resetting a Demo returns, for the preview's "Reset data" action.
export const previewDemoSeedResult=()=>({ok:true,departments:8,patients:48,surveillanceCases:14,laboratorySamples:43,microbiologyResults:38,handHygieneSessions:36,employees:24,incidents:10,capa:6,documents:8,committees:2,controls:6,controlExecutions:350,trainingPrograms:5,trainingAssignments:72,antibioticDispensing:360,vaccinations:76,occupationalVisits:29,exposures:4})

// Sign-ins (Ιστορικό & Υγεία › Συνδέσεις): sessions with IP/device, failed attempts and one lock.
const minutesAgo=(minutes: number)=>new Date(Date.now()-minutes*60000).toISOString()
const DEVICE={win:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',mac:'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',iphone:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'}
// The same user ids as previewOrganizationMembers (u-<organization>-<index>), so the sessions match the members.
const memberOf=(username: string)=>{for(const [orgId,list] of Object.entries(PEOPLE)){const index=list.findIndex(person=>person[3]===username);if(index>=0)return {orgId,index}}return null}
const memberUserId=(username: string)=>{const found=memberOf(username);return found?`u-${found.orgId.slice(-1)}-${found.index}`:`u-${username}`}
const memberOrganizationId=(username: string)=>memberOf(username)?.orgId||''
export const previewLoginSessions=()=>[
 ['Άρης Ιωάννου','owner','',true,'94.64.59.134','mac',95,1,null,null],
 ['Μαρία Γεωργίου','m.georgiou',ORGANIZATIONS[0].name,false,'109.242.139.64','win',190,160,160,'signed_out'],
 ['Δρ. Νίκος Αλεξίου','n.alexiou',ORGANIZATIONS[0].name,false,'109.242.185.33','iphone',38,6,null,null],
 ['Δρ. Σοφία Ιωάννου','s.ioannou',ORGANIZATIONS[1].name,false,'85.74.12.201','win',260,70,null,null],
 ['Ελένη Παπά','e.papa',ORGANIZATIONS[0].name,false,'109.242.140.12','mac',600,420,420,'signed_out'],
 ['Μαρία Γεωργίου','m.georgiou',ORGANIZATIONS[0].name,false,'109.242.139.64','win',1500,1310,1310,'signed_out'],
 ['Δρ. Νίκος Αλεξίου','n.alexiou',ORGANIZATIONS[0].name,false,'185.220.101.4','win',2900,2880,2880,'ended_by_owner'],
 ['Δρ. Νίκος Αλεξίου','n.alexiou',ORGANIZATIONS[0].name,false,'109.242.185.33','win',300,95,null,null],
 ['Δρ. Νίκος Αλεξίου','n.alexiou',ORGANIZATIONS[0].name,false,'109.242.185.40','mac',1700,1650,1650,'signed_out'],
].map(([fullName,username,organizations,owner,ip,device,started,seen,ended,reason]: Row,index)=>({sessionId:`s-${index}`,userId:owner?'owner':memberUserId(username),organizationId:owner?'':memberOrganizationId(username),fullName,username,email:`${username}@example.org`,isPlatformOwner:owner,organizations,ip,lastIp:ip,userAgent:DEVICE[device as keyof typeof DEVICE],startedAt:minutesAgo(started),lastSeenAt:minutesAgo(seen),endedAt:ended==null?null:minutesAgo(ended),endedReason:reason,active:ended==null&&seen<720,online:ended==null&&seen<10}))
export const previewLoginAttempts=()=>[
 ['m.georgiou','109.242.139.64',true,'ok',190],
 ['n.alexiou','109.242.185.33',true,'ok',38],
 ['admin','185.220.101.4',false,'unknown_user',22],
 ['admin','185.220.101.4',false,'unknown_user',21],
 ['m.georgiou','185.220.101.4',false,'wrong_password',6],
 ['m.georgiou','185.220.101.4',false,'wrong_password',5],
 ['m.georgiou','185.220.101.4',false,'wrong_password',4],
 ['m.georgiou','185.220.101.4',false,'wrong_password',3],
 ['m.georgiou','185.220.101.4',false,'wrong_password',2],
 ['m.georgiou','185.220.101.4',false,'locked',1],
].map(([identifier,ip,success,reason,ago]: Row,index)=>({id:index+1,identifier,ip,userAgent:DEVICE.win,success,reason,createdAt:minutesAgo(ago)})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
export const previewLoginLocks=()=>[{id:1,kind:'account',subject:'m.georgiou',failures:5,lockedUntil:new Date(Date.now()+13*60000).toISOString(),createdAt:minutesAgo(2),releasedAt:null},{id:2,kind:'ip',subject:'185.220.101.4',failures:20,lockedUntil:new Date(Date.now()+9*60000).toISOString(),createdAt:minutesAgo(6),releasedAt:null}]
