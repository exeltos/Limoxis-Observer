// Platform Owner preview: the help-preview frame opened with ?helpOwner=1
// shows the Platform Owner screens with sample hospitals, users, demos and
// events, so they can be documented and checked without a live owner
// account. Only inside the help-preview iframe; real sessions never see it.
// Saving from these screens is not supported here (the services stay live).

// Decided once, from the address the app was opened with: navigating inside
// the preview drops the query string.
let ownerPreview
export function isOwnerPreview(){
 if(ownerPreview===undefined){
  if(typeof window==='undefined'||window.self===window.top)ownerPreview=false
  else{const params=new URLSearchParams(window.location.search);ownerPreview=params.get('helpPreview')==='1'&&params.get('helpOwner')==='1'}
 }
 return ownerPreview
}

export const OWNER_PREVIEW_USER=Object.freeze({id:'owner-preview',email:'owner@limoxis-observer.local',fullName:'Platform Owner',isPlatformOwner:true,isDemo:false})

const day=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)}
const at=(offsetDays,hour=10)=>{const d=new Date();d.setDate(d.getDate()+offsetDays);d.setHours(hour,12,0,0);return d.toISOString()}

const ORGANIZATIONS=[
 {id:'11111111-0000-4000-8000-000000000001',name:'Γ.Ν. Θεσσαλονίκης «Παπανικολάου»',code:'GNT-PAP',type:'hospital',status:'active',region:'Κεντρική Μακεδονία',health_region:'3η ΥΠΕ Μακεδονίας',city:'Θεσσαλονίκη',country:'GR',contact_email:'ipc@papanikolaou.example',contact_phone:'2313 307000',bed_capacity:780,is_demo:false,operating_profile:'full',enabled_addons:['occupational_health','pharmacy','lira'],enabled_modules:null,idle_lock_minutes:15,branding:{},paused_at:null},
 {id:'11111111-0000-4000-8000-000000000002',name:'Γ.Ν. Κομοτηνής «Σισμανόγλειο»',code:'GNK-SIS',type:'hospital',status:'active',region:'Ανατολική Μακεδονία και Θράκη',health_region:'4η ΥΠΕ Μακεδονίας και Θράκης',city:'Κομοτηνή',country:'GR',contact_email:'quality@sismanoglio.example',contact_phone:'25310 22222',bed_capacity:260,is_demo:false,operating_profile:'surveillance',enabled_addons:[],enabled_modules:null,idle_lock_minutes:10,branding:{},paused_at:null},
 {id:'11111111-0000-4000-8000-000000000003',name:'Κλινική Αγία Ειρήνη',code:'KL-AGEIR',type:'clinic',status:'suspended',region:'Αττική',health_region:'1η ΥΠΕ Αττικής',city:'Αθήνα',country:'GR',contact_email:'admin@agiairini.example',contact_phone:'210 0000000',bed_capacity:90,is_demo:false,operating_profile:'basic',enabled_addons:[],enabled_modules:null,idle_lock_minutes:0,branding:{},paused_at:at(-12)},
]

const PEOPLE={
 '11111111-0000-4000-8000-000000000001':[['hospital_admin','active','Μαρία Γεωργίου','m.georgiou','Διευθύντρια Νοσηλευτικής'],['infection_control_lead','active','Δρ. Νίκος Αλεξίου','n.alexiou','Πρόεδρος ΕΝΛ'],['quality_manager','active','Ελένη Παπά','e.papa','Υπεύθυνη Ποιότητας'],['department_manager','active','Κώστας Δήμου','k.dimou','Προϊστάμενος ΜΕΘ'],['staff_user','invited','Άννα Βλάχου','a.vlachou','Νοσηλεύτρια']],
 '11111111-0000-4000-8000-000000000002':[['hospital_admin','invited','Γιώργος Σταύρου','g.stavrou','Διοικητικός Διευθυντής'],['infection_control_lead','active','Δρ. Σοφία Ιωάννου','s.ioannou','ΝΕΛ']],
 '11111111-0000-4000-8000-000000000003':[['hospital_admin','disabled','Πέτρος Λάμπρου','p.lamprou','Διευθυντής']],
}

