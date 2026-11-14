import '../features/platform/platformFocus.css'
import { BrandMark } from '../design-system/BrandMark'
import { Suspense, useEffect, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { lazyPage } from '../core/errors/chunkRecovery'
import { ScreenErrorBoundary } from '../core/errors/AppErrorBoundary'
import { UnsavedChangesGuard } from './UnsavedChangesGuard'
import { watchTableCells } from './phoneTableCards'
import { watchWheelChaining } from './wheelChaining'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, LoaderCircle, BarChart3, Bell, Bot, Building2, ChevronDown, Database, Eye, FlaskConical, Inbox, LayoutDashboard, Layers3, Megaphone, Menu, Pin, PinOff, Scale, ShieldCheck, Users, X } from 'lucide-react'
import { SidebarRecycleBin } from '../features/recycle-bin/SidebarRecycleBin'
import { navigationFor } from './navigation'
import { useSidebarRail } from './useSidebarRail'
import { SidebarNavigation } from './SidebarNavigation'
import { TopbarUserMenu } from './TopbarUserMenu'
import { preloadRoutesWhenIdle } from './routePreload'
import { RouteLoading } from '../design-system/RouteLoading'
import { useLoadingActive } from '../design-system/loadingActivity'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useTenant } from '../core/tenant/TenantContext'
import { useAuth } from '../core/auth/AuthContext'
import { PREVIEWABLE_ROLES, ROLES } from '../core/permissions/roles'
import { roleLabel } from '../core/permissions/roleLabels'
import { APP_VERSION } from '../core/version'
import { useNotifications } from '../core/notifications/NotificationContext'
import { useFeedback } from '../core/feedback/FeedbackContext'
import { readSessionValue, writeSessionValue } from '../core/storage/browserStorage'
import { IdleLock,clearIdleLock,ownerIdleLockMinutes,useIdleLockMinutes } from './IdleLock'
import { setReportBranding,useOrganizationBranding } from '../core/organization/branding'
import { recordRuntimeEvent } from '../core/diagnostics/runtimeDiagnosticsService'
import { loadDepartments } from '../features/management/departmentsService'
import { resetMyDemoData, switchDemoRole } from '../core/tenant/tenantService'
import { SAMPLE_PREVIEW_DEPARTMENTS } from '../core/tenant/sampleDepartments'
import { useDemoEvaluation } from '../features/demo/useDemoEvaluation'
import { resetScreenGuides } from '../features/demo/screenGuideService'
import { screenGuidesOn } from '../features/demo/screenGuideSettings'
import { PlatformAnnouncementGate } from '../features/platform/PlatformAnnouncementGate'
import { hospitalToday } from '../core/dates/hospitalDate'
// What a feedback message tells the platform's log (FeedbackContext sends it as «limoxis:feedback»).
type FeedbackDetail = { message?: string, severity?: string, eventType?: string, operation?: string | null, diagnosticCode?: string | null }

// The help manual (EL/EN content for every role) is only needed once the user
// opens it, so it loads on demand instead of shipping with the first paint.
// Panels that open only on request: out of the first load.
const NotificationCenter=lazyPage(()=>import('../core/notifications/NotificationCenter'),'NotificationCenter')
const BirthdayGreeting=lazyPage(()=>import('../core/notifications/NotificationCenter'),'BirthdayGreeting')
const LoginBriefingDialog=lazyPage(()=>import('../core/notifications/LoginBriefingDialog'),'LoginBriefingDialog')
const AccountDrawer=lazyPage(()=>import('../features/account/AccountDrawer'),'AccountDrawer')
const DemoEvaluationBar=lazyPage(()=>import('./DemoEvaluationBar'),'DemoEvaluationBar')
const DemoClosedScreen=lazyPage(()=>import('./DemoEvaluationBar'),'DemoClosedScreen')
const HelpCenter=lazyPage(()=>import('../core/help/HelpCenter'),'HelpCenter')
// An entry of the Platform Owner's menu (a path with an optional #hash, under an optional heading).
interface PlatformNavItem { key: string, label: string, path: string, hash: string, icon?: LucideIcon, group?: string, children?: PlatformNavItem[] }

// Screen guides exist only in a Demo: keep the manual text out of the main bundle.
const ScreenGuide=lazyPage(()=>import('../features/demo/ScreenGuide'),'ScreenGuide')

