import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, BookOpen, ChevronDown, Eye, Layers3, LogOut, Search, X } from 'lucide-react'
import { navigationFor } from './navigation'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useTenant } from '../core/tenant/TenantContext'
import { useAuth } from '../core/auth/AuthContext'
import { HelpCenter } from '../core/help/HelpCenter'
import { ROLES } from '../core/permissions/roles'
import { APP_VERSION, BUILD_ID } from '../core/version'

export function AppShell(){
  const {language,setLanguage,t}=useLanguage(); const {tenant,memberships,membership,role,isDemo,setTenantByMembership,canRolePreview,isRolePreview,rolePreview,startRolePreview,updateRolePreviewDepartment,stopRolePreview}=useTenant(); const {profile,logout}=useAuth(); const navigate=useNavigate(); const location=useLocation(); const [helpOpen,setHelpOpen]=useState(false); const [previewOpen,setPreviewOpen]=useState(false); const [moreOpen,setMoreOpen]=useState(false)

  const previewRoles=[
    [ROLES.HOSPITAL_ADMIN,'hospitalAdminRole'],[ROLES.INFECTION_CONTROL_LEAD,'infectionControlLeadRole'],[ROLES.INFECTION_CONTROL_MEMBER,'infectionControlMemberRole'],[ROLES.DEPARTMENT_MANAGER,'departmentManagerRole'],[ROLES.DEPARTMENT_USER,'departmentUserRole'],[ROLES.LABORATORY,'laboratoryRole'],[ROLES.COMMITTEE_SECRETARIAT,'committeeSecretariatRole'],[ROLES.HR_OFFICE,'hrOfficeRole'],[ROLES.PHARMACY,'pharmacyRole'],[ROLES.OCCUPATIONAL_PHYSICIAN,'occupationalPhysicianRole'],[ROLES.DOCTOR_REVIEWER,'doctorReviewerRole'],[ROLES.QUALITY_MANAGER,'qualityManagerRole']
  ]
  const previewDepartments=[['','previewAllHospital'],['icu','previewIcu'],['surgery','previewSurgery'],['internal','previewInternalMedicine']]
  const visibleNavigation=navigationFor({role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[],hasAssignments:Boolean(membership?.assignments?.length)})
  const managementNavigation=visibleNavigation.filter(item=>item.key==='management')
  const usesCompactMore=[ROLES.HOSPITAL_ADMIN,ROLES.INFECTION_CONTROL_LEAD].includes(role)
  const moreNavigation=usesCompactMore?visibleNavigation.filter(item=>item.group==='more'):[]
  const primaryNavigation=usesCompactMore
    ?visibleNavigation.filter(item=>item.key!=='management'&&item.group!=='more')
    :visibleNavigation.filter(item=>item.key!=='management')
  const moreActive=usesCompactMore&&moreNavigation.some(item=>location.pathname===item.to||location.pathname.startsWith(`${item.to}/`))
  const moreExpanded=usesCompactMore&&(moreOpen||moreActive)
  async function handleLogout(){await logout();navigate('/login',{replace:true})}
  const NavEntry=({item,nested=false,collapseMore=false})=>{const Icon=item.icon;return <NavLink to={item.to} end={item.to==='/' } onClick={()=>collapseMore&&setMoreOpen(false)} className={({isActive})=>`nav-item ${nested?'nested':''} ${isActive?'active':''}`}><Icon size={nested?16:18}/><span>{t(item.key)}</span></NavLink>}
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">L+</div><div><strong>Limoxis Observer</strong><span>{t('brandSubtitle')}</span></div></div><nav>
      {primaryNavigation.map(item=><NavEntry key={item.to} item={item} collapseMore/>)}
      {moreNavigation.length>0&&<div className={`sidebar-nav-group ${moreExpanded?'open':''}`}>
        <button type="button" className={`nav-item nav-group-trigger ${moreActive?'active-group':''}`} onClick={()=>setMoreOpen(v=>!v)} aria-expanded={moreExpanded}>
          <Layers3 size={18}/><span>{t('more')}</span><ChevronDown className="nav-group-chevron" size={14}/>
        </button>
        {moreExpanded&&<div className="sidebar-nav-children">{moreNavigation.map(item=><NavEntry key={item.to} item={item} nested/>)}</div>}
      </div>}
      {managementNavigation.length>0&&<div className="sidebar-nav-management">{managementNavigation.map(item=><NavEntry key={item.to} item={item} collapseMore/>)}</div>}
    </nav><div className="sidebar-footer"><div className="tenant-name">{tenant?.name??t('noOrganization')}</div><div className="sidebar-meta">{role?.replaceAll('_',' ')??'—'}</div>{isDemo&&<span className="demo-pill">{t('demo')}</span>}<div className="app-version-stamp">v{APP_VERSION} · {BUILD_ID}</div></div></aside>
    <main className="main-column"><header className="topbar"><div className="search-box"><Search size={17}/><input aria-label={t('search')} placeholder={`${t('search')}...`}/></div><div className="topbar-actions">
      {canRolePreview&&<div className="role-preview-control"><button className={`preview-trigger ${isRolePreview?'active':''}`} onClick={()=>setPreviewOpen(v=>!v)} title={t('previewAsRole')}><Eye size={16}/><span>{isRolePreview?t('previewMode'):t('previewAsRole')}</span><ChevronDown size={13}/></button>{previewOpen&&<div className="role-preview-popover"><strong>{t('previewAsRole')}</strong><small>{t('previewSafeHint')}</small><label><span>{t('roleLabel')}</span><select value={rolePreview?.role||''} onChange={e=>{if(e.target.value)startRolePreview(e.target.value,rolePreview?.department||'')}}><option value="">{t('selectRole')}</option>{previewRoles.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</select></label>{rolePreview?.role&&<label><span>{t('departmentScope')}</span><select value={rolePreview?.department||''} onChange={e=>updateRolePreviewDepartment(e.target.value)}>{previewDepartments.map(([value,key])=><option key={key} value={value}>{t(key)}</option>)}</select></label>}<div className="preview-popover-actions">{isRolePreview&&<button onClick={()=>{stopRolePreview();setPreviewOpen(false)}}>{t('exitPreview')}</button>}<button onClick={()=>setPreviewOpen(false)}>{t('close')}</button></div></div>}</div>}
      {memberships.length>1&&<label className="tenant-switch"><select value={membership?.id??''} onChange={e=>setTenantByMembership(e.target.value)}>{memberships.map(item=><option key={item.id} value={item.id}>{item.organization.name}</option>)}</select><ChevronDown size={14}/></label>}
      <div className="topbar-utility-group">
        <button className="icon-button help-button" aria-label={t('helpCenter')} title={t('helpCenter')} onClick={()=>setHelpOpen(true)}><BookOpen size={18}/></button>
        <button className="icon-button notification-button" aria-label={t('notifications')} title={t('notifications')}><Bell size={18}/><span className="notification-dot"/></button>
        <button className="language-button" onClick={()=>setLanguage(language==='el'?'en':'el')}>{language==='el'?'EN':'EL'}</button>
      </div>
      <div className="user-chip"><div className="avatar">{(profile?.fullName||profile?.email||'U').slice(0,2).toUpperCase()}</div><div><strong>{profile?.fullName||profile?.email||'User'}</strong><span>{tenant?.name??''}</span></div></div>
      <button className="icon-button logout-button" title={t('logout')} aria-label={t('logout')} onClick={handleLogout}><LogOut size={17}/></button>
    </div></header>{isRolePreview&&<div className="preview-banner"><Eye size={15}/><span>{t('previewingAs')}: <strong>{t(previewRoles.find(([value])=>value===role)?.[1]||'roleLabel')}</strong>{rolePreview?.department?` · ${t(previewDepartments.find(([value])=>value===rolePreview.department)?.[1]||'departmentScope')}`:''}</span><button onClick={stopRolePreview}><X size={14}/>{t('exitPreview')}</button></div>}<div className="content"><Outlet/></div></main><HelpCenter open={helpOpen} onClose={()=>setHelpOpen(false)}/>
  </div>
}