export const previewMemberships=()=>ORGANIZATIONS.map(organization=>({id:`platform-owner:${organization.id}`,role:'platform_owner',status:'active',organization,departmentIds:[],capabilities:[],customCapabilities:[],assignments:[],platformSynthetic:true}))

export const previewPlatformMembers=()=>Object.entries(PEOPLE).flatMap(([orgId,list])=>{const organization=ORGANIZATIONS.find(o=>o.id===orgId);return list.map(([role,status],index)=>({id:`m-${orgId.slice(-1)}-${index}`,organization_id:orgId,user_id:`u-${orgId.slice(-1)}-${index}`,role,status,organization:{id:orgId,name:organization.name,code:organization.code,is_demo:false}}))})

export const previewOrganizationMembers=organizationId=>(PEOPLE[organizationId]||[]).map(([role,status,name,username,jobTitle],index)=>({id:`m-${organizationId.slice(-1)}-${index}`,userId:`u-${organizationId.slice(-1)}-${index}`,role,status,username,name,email:`${username}@example.org`,phone:'',jobTitle,invitationStatus:status==='invited'?'pending':'accepted',invitationCreatedAt:status==='invited'?at(-2):null,invitationExpiresAt:status==='invited'?at(5):null}))

export const previewDemos=()=>[
 {id:'demo-1',label:'Γ.Ν. Λάρισας — αξιολόγηση',contact_name:'Δρ. Αθηνά Κ.',contact_email:'athina@larisa.example',valid_from:day(-20),valid_until:day(10),status:'active',organization_id:'demo-org-1',demo_user_id:'demo-u-1',organization:{id:'demo-org-1',name:'Demo · Γ.Ν. Λάρισας',code:'DEMO-LAR',is_demo:true}},
 {id:'demo-2',label:'Ιδιωτική κλινική Πάτρας',contact_name:'Ιωάννα Μ.',contact_email:'ioanna@patra.example',valid_from:day(-28),valid_until:day(2),status:'active',organization_id:'demo-org-2',demo_user_id:'demo-u-2',organization:{id:'demo-org-2',name:'Demo · Κλινική Πάτρας',code:'DEMO-PAT',is_demo:true}},
 {id:'demo-3',label:'Π.Γ.Ν. Ηρακλείου — ΕΝΛ',contact_name:'Μιχάλης Τ.',contact_email:'michalis@pagni.example',valid_from:day(-40),valid_until:day(-3),status:'expired',organization_id:'demo-org-3',demo_user_id:'demo-u-3',organization:{id:'demo-org-3',name:'Demo · ΠΑΓΝΗ',code:'DEMO-HER',is_demo:true}},
 {id:'demo-4',label:'ΚΑΤ — Ποιότητα',contact_name:'Ε. Ζαχαρίου',contact_email:'ez@kat.example',valid_from:day(-6),valid_until:day(24),status:'paused',organization_id:'demo-org-4',demo_user_id:'demo-u-4',organization:{id:'demo-org-4',name:'Demo · ΚΑΤ',code:'DEMO-KAT',is_demo:true}},
 {id:'demo-5',label:'Γ.Ν. Κέρκυρας',contact_name:'Σ. Βλάχου',contact_email:'sv@corfu.example',valid_from:day(-42),valid_until:day(-12),status:'active',organization_id:'demo-org-5',demo_user_id:'demo-u-5',organization:{id:'demo-org-5',name:'Demo · Γ.Ν. Κέρκυρας',code:'DEMO-CFU',is_demo:true}},
]