// The screen's area: while anything on it is still loading, frozen and faded under one round spinner, and everything
// shows at once after the load (owner, 8/11/2026; loadingActivity.js).
function ContentArea({ children }: { children?: ReactNode }){
  const loading=useLoadingActive()
  return <div className={`content${loading?' is-loading':''}`} aria-busy={loading||undefined}>{loading&&<div className="content-loading-spinner" aria-hidden="true"><LoaderCircle className="loading-spinner" size={30}/></div>}{children}</div>
}

export function AppShell(){
  const helpPreviewMode=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('helpPreview')==='1'&&window.self!==window.top
  const {language,setLanguage,t}=useLanguage(); const {tenant,loading:tenantLoading,memberships,membership,role,isDemo,enterPlatformDemo,setTenantByMembership,returnToPlatform,actualRole,canRolePreview,isRolePreview,rolePreview,startRolePreview,updateRolePreviewDepartment,updateRolePreviewDivision,stopRolePreview,reloadMemberships}=useTenant(); const {profile,user,logout}=useAuth(); const notifications=useNotifications(); const {confirm,notifyError}=useFeedback(); const navigate=useNavigate(); const location=useLocation(); const [helpOpen,setHelpOpen]=useState(false);const [screenGuideReset,setScreenGuideReset]=useState(0);const [helpRequested,setHelpRequested]=useState(false);useEffect(()=>{if(helpOpen)setHelpRequested(true)},[helpOpen]); const [notificationOpen,setNotificationOpen]=useState(false); const [birthdayOpen,setBirthdayOpen]=useState(false); const [briefingOpen,setBriefingOpen]=useState(false); const [previewOpen,setPreviewOpen]=useState(false);  const [accountOpen,setAccountOpen]=useState(false)
  useEffect(()=>{if(helpPreviewMode||!tenant?.id||isDemo)return;const handleFeedback=(event: Event)=>{const detail: FeedbackDetail=(event as CustomEvent<FeedbackDetail>)?.detail||{};if(!detail.message)return;void recordRuntimeEvent({organizationId:tenant.id,severity:detail.severity||'info',eventType:detail.eventType||'ui_feedback',route:window.location.pathname,operation:detail.operation||null,userMessage:detail.message,diagnosticCode:detail.diagnosticCode||null}).catch(()=>{})};window.addEventListener('limoxis:feedback',handleFeedback);return ()=>window.removeEventListener('limoxis:feedback',handleFeedback)},[tenant?.id,isDemo,helpPreviewMode])
  useEffect(()=>{if(helpPreviewMode||!profile)return;const key=profile?.id||profile?.email||'user';const birthdayKey=`limoxis.birthday.seen.${key}.${hospitalToday()}`;const briefingKey=`limoxis.briefing.seen.${key}`;const birthdaySeen=readSessionValue(birthdayKey)==='1';const briefingSeen=readSessionValue(briefingKey)==='1';if(notifications.birthday.length&&!birthdaySeen)setBirthdayOpen(true);else if(!briefingSeen)setBriefingOpen(true)},[profile,notifications.birthday.length,helpPreviewMode])
  function closeBirthday(){const key=profile?.id||profile?.email||'user';writeSessionValue(`limoxis.birthday.seen.${key}.${hospitalToday()}`,'1');setBirthdayOpen(false);const briefingSeen=readSessionValue(`limoxis.briefing.seen.${key}`)==='1';if(!briefingSeen)window.setTimeout(()=>setBriefingOpen(true),180)}
  function closeBriefing(){const key=profile?.id||profile?.email||'user';writeSessionValue(`limoxis.briefing.seen.${key}`,'1');setBriefingOpen(false)}
  const isPlatformOwner=actualRole===ROLES.PLATFORM_OWNER
  const platformMode=isPlatformOwner&&!tenant
  // Tablets (641–1100px) show an icon rail; the toggle opens the full menu over the page.
  const [navOpen,setNavOpen]=useState(false)
  // Wide screens: an icon rail that opens on hover or focus; tablets: always the rail (see useSidebarRail).
  const sidebarRail=useSidebarRail()
  useEffect(()=>watchTableCells(),[])
  useEffect(()=>watchWheelChaining(),[])
  useEffect(()=>{setNavOpen(false)},[location.pathname,location.hash])
  useEffect(()=>{if(!navOpen)return;const onKey=(event: KeyboardEvent)=>{if(event.key==='Escape')setNavOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[navOpen])
  const platformHashKey=location.hash.replace(/^#/,'').split('?')[0]
  // The Platform Owner's menu (owner, 9/11/2026): the work areas, then «Monitoring» (reports, history & health)
  // and «Settings» (announcements, lists, legislation & sources, LIRA & AI), each under its heading; every settings
  // screen opens in this same shell, with the menu. The platform's own settings sit where each is used (10/11/2026).
  const platformNavigation: PlatformNavItem[]=[
    {key:'platformNav.overview',label:'platformNav.menuOverview',path:'/platform',hash:'',icon:LayoutDashboard},
    {key:'platformNav.organizations',label:'platformNav.menuOrganizations',path:'/platform',hash:'organizations',icon:Building2},
    {key:'platformNav.demos',label:'platformNav.menuDemos',path:'/platform',hash:'demo',icon:FlaskConical},
    {key:'platformNav.demoRequests',label:'platformNav.menuDemoRequests',path:'/platform/demo-requests',hash:'',icon:Inbox},
    {key:'platformNav.users',label:'platformNav.menuPlatformUsers',path:'/platform',hash:'users',icon:Users},
    {key:'platformNav.analysis',label:'platformNav.menuReports',path:'/platform',hash:'reports',icon:BarChart3,group:'monitoring'},
    {key:'platformNav.audit',label:'platformNav.menuAudit',path:'/platform/audit',hash:'',icon:ShieldCheck,group:'monitoring'},
    {key:'platformNav.announcements',label:'platformNav.menuAnnouncements',path:'/platform/announcements',hash:'',icon:Megaphone,group:'settings'},
    {key:'platformNav.libraries',label:'platformNav.menuLists',path:'/platform',hash:'management?group=libraries',icon:Database,group:'settings'},
    {key:'platformNav.legislation',label:'platformNav.menuLegislationSources',path:'/platform/legislation',hash:'',icon:Scale,group:'settings'},
    {key:'platformNav.lira',label:'platformNav.menuLira',path:'/platform',hash:'management?group=lira',icon:Bot,group:'settings'},
  ]
  const platformNavGroups=[['',null],['monitoring','platformNav.groupMonitoring'],['settings','platformNav.groupSettings']] as [string, string|null][]
  // #management?group=… : the Lists, LIRA & AI, or the external sources of «Legislation & sources».
  const platformManagementGroup=platformHashKey==='management'?new URLSearchParams(location.hash.split('?')[1]||'').get('group'):null
  // Exactly one entry is marked: a record (an organization, a Demo) belongs to its registry's entry.
  const platformActive=(item: PlatformNavItem)=>{
    const under=(prefix: string)=>location.pathname===prefix||location.pathname.startsWith(`${prefix}/`)
    const management=location.pathname==='/platform'&&platformHashKey==='management'
    if(item.key==='platformNav.legislation')return under('/platform/legislation')||under('/platform/library')||(management&&platformManagementGroup==='sources')
    if(item.key==='platformNav.lira')return management&&platformManagementGroup==='lira'
    if(item.key==='platformNav.libraries')return management&&!['sources','lira'].includes(platformManagementGroup as string)
    // A user record opened from another screen (the users list, the sign-ins, the Overview, an organization tab) keeps that screen's entry highlighted.
    const userBack=platformHashKey==='organizations'&&new URLSearchParams(location.hash.split('?')[1]||'').get('user')?(location.state?.userReturnTo||(location.state?.fromUsers?'/platform#users':'')):''
    if(item.key==='platformNav.audit')return under('/platform/audit')||under('/platform/health')||userBack.startsWith('/platform/audit')
    if(item.path!=='/platform')return under(item.path)
    if(userBack)return userBack.split('#')[0]==='/platform'&&(userBack.split('#')[1]||'').split('?')[0]===item.hash
    return location.pathname==='/platform'&&platformHashKey===item.hash
  }
  const selectedMembership=membership||memberships.find(item=>item?.organization?.id===tenant?.id)||null
  const currentOrganization=selectedMembership?.organization||tenant||null
  const idleLockMinutes=useIdleLockMinutes(tenant,isDemo)
  const branding=useOrganizationBranding(tenant,isDemo)
  // Every PDF prints the open hospital's name, logo and report header.
  useEffect(()=>{setReportBranding(tenant?{name:currentOrganization?.name||tenant.name||'',...branding,demo:Boolean(isDemo||tenant?.is_demo),printedBy:profile?.fullName||profile?.email||user?.email||''}:null)},[tenant,currentOrganization?.name,branding,isDemo,profile?.fullName,profile?.email,user?.email])
  const productionMemberships=(memberships||[]).filter(item=>item?.organization?.id&&!item?.organization?.is_demo)
  // A legislation link (from an e-mail or the bell) opens the platform's own legislation screen.
  useEffect(()=>{if(platformMode&&!tenantLoading&&!location.pathname.startsWith('/platform')&&location.pathname!=='/about'&&location.pathname!=='/account')navigate(location.pathname.startsWith('/legislation')?`/platform${location.pathname}${location.search}`:'/platform',{replace:true})},[platformMode,tenantLoading,location.pathname,location.search,navigate])
  const isDepartmentHomeRole=role===ROLES.DEPARTMENT_MANAGER||role===ROLES.DEPARTMENT_USER||role===ROLES.LINK_NURSE
  useEffect(()=>{if(isDepartmentHomeRole&&location.pathname==='/')navigate('/my-department',{replace:true})},[isDepartmentHomeRole,location.pathname,navigate])
  const previewRoleLabels={hospital_admin:'hospitalAdminRole',infection_control_lead:'infectionControlLeadRole',infection_control_member:'infectionControlMemberRole',department_manager:'departmentManagerRole',link_nurse:'linkNurseRole',department_user:'departmentUserRole',laboratory:'laboratoryRole',committee_secretariat:'committeeSecretariatRole',hr_office:'hrOfficeRole',pharmacy:'pharmacyRole',occupational_physician:'occupationalPhysicianRole',doctor_reviewer:'doctorReviewerRole',quality_manager:'qualityManagerRole',hospital_director:'hospitalDirectorRole',division_director:'divisionDirectorRole'}
  const previewRoles=PREVIEWABLE_ROLES.map(previewRole=>[previewRole,previewRoleLabels[previewRole]])
  // A real Demo organization previews roles over its own departments; the
  // sample hospital keeps its fixed list.
  const realDemoTenant=Boolean(tenant?.is_demo&&tenant?.mode!=='demo')
  // Screen guides: per hospital and per user (screenGuideSettings), in Demo organizations and hospitals alike.
  const guidesOn=!platformMode&&!helpPreviewMode&&screenGuidesOn({organization:tenant,membership})
  // A hospital's own departments (a real one or a Demo organization): the preview of a department role picks one of them.
  const realTenant=Boolean(tenant?.id&&tenant?.mode!=='demo')
  const [realDepartments,setRealDepartments]=useState<{ id: string, name: string, is_active?: boolean }[]>([])
  useEffect(()=>{let active=true;if(!realTenant||!tenant?.id||!canRolePreview){setRealDepartments([]);return undefined}loadDepartments(tenant.id).then(rows=>{if(active)setRealDepartments((rows||[]).filter(row=>row.is_active!==false))}).catch(()=>{if(active)setRealDepartments([])});return ()=>{active=false}},[realTenant,tenant?.id,canRolePreview])
  const previewDepartments=SAMPLE_PREVIEW_DEPARTMENTS
  const demoAccess=(profile?.demoAccess||[]).find(item=>item.organizationId===tenant?.id)||null
  // A Demo evaluator switches their own role for real (demo_switch_my_role), so
  // the database returns exactly what that role sees. The Platform Owner keeps
  // the on-screen preview.
  const demoEvaluator=realDemoTenant&&!isPlatformOwner
  const demoEvaluation=useDemoEvaluation({enabled:realDemoTenant&&!platformMode&&!helpPreviewMode,organizationId:tenant?.id,organizationName:tenant?.name||'',userId:user?.id,profile,isPlatformOwner,role,language,navigate,holdAutoOpen:briefingOpen||birthdayOpen})
  const [roleSwitching,setRoleSwitching]=useState(false)
  async function switchEvaluatorRole(nextRole: string,departmentId: string|null=null){if(roleSwitching||!tenant?.id)return;setRoleSwitching(true);try{await switchDemoRole(tenant.id,nextRole,departmentId);setPreviewOpen(false);// The new role starts from its own home page; the current page may not be open to it.
navigate('/');await reloadMemberships()}catch(error){notifyError(error,'save',{operation:'demo_switch_role'})}finally{setRoleSwitching(false)}}
  const closedDemoAccess=!isPlatformOwner&&!tenant&&!tenantLoading?(profile?.demoAccess||[]).find(item=>!item.open)||null:null
  const departmentScopedPreviewRoles=new Set<string|null|undefined>([ROLES.DEPARTMENT_MANAGER,ROLES.LINK_NURSE,ROLES.DEPARTMENT_USER])
  const previewNeedsDepartment=Boolean(rolePreview?.role&&departmentScopedPreviewRoles.has(rolePreview.role))
  // A previewed Division Director oversees one division: the hospital's divisions (Interviews › Divisions), the first until another is chosen.
  const previewNeedsDivision=Boolean(rolePreview?.role===ROLES.DIVISION_DIRECTOR&&canRolePreview&&!demoEvaluator)
  const [previewDivisions,setPreviewDivisions]=useState<{ id: string, name: string, departmentIds: string[] }[]>([])
  useEffect(()=>{let active=true;if(!previewNeedsDivision){setPreviewDivisions([]);return undefined}import('../features/division/divisionService').then(service=>service.loadDivisionChoices(tenant?.id)).then(rows=>{if(active)setPreviewDivisions(rows||[])}).catch(()=>{if(active)setPreviewDivisions([])});return ()=>{active=false}},[previewNeedsDivision,tenant?.id])
  useEffect(()=>{if(!previewNeedsDivision||!previewDivisions.length||previewDivisions.some(item=>item.id===rolePreview?.division))return;const first=previewDivisions[0];updateRolePreviewDivision(first.id,first.name,first.departmentIds)},[previewNeedsDivision,previewDivisions,rolePreview?.division,updateRolePreviewDivision])
  function handlePreviewDivisionChange(value: string){const item=previewDivisions.find(division=>division.id===value);if(item)updateRolePreviewDivision(item.id,item.name,item.departmentIds)}
  // The incident report is a button at the foot of the sidebar, not a menu entry.
  const visibleNavigation=platformMode?[]:navigationFor({role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[],hasAssignments:Boolean(membership?.assignments?.length)})
  // Every screen of this menu is fetched in idle time, so moving between screens never waits for a page file.
  const navigationPaths=visibleNavigation.map(item=>item.to).join('|')
  useEffect(()=>navigationPaths?preloadRoutesWhenIdle(navigationPaths.split('|')):undefined,[navigationPaths])
  // The Owner's level: the platform, or one hospital by name (a Demo too); inside a Demo the real-hospital selector is hidden.
  const ownerInDemo=Boolean(isDemo||realDemoTenant||tenant?.is_demo)
  const showOrganizationSwitch=isPlatformOwner&&!ownerInDemo&&productionMemberships.length>1
  const [demoResetting,setDemoResetting]=useState(false)
  async function handleResetDemoData(){const ok=await confirm({title:t('demoResetTitle'),message:t('demoResetMessage'),confirmLabel:t('demoResetConfirm'),danger:true});if(!ok)return;setDemoResetting(true);try{await resetMyDemoData(currentOrganization?.id||tenant?.id);window.location.reload()}catch(e){setDemoResetting(false);notifyError(e,'save',{operation:'demo_reset_data'})}}
  async function handleLogout(){const ok=await confirm({title:t('logoutConfirmTitle'),message:`${t('logoutConfirmMessage')} ${t('logoutFarewell')}`,confirmLabel:t('logout')});if(!ok)return;clearIdleLock();await logout();navigate('/login',{replace:true})}
  async function switchUserFromLock(){await logout();navigate('/login',{replace:true})}
  // The Owner's own Demo organization, as the evaluators see theirs.
  async function openOwnDemo(){try{if(await enterPlatformDemo())navigate('/')}catch(error){notifyError(error,'load',{operation:'platform_owner_demo_enter'})}}
  function handleExitDemo(){if(isPlatformOwner){returnToPlatform();navigate({pathname:'/platform',search:'',hash:''})}else{void handleLogout()}}
  function handlePreviewRoleChange(nextRole: string){if(!nextRole)return;const nextNeedsDepartment=departmentScopedPreviewRoles.has(nextRole);if(demoEvaluator){const current=nextNeedsDepartment?(realDepartments.find(item=>item.id===membership?.departmentIds?.[0])||realDepartments[0]||null):null;void switchEvaluatorRole(nextRole,current?.id||null);return}if(realTenant){const current=nextNeedsDepartment?(realDepartments.find(item=>item.id===rolePreview?.department)||realDepartments[0]||null):null;startRolePreview(nextRole,current?.id||'',current?.name||'');return}startRolePreview(nextRole,nextNeedsDepartment?(rolePreview?.department||''):'')}
  function handlePreviewDepartmentChange(value: string){if(demoEvaluator){void switchEvaluatorRole(actualRole as string,value);return}if(realTenant){updateRolePreviewDepartment(value,realDepartments.find(item=>item.id===value)?.name||'');return}updateRolePreviewDepartment(value)}
  // The role picker: in the topbar, or in the Demo bar inside a Demo organization.
  const pickerNeedsDepartment=demoEvaluator?departmentScopedPreviewRoles.has(actualRole):previewNeedsDepartment
  const rolePreviewPopover=<div className="role-preview-popover"><strong>{t(demoEvaluator?'demoRoleTitle':'previewAsRole')}</strong><small>{t(demoEvaluator?'demoRoleHint':realDemoTenant?'previewDemoHint':'previewSafeHint')}</small><label><span>{t('roleLabel')}</span><select disabled={roleSwitching} value={demoEvaluator?(actualRole||''):(rolePreview?.role||'')} onChange={e=>handlePreviewRoleChange(e.target.value)}><option value="">{t('selectRole')}</option>{previewRoles.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</select></label>{pickerNeedsDepartment&&<label><span>{t('departmentScope')}</span><select disabled={roleSwitching} value={demoEvaluator?(membership?.departmentIds?.[0]||''):(rolePreview?.department||'')} onChange={e=>handlePreviewDepartmentChange(e.target.value)}>{realTenant?realDepartments.map(item=><option key={item.id} value={item.id}>{item.name}</option>):previewDepartments.map(([value,key])=><option key={key} value={value}>{t(key)}</option>)}</select></label>}{previewNeedsDivision&&<label><span>{t('divisionScope')}</span>{previewDivisions.length?<select value={rolePreview?.division||''} onChange={e=>handlePreviewDivisionChange(e.target.value)}>{previewDivisions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>:<small>{t('noDivisions')}</small>}</label>}<div className="preview-popover-actions">{demoEvaluator&&actualRole!==ROLES.HOSPITAL_ADMIN&&<button disabled={roleSwitching} onClick={()=>void switchEvaluatorRole(ROLES.HOSPITAL_ADMIN)}>{t('demoRoleBackToAdmin')}</button>}{isRolePreview&&<button onClick={()=>{stopRolePreview();setPreviewOpen(false)}}>{t('exitPreview')}</button>}<button onClick={()=>setPreviewOpen(false)}>{t('close')}</button></div></div>
  if(closedDemoAccess)return <Suspense fallback={null}><DemoClosedScreen access={closedDemoAccess} language={language} onLogout={()=>{clearIdleLock();void logout().then(()=>navigate('/login',{replace:true}))}}/></Suspense>
  const PlatformNavEntry=({item,nested=false}: { item: PlatformNavItem, nested?: boolean })=>{const Icon=item.icon;const active=platformActive(item);const go=(target: PlatformNavItem)=>navigate({pathname:target.path,search:'',hash:target.hash?`#${target.hash}`:''});const button=<button type="button" title={t(item.key)} aria-current={active&&!item.children?'page':undefined} className={`nav-item ${nested?'nested':''} ${active&&!item.children?'active':''} ${active&&item.children?'active-group':''}`} onClick={()=>go(item.children?item.children[0]:item)}>{Icon&&<Icon size={nested?16:18}/>}<span>{t(item.label)}</span>{item.children&&<ChevronDown className="nav-group-chevron" size={14}/>}</button>;if(!item.children)return button;return <div className={`sidebar-nav-group ${active?'open':''}`}>{button}{active&&<div className="sidebar-nav-children">{item.children.map((child: PlatformNavItem)=><PlatformNavEntry key={child.hash} item={child} nested/>)}</div>}</div>}
  return <div className={`app-shell ${platformMode?'platform-mode':''} ${helpPreviewMode?'help-preview-mode':''}${sidebarRail.rail&&(!platformMode||!sidebarRail.wide)?' sidebar-rail':''}`}>
    <aside id="app-sidebar" className={`sidebar${navOpen?' sidebar-open':''}`} {...(platformMode?{}:sidebarRail.handlers)}>{!platformMode&&sidebarRail.wide&&<button type="button" className="sidebar-pin" aria-pressed={sidebarRail.pinned} aria-label={sidebarRail.pinned?t('unpinMenu'):t('pinMenu')} title={sidebarRail.pinned?t('unpinMenu'):t('pinMenu')} onClick={sidebarRail.togglePin}>{sidebarRail.pinned?<PinOff size={15}/>:<Pin size={15}/>}</button>}<button type="button" className="sidebar-toggle" aria-expanded={navOpen} aria-controls="app-sidebar" aria-label={navOpen?t('closeMenu'):t('openMenu')} title={navOpen?t('closeMenu'):t('openMenu')} onClick={()=>setNavOpen(v=>!v)}>{navOpen?<X size={20}/>:<Menu size={20}/>}</button><div className="brand"><BrandMark size={30} tone="light" className="brand-mark-logo"/><div><strong>Limoxis Observer</strong><span>{t('brandSubtitle')}</span></div></div><nav>
      {platformMode&&platformNavGroups.map(([group,heading])=>{const items=platformNavigation.filter(item=>(item.group||'')===group).map(item=><PlatformNavEntry key={item.key} item={item}/>);return group?<div key={group} className="platform-nav-group" role="group" aria-labelledby={`platform-nav-${group}`}><div id={`platform-nav-${group}`} className="platform-nav-heading">{t(heading as string)}</div>{items}</div>:items})}
      {!platformMode&&<SidebarNavigation role={role} items={visibleNavigation} t={t} userKey={profile?.id||user?.id}/>}
    </nav>{!platformMode&&<SidebarRecycleBin organizationId={tenant?.id||null} role={role} actorName={profile?.fullName||profile?.email||null} label={t('recycleBin')} onOpen={()=>setNavOpen(false)}/>}<div className="sidebar-footer"><div className="sidebar-meta">{roleLabel(role,language)}</div><div className="app-version-stamp">v{APP_VERSION}</div></div></aside>{navOpen&&<div className="sidebar-backdrop" aria-hidden="true" onClick={()=>setNavOpen(false)}/>}
    <main className="main-column"><header className={`topbar${isPlatformOwner&&tenant&&!platformMode?' topbar-owner-in-hospital':''}`}><div className="topbar-spacer topbar-whereami">{platformMode&&isPlatformOwner&&<div className="topbar-organization-context topbar-level-platform" title={t('topbarLevelPlatformHint')}><Layers3 size={17}/><div className="topbar-organization-copy"><strong>{t('topbarLevelPlatform')}</strong><span>{t('topbarLevelPlatformHint')}</span></div></div>}{platformMode&&<button type="button" className="topbar-demo-badge" onClick={()=>void openOwnDemo()} title={t('enterDemo')}><FlaskConical size={14}/><span>{t('enterDemo')}</span></button>}{!platformMode&&currentOrganization&&<div className={`topbar-organization-context${isPlatformOwner?' topbar-level-hospital':''}`}>{branding.logo?<img className="topbar-organization-logo" src={branding.logo} alt=""/>:<Building2 size={17}/>}<div className="topbar-organization-copy"><strong>{isPlatformOwner?`${t('topbarLevelHospital')}: ${currentOrganization.name}`:currentOrganization.name}</strong><span>{[currentOrganization.code,currentOrganization.city].filter(Boolean).join(' · ')||roleLabel(role,language)}</span></div>{showOrganizationSwitch&&<label className="topbar-organization-switch" title={t('changeOrganizationTitle')}><select value={selectedMembership?.id||''} onChange={e=>e.target.value&&setTenantByMembership(e.target.value)} aria-label={t('organization')}>{productionMemberships.map(item=><option key={item.id} value={item.id}>{item.organization?.name}</option>)}</select><ChevronDown size={13}/></label>}</div>}{isDemo&&<button type="button" className="topbar-demo-badge" onClick={handleExitDemo} title={t('exitDemo')}><FlaskConical size={13}/><span>{t('demo')}</span><X size={12}/></button>}
      {/* The Platform Owner in a hospital or a Demo: the way back, always in the same place. */}
      {isPlatformOwner&&tenant&&!platformMode&&<button type="button" className="preview-trigger topbar-platform-return" title={t('backToPlatform')} onClick={()=>{returnToPlatform();navigate({pathname:'/platform',search:'',hash:''})}}><ArrowLeft size={15}/><span>{t('backToPlatform')}</span></button>}</div><div className="topbar-actions">
      {/* A clean bar: where I am (left), the notifications and one user menu (preview, help, language, sign out). */}
      <div className="notification-anchor"><button className={`icon-button notification-button ${notificationOpen?'active':''}`} aria-label={t('notifications')} title={t('notifications')} onClick={()=>setNotificationOpen(v=>!v)}><Bell size={19}/>{notifications.unreadCount>0&&<span className="notification-count">{notifications.unreadCount>99?'99+':notifications.unreadCount}</span>}</button>{notificationOpen&&<Suspense fallback={null}><NotificationCenter open={notificationOpen} onClose={()=>setNotificationOpen(false)} onOpenBriefing={()=>{setNotificationOpen(false);setBriefingOpen(true)}} onOpenBirthday={()=>{setNotificationOpen(false);setBirthdayOpen(true)}}/></Suspense>}</div>
      {canRolePreview&&!platformMode&&!realDemoTenant&&<div className="role-preview-control">{previewOpen&&rolePreviewPopover}</div>}
      <TopbarUserMenu t={t} name={profile?.fullName||profile?.email||''} roleName={isRolePreview?t('previewMode'):roleLabel(role,language)} language={language} onAccount={()=>setAccountOpen(true)} onPreview={canRolePreview&&!platformMode&&!realDemoTenant?()=>setPreviewOpen(true):null} onHelp={()=>setHelpOpen(true)} onToggleLanguage={()=>setLanguage(language==='el'?'en':'el')} onLogout={()=>void handleLogout()}/>
    </div></header>{realDemoTenant&&!platformMode&&<Suspense fallback={null}><DemoEvaluationBar tenant={currentOrganization} access={demoAccess} isPlatformOwner={isPlatformOwner} language={language} previewOpen={previewOpen} previewLabel={demoEvaluator?`${t('roleLabel')}: ${t(previewRoles.find(([value])=>value===actualRole)?.[1]||'roleLabel')}${pickerNeedsDepartment&&membership?.departmentName?` · ${membership.departmentName}`:''}`:isRolePreview?`${t('previewingAs')}: ${t(previewRoles.find(([value])=>value===role)?.[1]||'roleLabel')}`:''} onPreviewRoles={()=>setPreviewOpen(v=>!v)} rolePicker={previewOpen?rolePreviewPopover:null} guideDone={demoEvaluation.guideDone} guideTotal={demoEvaluation.guideTotal} onOpenGuide={demoEvaluation.openGuide} canRequestApplication={demoEvaluation.canRequest} applicationRequested={demoEvaluation.requested} onRequestApplication={demoEvaluation.openApplication} onResetData={isPlatformOwner?null:()=>void handleResetDemoData()} resetting={demoResetting} onExit={()=>{returnToPlatform();navigate({pathname:'/platform',search:'',hash:''})}}/></Suspense>}{isRolePreview&&<div className="preview-banner"><Eye size={15}/><span>{t('previewingAs')}: <strong>{t(previewRoles.find(([value])=>value===role)?.[1]||'roleLabel')}</strong>{previewNeedsDepartment&&rolePreview?.department?` · ${realTenant?(rolePreview.departmentName||''):t(previewDepartments.find(([value])=>value===rolePreview.department)?.[1]||'departmentScope')}`:''}{previewNeedsDivision&&rolePreview?.divisionName?` · ${rolePreview.divisionName}`:''}</span><button onClick={stopRolePreview}><X size={14}/>{t('exitPreview')}</button></div>}<UnsavedChangesGuard language={language}/><ContentArea><ScreenErrorBoundary resetKey={location.pathname}><Suspense fallback={<RouteLoading/>}><Outlet/></Suspense></ScreenErrorBoundary></ContentArea></main>{!helpPreviewMode&&helpRequested&&<Suspense fallback={null}><HelpCenter open={helpOpen} onClose={()=>setHelpOpen(false)} onResetScreenGuides={guidesOn&&user?.id?async()=>{await resetScreenGuides(user.id);setScreenGuideReset(v=>v+1)}:null}/></Suspense>}{!helpPreviewMode&&birthdayOpen&&<Suspense fallback={null}><BirthdayGreeting open={birthdayOpen} onClose={closeBirthday}/></Suspense>}{!helpPreviewMode&&briefingOpen&&<Suspense fallback={null}><LoginBriefingDialog open={briefingOpen} onClose={closeBriefing}/></Suspense>}{!helpPreviewMode&&!platformMode&&<PlatformAnnouncementGate hold={briefingOpen||birthdayOpen}/>}{demoEvaluation.dialogs}{guidesOn&&<Suspense fallback={null}><ScreenGuide enabled={guidesOn} userId={user?.id} language={language} hold={briefingOpen||birthdayOpen||helpOpen||demoEvaluation.busy} resetToken={screenGuideReset} onOpenHelp={()=>{setHelpRequested(true);setHelpOpen(true)}}/></Suspense>}{accountOpen&&<Suspense fallback={null}><AccountDrawer open={accountOpen} onClose={()=>setAccountOpen(false)}/></Suspense>}{!helpPreviewMode&&<IdleLock minutes={isPlatformOwner?ownerIdleLockMinutes(idleLockMinutes):idleLockMinutes} userName={profile?.fullName||profile?.email||''} organizationName={platformMode?t('topbarLevelPlatform'):currentOrganization?.name||''} email={isDemo?null:user?.email||null} language={language} onSwitchUser={()=>void switchUserFromLock()}/>}
  </div>
}
