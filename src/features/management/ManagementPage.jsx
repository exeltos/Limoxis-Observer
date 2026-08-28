import { useEffect, useMemo, useState } from 'react'
import { Building2, Database, Globe2, KeyRound, Plus, ShieldCheck, Users, X } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { BedDaysPanel } from './BedDaysPanel'
import { EnvironmentalStandardsPanel } from './EnvironmentalStandardsPanel'
import { LibrariesPanel } from './LibrariesPanel'
import { capabilityLabel } from '../../core/permissions/capabilityLabels'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES, ROLES, can } from '../../core/permissions/roles'
import { demoOrganizations, demoUsers } from './managementData'

const roleNames={platform_owner:'platformOwnerRole',hospital_admin:'hospitalAdminRole',infection_control_lead:'infectionControlLeadRole',infection_control_member:'infectionControlMemberRole',department_manager:'departmentManagerRole',department_user:'departmentUserRole',laboratory:'laboratoryRole',committee_secretariat:'committeeSecretariatRole',hr_office:'hrOfficeRole',pharmacy:'pharmacyRole',occupational_physician:'occupationalPhysicianRole',doctor_reviewer:'doctorReviewerRole',quality_manager:'qualityManagerRole',demo:'demoRole'}
const externalSources=[
  {id:'eody',label:'eodyNotifiable',authority:'EODY',version:'2026-08',status:'approved'},
  {id:'eucast',label:'eucastBreakpoints',authority:'EUCAST',version:'v16.0 / 2026',status:'approved'},
  {id:'who',label:'whoIpc',authority:'WHO',version:'reviewed 2026-08',status:'approved'},
]

