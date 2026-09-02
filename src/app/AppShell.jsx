import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, Bell, BookOpen, Building2, ChevronDown, Eye, FlaskConical, Layers3, LogOut, UserRound, X } from 'lucide-react'
import { navigationFor } from './navigation'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useTenant } from '../core/tenant/TenantContext'
import { useAuth } from '../core/auth/AuthContext'
import { HelpCenter } from '../core/help/HelpCenter'
import { ROLES } from '../core/permissions/roles'
import { APP_VERSION, BUILD_ID } from '../core/version'
import { BirthdayGreeting, NotificationCenter, LoginBriefing } from '../core/notifications/NotificationCenter'
import { useNotifications } from '../core/notifications/NotificationContext'
import { useFeedback } from '../core/feedback/FeedbackContext'
import { readSessionValue, writeSessionValue } from '../core/storage/browserStorage'
import { AccountDrawer } from '../features/account/AccountDrawer'
import { recordRuntimeEvent } from '../core/diagnostics/runtimeDiagnosticsService'

export function AppShell(){
  const helpPreviewMode=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('helpPreview')==='1'&&window.self!==window.top
  const {language,setLanguage,t}=useLanguage(); const {tenant,memberships,membership,role,isDemo,setTenantByMembership,returnToPlatform,actualRole,canRolePreview,isRolePreview,rolePreview,startRolePreview,updateRolePreviewDepartment,stopRolePreview}=useTenant(); const {profile,logout}=useAuth(); const notifications=useNotifications(); const {confirm}=useFeedback(); const navigate=useNavigate(); const location=useLocation(); const [helpOpen,setHelpOpen]=useState(false); const [notificationOpen,setNotificationOpen]=useState(false); const [birthdayOpen,setBirthdayOpen]=useState(false); const [briefingOpen,setBriefingOpen]=useState(false); const [previewOpen,setPreviewOpen]=useState(false); const [moreOpen,setMoreOpen]=useState(false); const [accountOpen,setAccountOpen]=useState(false)

  useEffect(()=>{
    if(helpPreviewMode||!tenant?.id||isDemo)return
    const handleFeedback=(event)=>{
      const detail=event?.detail||{}
      if(!detail.message)return
      void recordRuntimeEvent({
        organizationId:tenant.id,
        severity:detail.severity||'info',
        eventType:detail.eventType||'ui_feedback',
        route:window.location.pathname,
        operation:detail.operation||null,
        userMessage:detail.message,
        diagnosticCode:detail.diagnosticCode||null,
      }).catch(()=>{/* diagnostics must never interrupt the user's workflow */})
    }
    window.addEventListener('limoxis:feedback',handleFeedback)
    return ()=>window.removeEventListener('limoxis:feedback',handleFeedback)
  },[tenant?.id,isDemo,helpPreviewMode])

  useEffect(()=>{
    if(helpPreviewMode||!profile)return
    const key=profile?.id||profile?.email||'user'
    const birthdayKey=`limoxis.birthday.seen.${key}.${new Date().toISOString().slice(0,10)}`
    const briefingKey=`limoxis.briefing.seen.${key}`
    const birthdaySeen=readSessionValue(birthdayKey)==='1'
    const briefingSeen=readSessionValue(briefingKey)==='1'
    if(notifications.birthday.length&&!birthdaySeen)setBirthdayOpen(true)
    else if(!briefingSeen)setBriefingOpen(true)
  },[profile,notifications.birthday.length,helpPreviewMode])
  function closeBirthday(){
    const key=profile?.id||profile?.email||'user';writeSessionValue(`limoxis.birthday.seen.${key}.${new Date().toISOString().slice(0,10)}`,'1')
    setBirthdayOpen(false)
    const briefingSeen=readSessionValue(`limoxis.briefing.seen.${key}`)==='1'
    if(!briefingSeen)window.setTimeout(()=>setBriefingOpen(true),180)
  }
  function closeBriefing(){const key=profile?.id||profile?.email||'user';writeSessionValue(`limoxis.briefing.seen.${key}`,'1');setBriefingOpen(false)}

  const isPlatformOwner=actualRole===ROLES.PLATFORM_OWNER
  const platformMode=isPlatformOwner&&!tenant
  useEffect(()=>{
    if(platformMode&&!location.pathname.startsWith('/platform')&&location.pathname!=='/about'&&location.pathname!=='/account') navigate('/platform',{replace:true})
  },[platformMode,location.pathname,navigate])
  const isDepartmentRole=role===ROLES.DEPARTMENT_MANAGER||role===ROLES.DEPARTMENT_USER||role===ROLES.LINK_NURSE||role===ROLES.LABORATORY
  useEffect(()=>{
    if(isDepartmentRole&&location.pathname==='/') navigate('/my-department',{replace:true})
  },[isDepartmentRole,location.pathname,navigate])
  const platformItems=[
    ['/platform','platformDashboardNav',BarChart3],
    ['/platform#organizations','platformOrganizationsNav',Building2],
    ['/platform#demo','platformDemoNav',FlaskConical],
    ['/platform#reports','platformAnalyticsNav',BarChart3],
  ]
  const previewRoles=[
    [ROLES.HOSPITAL_ADMIN,'hospitalAdminRole'],[ROLES.INFECTION_CONTROL_LEAD,'infectionControlLeadRole'],[ROLES.INFECTION_CONTROL_MEMBER,'infectionControlMemberRole'],[ROLES.DEPARTMENT_MANAGER,'departmentManagerRole'],[ROLES.LINK_NURSE,'linkNurseRole'],[ROLES.DEPARTMENT_USER,'departmentUserRole'],[ROLES.LABORATORY,'laboratoryRole'],[ROLES.COMMITTEE_SECRETARIAT,'committeeSecretariatRole'],[ROLES.HR_OFFICE,'hrOfficeRole'],[ROLES.PHARMACY,'pharmacyRole'],[ROLES.OCCUPATIONAL_PHYSICIAN,'occupationalPhysicianRole'],[ROLES.DOCTOR_REVIEWER,'doctorReviewerRole'],[ROLES.QUALITY_MANAGER,'qualityManagerRole']
  ]
  const previewDepartments=[['','previewAllHospital'],['icu','previewIcu'],['surgery','previewSurgery'],['internal','previewInternalMedicine']]
  const visibleNavigation=platformMode?[]:navigationFor({role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[],hasAssignments:Boolean(membership?.assignments?.length)})
  const canOrganizationAnalysis=!platformMode&&[ROLES.PLATFORM_OWNER,ROLES.HOSPITAL_ADMIN,ROLES.INFECTION_CONTROL_LEAD,ROLES.DEMO].includes(role)
  const managementNavigation=visibleNavigation.filter(item=>item.key==='management')
  const usesCompactMore=[ROLES.PLATFORM_OWNER,ROLES.HOSPITAL_ADMIN,ROLES.INFECTION_CONTROL_LEAD].includes(role)
  const moreNavigation=usesCompactMore?visibleNavigation.filter(item=>item.group==='more'):[]
  const primaryNavigation=usesCompactMore
    ?visibleNavigation.filter(item=>item.key!=='management'&&item.group!=='more')
    :visibleNavigation.filter(item=>item.key!=='management')
  const moreActive=usesCompactMore&&moreNavigation.some(item=>location.pathname===item.to||location.pathname.startsWith(`${item.to}/`))
  const moreExpanded=usesCompactMore&&(moreOpen||moreActive)
  async function handleLogout(){
    const ok=await confirm({title:t('logoutConfirmTitle'),message:`${t('logoutConfirmMessage')} ${t('logoutFarewell')}`,confirmLabel:t('logout')})
    if(!ok)return
    await logout();navigate('/login',{replace:true})
  }
  const NavEntry=({item,nested=false,collapseMore=false})=>{const Icon=item.icon;return <NavLink to={item.to} end={item.to==='/' } onClick={()=>collapseMore&&setMoreOpen(false)} className={({isActive})=>`nav-item ${nested?'nested':''} ${isActive?'active':''}`}><Icon size={nested?16:18}/><span>{t(item.key)}</span></NavLink>}
  return <div className={`app-shell ${helpPreviewMode?'help-preview-mode':''}`}>
    <aside className="sidebar"><div className="brand"><div className="brand-mark">L+</div><div><strong>Limoxis Observer</strong><span>{platformMode?t('platformAdministration'):t('brandSubtitle')}</span></div></div><nav>
      {platformMode&&platformItems.map(([to,labelKey,Icon])=>{const [path,hash='']=to.split('#');const active=location.pathname===path&&((!hash&&!location.hash)||location.hash===`#${hash}`||location.hash.startsWith(`#${hash}?`));return <a key={to} href={to} className={`nav-item ${active?'active':''}`}><Icon size={18}/><span>{t(labelKey)}</span></a>})}
      {!platformMode&&isPlatformOwner&&tenant&&<button type="button" className="nav-item platform-return-nav" onClick={()=>{returnToPlatform();navigate('/platform')}}><ArrowLeft size={18}/><span>{t('backToPlatform')}</span></button>}
      {primaryNavigation.map(item=><NavEntry key={item.to} item={item} collapseMore/>)}
      {canOrganizationAnalysis&&<NavLink to="/analysis" className={({isActive})=>`nav-item ${isActive?'active':''}`}><BarChart3 size={18}/><span>{t('platformAnalyticsNav')}</span></NavLink>}
      {moreNavigation.length>0&&<div className={`sidebar-nav-group ${moreExpanded?'open':''}`}><button type="button" className={`nav-item nav-group-trigger ${moreActive?'active-group':''}`} onClick={()=>setMoreOpen(v=>!v)} aria-expanded={moreExpanded}><Layers3 size={18}/><span>{t('more')}</span><ChevronDown className="nav-group-chevron" size={14}/></button>{moreExpanded&&<div className="sidebar-nav-children">{moreNavigation.map(item=><NavEntry key={item.to} item={item} nested/>)}</div>}</div>}
      {managementNavigation.length>0&&<div className="sidebar-nav-management">{managementNavigation.map(item=><NavEntry key={item.to} item={item} collapseMore/>)}</div>}
    </nav><div className="sidebar-footer"><div className="tenant-name">{platformMode?t('platformLevel'):(tenant?.name??t('noOrganization'))}</div><div className="sidebar-meta">{role?.replaceAll('_',' ')??'—'}</div>{isDemo&&<span className="demo-pill">{t('demo')}</span>}<div className="app-version-stamp">v{APP_VERSION} · {BUILD_ID}</div></div></aside>
    <main className="main-column"><header className="topbar"><div className="topbar-spacer"/><div className="topbar-actions">
      {canRolePreview&&!platformMode&&<div className="role-preview-control"><button className={`preview-trigger ${isRolePreview?'active':''}`} onClick={()=>setPreviewOpen(v=>!v)} title={t('previewAsRole')}><Eye size={16}/><span>{isRolePreview?t('previewMode'):t('previewAsRole')}</span><ChevronDown size={13}/></button>{previewOpen&&<div className="role-preview-popover"><strong>{t('previewAsRole')}</strong><small>{t('previewSafeHint')}</small><label><span>{t('roleLabel')}</span><select value={rolePreview?.role||''} onChange={e=>{if(e.target.value)startRolePreview(e.target.value,rolePreview?.department||'')}}><option value="">{t('selectRole')}</option>{previewRoles.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</select></label>{rolePreview?.role&&<label><span>{t('departmentScope')}</span><select value={rolePreview?.department||''} onChange={e=>updateRolePreviewDepartment(e.target.value)}>{previewDepartments.map(([value,key])=><option key={key} value={value}>{t(key)}</option>)}</select></label>}<div className="preview-popover-actions">{isRolePreview&&<button onClick={()=>{stopRolePreview();setPreviewOpen(false)}}>{t('exitPreview')}</button>}<button onClick={()=>setPreviewOpen(false)}>{t('close')}</button></div></div>}</div>}
      {!platformMode&&memberships.length>1&&<label className="tenant-switch"><select value={membership?.id??''} onChange={e=>setTenantByMembership(e.target.value)}>{memberships.map(item=><option key={item.id} value={item.id}>{item.organization.name}</option>)}</select><ChevronDown size={14}/></label>}
      <div className="topbar-utility-group topbar-utility-card"><div className="notification-anchor"><button className={`icon-button notification-button ${notificationOpen?'active':''}`} aria-label={t('notifications')} title={t('notifications')} onClick={()=>setNotificationOpen(v=>!v)}><Bell size={19}/>{notifications.unreadCount>0&&<span className="notification-count">{notifications.unreadCount>99?'99+':notifications.unreadCount}</span>}</button><NotificationCenter open={notificationOpen} onClose={()=>setNotificationOpen(false)} onOpenBriefing={()=>{setNotificationOpen(false);setBriefingOpen(true)}} onOpenBirthday={()=>{setNotificationOpen(false);setBirthdayOpen(true)}}/></div><button className="icon-button help-button" aria-label={t('helpInformationCenter')} title={t('helpInformationCenter')} onClick={()=>setHelpOpen(true)}><BookOpen size={18}/></button><button className="language-button" onClick={()=>setLanguage(language==='el'?'en':'el')}>{language==='el'?'EN':'EL'}</button></div>
      <button type="button" className="user-chip user-chip-button" onClick={()=>setAccountOpen(true)} title={t('myAccount')}><div className="avatar">{(profile?.fullName||profile?.email||'U').slice(0,2).toUpperCase()}</div><div><strong>{profile?.fullName||profile?.email||'User'}</strong><span>{tenant?.name??''}</span></div><UserRound size={15}/></button><button className="icon-button logout-button" title={t('logout')} aria-label={t('logout')} onClick={handleLogout}><LogOut size={17}/></button>
    </div></header>{isRolePreview&&<div className="preview-banner"><Eye size={15}/><span>{t('previewingAs')}: <strong>{t(previewRoles.find(([value])=>value===role)?.[1]||'roleLabel')}</strong>{rolePreview?.department?` · ${t(previewDepartments.find(([value])=>value===rolePreview.department)?.[1]||'departmentScope')}`:''}</span><button onClick={stopRolePreview}><X size={14}/>{t('exitPreview')}</button></div>}<div className="content"><Outlet/></div></main>{!helpPreviewMode&&<HelpCenter open={helpOpen} onClose={()=>setHelpOpen(false)}/>}{!helpPreviewMode&&<BirthdayGreeting open={birthdayOpen} onClose={closeBirthday}/>}{!helpPreviewMode&&<LoginBriefing open={briefingOpen} onClose={closeBriefing}/>}<AccountDrawer open={accountOpen} onClose={()=>setAccountOpen(false)}/>
  </div>
}