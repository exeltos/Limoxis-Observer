import { BrandMark } from '../design-system/BrandMark'
import { Suspense, useEffect, useState } from 'react'
import { lazyPage } from '../core/errors/chunkRecovery'
import { ScreenErrorBoundary } from '../core/errors/AppErrorBoundary'
import { UnsavedChangesGuard } from './UnsavedChangesGuard'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, BookOpen, Building2, ChevronDown, ChevronRight, Eye, FlaskConical, LayoutDashboard, Layers3, LogOut, Menu, UserRound, X } from 'lucide-react'
import { navigationFor } from './navigation'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useTenant } from '../core/tenant/TenantContext'
import { useAuth } from '../core/auth/AuthContext'
import { PREVIEWABLE_ROLES, ROLES } from '../core/permissions/roles'
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
import { useDemoEvaluation } from '../features/demo/useDemoEvaluation'
import { resetScreenGuides } from '../features/demo/screenGuideService'

// The help manual (EL/EN content for every role) is only needed once the user
// opens it, so it loads on demand instead of shipping with the first paint.
const HelpCenter=lazyPage(()=>import('../core/help/HelpCenter'),'HelpCenter')
// Screen guides exist only in a Demo: keep the manual text out of the main bundle.
const ScreenGuide=lazyPage(()=>import('../features/demo/ScreenGuide'),'ScreenGuide')

