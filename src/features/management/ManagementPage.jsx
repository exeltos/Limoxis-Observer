import { useEffect, useMemo, useState } from 'react'
import { Bell, Building2, Database, FileCheck2, Globe2, KeyRound, Layers3, Pencil, Plus, Save, ShieldCheck, Users, X } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { BedDaysPanel } from './BedDaysPanel'
import { LibrariesPanel } from './LibrariesPanel'
import { BundleLibraryPanel } from './BundleLibraryPanel'
import { AnnouncementsPanel } from './AnnouncementsPanel'
import { loadBundleLibrary } from './bundleLibraryData'
import { capabilityLabel } from '../../core/permissions/capabilityLabels'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES, ROLES, can } from '../../core/permissions/roles'
import { demoLibrarySeed, demoOrganizations, demoUsers, externalSources } from './managementData'

const roleNames={platform_owner:'platformOwnerRole',hospital_admin:'hospitalAdminRole',infection_control_lead:'infectionControlLeadRole',infection_control_member:'infectionControlMemberRole',department_manager:'departmentManagerRole',department_user:'departmentUserRole',laboratory:'laboratoryRole',committee_secretariat:'committeeSecretariatRole',hr_office:'hrOfficeRole',pharmacy:'pharmacyRole',occupational_physician:'occupationalPhysicianRole',doctor_reviewer:'doctorReviewerRole',quality_manager:'qualityManagerRole',demo:'demoRole'}