// What deleting the given organizations would remove, for the preview's delete dialog.
const PREVIEW_IMPACT={'demo-org-3':[1284,96,12,8400000,4,4],'demo-org-5':[0,74,0,0,1,0],'demo-org-1':[642,74,5,2100000,3,3],'demo-org-2':[210,74,1,300000,2,2],'demo-org-4':[388,74,2,900000,2,1]}
export const previewDeletionImpact=ids=>ids.map(id=>{
 const organization=ORGANIZATIONS.find(o=>o.id===id)||previewDemos().find(d=>d.organization_id===id)?.organization
 if(!organization)return null
 const [records,systemRecords,files,bytes,members,accountsDeleted]=PREVIEW_IMPACT[id]||[3912+6240,74,418,1288490188,(PEOPLE[id]||[]).length,Math.max(0,(PEOPLE[id]||[]).length-1)]
 const status=organization.status||'active'
 const blockers=[!organization.is_demo&&status!=='suspended'?'not_suspended':null].filter(Boolean)
 return {organizationId:id,name:organization.name,code:organization.code,isDemo:Boolean(organization.is_demo),status,records,systemRecords,files,bytes,members,accountsDeleted,accountsKept:Math.max(0,members-accountsDeleted),blockers}
}).filter(Boolean)

export const previewAuditEvents=()=>[
 ['owner',ORGANIZATIONS[1].id,'platform_owner','update','organization',ORGANIZATIONS[1].id,-0.1],
 ['Μαρία Γεωργίου',ORGANIZATIONS[0].id,'hospital_admin','create','organization_member','u-1-4',-0.4],
 ['Μαρία Γεωργίου',ORGANIZATIONS[0].id,'hospital_admin','update','organization',ORGANIZATIONS[0].id,-1],
 ['owner',ORGANIZATIONS[2].id,'platform_owner','suspend','organization',ORGANIZATIONS[2].id,-12],
 ['owner','','platform_owner','update','platform_settings','global',-15],
].map(([actor,organizationId,actorRole,eventType,entityType,entityId,offset],index)=>({id:`audit-${index}`,organizationId,actorId:actor,actorName:actor==='owner'?'Platform Owner':actor,actorRole,eventType,entityType,entityId,metadata:{},createdAt:at(offset)}))

export const previewRuntimeEvents=organizationId=>[
 ['error','surveillance','/surveillance/new','Η αποθήκευση απέτυχε: λήξη χρόνου σύνδεσης.','DB-TIMEOUT',-0.2],
 ['warning','controls','/controls','Ο έλεγχος δεν φόρτωσε τα συνημμένα.','STORAGE-403',-1],
 ['info','training','/training','Αποστολή προσκλήσεων εκπαίδευσης (12).','',-2],
].map(([severity,module,route,userMessage,diagnosticCode,offset],index)=>({id:`ev-${organizationId?.slice(-1)||'x'}-${index}`,organizationId,actorId:'',actorName:'Ελένη Παπά',actorJobTitle:'Υπεύθυνη Ποιότητας',role:'quality_manager',severity,eventType:'ui_feedback',module,route,operation:'',userMessage,message:userMessage,diagnosticCode,appVersion:'0.47.6',occurredAt:at(offset)}))

export const previewPlatformSettings=()=>({id:'global',supportEmail:'support@limoxis.example',defaultDemoDurationDays:30,demoAutoPurgeAfterDays:14,organizationDeletionGraceDays:30,maxDemoUsers:5,maintenanceNoticeEnabled:false,maintenanceNoticeEl:'',maintenanceNoticeEn:'',updatedAt:at(-15)})

// What resetting a Demo returns, for the preview's "Reset data" action.
export const previewDemoSeedResult=()=>({ok:true,departments:8,patients:48,surveillanceCases:14,laboratorySamples:43,microbiologyResults:38,handHygieneSessions:36,employees:24,incidents:10,capa:6,documents:8,committees:2,controls:6,controlExecutions:350,trainingPrograms:5,trainingAssignments:72,antibioticDispensing:360,vaccinations:76,occupationalVisits:29,exposures:4})