export function ManagementPage(){
  const {language,t}=useLanguage(); const {tenant,role,membership,isDemo}=useTenant(); const {notify}=useFeedback(); const [tab,setTab]=useState('users'); const [roleModal,setRoleModal]=useState(false); const [customRoles,setCustomRoles]=useState([]); const [roleName,setRoleName]=useState(''); const [selectedCaps,setSelectedCaps]=useState([])
  const addOns=useMemo(()=>membership?.capabilities??[],[membership])
  const customCaps=useMemo(()=>membership?.customCapabilities??[],[membership])
  const allowed=(cap)=>can(role,cap,addOns,customCaps)
  const tabs=useMemo(()=>{
    const isAllowed=(cap)=>can(role,cap,addOns,customCaps)
    return [
      ...(isAllowed(CAPABILITIES.MANAGE_USERS)?[{id:'users',label:t('users'),icon:Users}]:[]),
      ...(isAllowed(CAPABILITIES.MANAGE_ORGANIZATION)?[{id:'organization',label:t('organization'),icon:Building2}]:[]),
      ...(isAllowed(CAPABILITIES.MANAGE_ROLES)?[{id:'roles',label:t('rolesPermissions'),icon:ShieldCheck}]:[]),
      ...(isAllowed(CAPABILITIES.MANAGE_LIBRARIES)?[
        {id:'libraries',label:t('libraries'),icon:Database},
        {id:'environmentalProtocols',label:t('environmentalProtocols'),icon:ShieldCheck},
      ]:[]),
      ...(isAllowed(CAPABILITIES.MANAGE_BED_DAYS)?[{id:'patientDays',label:t('patientDays'),icon:Database}]:[]),
      ...(isAllowed(CAPABILITIES.MANAGE_EXTERNAL_REFERENCES)?[{id:'references',label:t('externalReferences'),icon:Globe2}]:[]),
      ...(role===ROLES.PLATFORM_OWNER?[{id:'platform',label:'Platform',icon:KeyRound}]:[]),
    ]
  },[role,addOns,customCaps,t])
  useEffect(()=>{if(tabs.length&&!tabs.some(item=>item.id===tab))setTab(tabs[0].id)},[tabs,tab])
  function toggleCap(cap){setSelectedCaps(current=>current.includes(cap)?current.filter(x=>x!==cap):[...current,cap])}
  function saveCustomRole(){if(!roleName.trim())return;setCustomRoles(current=>[...current,{id:`custom-${Date.now()}`,name:roleName.trim(),capabilities:selectedCaps}]);setRoleName('');setSelectedCaps([]);setRoleModal(false);notify(t('customRoleCreated'),'success')}
  return <Page fill title={t('management')} subtitle={t('managementSubtitle')}>
    <div className="management-shell workspace-fill"><div className="tabs">{tabs.map(({id,label,icon:Icon})=><button key={id} className={`tab ${tab===id?'active':''}`} onClick={()=>setTab(id)}><Icon size={16}/>{label}</button>)}</div>
      {tab==='users'&&<section className="management-section"><div className="section-toolbar"><div><h2>{t('organizationUsers')}</h2><p>{tenant?.name}</p></div>{allowed(CAPABILITIES.MANAGE_USERS)&&<Button onClick={()=>notify(t('actionCompleted'),'info')}><Plus size={15}/>{t('inviteUser')}</Button>}</div><div className="table-wrap scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('users')}</th><th>{t('roleLabel')}</th><th>{t('status')}</th><th/></tr></thead><tbody>{(isDemo?demoUsers:[]).map(user=><tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td><span className="role-badge">{t(roleNames[user.role]??user.role)}</span></td><td><span className="status-badge active">{t('active')}</span></td><td>{allowed(CAPABILITIES.MANAGE_USERS)&&<button className="text-button" onClick={()=>notify(t('actionCompleted'),'info')}>{t('manage')}</button>}</td></tr>)}</tbody></table>{!isDemo&&<div className="inline-empty">{t('noConnectedUsers')}</div>}</div></section>}
      {tab==='organization'&&<section className="management-section"><div className="section-toolbar"><div><h2>{t('organizationDetails')}</h2><p>{t('tenantIdentity')}</p></div></div><div className="details-grid"><div><span>{t('name')}</span><strong>{tenant?.name??'—'}</strong></div><div><span>{t('codeLabel')}</span><strong>{tenant?.code??'—'}</strong></div><div><span>{t('typeLabel')}</span><strong>{tenant?.type??'—'}</strong></div><div><span>{t('modeLabel')}</span><strong>{isDemo?t('demo'):t('production')}</strong></div></div></section>}
      {tab==='roles'&&<section className="management-section"><div className="section-toolbar"><div><h2>{t('rolesPermissions')}</h2><p>{t('roleManagementNote')}</p></div><Button onClick={()=>setRoleModal(true)}><Plus size={15}/>{t('createRole')}</Button></div><div className="role-grid">{Object.entries(roleNames).filter(([key])=>key!=='demo').map(([key,labelKey])=><div className="role-card" key={key}><ShieldCheck size={18}/><strong>{t(labelKey)}</strong><span>{t('capabilityBasedAccess')}</span></div>)}{customRoles.map(item=><div className="role-card custom" key={item.id}><ShieldCheck size={18}/><strong>{item.name}</strong><span>{item.capabilities.length} {t('permissions')}</span></div>)}</div></section>}
      {tab==='libraries'&&<LibrariesPanel/>}
      {tab==='environmentalProtocols'&&<EnvironmentalStandardsPanel/>}
      {tab==='patientDays'&&<BedDaysPanel/>}
      {tab==='references'&&<section className="management-section"><div className="section-toolbar"><div><h2>{t('externalReferences')}</h2><p>{t('externalReferenceNote')}</p></div><Button variant="secondary" onClick={()=>notify(t('actionCompleted'),'success')}>{t('refreshMetadata')}</Button></div><div className="table-wrap scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('officialSource')}</th><th>{t('source')}</th><th>{t('referenceVersion')}</th><th>{t('reviewStatusLabel')}</th></tr></thead><tbody>{externalSources.map(item=><tr key={item.id}><td><strong>{t(item.label)}</strong></td><td>{item.authority}</td><td>{item.version}</td><td><span className="status-badge active">{t(item.status)}</span></td></tr>)}</tbody></table></div></section>}
      {tab==='platform'&&<section className="management-section"><div className="section-toolbar"><div><h2>{t('platformOrganizations')}</h2><p>{t('platformOwnerRole')}</p></div><Button onClick={()=>notify(t('actionCompleted'),'info')}>{t('newOrganization')}</Button></div><div className="table-wrap scroll-table"><table className="data-table sticky-table"><thead><tr><th>Organization</th><th>Type</th><th>Status</th><th>Members</th></tr></thead><tbody>{demoOrganizations.map(org=><tr key={org.id}><td><strong>{org.name}</strong><small>{org.code}</small></td><td>{org.type}</td><td><span className="status-badge active">{org.status}</span></td><td>{org.members}</td></tr>)}</tbody></table></div></section>}
    </div>
    {roleModal&&<div className="modal-backdrop"><div className="role-editor" role="dialog" aria-modal="true"><header><div><h3>{t('createRole')}</h3><p>{t('roleManagementNote')}</p></div><button className="icon-button" onClick={()=>setRoleModal(false)}><X size={17}/></button></header><label className="field"><span>{t('roleName')}</span><input value={roleName} onChange={e=>setRoleName(e.target.value)}/></label><div className="capability-picker"><strong>{t('permissions')}</strong><div>{Object.values(CAPABILITIES).map(cap=><label key={cap}><input type="checkbox" checked={selectedCaps.includes(cap)} onChange={()=>toggleCap(cap)}/><span>{capabilityLabel(cap,language)}</span></label>)}</div></div><footer><Button variant="secondary" onClick={()=>setRoleModal(false)}>{t('cancel')}</Button><Button onClick={saveCustomRole}>{t('saveRole')}</Button></footer></div></div>}
  </Page>
}
