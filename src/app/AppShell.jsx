import { BrandMark } from '../design-system/BrandMark'
import { Suspense, useEffect, useState } from 'react'
import { lazyPage } from '../core/errors/chunkRecovery'
import { ScreenErrorBoundary } from '../core/errors/AppErrorBoundary'
import { UnsavedChangesGuard } from './UnsavedChangesGuard'
import { watchTableCells } from './phoneTableCards'
import { watchWheelChaining } from './wheelChaining'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, Bell, Building2, ChevronDown, Database, Eye, FlaskConical, LayoutDashboard, Layers3, Menu, Scale, Settings, ShieldCheck, Users, X } from 'lucide-react'
import { SidebarRecycleBin } from '../features/recycle-bin/SidebarRecycleBin'
import { navigationFor } from './navigation'
import { SidebarNavigation } from './SidebarNavigation'
import { SidebarIncidentReport } from './SidebarIncidentReport'
import { TopbarUserMenu } from './TopbarUserMenu'
import { preloadRoutesWhenIdle } from './routePreload'
import { RouteLoading } from '../design-system/RouteLoading'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useTenant } from '../core/tenant/TenantContext'
import { useAuth } from '../core/auth/AuthContext'
import { CAPABILITIES, PREVIEWABLE_ROLES, ROLES, can } from '../core/permissions/roles'
import { roleLabel } from '../core/permissions/roleLabels'
import { APP_VERSION } from '../core/version'
import { BirthdayGreeting, NotificationCenter } from '../core/notifications/NotificationCenter'
import { LoginBriefingDialog } from '../core/notifications/LoginBriefingDialog'
import { useNotifications } from '../core/notifications/NotificationContext'
import { useFeedback } from '../core/feedback/FeedbackContext'
import { readSessionValue, writeSessionValue } from '../core/storage/browserStorage'
import { AccountDrawer } from '../features/account/AccountDrawer'
import { IdleLock,clearIdleLock,useIdleLockMinutes } from './IdleLock'
import { setReportBranding,useOrganizationBranding } from '../core/organization/branding'
import { recordRuntimeEvent } from '../core/diagnostics/runtimeDiagnosticsService'
import { loadDepartments } from '../features/management/departmentsService'
import { DemoClosedScreen, DemoEvaluationBar } from './DemoEvaluationBar'
import { switchDemoRole } from '../core/tenant/tenantService'
import { SAMPLE_PREVIEW_DEPARTMENTS } from '../core/tenant/sampleDepartments'
import { useDemoEvaluation } from '../features/demo/useDemoEvaluation'
import { resetScreenGuides } from '../features/demo/screenGuideService'
import { screenGuidesOn } from '../features/demo/screenGuideSettings'

// The help manual (EL/EN content for every role) is only needed once the user
// opens it, so it loads on demand instead of shipping with the first paint.
const HelpCenter=lazyPage(()=>import('../core/help/HelpCenter'),'HelpCenter')
// Screen guides exist only in a Demo: keep the manual text out of the main bundle.
const ScreenGuide=lazyPage(()=>import('../features/demo/ScreenGuide'),'ScreenGuide')

