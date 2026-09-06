import { useEffect,useMemo,useState } from 'react'
import { Activity,Bell,Database,Globe2,KeyRound,Layers3,Pencil,Plus,ShieldCheck,X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { BedDaysPanel } from './BedDaysPanel'
import { LibrariesPanel } from './LibrariesPanel'
import { BundleLibraryPanel } from './BundleLibraryPanel'
import { AnnouncementsPanel } from './AnnouncementsPanel'
import { IndicatorsPanel } from './IndicatorsPanel'
import { ManagementUsersPanel } from './ManagementUsersPanel'
import { managementRoleNames } from './managementRoles'
import { capabilityLabel } from '../../core/permissions/capabilityLabels'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { capabilityCatalogue,isCustomRoleEligible } from '../../core/permissions/capabilityCatalogue'
import { externalSources } from './managementData'
import { createCustomRole,deactivateCustomRole,loadCustomRoles,loadExternalReferences,removeExternalReference,updateCustomRole,updateExternalReference } from './managementCloudService'

export function ManagementPage(){
 const {language,t}=useLanguage()
 const {tenant,role,membership,isDemo}=useTenant()
 const {notify,confirm}=useFeedback()
 const navigate=useNavigate()
 const isPlatformOwner=role===ROLES.PLATFORM_OWNER
 const [tab,setTab]=useState('users')
 const [roleModal,setRoleModal]=useState(false)
 const [roleEditingId,setRoleEditingId]=useState(null)
 const [references,setReferences]=useState(isDemo?externalSources:[])
 const [referenceEditor,setReferenceEditor]=useState(null)
 const [customRoles,setCustomRoles]=useState([])
 const [roleName,setRoleName]=useState('')
 const [selectedCaps,setSelectedCaps]=useState([])
 const [managementLoading,setManagementLoading]=useState(false)
 const addOns=useMemo(()=>membership?.capabilities??[],[membership])
 const customCaps=useMemo(()=>membership?.customCapabilities??[],[membership])
 const customRoleCapabilities=useMemo(()=>Object.values(capabilityCatalogue).filter(item=>isCustomRoleEligible(item.id)),[])

 useEffect(()=>{
  if(isDemo){setReferences(externalSources);setCustomRoles([]);return}
  if(!tenant?.id||!['roles','references'].includes(tab))return
  let active=true
  setManagementLoading(true)
  ;(async()=>{
   try{
    const rows=tab==='roles'?await loadCustomRoles(tenant.id):await loadExternalReferences(tenant.id)
    if(active)(tab==='roles'?setCustomRoles:setReferences)(rows)
   }catch(error){if(active)notify(error?.message||t('managementPanel.loadFailed'),'error')}
   finally{if(active)setManagementLoading(false)}
  })()
  return()=>{active=false}
 },[isDemo,tenant?.id,tab,notify,t])

 const tabs=useMemo(()=>{
  const ok=cap=>can(role,cap,addOns,customCaps)
  return [
   ...(ok(CAPABILITIES.MANAGE_USERS)?[{id:'users',label:t('users'),icon:ShieldCheck}]:[]),
   ...(ok(CAPABILITIES.MANAGE_ANNOUNCEMENTS)?[{id:'announcements',label:t('announcements'),icon:Bell}]:[]),
   ...(ok(CAPABILITIES.MANAGE_LIBRARIES)?[{id:'libraries',label:t('libraries'),icon:Database},{id:'bundles',label:t('managementPanel.preventionBundlesLabel'),icon:Layers3}]:[]),
   ...(ok(CAPABILITIES.MANAGE_INDICATORS)?[{id:'indicators',label:language==='en'?'Indicators':'Δείκτες',icon:Activity}]:[]),
   ...(ok(CAPABILITIES.MANAGE_BED_DAYS)?[{id:'patientDays',label:t('patientDays'),icon:Database}]:[]),
   ...(ok(CAPABILITIES.MANAGE_EXTERNAL_REFERENCES)?[{id:'references',label:t('externalReferences'),icon:Globe2}]:[]),
   ...(ok(CAPABILITIES.MANAGE_ROLES)?[{id:'roles',label:t('rolesPermissions'),icon:ShieldCheck}]:[]),
   ...(isPlatformOwner?[{id:'platform',label:language==='en'?'Platform Center':'Κέντρο Πλατφόρμας',icon:KeyRound}]:[]),
  ]
 },[role,addOns,customCaps,t,isPlatformOwner,language])

 useEffect(()=>{if(tabs.length&&!tabs.some(item=>item.id===tab))setTab(tabs[0].id)},[tabs,tab])
 function openTab(id){if(id==='platform'){navigate('/platform');return}setTab(id)}
 function toggleCap(cap){setSelectedCaps(current=>current.includes(cap)?current.filter(x=>x!==cap):[...current,cap])}
 function openNewCustomRole(){setRoleEditingId(null);setRoleName('');setSelectedCaps([]);setRoleModal(true)}
 function openCustomRole(item){setRoleEditingId(item.id);setRoleName(item.name||'');setSelectedCaps((item.capabilities||[]).filter(isCustomRoleEligible));setRoleModal(true)}
 function closeRoleEditor(){setRoleModal(false);setRoleEditingId(null);setRoleName('');setSelectedCaps([])}
 async function saveCustomRole(){
  const capabilities=selectedCaps.filter(isCustomRoleEligible)
  if(!roleName.trim()||!capabilities.length)return
  try{
   let item
   if(isDemo)item={id:roleEditingId||`custom-${Date.now()}`,name:roleName.trim(),capabilities}
   else item=roleEditingId?await updateCustomRole(tenant.id,roleEditingId,{name:roleName.trim(),capabilities}):await createCustomRole(tenant.id,{name:roleName.trim(),capabilities})
   setCustomRoles(current=>roleEditingId?current.map(row=>row.id===item.id?item:row):[...current,item])
   const edited=Boolean(roleEditingId)
   closeRoleEditor()
   notify(edited?(language==='en'?'Custom role updated.':'Ο προσαρμοσμένος ρόλος ενημερώθηκε.'):t('customRoleCreated'),'success')
  }catch(error){notify(error?.message||t('managementPanel.saveFailed'),'error')}
 }
 async function deleteCustomRole(item){
  const ok=await confirm({title:t('rolesPermissions'),message:`${t('delete')} «${item.name}»`,confirmLabel:t('delete'),danger:true})
  if(!ok)return
  try{if(!isDemo)await deactivateCustomRole(tenant.id,item.id);setCustomRoles(rows=>rows.filter(row=>row.id!==item.id));notify(t('actionCompleted'),'success')}
  catch(error){notify(error?.message||t('managementPanel.saveFailed'),'error')}
 }
 async function saveReference(){
  if(referenceEditor?.isGlobal&&!isPlatformOwner){notify(language==='en'?'System references can only be changed by the Platform Owner.':'Οι αναφορές συστήματος μπορούν να αλλάξουν μόνο από τον Platform Owner.','warning');return}
  try{const saved=isDemo?referenceEditor:await updateExternalReference(tenant.id,referenceEditor);setReferences(rows=>rows.some(row=>row.id===referenceEditor.id)?rows.map(row=>row.id===referenceEditor.id?saved:row):[...rows,saved]);setReferenceEditor(null);notify(t('managementPanel.externalSourceUpdated'),'success')}
  catch(error){notify(error?.message||t('managementPanel.saveFailed'),'error')}
 }
 async function deleteReference(item){
  if(item?.isGlobal&&!isPlatformOwner)return
  const ok=await confirm({title:t('managementPanel.deleteExternalSourceTitle'),message:`${t('managementPanel.deleteExternalSourceMessagePrefix')} «${item.authority}» ${t('managementPanel.deleteExternalSourceMessageSuffix')}`,confirmLabel:t('delete'),danger:true})
  if(!ok)return
  try{if(!isDemo)await removeExternalReference(tenant.id,item);setReferences(rows=>rows.filter(row=>row.id!==item.id));notify(t('managementPanel.externalSourceRemoved'),'success')}
  catch(error){notify(error?.message||t('managementPanel.saveFailed'),'error')}
 }
 async function refreshReferences(){
  if(isDemo){notify(t('actionCompleted'),'success');return}
  try{setManagementLoading(true);setReferences(await loadExternalReferences(tenant.id));notify(t('actionCompleted'),'success')}
  catch(error){notify(error?.message||t('managementPanel.loadFailed'),'error')}
  finally{setManagementLoading(false)}
 }

 return <Page fill title={t('management')} subtitle={t('managementSubtitle')}><div className="management-shell workspace-fill">
  <div className="tabs canonical-module-tabs management-tabs">{tabs.map(({id,label,icon:Icon})=><button key={id} className={`tab ${tab===id?'active':''}`} onClick={()=>openTab(id)}><Icon size={16}/>{label}</button>)}</div>
  {tab==='users'&&<ManagementUsersPanel/>}
  {tab==='announcements'&&<AnnouncementsPanel/>}
  {tab==='libraries'&&<LibrariesPanel/>}
  {tab==='bundles'&&<section className="management-section management-scroll-section"><BundleLibraryPanel/></section>}
  {tab==='indicators'&&<IndicatorsPanel/>}
  {tab==='patientDays'&&<BedDaysPanel/>}
  {tab==='roles'&&<section className="management-section"><div className="section-toolbar"><div><h2>{t('rolesPermissions')}</h2><p>{t('roleManagementNote')}</p></div><Button onClick={openNewCustomRole}><Plus size={15}/>{t('createRole')}</Button></div>{managementLoading&&<div className="inline-empty">{t('loading')}</div>}<div className="role-grid">{Object.entries(managementRoleNames).filter(([key])=>key!=='demo').map(([key,labelKey])=><div className="role-card" key={key}><ShieldCheck size={18}/><strong>{t(labelKey)}</strong><span>{t('capabilityBasedAccess')}</span></div>)}{customRoles.map(item=><div className="role-card custom" key={item.id}><ShieldCheck size={18}/><strong>{item.name}</strong><span>{item.capabilities.length} {t('permissions')}</span><div className="record-inline-actions"><button className="edit" title={t('edit')} onClick={()=>openCustomRole(item)}><Pencil size={15}/></button><button className="danger" title={t('delete')} onClick={()=>deleteCustomRole(item)}><X size={15}/></button></div></div>)}</div></section>}
  {tab==='references'&&<section className="management-section management-scroll-section"><div className="section-toolbar"><div><h2>{t('externalReferences')}</h2><p>{t('externalReferenceNote')}</p></div><Button variant="secondary" onClick={refreshReferences}>{language==='en'?'Reload':'Επαναφόρτωση'}</Button></div>{managementLoading&&<div className="inline-empty">{t('loading')}</div>}<div className="table-wrap scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('officialSource')}</th><th>{t('source')}</th><th>{t('managementPanel.scopeLabel')}</th><th>{t('referenceVersion')}</th><th>{t('reviewStatusLabel')}</th><th/></tr></thead><tbody>{references.map(item=><tr key={item.id}><td><strong>{item.label||'—'}</strong>{item.isGlobal&&<small>{isPlatformOwner?'System · Owner':'System · Read only'}</small>}</td><td>{item.authority}</td><td>{language==='el'?item.scope:(item.scopeEn||item.scope)}</td><td>{language==='el'?item.version:(item.versionEn||item.version)}</td><td><span className="status-badge active">{t(item.status)}</span></td><td>{(!item.isGlobal||isPlatformOwner)&&<div className="record-inline-actions"><button title={t('edit')} onClick={()=>setReferenceEditor({...item})}><Pencil size={15}/></button><button className="danger" title={t('delete')} onClick={()=>deleteReference(item)}><X size={15}/></button></div>}</td></tr>)}</tbody></table>{!managementLoading&&!references.length&&<div className="inline-empty">{t('noData')}</div>}</div></section>}
  {roleModal&&<ObserverDialog open title={roleEditingId?(language==='en'?'Edit custom role':'Επεξεργασία προσαρμοσμένου ρόλου'):t('createRole')} onClose={closeRoleEditor}><label className="field"><span>{t('roleName')}</span><input value={roleName} onChange={e=>setRoleName(e.target.value)}/></label><div className="capability-grid">{customRoleCapabilities.map(item=><label key={item.id} className="capability-option"><input type="checkbox" checked={selectedCaps.includes(item.id)} onChange={()=>toggleCap(item.id)}/><span><strong>{capabilityLabel(item.id,language)}</strong><small>{item.group}</small></span></label>)}</div><DialogActions><Button variant="secondary" onClick={closeRoleEditor}>{t('cancel')}</Button><SaveButton onClick={saveCustomRole} disabled={!roleName.trim()||!selectedCaps.length}>{t('save')}</SaveButton></DialogActions></ObserverDialog>}
  {referenceEditor&&<ObserverDialog open title={t('externalReferences')} onClose={()=>setReferenceEditor(null)}><div className="entry-form-grid"><label className="field"><span>{t('officialSource')}</span><input value={referenceEditor.label||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,label:e.target.value}))}/></label><label className="field"><span>{t('source')}</span><input value={referenceEditor.authority||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,authority:e.target.value}))}/></label><label className="field"><span>{t('managementPanel.scopeLabel')}</span><input value={referenceEditor.scope||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,scope:e.target.value}))}/></label><label className="field"><span>{t('referenceVersion')}</span><input value={referenceEditor.version||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,version:e.target.value}))}/></label></div><DialogActions><Button variant="secondary" onClick={()=>setReferenceEditor(null)}>{t('cancel')}</Button>{(!referenceEditor.isGlobal||isPlatformOwner)&&<SaveButton onClick={saveReference}>{t('save')}</SaveButton>}</DialogActions></ObserverDialog>}
 </div></Page>
}