export function ManagementPage(){
  const {language,t}=useLanguage(); const {tenant,role,membership,isDemo}=useTenant(); const {notify,confirm}=useFeedback(); const [tab,setTab]=useState('overview'); const [roleModal,setRoleModal]=useState(false); const [references,setReferences]=useState(externalSources); const [referenceEditor,setReferenceEditor]=useState(null); const [customRoles,setCustomRoles]=useState([]); const [roleName,setRoleName]=useState(''); const [selectedCaps,setSelectedCaps]=useState([])
  const addOns=useMemo(()=>membership?.capabilities??[],[membership])
  const customCaps=useMemo(()=>membership?.customCapabilities??[],[membership])
  const allowed=(cap)=>can(role,cap,addOns,customCaps)
  const tabs=useMemo(()=>{
    const isAllowed=(cap)=>can(role,cap,addOns,customCaps)
    return [
      {id:'overview',label:t('managementPanel.overviewTab'),icon:FileCheck2},
      ...(isAllowed(CAPABILITIES.MANAGE_ORGANIZATION)?[{id:'organization',label:t('organization'),icon:Building2}]:[]),
      ...(isAllowed(CAPABILITIES.MANAGE_USERS)?[{id:'users',label:t('users'),icon:Users}]:[]),
      ...(isAllowed(CAPABILITIES.MANAGE_ANNOUNCEMENTS)?[{id:'announcements',label:'Ανακοινώσεις',icon:Bell}]:[]),
      ...(isAllowed(CAPABILITIES.MANAGE_LIBRARIES)?[
        {id:'libraries',label:t('libraries'),icon:Database},
        {id:'bundles',label:t('managementPanel.preventionBundlesLabel'),icon:Layers3},
      ]:[]),
      ...(isAllowed(CAPABILITIES.MANAGE_BED_DAYS)?[{id:'patientDays',label:t('patientDays'),icon:Database}]:[]),
      ...(isAllowed(CAPABILITIES.MANAGE_EXTERNAL_REFERENCES)?[{id:'references',label:t('externalReferences'),icon:Globe2}]:[]),
      ...(isAllowed(CAPABILITIES.MANAGE_ROLES)?[{id:'roles',label:t('rolesPermissions'),icon:ShieldCheck}]:[]),
      ...(role===ROLES.PLATFORM_OWNER?[{id:'platform',label:'Platform',icon:KeyRound}]:[]),
    ]
  },[role,addOns,customCaps,t])
  useEffect(()=>{if(tabs.length&&!tabs.some(item=>item.id===tab))setTab(tabs[0].id)},[tabs,tab])
  function toggleCap(cap){setSelectedCaps(current=>current.includes(cap)?current.filter(x=>x!==cap):[...current,cap])}
  function saveCustomRole(){if(!roleName.trim())return;setCustomRoles(current=>[...current,{id:`custom-${Date.now()}`,name:roleName.trim(),capabilities:selectedCaps}]);setRoleName('');setSelectedCaps([]);setRoleModal(false);notify(t('customRoleCreated'),'success')}
  return <Page fill title={t('management')} subtitle={t('managementSubtitle')}>
    <div className="management-shell workspace-fill"><div className="tabs canonical-module-tabs management-tabs">{tabs.map(({id,label,icon:Icon})=><button key={id} className={`tab ${tab===id?'active':''}`} onClick={()=>setTab(id)}><Icon size={16}/>{label}</button>)}</div>
      {tab==='overview'&&<ManagementOverview tenant={tenant} isDemo={isDemo} allowed={allowed} onOpen={setTab} t={t}/>}
      {tab==='users'&&<section className="management-section"><div className="section-toolbar"><div><h2>{t('organizationUsers')}</h2><p>{tenant?.name}</p></div>{allowed(CAPABILITIES.MANAGE_USERS)&&<Button onClick={()=>notify(t('actionCompleted'),'info')}><Plus size={15}/>{t('inviteUser')}</Button>}</div><div className="table-wrap scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('users')}</th><th>{t('roleLabel')}</th><th>{t('status')}</th><th/></tr></thead><tbody>{(isDemo?demoUsers:[]).map(user=><tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td><span className="role-badge">{t(roleNames[user.role]??user.role)}</span></td><td><span className="status-badge active">{t('active')}</span></td><td>{allowed(CAPABILITIES.MANAGE_USERS)&&<button className="text-button" onClick={()=>notify(t('actionCompleted'),'info')}>{t('manage')}</button>}</td></tr>)}</tbody></table>{!isDemo&&<div className="inline-empty">{t('noConnectedUsers')}</div>}</div></section>}
      {tab==='announcements'&&<AnnouncementsPanel/>}
      {tab==='organization'&&<OrganizationPanel tenant={tenant} notify={notify} t={t}/>}
      {tab==='roles'&&<section className="management-section"><div className="section-toolbar"><div><h2>{t('rolesPermissions')}</h2><p>{t('roleManagementNote')}</p></div><Button onClick={()=>setRoleModal(true)}><Plus size={15}/>{t('createRole')}</Button></div><div className="role-grid">{Object.entries(roleNames).filter(([key])=>key!=='demo').map(([key,labelKey])=><div className="role-card" key={key}><ShieldCheck size={18}/><strong>{t(labelKey)}</strong><span>{t('capabilityBasedAccess')}</span></div>)}{customRoles.map(item=><div className="role-card custom" key={item.id}><ShieldCheck size={18}/><strong>{item.name}</strong><span>{item.capabilities.length} {t('permissions')}</span></div>)}</div></section>}
      {tab==='libraries'&&<LibrariesPanel/>}
      {tab==='bundles'&&<section className="management-section management-scroll-section"><BundleLibraryPanel/></section>}
      {tab==='patientDays'&&<BedDaysPanel/>}
      {tab==='references'&&<section className="management-section management-scroll-section"><div className="section-toolbar"><div><h2>{t('externalReferences')}</h2><p>{t('externalReferenceNote')}</p></div><Button variant="secondary" onClick={()=>notify(t('actionCompleted'),'success')}>{t('refreshMetadata')}</Button></div><div className="table-wrap scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('officialSource')}</th><th>{t('source')}</th><th>{t('managementPanel.scopeLabel')}</th><th>{t('referenceVersion')}</th><th>{t('reviewStatusLabel')}</th><th></th></tr></thead><tbody>{references.map(item=><tr key={item.id}><td><strong>{t(item.label)}</strong></td><td>{item.authority}</td><td>{language==='el'?item.scope:(item.scopeEn||item.scope)}</td><td>{language==='el'?item.version:(item.versionEn||item.version)}</td><td><span className="status-badge active">{t(item.status)}</span></td><td><div className="record-inline-actions"><button title={t('edit')} onClick={()=>setReferenceEditor({...item})}><Pencil size={15}/></button><button className="danger" title={t('delete')} onClick={async()=>{const ok=await confirm({title:t('managementPanel.deleteExternalSourceTitle'),message:`${t('managementPanel.deleteExternalSourceMessagePrefix')} «${item.authority}» ${t('managementPanel.deleteExternalSourceMessageSuffix')}`,confirmLabel:t('delete'),danger:true});if(ok){setReferences(x=>x.filter(r=>r.id!==item.id));notify(t('managementPanel.externalSourceRemoved'),'success')}}}><X size={15}/></button></div></td></tr>)}</tbody></table></div></section>}
      {tab==='platform'&&<section className="management-section"><div className="section-toolbar"><div><h2>{t('platformOrganizations')}</h2><p>{t('platformOwnerRole')}</p></div><Button onClick={()=>notify(t('actionCompleted'),'info')}>{t('newOrganization')}</Button></div><div className="table-wrap scroll-table"><table className="data-table sticky-table"><thead><tr><th>Organization</th><th>Type</th><th>Status</th><th>Members</th></tr></thead><tbody>{demoOrganizations.map(org=><tr key={org.id}><td><strong>{org.name}</strong><small>{org.code}</small></td><td>{org.type}</td><td><span className="status-badge active">{org.status}</span></td><td>{org.members}</td></tr>)}</tbody></table></div></section>}
    </div>
    {referenceEditor&&<div className="modal-backdrop"><div className="entry-editor" role="dialog" aria-modal="true"><header><div><h3>{t('managementPanel.editExternalSourceTitle')}</h3><p>{t('managementPanel.editExternalSourceSubtitle')}</p></div><button className="icon-button" onClick={()=>setReferenceEditor(null)}><X size={17}/></button></header><div className="entry-form-grid"><label className="field"><span>{t('managementPanel.authorityOrgLabel')}</span><input value={referenceEditor.authority} onChange={e=>setReferenceEditor(x=>({...x,authority:e.target.value}))}/></label><label className="field"><span>{t('managementPanel.versionReviewLabel')}</span><input value={referenceEditor.version} onChange={e=>setReferenceEditor(x=>({...x,version:e.target.value}))}/></label><label className="field entry-span-2"><span>{t('managementPanel.usageScopeLabel')}</span><input value={referenceEditor.scope} onChange={e=>setReferenceEditor(x=>({...x,scope:e.target.value}))}/></label></div><footer><Button variant="secondary" onClick={()=>setReferenceEditor(null)}>{t('cancel')}</Button><Button onClick={()=>{setReferences(rows=>rows.map(r=>r.id===referenceEditor.id?referenceEditor:r));setReferenceEditor(null);notify(t('managementPanel.externalSourceUpdated'),'success')}}>{t('save')}</Button></footer></div></div>}
    {roleModal&&<div className="modal-backdrop"><div className="role-editor" role="dialog" aria-modal="true"><header><div><h3>{t('createRole')}</h3><p>{t('roleManagementNote')}</p></div><button className="icon-button" onClick={()=>setRoleModal(false)}><X size={17}/></button></header><label className="field"><span>{t('roleName')}</span><input value={roleName} onChange={e=>setRoleName(e.target.value)}/></label><div className="capability-picker"><strong>{t('permissions')}</strong><div>{Object.values(CAPABILITIES).map(cap=><label key={cap}><input type="checkbox" checked={selectedCaps.includes(cap)} onChange={()=>toggleCap(cap)}/><span>{capabilityLabel(cap,language)}</span></label>)}</div></div><footer><Button variant="secondary" onClick={()=>setRoleModal(false)}>{t('cancel')}</Button><Button onClick={saveCustomRole}>{t('saveRole')}</Button></footer></div></div>}
  </Page>
}


function ManagementOverview({tenant,isDemo,allowed,onOpen,t}){
 const libraryCount=Object.entries(demoLibrarySeed).filter(([key,value])=>Array.isArray(value)&&key!=='environmentalStandards').reduce((sum,[,value])=>sum+value.length,0)
 const bundleRows=loadBundleLibrary()
 const publishedBundles=bundleRows.filter(x=>x.status==='published').length
 const userCount=isDemo?demoUsers.length:0
 const areas=[
  allowed(CAPABILITIES.MANAGE_ORGANIZATION)&&{id:'organization',icon:Building2,title:t('organization'),value:tenant?.name||'—',meta:t('managementPanel.identitySettingsMeta'),text:t('managementPanel.organizationCardText')},
  allowed(CAPABILITIES.MANAGE_USERS)&&{id:'users',icon:Users,title:t('users'),value:userCount||'—',meta:isDemo?t('managementPanel.demoActiveUsersMeta'):t('managementPanel.connectedAccountsMeta'),text:t('managementPanel.usersCardText')},
  allowed(CAPABILITIES.MANAGE_LIBRARIES)&&{id:'libraries',icon:Database,title:t('libraries'),value:libraryCount,meta:t('managementPanel.baselineReferenceEntriesMeta'),text:t('managementPanel.librariesCardText')},
  allowed(CAPABILITIES.MANAGE_LIBRARIES)&&{id:'bundles',icon:Layers3,title:t('managementPanel.preventionBundlesLabel'),value:publishedBundles,meta:t('managementPanel.publishedVersionsMeta'),text:t('managementPanel.bundlesCardText')},
  allowed(CAPABILITIES.MANAGE_BED_DAYS)&&{id:'patientDays',icon:Database,title:t('patientDays'),value:'Denominator',meta:t('managementPanel.forIndicatorsReportsMeta'),text:t('managementPanel.patientDaysCardText')},
  allowed(CAPABILITIES.MANAGE_EXTERNAL_REFERENCES)&&{id:'references',icon:Globe2,title:t('externalReferences'),value:externalSources.length,meta:t('managementPanel.governedSourcesMeta'),text:t('managementPanel.referencesCardText')},
  allowed(CAPABILITIES.MANAGE_ROLES)&&{id:'roles',icon:ShieldCheck,title:t('rolesPermissions'),value:'Governed',meta:t('managementPanel.accessPoliciesMeta'),text:t('managementPanel.rolesCardText')},
 ].filter(Boolean)
 return <section className="management-section management-overview">
  <div className="management-overview-head"><div><span className="eyebrow">{t('managementPanel.managementCenterEyebrow')}</span><h2>{tenant?.name||t('organization')}</h2><p>{t('managementPanel.overviewIntro')}</p></div><span className={`status-badge ${isDemo?'temporary':'active'}`}>{isDemo?t('managementPanel.demoEnvironmentBadge'):t('managementPanel.activeOrganizationBadge')}</span></div>
  <div className="management-overview-cards">{areas.map(({id,icon:Icon,title,value,meta,text})=><button key={id} type="button" onClick={()=>onOpen(id)}>
    <div className="management-card-top"><span className="management-area-icon"><Icon size={16}/></span><span className="management-card-value"><strong>{value}</strong><small>{meta}</small></span></div>
    <div className="management-card-copy"><strong>{title}</strong><span>{text}</span></div>
    <b>{t('managementPanel.openArrow')}</b>
  </button>)}</div>
  <div className="management-governance-note"><ShieldCheck size={16}/><div><strong>{t('managementPanel.governancePrincipleTitle')}</strong><span>{t('managementPanel.governancePrincipleText')}</span></div></div>
 </section>
}

const ORGANIZATION_SETTINGS_KEY='limoxis.organizationSettings.v1'
const facilityTypeKeys={general:'generalHospitalType',university:'universityHospitalType',private:'privateHospitalType',clinic:'clinicType',rehab:'rehabCenterType'}
// Accepts both the new stable identifiers ('general', 'university', ...) and legacy Greek
// strings persisted by earlier versions that stored the option's display text directly.
function facilityTypeLabel(value,t){
 if(facilityTypeKeys[value])return t(`managementPanel.${facilityTypeKeys[value]}`)
 return value||t('managementPanel.generalHospitalType')
}
function OrganizationPanel({tenant,notify,t}){
 const defaults={name:tenant?.name||'',shortName:'',code:tenant?.code||'',facilityType:'general',language:'el',timezone:'Europe/Athens',email:'',phone:'',website:'',address:'',city:'',postalCode:'',reportHeader:'',footerNote:''}
 const [editing,setEditing]=useState(false)
 const [value,setValue]=useState(()=>{
  try{return {...defaults,...JSON.parse(localStorage.getItem(ORGANIZATION_SETTINGS_KEY)||'{}')}}catch{return defaults}
 })
 const [draft,setDraft]=useState(value)
 const set=(k,v)=>setDraft(x=>({...x,[k]:v}))
 function begin(){setDraft(value);setEditing(true)}
 function cancel(){setDraft(value);setEditing(false)}
 function save(){
  const next={...draft,name:draft.name.trim(),code:draft.code.trim().toUpperCase()}
  if(!next.name||!next.code)return
  setValue(next);localStorage.setItem(ORGANIZATION_SETTINGS_KEY,JSON.stringify(next));setEditing(false);notify(t('managementPanel.organizationSettingsSaved'),'success')
 }
 return <section className="management-section management-scroll-section organization-settings">
  <div className="section-toolbar"><div><h2>{t('organization')}</h2><p>{t('managementPanel.organizationPanelSubtitle')}</p></div>{!editing?<button type="button" className="entity-record-icon-button" onClick={begin} title={t('managementPanel.editOrganizationLabel')} aria-label={t('managementPanel.editOrganizationLabel')}><Pencil size={16}/></button>:null}</div>
  <div className="organization-settings-grid">
   <section className="surface organization-settings-section"><header><strong>{t('managementPanel.unitIdentityTitle')}</strong><span>{t('managementPanel.hospitalBasicInfoSubtitle')}</span></header><div className="entry-grid compact">
    <label className="field"><span>{t('managementPanel.legalNameRequired')}</span>{editing?<input value={draft.name} onChange={e=>set('name',e.target.value)}/>:<strong>{value.name||'—'}</strong>}</label>
    <label className="field"><span>{t('managementPanel.shortNameLabel')}</span>{editing?<input value={draft.shortName} onChange={e=>set('shortName',e.target.value)}/>:<strong>{value.shortName||'—'}</strong>}</label>
    <label className="field"><span>{t('managementPanel.orgCodeRequired')}</span>{editing?<input value={draft.code} onChange={e=>set('code',e.target.value)}/>:<strong>{value.code||'—'}</strong>}</label>
    <label className="field"><span>{t('managementPanel.facilityTypeLabel')}</span>{editing?<select value={draft.facilityType} onChange={e=>set('facilityType',e.target.value)}><option value="general">{t('managementPanel.generalHospitalType')}</option><option value="university">{t('managementPanel.universityHospitalType')}</option><option value="private">{t('managementPanel.privateHospitalType')}</option><option value="clinic">{t('managementPanel.clinicType')}</option><option value="rehab">{t('managementPanel.rehabCenterType')}</option><option value="other">{t('other')}</option></select>:<strong>{facilityTypeLabel(value.facilityType,t)}</strong>}</label>
   </div></section>
   <section className="surface organization-settings-section"><header><strong>{t('managementPanel.contactSectionTitle')}</strong><span>{t('managementPanel.contactSectionSubtitle')}</span></header><div className="entry-grid compact">
    <label className="field"><span>Email</span>{editing?<input value={draft.email} onChange={e=>set('email',e.target.value)}/>:<strong>{value.email||'—'}</strong>}</label>
    <label className="field"><span>{t('phone')}</span>{editing?<input value={draft.phone} onChange={e=>set('phone',e.target.value)}/>:<strong>{value.phone||'—'}</strong>}</label>
    <label className="field entry-span-2"><span>{t('managementPanel.addressLabel')}</span>{editing?<input value={draft.address} onChange={e=>set('address',e.target.value)}/>:<strong>{value.address||'—'}</strong>}</label>
    <label className="field"><span>{t('managementPanel.cityLabel')}</span>{editing?<input value={draft.city} onChange={e=>set('city',e.target.value)}/>:<strong>{value.city||'—'}</strong>}</label>
    <label className="field"><span>{t('managementPanel.postalCodeLabel')}</span>{editing?<input value={draft.postalCode} onChange={e=>set('postalCode',e.target.value)}/>:<strong>{value.postalCode||'—'}</strong>}</label>
   </div></section>
   <section className="surface organization-settings-section"><header><strong>{t('managementPanel.localSettingsTitle')}</strong><span>{t('managementPanel.localSettingsSubtitle')}</span></header><div className="entry-grid compact">
    <label className="field"><span>{t('managementPanel.defaultLanguageLabel')}</span>{editing?<select value={draft.language} onChange={e=>set('language',e.target.value)}><option value="el">{t('managementPanel.greekLanguageName')}</option><option value="en">{t('managementPanel.englishLanguageName')}</option></select>:<strong>{value.language==='el'?t('managementPanel.greekLanguageName'):t('managementPanel.englishLanguageName')}</strong>}</label>
    <label className="field"><span>{t('managementPanel.timezoneLabel')}</span>{editing?<select value={draft.timezone} onChange={e=>set('timezone',e.target.value)}><option value="Europe/Athens">Europe/Athens</option><option value="UTC">UTC</option></select>:<strong>{value.timezone}</strong>}</label>
    <label className="field entry-span-2"><span>{t('managementPanel.reportHeaderLabel')}</span>{editing?<input value={draft.reportHeader} onChange={e=>set('reportHeader',e.target.value)}/>:<strong>{value.reportHeader||value.name||'—'}</strong>}</label>
   </div></section>
  </div>
  {editing&&<div className="organization-edit-actions"><Button variant="secondary" onClick={cancel}>{t('cancel')}</Button><Button onClick={save}><Save size={15}/> {t('save')}</Button></div>}
 </section>
}