export function AppShell(){
  const helpPreviewMode=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('helpPreview')==='1'&&window.self!==window.top
  const {language,setLanguage,t}=useLanguage(); const {tenant,loading:tenantLoading,memberships,membership,role,isDemo,enterPlatformDemo,setTenantByMembership,returnToPlatform,actualRole,canRolePreview,isRolePreview,rolePreview,startRolePreview,updateRolePreviewDepartment,stopRolePreview,reloadMemberships}=useTenant(); const {profile,user,logout}=useAuth(); const notifications=useNotifications(); const {confirm,notifyError}=useFeedback(); const navigate=useNavigate(); const location=useLocation(); const [helpOpen,setHelpOpen]=useState(false);const [screenGuideReset,setScreenGuideReset]=useState(0);const [helpRequested,setHelpRequested]=useState(false);useEffect(()=>{if(helpOpen)setHelpRequested(true)},[helpOpen]); const [notificationOpen,setNotificationOpen]=useState(false); const [birthdayOpen,setBirthdayOpen]=useState(false); const [briefingOpen,setBriefingOpen]=useState(false); const [previewOpen,setPreviewOpen]=useState(false);  const [accountOpen,setAccountOpen]=useState(false)
  useEffect(()=>{if(helpPreviewMode||!tenant?.id||isDemo)return;const handleFeedback=(event)=>{const detail=event?.detail||{};if(!detail.message)return;void recordRuntimeEvent({organizationId:tenant.id,severity:detail.severity||'info',eventType:detail.eventType||'ui_feedback',route:window.location.pathname,operation:detail.operation||null,userMessage:detail.message,diagnosticCode:detail.diagnosticCode||null}).catch(()=>{})};window.addEventListener('limoxis:feedback',handleFeedback);return ()=>window.removeEventListener('limoxis:feedback',handleFeedback)},[tenant?.id,isDemo,helpPreviewMode])
  useEffect(()=>{if(helpPreviewMode||!profile)return;const key=profile?.id||profile?.email||'user';const birthdayKey=`limoxis.birthday.seen.${key}.${new Date().toISOString().slice(0,10)}`;const briefingKey=`limoxis.briefing.seen.${key}`;const birthdaySeen=readSessionValue(birthdayKey)==='1';const briefingSeen=readSessionValue(briefingKey)==='1';if(notifications.birthday.length&&!birthdaySeen)setBirthdayOpen(true);else if(!briefingSeen)setBriefingOpen(true)},[profile,notifications.birthday.length,helpPreviewMode])
  function closeBirthday(){const key=profile?.id||profile?.email||'user';writeSessionValue(`limoxis.birthday.seen.${key}.${new Date().toISOString().slice(0,10)}`,'1');setBirthdayOpen(false);const briefingSeen=readSessionValue(`limoxis.briefing.seen.${key}`)==='1';if(!briefingSeen)window.setTimeout(()=>setBriefingOpen(true),180)}
  function closeBriefing(){const key=profile?.id||profile?.email||'user';writeSessionValue(`limoxis.briefing.seen.${key}`,'1');setBriefingOpen(false)}
  const isPlatformOwner=actualRole===ROLES.PLATFORM_OWNER
  const platformMode=isPlatformOwner&&!tenant
  // Tablets (641–1100px) show an icon rail; the toggle opens the full menu over the page.
  const [navOpen,setNavOpen]=useState(false)
  useEffect(()=>watchTableCells(),[])
  useEffect(()=>watchWheelChaining(),[])
  useEffect(()=>{setNavOpen(false)},[location.pathname,location.hash])
  useEffect(()=>{if(!navOpen)return;const onKey=event=>{if(event.key==='Escape')setNavOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[navOpen])
  const platformHashKey=location.hash.replace(/^#/,'').split('?')[0]
  // The Platform Owner's menu: the work areas, then governance (health, audit, settings).
  const platformNavigation=[
    {key:'platformNav.overview',label:'platformNav.menuOverview',path:'/platform',hash:'',icon:LayoutDashboard},
    {key:'platformNav.organizations',label:'platformNav.menuOrganizations',path:'/platform',hash:'organizations',icon:Building2},
    {key:'platformNav.demos',label:'platformNav.menuDemos',path:'/platform',hash:'demo',icon:FlaskConical},
    {key:'platformNav.users',label:'platformNav.menuUsers',path:'/platform',hash:'users',icon:Users},
    {key:'platformNav.analysis',label:'platformNav.menuAnalysis',path:'/platform',hash:'reports',icon:BarChart3},
    {key:'platformNav.legislation',label:'platformNav.menuLegislation',path:'/platform/legislation',hash:'',icon:Scale},
    {key:'platformNav.management',label:'platformNav.menuManagement',path:'/platform',hash:'management',icon:Database,children:[
      {key:'managementGroupLibraries',label:'managementGroupLibraries',path:'/platform',hash:'management?group=libraries'},
      {key:'managementGroupData',label:'managementGroupData',path:'/platform',hash:'management?group=data'},
      {key:'managementGroupLira',label:'managementGroupLira',path:'/platform',hash:'management?group=lira'},
    ]},
    {key:'platformNav.audit',label:'platformNav.menuAudit',path:'/platform/audit',hash:'',icon:ShieldCheck,governance:true},
    {key:'platformNav.settings',label:'platformNav.menuSettings',path:'/platform/settings',hash:'',icon:Settings,governance:true},
  ]
  const platformHashFull=location.hash.replace(/^#/,'')
  const platformActive=item=>(item.path==='/platform/legislation'&&location.pathname.startsWith('/platform/legislation'))||location.pathname===item.path&&(item.path!=='/platform'||(item.hash.includes('?')?platformHashFull===item.hash||(item.hash.endsWith('=libraries')&&platformHashFull==='management'):platformHashKey===item.hash))
  const selectedMembership=membership||memberships.find(item=>item?.organization?.id===tenant?.id)||null
  const currentOrganization=selectedMembership?.organization||tenant||null
  const idleLockMinutes=useIdleLockMinutes(tenant,isDemo)
  const branding=useOrganizationBranding(tenant,isDemo)
  // Every PDF prints the open hospital's name, logo and report header.
  useEffect(()=>{setReportBranding(tenant?{name:currentOrganization?.name||tenant.name||'',...branding,demo:Boolean(isDemo||tenant?.is_demo)}:null)},[tenant,currentOrganization?.name,branding,isDemo])
  const productionMemberships=(memberships||[]).filter(item=>item?.organization?.id&&!item?.organization?.is_demo)
  // A legislation link (from an e-mail or the bell) opens the platform's own legislation screen.
  useEffect(()=>{if(platformMode&&!tenantLoading&&!location.pathname.startsWith('/platform')&&location.pathname!=='/about'&&location.pathname!=='/account')navigate(location.pathname.startsWith('/legislation')?`/platform${location.pathname}${location.search}`:'/platform',{replace:true})},[platformMode,tenantLoading,location.pathname,location.search,navigate])
  const isDepartmentHomeRole=role===ROLES.DEPARTMENT_MANAGER||role===ROLES.DEPARTMENT_USER||role===ROLES.LINK_NURSE
  useEffect(()=>{if(isDepartmentHomeRole&&location.pathname==='/')navigate('/my-department',{replace:true})},[isDepartmentHomeRole,location.pathname,navigate])
  const previewRoleLabels={hospital_admin:'hospitalAdminRole',infection_control_lead:'infectionControlLeadRole',infection_control_member:'infectionControlMemberRole',department_manager:'departmentManagerRole',link_nurse:'linkNurseRole',department_user:'departmentUserRole',laboratory:'laboratoryRole',committee_secretariat:'committeeSecretariatRole',hr_office:'hrOfficeRole',pharmacy:'pharmacyRole',occupational_physician:'occupationalPhysicianRole',doctor_reviewer:'doctorReviewerRole',quality_manager:'qualityManagerRole',hospital_director:'hospitalDirectorRole'}
  const previewRoles=PREVIEWABLE_ROLES.map(previewRole=>[previewRole,previewRoleLabels[previewRole]])
  // A real Demo organization previews roles over its own departments; the
  // sample hospital keeps its fixed list.
  const realDemoTenant=Boolean(tenant?.is_demo&&tenant?.mode!=='demo')
  // Screen guides: per hospital and per user (screenGuideSettings), in Demo organizations and hospitals alike.
  const guidesOn=!platformMode&&!helpPreviewMode&&screenGuidesOn({organization:tenant,membership})
  const [realDepartments,setRealDepartments]=useState([])
  useEffect(()=>{let active=true;if(!realDemoTenant||!tenant?.id||!canRolePreview){setRealDepartments([]);return undefined}loadDepartments(tenant.id).then(rows=>{if(active)setRealDepartments((rows||[]).filter(row=>row.is_active!==false))}).catch(()=>{if(active)setRealDepartments([])});return ()=>{active=false}},[realDemoTenant,tenant?.id,canRolePreview])
  const previewDepartments=SAMPLE_PREVIEW_DEPARTMENTS
  const demoAccess=(profile?.demoAccess||[]).find(item=>item.organizationId===tenant?.id)||null
  // A Demo evaluator switches their own role for real (demo_switch_my_role), so
  // the database returns exactly what that role sees. The Platform Owner keeps
  // the on-screen preview.
  const demoEvaluator=realDemoTenant&&!isPlatformOwner
  const demoEvaluation=useDemoEvaluation({enabled:realDemoTenant&&!platformMode&&!helpPreviewMode,organizationId:tenant?.id,organizationName:tenant?.name||'',userId:user?.id,profile,isPlatformOwner,role,language,navigate,holdAutoOpen:briefingOpen||birthdayOpen})
  const [roleSwitching,setRoleSwitching]=useState(false)
  async function switchEvaluatorRole(nextRole,departmentId=null){if(roleSwitching||!tenant?.id)return;setRoleSwitching(true);try{await switchDemoRole(tenant.id,nextRole,departmentId);setPreviewOpen(false);// The new role starts from its own home page; the current page may not be open to it.
navigate('/');await reloadMemberships()}catch(error){notifyError(error,'save',{operation:'demo_switch_role'})}finally{setRoleSwitching(false)}}
  const closedDemoAccess=!isPlatformOwner&&!tenant&&!tenantLoading?(profile?.demoAccess||[]).find(item=>!item.open)||null:null
  const departmentScopedPreviewRoles=new Set([ROLES.DEPARTMENT_MANAGER,ROLES.LINK_NURSE,ROLES.DEPARTMENT_USER,ROLES.LABORATORY])
  const previewNeedsDepartment=Boolean(rolePreview?.role&&departmentScopedPreviewRoles.has(rolePreview.role))
  // The incident report is a button at the foot of the sidebar, not a menu entry.
  const canReportIncident=!platformMode&&can(role,CAPABILITIES.REPORT_INCIDENT,membership?.capabilities??[],membership?.customCapabilities??[])&&Boolean(tenant)
  const visibleNavigation=platformMode?[]:navigationFor({role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[],hasAssignments:Boolean(membership?.assignments?.length)})
  // Every screen of this menu is fetched in idle time, so moving between screens never waits for a page file.
  const navigationPaths=visibleNavigation.map(item=>item.to).join('|')
  useEffect(()=>navigationPaths?preloadRoutesWhenIdle(navigationPaths.split('|')):undefined,[navigationPaths])
  // The Owner's level: the platform, or one hospital by name (a Demo too); inside a Demo the real-hospital selector is hidden.
  const ownerInDemo=Boolean(isDemo||realDemoTenant||tenant?.is_demo)
  const showOrganizationSwitch=isPlatformOwner&&!ownerInDemo&&productionMemberships.length>1
  async function handleLogout(){const ok=await confirm({title:t('logoutConfirmTitle'),message:`${t('logoutConfirmMessage')} ${t('logoutFarewell')}`,confirmLabel:t('logout')});if(!ok)return;clearIdleLock();await logout();navigate('/login',{replace:true})}
  async function switchUserFromLock(){await logout();navigate('/login',{replace:true})}
  // The Owner's own Demo organization, as the evaluators see theirs.
  async function openOwnDemo(){try{if(await enterPlatformDemo())navigate('/')}catch(error){notifyError(error,'load',{operation:'platform_owner_demo_enter'})}}
  function handleExitDemo(){if(isPlatformOwner){returnToPlatform();navigate({pathname:'/platform',search:'',hash:''})}else{void handleLogout()}}
  function handlePreviewRoleChange(nextRole){if(!nextRole)return;const nextNeedsDepartment=departmentScopedPreviewRoles.has(nextRole);if(demoEvaluator){const current=nextNeedsDepartment?(realDepartments.find(item=>item.id===membership?.departmentIds?.[0])||realDepartments[0]||null):null;void switchEvaluatorRole(nextRole,current?.id||null);return}if(realDemoTenant){const current=nextNeedsDepartment?(realDepartments.find(item=>item.id===rolePreview?.department)||realDepartments[0]||null):null;startRolePreview(nextRole,current?.id||'',current?.name||'');return}startRolePreview(nextRole,nextNeedsDepartment?(rolePreview?.department||''):'')}
  function handlePreviewDepartmentChange(value){if(demoEvaluator){void switchEvaluatorRole(actualRole,value);return}if(realDemoTenant){updateRolePreviewDepartment(value,realDepartments.find(item=>item.id===value)?.name||'');return}updateRolePreviewDepartment(value)}
  // The role picker: in the topbar, or in the Demo bar inside a Demo organization.
  const pickerNeedsDepartment=demoEvaluator?departmentScopedPreviewRoles.has(actualRole):previewNeedsDepartment
  const rolePreviewPopover=<div className="role-preview-popover"><strong>{t(demoEvaluator?'demoRoleTitle':'previewAsRole')}</strong><small>{t(demoEvaluator?'demoRoleHint':realDemoTenant?'previewDemoHint':'previewSafeHint')}</small><label><span>{t('roleLabel')}</span><select disabled={roleSwitching} value={demoEvaluator?(actualRole||''):(rolePreview?.role||'')} onChange={e=>handlePreviewRoleChange(e.target.value)}><option value="">{t('selectRole')}</option>{previewRoles.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</select></label>{pickerNeedsDepartment&&<label><span>{t('departmentScope')}</span><select disabled={roleSwitching} value={demoEvaluator?(membership?.departmentIds?.[0]||''):(rolePreview?.department||'')} onChange={e=>handlePreviewDepartmentChange(e.target.value)}>{realDemoTenant?realDepartments.map(item=><option key={item.id} value={item.id}>{item.name}</option>):previewDepartments.map(([value,key])=><option key={key} value={value}>{t(key)}</option>)}</select></label>}<div className="preview-popover-actions">{demoEvaluator&&actualRole!==ROLES.HOSPITAL_ADMIN&&<button disabled={roleSwitching} onClick={()=>void switchEvaluatorRole(ROLES.HOSPITAL_ADMIN)}>{t('demoRoleBackToAdmin')}</button>}{isRolePreview&&<button onClick={()=>{stopRolePreview();setPreviewOpen(false)}}>{t('exitPreview')}</button>}<button onClick={()=>setPreviewOpen(false)}>{t('close')}</button></div></div>
  if(closedDemoAccess)return <DemoClosedScreen access={closedDemoAccess} language={language} onLogout={()=>{clearIdleLock();void logout().then(()=>navigate('/login',{replace:true}))}}/>
  const PlatformNavEntry=({item,nested=false})=>{const Icon=item.icon;const active=platformActive(item);const go=target=>navigate({pathname:target.path,search:'',hash:target.hash?`#${target.hash}`:''});const button=<button type="button" title={t(item.key)} aria-current={active&&!item.children?'page':undefined} className={`nav-item ${nested?'nested':''} ${active&&!item.children?'active':''} ${active&&item.children?'active-group':''}`} onClick={()=>go(item.children?item.children[0]:item)}>{Icon&&<Icon size={nested?16:18}/>}<span>{t(item.label)}</span>{item.children&&<ChevronDown className="nav-group-chevron" size={14}/>}</button>;if(!item.children)return button;return <div className={`sidebar-nav-group ${active?'open':''}`}>{button}{active&&<div className="sidebar-nav-children">{item.children.map(child=><PlatformNavEntry key={child.hash} item={child} nested/>)}</div>}</div>}
  return <div className={`app-shell ${platformMode?'platform-mode':''} ${helpPreviewMode?'help-preview-mode':''}`}>
    <aside id="app-sidebar" className={`sidebar${navOpen?' sidebar-open':''}`}><button type="button" className="sidebar-toggle" aria-expanded={navOpen} aria-controls="app-sidebar" aria-label={navOpen?t('closeMenu'):t('openMenu')} title={navOpen?t('closeMenu'):t('openMenu')} onClick={()=>setNavOpen(v=>!v)}>{navOpen?<X size={20}/>:<Menu size={20}/>}</button><div className="brand"><BrandMark size={30} tone="light" className="brand-mark-logo"/><div><strong>Limoxis Observer</strong><span>{t('brandSubtitle')}</span></div></div><nav>
      {platformMode&&<>{platformNavigation.filter(item=>!item.governance).map(item=><PlatformNavEntry key={item.key} item={item}/>)}<div className="sidebar-nav-management">{platformNavigation.filter(item=>item.governance).map(item=><PlatformNavEntry key={item.key} item={item}/>)}</div></>}
      {!platformMode&&<SidebarNavigation role={role} items={visibleNavigation} t={t} userKey={profile?.id||user?.id}/>}
    </nav>{!platformMode&&<SidebarRecycleBin organizationId={tenant?.id||null} role={role} actorName={profile?.fullName||profile?.email||null} label={t('recycleBin')} onOpen={()=>setNavOpen(false)}/>}{canReportIncident&&<SidebarIncidentReport t={t} onNavigate={()=>setNavOpen(false)}/>}<div className="sidebar-footer"><div className="sidebar-meta">{roleLabel(role,language)}</div><div className="app-version-stamp">v{APP_VERSION}</div></div></aside>{navOpen&&<div className="sidebar-backdrop" aria-hidden="true" onClick={()=>setNavOpen(false)}/>}
    <main className="main-column"><header className={`topbar${isPlatformOwner&&tenant&&!platformMode?' topbar-owner-in-hospital':''}`}><div className="topbar-spacer topbar-whereami">{platformMode&&isPlatformOwner&&<div className="topbar-organization-context topbar-level-platform" title={t('topbarLevelPlatformHint')}><Layers3 size={17}/><div className="topbar-organization-copy"><strong>{t('topbarLevelPlatform')}</strong><span>{t('topbarLevelPlatformHint')}</span></div></div>}{platformMode&&<button type="button" className="topbar-demo-badge" onClick={()=>void openOwnDemo()} title={t('enterDemo')}><FlaskConical size={14}/><span>{t('enterDemo')}</span></button>}{!platformMode&&currentOrganization&&<div className={`topbar-organization-context${isPlatformOwner?' topbar-level-hospital':''}`}>{branding.logo?<img className="topbar-organization-logo" src={branding.logo} alt=""/>:<Building2 size={17}/>}<div className="topbar-organization-copy"><strong>{isPlatformOwner?`${t('topbarLevelHospital')}: ${currentOrganization.name}`:currentOrganization.name}</strong><span>{[currentOrganization.code,currentOrganization.city].filter(Boolean).join(' · ')||roleLabel(role,language)}</span></div>{showOrganizationSwitch&&<label className="topbar-organization-switch" title={t('changeOrganizationTitle')}><select value={selectedMembership?.id||''} onChange={e=>e.target.value&&setTenantByMembership(e.target.value)} aria-label={t('organization')}>{productionMemberships.map(item=><option key={item.id} value={item.id}>{item.organization.name}</option>)}</select><ChevronDown size={13}/></label>}</div>}{isDemo&&<button type="button" className="topbar-demo-badge" onClick={handleExitDemo} title={t('exitDemo')}><FlaskConical size={13}/><span>{t('demo')}</span><X size={12}/></button>}
      {/* The Platform Owner in a hospital or a Demo: the way back, always in the same place. */}
      {isPlatformOwner&&tenant&&!platformMode&&<button type="button" className="preview-trigger topbar-platform-return" title={t('backToPlatform')} onClick={()=>{returnToPlatform();navigate({pathname:'/platform',search:'',hash:''})}}><ArrowLeft size={15}/><span>{t('backToPlatform')}</span></button>}</div><div className="topbar-actions">
      {/* A clean bar: where I am (left), the notifications and one user menu (preview, help, language, sign out). */}
      <div className="notification-anchor"><button className={`icon-button notification-button ${notificationOpen?'active':''}`} aria-label={t('notifications')} title={t('notifications')} onClick={()=>setNotificationOpen(v=>!v)}><Bell size={19}/>{notifications.unreadCount>0&&<span className="notification-count">{notifications.unreadCount>99?'99+':notifications.unreadCount}</span>}</button><NotificationCenter open={notificationOpen} onClose={()=>setNotificationOpen(false)} onOpenBriefing={()=>{setNotificationOpen(false);setBriefingOpen(true)}} onOpenBirthday={()=>{setNotificationOpen(false);setBirthdayOpen(true)}}/></div>
      {canRolePreview&&!platformMode&&!realDemoTenant&&<div className="role-preview-control">{previewOpen&&rolePreviewPopover}</div>}
      <TopbarUserMenu t={t} name={profile?.fullName||profile?.email||''} roleName={isRolePreview?t('previewMode'):roleLabel(role,language)} language={language} onAccount={()=>setAccountOpen(true)} onPreview={canRolePreview&&!platformMode&&!realDemoTenant?()=>setPreviewOpen(true):null} onHelp={()=>setHelpOpen(true)} onToggleLanguage={()=>setLanguage(language==='el'?'en':'el')} onLogout={()=>void handleLogout()}/>
    </div></header>{realDemoTenant&&!platformMode&&<DemoEvaluationBar tenant={currentOrganization} access={demoAccess} isPlatformOwner={isPlatformOwner} language={language} previewOpen={previewOpen} previewLabel={demoEvaluator?`${t('roleLabel')}: ${t(previewRoles.find(([value])=>value===actualRole)?.[1]||'roleLabel')}${pickerNeedsDepartment&&membership?.departmentName?` · ${membership.departmentName}`:''}`:isRolePreview?`${t('previewingAs')}: ${t(previewRoles.find(([value])=>value===role)?.[1]||'roleLabel')}`:''} onPreviewRoles={()=>setPreviewOpen(v=>!v)} rolePicker={previewOpen?rolePreviewPopover:null} guideDone={demoEvaluation.guideDone} guideTotal={demoEvaluation.guideTotal} onOpenGuide={demoEvaluation.openGuide} canRequestApplication={demoEvaluation.canRequest} applicationRequested={demoEvaluation.requested} onRequestApplication={demoEvaluation.openApplication} onExit={()=>{returnToPlatform();navigate({pathname:'/platform',search:'',hash:''})}}/>}{isRolePreview&&<div className="preview-banner"><Eye size={15}/><span>{t('previewingAs')}: <strong>{t(previewRoles.find(([value])=>value===role)?.[1]||'roleLabel')}</strong>{previewNeedsDepartment&&rolePreview?.department?` · ${realDemoTenant?(rolePreview.departmentName||''):t(previewDepartments.find(([value])=>value===rolePreview.department)?.[1]||'departmentScope')}`:''}</span><button onClick={stopRolePreview}><X size={14}/>{t('exitPreview')}</button></div>}<UnsavedChangesGuard language={language}/><div className="content"><ScreenErrorBoundary resetKey={location.pathname}><Suspense fallback={<RouteLoading/>}><Outlet/></Suspense></ScreenErrorBoundary></div></main>{!helpPreviewMode&&helpRequested&&<Suspense fallback={null}><HelpCenter open={helpOpen} onClose={()=>setHelpOpen(false)} onResetScreenGuides={guidesOn&&user?.id?async()=>{await resetScreenGuides(user.id);setScreenGuideReset(v=>v+1)}:null}/></Suspense>}{!helpPreviewMode&&<BirthdayGreeting open={birthdayOpen} onClose={closeBirthday}/>}{!helpPreviewMode&&<LoginBriefingDialog open={briefingOpen} onClose={closeBriefing}/>}{demoEvaluation.dialogs}{guidesOn&&<Suspense fallback={null}><ScreenGuide enabled={guidesOn} userId={user?.id} language={language} hold={briefingOpen||birthdayOpen||helpOpen||demoEvaluation.busy} resetToken={screenGuideReset} onOpenHelp={()=>{setHelpRequested(true);setHelpOpen(true)}}/></Suspense>}<AccountDrawer open={accountOpen} onClose={()=>setAccountOpen(false)}/>{!helpPreviewMode&&!platformMode&&<IdleLock minutes={idleLockMinutes} userName={profile?.fullName||profile?.email||''} organizationName={currentOrganization?.name||''} email={isDemo?null:user?.email||null} language={language} onSwitchUser={()=>void switchUserFromLock()}/>}
  </div>
}