export function AppShell(){
  const helpPreviewMode=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('helpPreview')==='1'&&window.self!==window.top
  const {language,setLanguage,t}=useLanguage(); const {tenant,loading:tenantLoading,memberships,membership,role,isDemo,platformDemoPreview,togglePlatformDemoPreview,setTenantByMembership,returnToPlatform,actualRole,canRolePreview,isRolePreview,rolePreview,startRolePreview,updateRolePreviewDepartment,stopRolePreview,reloadMemberships}=useTenant(); const {profile,user,logout}=useAuth(); const notifications=useNotifications(); const {confirm,notifyError}=useFeedback(); const navigate=useNavigate(); const location=useLocation(); const [helpOpen,setHelpOpen]=useState(false);const [screenGuideReset,setScreenGuideReset]=useState(0);const [helpRequested,setHelpRequested]=useState(false);useEffect(()=>{if(helpOpen)setHelpRequested(true)},[helpOpen]); const [notificationOpen,setNotificationOpen]=useState(false); const [birthdayOpen,setBirthdayOpen]=useState(false); const [briefingOpen,setBriefingOpen]=useState(false); const [previewOpen,setPreviewOpen]=useState(false); const [moreOpen,setMoreOpen]=useState(false); const [accountOpen,setAccountOpen]=useState(false)
  useEffect(()=>{if(helpPreviewMode||!tenant?.id||isDemo)return;const handleFeedback=(event)=>{const detail=event?.detail||{};if(!detail.message)return;void recordRuntimeEvent({organizationId:tenant.id,severity:detail.severity||'info',eventType:detail.eventType||'ui_feedback',route:window.location.pathname,operation:detail.operation||null,userMessage:detail.message,diagnosticCode:detail.diagnosticCode||null}).catch(()=>{})};window.addEventListener('limoxis:feedback',handleFeedback);return ()=>window.removeEventListener('limoxis:feedback',handleFeedback)},[tenant?.id,isDemo,helpPreviewMode])
  useEffect(()=>{if(helpPreviewMode||!profile)return;const key=profile?.id||profile?.email||'user';const birthdayKey=`limoxis.birthday.seen.${key}.${new Date().toISOString().slice(0,10)}`;const briefingKey=`limoxis.briefing.seen.${key}`;const birthdaySeen=readSessionValue(birthdayKey)==='1';const briefingSeen=readSessionValue(briefingKey)==='1';if(notifications.birthday.length&&!birthdaySeen)setBirthdayOpen(true);else if(!briefingSeen)setBriefingOpen(true)},[profile,notifications.birthday.length,helpPreviewMode])
  function closeBirthday(){const key=profile?.id||profile?.email||'user';writeSessionValue(`limoxis.birthday.seen.${key}.${new Date().toISOString().slice(0,10)}`,'1');setBirthdayOpen(false);const briefingSeen=readSessionValue(`limoxis.briefing.seen.${key}`)==='1';if(!briefingSeen)window.setTimeout(()=>setBriefingOpen(true),180)}
  function closeBriefing(){const key=profile?.id||profile?.email||'user';writeSessionValue(`limoxis.briefing.seen.${key}`,'1');setBriefingOpen(false)}
  const isPlatformOwner=actualRole===ROLES.PLATFORM_OWNER
  const platformMode=isPlatformOwner&&!tenant
  // Tablets (641–1100px) show an icon rail; the toggle opens the full menu over the page.
  const [navOpen,setNavOpen]=useState(false)
  useEffect(()=>{setNavOpen(false)},[location.pathname,location.hash])
  useEffect(()=>{if(!navOpen)return;const onKey=event=>{if(event.key==='Escape')setNavOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[navOpen])
  const platformHashKey=location.hash.replace(/^#/,'').split('?')[0]
  const platformNavigation=[
    {key:'platformNav.organizations',path:'/platform',hash:'organizations'},
    {key:'platformNav.demos',path:'/platform',hash:'demo'},
    {key:'platformNav.analysis',path:'/platform',hash:'reports'},
    {key:'platformNav.management',path:'/platform',hash:'management'},
    {key:'platformNav.health',path:'/platform/health',hash:''},
    {key:'platformNav.audit',path:'/platform/audit',hash:''},
    {key:'platformNav.settings',path:'/platform/settings',hash:''},
  ]
  const platformCrumb=platformMode?platformNavigation.find(item=>location.pathname===item.path&&(item.path!=='/platform'||platformHashKey===item.hash))||null:null
  const selectedMembership=membership||memberships.find(item=>item?.organization?.id===tenant?.id)||null
  const currentOrganization=selectedMembership?.organization||tenant||null
  const idleLockMinutes=useIdleLockMinutes(tenant,isDemo)
  const branding=useOrganizationBranding(tenant,isDemo)
  // Every PDF prints the open hospital's name, logo and report header.
  useEffect(()=>{setReportBranding(tenant?{name:currentOrganization?.name||tenant.name||'',...branding,demo:Boolean(isDemo||tenant?.is_demo)}:null)},[tenant,currentOrganization?.name,branding,isDemo])
  const productionMemberships=(memberships||[]).filter(item=>item?.organization?.id&&!item?.organization?.is_demo)
  useEffect(()=>{if(platformMode&&!tenantLoading&&!location.pathname.startsWith('/platform')&&location.pathname!=='/about'&&location.pathname!=='/account')navigate('/platform',{replace:true})},[platformMode,tenantLoading,location.pathname,navigate])
  const isDepartmentHomeRole=role===ROLES.DEPARTMENT_MANAGER||role===ROLES.DEPARTMENT_USER||role===ROLES.LINK_NURSE
  useEffect(()=>{if(isDepartmentHomeRole&&location.pathname==='/')navigate('/my-department',{replace:true})},[isDepartmentHomeRole,location.pathname,navigate])
  const previewRoleLabels={hospital_admin:'hospitalAdminRole',infection_control_lead:'infectionControlLeadRole',infection_control_member:'infectionControlMemberRole',department_manager:'departmentManagerRole',link_nurse:'linkNurseRole',department_user:'departmentUserRole',laboratory:'laboratoryRole',committee_secretariat:'committeeSecretariatRole',hr_office:'hrOfficeRole',pharmacy:'pharmacyRole',occupational_physician:'occupationalPhysicianRole',doctor_reviewer:'doctorReviewerRole',quality_manager:'qualityManagerRole'}
  const previewRoles=PREVIEWABLE_ROLES.map(previewRole=>[previewRole,previewRoleLabels[previewRole]])
  // A real Demo organization previews roles over its own departments; the
  // sample hospital keeps its fixed list.
  const realDemoTenant=Boolean(tenant?.is_demo&&tenant?.mode!=='demo')
  const [realDepartments,setRealDepartments]=useState([])
  useEffect(()=>{let active=true;if(!realDemoTenant||!tenant?.id||!canRolePreview){setRealDepartments([]);return undefined}loadDepartments(tenant.id).then(rows=>{if(active)setRealDepartments((rows||[]).filter(row=>row.is_active!==false))}).catch(()=>{if(active)setRealDepartments([])});return ()=>{active=false}},[realDemoTenant,tenant?.id,canRolePreview])
  const previewDepartments=[['','previewAllHospital'],['icu','previewIcu'],['surgery','previewSurgery'],['internal','previewInternalMedicine']]
  const demoAccess=(profile?.demoAccess||[]).find(item=>item.organizationId===tenant?.id)||null
  // A Demo evaluator switches their own role for real (demo_switch_my_role), so
  // the database returns exactly what that role sees. The Platform Owner keeps
  // the on-screen preview.
  const demoEvaluator=realDemoTenant&&!isPlatformOwner
  const demoEvaluation=useDemoEvaluation({enabled:realDemoTenant&&!platformMode&&!helpPreviewMode,organizationId:tenant?.id,organizationName:tenant?.name||'',userId:user?.id,profile,isPlatformOwner,language,navigate,holdAutoOpen:briefingOpen||birthdayOpen})
  const [roleSwitching,setRoleSwitching]=useState(false)
  async function switchEvaluatorRole(nextRole,departmentId=null){if(roleSwitching||!tenant?.id)return;setRoleSwitching(true);try{await switchDemoRole(tenant.id,nextRole,departmentId);setPreviewOpen(false);// The new role starts from its own home page; the current page may not be open to it.
navigate('/');await reloadMemberships()}catch(error){notifyError(error,'save',{operation:'demo_switch_role'})}finally{setRoleSwitching(false)}}
  const closedDemoAccess=!isPlatformOwner&&!tenant&&!tenantLoading?(profile?.demoAccess||[]).find(item=>!item.open)||null:null
  const departmentScopedPreviewRoles=new Set([ROLES.DEPARTMENT_MANAGER,ROLES.LINK_NURSE,ROLES.DEPARTMENT_USER,ROLES.LABORATORY])
  const previewNeedsDepartment=Boolean(rolePreview?.role&&departmentScopedPreviewRoles.has(rolePreview.role))
  const visibleNavigation=platformMode?[]:navigationFor({role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[],hasAssignments:Boolean(membership?.assignments?.length)})
  const managementNavigation=visibleNavigation.filter(item=>item.key==='management')
  const usesCompactMore=[ROLES.PLATFORM_OWNER,ROLES.INFECTION_CONTROL_LEAD].includes(role)
  const moreNavigation=usesCompactMore?visibleNavigation.filter(item=>item.group==='more'):[]
  const primaryNavigation=usesCompactMore?visibleNavigation.filter(item=>item.key!=='management'&&item.group!=='more'):visibleNavigation.filter(item=>item.key!=='management')
  const moreActive=usesCompactMore&&moreNavigation.some(item=>location.pathname===item.to||location.pathname.startsWith(`${item.to}/`))
  const moreExpanded=usesCompactMore&&(moreOpen||moreActive)
  async function handleLogout(){const ok=await confirm({title:t('logoutConfirmTitle'),message:`${t('logoutConfirmMessage')} ${t('logoutFarewell')}`,confirmLabel:t('logout')});if(!ok)return;clearIdleLock();await logout();navigate('/login',{replace:true})}
  async function switchUserFromLock(){await logout();navigate('/login',{replace:true})}
  function handleExitDemo(){if(isPlatformOwner){returnToPlatform();navigate({pathname:'/platform',search:'',hash:''})}else{void handleLogout()}}
  function handlePreviewRoleChange(nextRole){if(!nextRole)return;const nextNeedsDepartment=departmentScopedPreviewRoles.has(nextRole);if(demoEvaluator){const current=nextNeedsDepartment?(realDepartments.find(item=>item.id===membership?.departmentIds?.[0])||realDepartments[0]||null):null;void switchEvaluatorRole(nextRole,current?.id||null);return}if(realDemoTenant){const current=nextNeedsDepartment?(realDepartments.find(item=>item.id===rolePreview?.department)||realDepartments[0]||null):null;startRolePreview(nextRole,current?.id||'',current?.name||'');return}startRolePreview(nextRole,nextNeedsDepartment?(rolePreview?.department||''):'')}
  function handlePreviewDepartmentChange(value){if(demoEvaluator){void switchEvaluatorRole(actualRole,value);return}if(realDemoTenant){updateRolePreviewDepartment(value,realDepartments.find(item=>item.id===value)?.name||'');return}updateRolePreviewDepartment(value)}
  const NavEntry=({item,nested=false,collapseMore=false})=>{const Icon=item.icon;return <NavLink to={item.to} end={item.to==='/'} onClick={()=>collapseMore&&setMoreOpen(false)} title={t(item.key)} className={({isActive})=>`nav-item ${nested?'nested':''} ${isActive?'active':''}`}><Icon size={nested?16:18}/><span>{t(item.key)}</span></NavLink>}
  // The role picker: in the topbar, or in the Demo bar inside a Demo organization.
  const pickerNeedsDepartment=demoEvaluator?departmentScopedPreviewRoles.has(actualRole):previewNeedsDepartment
  const rolePreviewPopover=<div className="role-preview-popover"><strong>{t(demoEvaluator?'demoRoleTitle':'previewAsRole')}</strong><small>{t(demoEvaluator?'demoRoleHint':realDemoTenant?'previewDemoHint':'previewSafeHint')}</small><label><span>{t('roleLabel')}</span><select disabled={roleSwitching} value={demoEvaluator?(actualRole||''):(rolePreview?.role||'')} onChange={e=>handlePreviewRoleChange(e.target.value)}><option value="">{t('selectRole')}</option>{previewRoles.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</select></label>{pickerNeedsDepartment&&<label><span>{t('departmentScope')}</span><select disabled={roleSwitching} value={demoEvaluator?(membership?.departmentIds?.[0]||''):(rolePreview?.department||'')} onChange={e=>handlePreviewDepartmentChange(e.target.value)}>{realDemoTenant?realDepartments.map(item=><option key={item.id} value={item.id}>{item.name}</option>):previewDepartments.map(([value,key])=><option key={key} value={value}>{t(key)}</option>)}</select></label>}<div className="preview-popover-actions">{demoEvaluator&&actualRole!==ROLES.HOSPITAL_ADMIN&&<button disabled={roleSwitching} onClick={()=>void switchEvaluatorRole(ROLES.HOSPITAL_ADMIN)}>{t('demoRoleBackToAdmin')}</button>}{isRolePreview&&<button onClick={()=>{stopRolePreview();setPreviewOpen(false)}}>{t('exitPreview')}</button>}<button onClick={()=>setPreviewOpen(false)}>{t('close')}</button></div></div>
  if(closedDemoAccess)return <DemoClosedScreen access={closedDemoAccess} language={language} onLogout={()=>{clearIdleLock();void logout().then(()=>navigate('/login',{replace:true}))}}/>
  return <div className={`app-shell ${platformMode?'platform-owner-shell':''} ${helpPreviewMode?'help-preview-mode':''}`} style={platformMode?{gridTemplateColumns:'minmax(0,1fr)'}:undefined}>
    {!platformMode&&<aside id="app-sidebar" className={`sidebar${navOpen?' sidebar-open':''}`}><button type="button" className="sidebar-toggle" aria-expanded={navOpen} aria-controls="app-sidebar" aria-label={navOpen?t('closeMenu'):t('openMenu')} title={navOpen?t('closeMenu'):t('openMenu')} onClick={()=>setNavOpen(v=>!v)}>{navOpen?<X size={20}/>:<Menu size={20}/>}</button><div className="brand"><BrandMark size={30} tone="light" className="brand-mark-logo"/><div><strong>Limoxis Observer</strong><span>{t('brandSubtitle')}</span></div></div><nav>
      {isPlatformOwner&&tenant&&<button type="button" className="nav-item platform-return-nav" onClick={()=>{returnToPlatform();navigate({pathname:'/platform',search:'',hash:''})}}><ArrowLeft size={18}/><span>{t('backToPlatform')}</span></button>}
      {primaryNavigation.map(item=><NavEntry key={item.to} item={item} collapseMore/>)}
      {moreNavigation.length>0&&<div className={`sidebar-nav-group ${moreExpanded?'open':''}`}><button type="button" title={t('more')} className={`nav-item nav-group-trigger ${moreActive?'active-group':''}`} onClick={()=>setMoreOpen(v=>!v)} aria-expanded={moreExpanded}><Layers3 size={18}/><span>{t('more')}</span><ChevronDown className="nav-group-chevron" size={14}/></button>{moreExpanded&&<div className="sidebar-nav-children">{moreNavigation.map(item=><NavEntry key={item.to} item={item} nested/>)}</div>}</div>}
      {managementNavigation.length>0&&<div className="sidebar-nav-management">{managementNavigation.map(item=><NavEntry key={item.to} item={item} collapseMore/>)}</div>}
    </nav><div className="sidebar-footer"><div className="sidebar-meta">{roleLabel(role,language)}</div><div className="app-version-stamp">v{APP_VERSION}</div></div></aside>}{!platformMode&&navOpen&&<div className="sidebar-backdrop" aria-hidden="true" onClick={()=>setNavOpen(false)}/>}
    <main className="main-column"><header className="topbar"><div className="topbar-spacer">{platformCrumb&&<nav className="platform-breadcrumb" aria-label={t('platformCenter')}><button type="button" onClick={()=>navigate({pathname:'/platform',search:'',hash:''})}><LayoutDashboard size={16}/><span>{t('platformCenter')}</span></button><ChevronRight size={15} aria-hidden="true"/><strong>{t(platformCrumb.key)}</strong></nav>}{!platformMode&&currentOrganization&&<div className="topbar-organization-context">{branding.logo?<img className="topbar-organization-logo" src={branding.logo} alt=""/>:<Building2 size={17}/>}<div className="topbar-organization-copy"><strong>{currentOrganization.name}</strong><span>{[currentOrganization.code,currentOrganization.city].filter(Boolean).join(' · ')||roleLabel(role,language)}</span></div>{isPlatformOwner&&productionMemberships.length>1&&<label className="topbar-organization-switch" title={t('changeOrganizationTitle')}><select value={selectedMembership?.id||''} onChange={e=>e.target.value&&setTenantByMembership(e.target.value)} aria-label={t('organization')}>{productionMemberships.map(item=><option key={item.id} value={item.id}>{item.organization.name}</option>)}</select><ChevronDown size={13}/></label>}</div>}</div><div className="topbar-actions">
      {platformMode&&<button type="button" className={`topbar-demo-badge ${platformDemoPreview?'active':''}`} onClick={togglePlatformDemoPreview} title={platformDemoPreview?t('exitDemo'):t('enterDemo')}><FlaskConical size={14}/><span>{platformDemoPreview?t('exitDemo'):t('enterDemo')}</span></button>}
      {canRolePreview&&!platformMode&&!realDemoTenant&&<div className="role-preview-control"><button className={`preview-trigger ${isRolePreview?'active':''}`} onClick={()=>setPreviewOpen(v=>!v)} title={t('previewAsRole')}><Eye size={16}/><span>{isRolePreview?t('previewMode'):t('previewAsRole')}</span><ChevronDown size={13}/></button>{previewOpen&&rolePreviewPopover}</div>}
      <div className="topbar-utility-group topbar-utility-card"><div className="notification-anchor"><button className={`icon-button notification-button ${notificationOpen?'active':''}`} aria-label={t('notifications')} title={t('notifications')} onClick={()=>setNotificationOpen(v=>!v)}><Bell size={19}/>{notifications.unreadCount>0&&<span className="notification-count">{notifications.unreadCount>99?'99+':notifications.unreadCount}</span>}</button><NotificationCenter open={notificationOpen} onClose={()=>setNotificationOpen(false)} onOpenBriefing={()=>{setNotificationOpen(false);setBriefingOpen(true)}} onOpenBirthday={()=>{setNotificationOpen(false);setBirthdayOpen(true)}}/></div><button className="icon-button help-button" aria-label={t('helpInformationCenter')} title={t('helpInformationCenter')} onClick={()=>setHelpOpen(true)}><BookOpen size={18}/></button><button className="language-button" onClick={()=>setLanguage(language==='el'?'en':'el')}>{language==='el'?'EN':'EL'}</button></div>
      <button type="button" className="user-chip user-chip-button" onClick={()=>setAccountOpen(true)} title={t('myAccount')}><div className="avatar">{(profile?.fullName||profile?.email||'U').slice(0,2).toUpperCase()}</div><div><strong>{profile?.fullName||profile?.email||'User'}</strong><span>{roleLabel(role,language)}</span></div><UserRound size={15}/></button><button className="icon-button logout-button" title={t('logout')} aria-label={t('logout')} onClick={handleLogout}><LogOut size={17}/></button>
      {isDemo&&<button type="button" className="topbar-demo-badge" onClick={handleExitDemo} title={t('exitDemo')}><FlaskConical size={13}/><span>{t('demo')}</span><X size={12}/></button>}
    </div></header>{realDemoTenant&&!platformMode&&<DemoEvaluationBar tenant={currentOrganization} access={demoAccess} isPlatformOwner={isPlatformOwner} language={language} previewOpen={previewOpen} previewLabel={demoEvaluator?`${t('roleLabel')}: ${t(previewRoles.find(([value])=>value===actualRole)?.[1]||'roleLabel')}${pickerNeedsDepartment&&membership?.departmentName?` · ${membership.departmentName}`:''}`:isRolePreview?`${t('previewingAs')}: ${t(previewRoles.find(([value])=>value===role)?.[1]||'roleLabel')}`:''} onPreviewRoles={()=>setPreviewOpen(v=>!v)} rolePicker={previewOpen?rolePreviewPopover:null} guideDone={demoEvaluation.guideDone} onOpenGuide={demoEvaluation.openGuide} canRequestApplication={demoEvaluation.canRequest} applicationRequested={demoEvaluation.requested} onRequestApplication={demoEvaluation.openApplication} onExit={()=>{returnToPlatform();navigate({pathname:'/platform',search:'',hash:''})}}/>}{isRolePreview&&<div className="preview-banner"><Eye size={15}/><span>{t('previewingAs')}: <strong>{t(previewRoles.find(([value])=>value===role)?.[1]||'roleLabel')}</strong>{previewNeedsDepartment&&rolePreview?.department?` · ${realDemoTenant?(rolePreview.departmentName||''):t(previewDepartments.find(([value])=>value===rolePreview.department)?.[1]||'departmentScope')}`:''}</span><button onClick={stopRolePreview}><X size={14}/>{t('exitPreview')}</button></div>}<UnsavedChangesGuard language={language}/><div className="content"><ScreenErrorBoundary resetKey={location.pathname}><Outlet/></ScreenErrorBoundary></div></main>{!helpPreviewMode&&helpRequested&&<Suspense fallback={null}><HelpCenter open={helpOpen} onClose={()=>setHelpOpen(false)} onResetScreenGuides={realDemoTenant&&!platformMode&&user?.id?async()=>{await resetScreenGuides(user.id);setScreenGuideReset(v=>v+1)}:null}/></Suspense>}{!helpPreviewMode&&<BirthdayGreeting open={birthdayOpen} onClose={closeBirthday}/>}{!helpPreviewMode&&<LoginBriefingDialog open={briefingOpen} onClose={closeBriefing}/>}{demoEvaluation.dialogs}{realDemoTenant&&!platformMode&&!helpPreviewMode&&<Suspense fallback={null}><ScreenGuide enabled={realDemoTenant&&!platformMode&&!helpPreviewMode} userId={user?.id} language={language} hold={briefingOpen||birthdayOpen||helpOpen||demoEvaluation.busy} resetToken={screenGuideReset} onOpenHelp={()=>{setHelpRequested(true);setHelpOpen(true)}}/></Suspense>}<AccountDrawer open={accountOpen} onClose={()=>setAccountOpen(false)}/>{!helpPreviewMode&&!platformMode&&<IdleLock minutes={idleLockMinutes} userName={profile?.fullName||profile?.email||''} organizationName={currentOrganization?.name||''} email={isDemo?null:user?.email||null} language={language} onSwitchUser={()=>void switchUserFromLock()}/>}
  </div>
}
