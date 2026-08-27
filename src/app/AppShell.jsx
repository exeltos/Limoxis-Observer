import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, BookOpen, ChevronDown, Eye, LogOut, Search, X } from 'lucide-react'
import { navigationFor } from './navigation'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useTenant } from '../core/tenant/TenantContext'
import { useAuth } from '../core/auth/AuthContext'
import { HelpCenter } from '../core/help/HelpCenter'
import { ROLES } from '../core/permissions/roles'

export function AppShell(){
  const {language,setLanguage,t}=useLanguage(); const {tenant,memberships,membership,role,isDemo,setTenantByMembership,canRolePreview,isRolePreview,rolePreview,startRolePreview,updateRolePreviewDepartment,stopRolePreview}=useTenant(); const {profile,logout}=useAuth(); const navigate=useNavigate(); const [helpOpen,setHelpOpen]=useState(false); const [previewOpen,setPreviewOpen]=useState(false)

  const previewRoles=[
    [ROLES.HOSPITAL_ADMIN,'hospitalAdminRole'],[ROLES.INFECTION_CONTROL_LEAD,'infectionControlLeadRole'],[ROLES.INFECTION_CONTROL_MEMBER,'infectionControlMemberRole'],[ROLES.DEPARTMENT_MANAGER,'departmentManagerRole'],[ROLES.DEPARTMENT_USER,'departmentUserRole'],[ROLES.LABORATORY,'laboratoryRole'],[ROLES.COMMITTEE_SECRETARIAT,'committeeSecretariatRole'],[ROLES.HR_OFFICE,'hrOfficeRole'],[ROLES.PHARMACY,'pharmacyRole'],[ROLES.OCCUPATIONAL_PHYSICIAN,'occupationalPhysicianRole'],[ROLES.DOCTOR_REVIEWER,'doctorReviewerRole'],[ROLES.QUALITY_MANAGER,'qualityManagerRole']
  ]
  const previewDepartments=[['','previewAllHospital'],['icu','previewIcu'],['surgery','previewSurgery'],['internal','previewInternalMedicine']]
  const visibleNavigation=navigationFor({role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[],hasAssignments:Boolean(membership?.assignments?.length)})
  async function handleLogout(){await logout();navigate('/login',{replace:true})}
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">LO</div><div><strong>Limoxis Observer</strong><span>{t('brandSubtitle')}</span></div></div><nav>{visibleNavigation.map(({to,key,icon:Icon})=><NavLink key={to} to={to} end={to==='/' } className={({isActive})=>`nav-item ${isActive?'active':''}`}><Icon size={18}/><span>{t(key)}</span></NavLink>)}</nav><div className="sidebar-footer"><div className="tenant-name">{tenant?.name??t('noOrganization')}</div><div className="sidebar-meta">{role?.replaceAll('_',' ')??'—'}</div>{isDemo&&<span className="demo-pill">{t('demo')}</span>}</div></aside>
    <main className="main-column"><header className="topbar"><div className="search-box"><Search size={17}/><input aria-label={t('search')} placeholder={`${t('search')}...`}/></div><div className="topbar-actions">
      {canRolePreview&&<div className="role-preview-control"><button className={`preview-trigger ${isRolePreview?'active':''}`} onClick={()=>setPreviewOpen(v=>!v)} title={t('previewAsRole')}><Eye size={16}/><span>{isRolePreview?t('previewMode'):t('previewAsRole')}</span><ChevronDown size={13}/></button>{previewOpen&&<div className="role-preview-popover"><strong>{t('previewAsRole')}</strong><small>{t('previewSafeHint')}</small><label><span>{t('roleLabel')}</span><select value={rolePreview?.role||''} onChange={e=>{if(e.target.value)startRolePreview(e.target.value,rolePreview?.department||'')}}><option value="">{t('selectRole')}</option>{previewRoles.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</select></label>{rolePreview?.role&&<label><span>{t('departmentScope')}</span><select value={rolePreview?.department||''} onChange={e=>updateRolePreviewDepartment(e.target.value)}>{previewDepartments.map(([value,key])=><option key={key} value={value}>{t(key)}</option>)}</select></label>}<div className="preview-popover-actions">{isRolePreview&&<button onClick={()=>{stopRolePreview();setPreviewOpen(false)}}>{t('exitPreview')}</button>}<button onClick={()=>setPreviewOpen(false)}>{t('close')}</button></div></div>}</div>}
      {memberships.length>1&&<label className="tenant-switch"><select value={membership?.id??''} onChange={e=>setTenantByMembership(e.target.value)}>{memberships.map(item=><option key={item.id} value={item.id}>{item.organization.name}</option>)}</select><ChevronDown size={14}/></label>}
      <button className="icon-button help-button" aria-label={t('helpCenter')} title={t('helpCenter')} onClick={()=>setHelpOpen(true)}><BookOpen size={18}/></button>
      <button className="icon-button" aria-label={t('notifications')} title={t('notifications')}><Bell size={18}/><span className="notification-dot"/></button>
      <button className="language-button" onClick={()=>setLanguage(language==='el'?'en':'el')}>{language==='el'?'EN':'EL'}</button>
      <div className="user-chip"><div className="avatar">{(profile?.fullName||profile?.email||'U').slice(0,2).toUpperCase()}</div><div><strong>{profile?.fullName||profile?.email||'User'}</strong><span>{tenant?.name??''}</span></div></div>
      <button className="icon-button" aria-label={t('logout')} onClick={handleLogout}><LogOut size={17}/></button>
    </div></header>{isRolePreview&&<div className="preview-banner"><Eye size={15}/><span>{t('previewingAs')}: <strong>{t(previewRoles.find(([value])=>value===role)?.[1]||'roleLabel')}</strong>{rolePreview?.department?` · ${t(previewDepartments.find(([value])=>value===rolePreview.department)?.[1]||'departmentScope')}`:''}</span><button onClick={stopRolePreview}><X size={14}/>{t('exitPreview')}</button></div>}<div className="content"><Outlet/></div></main><HelpCenter open={helpOpen} onClose={()=>setHelpOpen(false)}/>
  </div>
}
