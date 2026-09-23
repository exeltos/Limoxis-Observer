import { useEffect,useMemo,useState } from 'react'
import { Activity,Bell,BookOpen,Building2,Database,Globe2,KeyRound,Layers3,Pencil,ShieldAlert,ShieldCheck,X,ClipboardList,Search,Wind,Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { BackButton } from '../../design-system/BackButton'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { RegistryTable } from '../../design-system/RegistryTable'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { BedDaysPanel } from './BedDaysPanel'
import { HospitalStructurePanel } from './HospitalStructurePanel'
import { PrevalenceSurveyPanel } from './PrevalenceSurveyPanel'
import { LibrariesPanel } from './LibrariesPanel'
import { BundleLibraryPanel } from './BundleLibraryPanel'
import { HaiCriteriaLibraryPanel } from './HaiCriteriaLibraryPanel'
import { AnnouncementsPanel } from './AnnouncementsPanel'
import { IndicatorsPanel } from './IndicatorsPanel'
import { ManagementUsersPanel } from './ManagementUsersPanel'
import { ManagementRolesPanel } from './ManagementRolesPanel'
import { EnvironmentalStandardsPanel } from './EnvironmentalStandardsPanel'
import { QuestionnairesPanel } from './QuestionnairesPanel'
import { ClinicalScalesPanel } from './ClinicalScalesPanel'
import { LiraAiSettingsPanel } from './LiraAiSettingsPanel'
import { LiraKnowledgePanel } from './LiraKnowledgePanel'
import { LiraOutbreakInvestigationsPanel } from './LiraOutbreakInvestigationsPanel'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { externalSources } from './managementData'
import { loadExternalReferences,loadGlobalExternalReferences,removeExternalReference,removeGlobalExternalReference,saveGlobalExternalReference,updateExternalReference } from './managementCloudService'

const coreExternalReferences=externalSources.map(item=>({...item,sourceKey:item.sourceKey||item.id,isGlobal:true,organizationId:null}))
function mergeExternalReferences(rows=[]){const merged=new Map(coreExternalReferences.map(item=>[item.sourceKey,item]));for(const item of rows||[]){const key=item.sourceKey||item.id;merged.set(key,{...(merged.get(key)||{}),...item})}return [...merged.values()].sort((a,b)=>String(a.authority||'').localeCompare(String(b.authority||'')))}

export function ManagementPage({global=false,onBack}={}){
 const {language,t}=useLanguage();const {tenant,role,membership,isDemo:tenantIsDemo}=useTenant();const isDemo=!global&&tenantIsDemo;const {notify,confirm}=useFeedback();const navigate=useNavigate();const isPlatformOwner=global||role===ROLES.PLATFORM_OWNER
 const [tab,setTab]=useState(()=>global?'libraries':'users');const [references,setReferences]=useState(()=>mergeExternalReferences(isDemo?externalSources:[]));const [referenceEditor,setReferenceEditor]=useState(null);const [managementLoading,setManagementLoading]=useState(false)
 const addOns=useMemo(()=>membership?.capabilities??[],[membership]);const customCaps=useMemo(()=>membership?.customCapabilities??[],[membership])
 useEffect(()=>{if(tab!=='references')return;if(isDemo){setReferences(mergeExternalReferences(externalSources));return}if(!global&&!tenant?.id)return;let active=true;setManagementLoading(true);(global?loadGlobalExternalReferences():loadExternalReferences(tenant.id)).then(rows=>active&&setReferences(mergeExternalReferences(rows))).catch(error=>active&&notify(error?.message||t('managementPanel.loadFailed'),'error')).finally(()=>active&&setManagementLoading(false));return()=>{active=false}},[global,isDemo,tenant?.id,tab,notify,t])
 const tabs=useMemo(()=>{
  if(global)return [{id:'libraries',label:t('libraries'),icon:Database},{id:'bundles',label:t('managementPanel.preventionBundlesLabel'),icon:Layers3},{id:'haiCriteria',label:t('managementPanel.haiCriteriaLabel'),icon:ShieldAlert},{id:'indicators',label:t('indicators'),icon:Activity},{id:'references',label:t('externalReferences'),icon:Globe2}]
  const ok=cap=>can(role,cap,addOns,customCaps);return [
  ...(ok(CAPABILITIES.MANAGE_USERS)?[{id:'users',label:t('users'),icon:Users},{id:'liraAi',label:'LIRA & AI',icon:KeyRound},{id:'liraKnowledge',label:'LIRA Knowledge',icon:BookOpen},{id:'liraOutbreaks',label:t('managementOutbreakInvestigationsLabel'),icon:ClipboardList}]:[]),
  ...(ok(CAPABILITIES.MANAGE_ANNOUNCEMENTS)?[{id:'announcements',label:t('announcements'),icon:Bell}]:[]),
  ...(ok(CAPABILITIES.MANAGE_LIBRARIES)?[{id:'libraries',label:t('libraries'),icon:Database},{id:'questionnaires',label:t('managementQuestionnairesLabel'),icon:ClipboardList},{id:'clinicalScales',label:language==='en'?'Clinical scales':'Κλινικές κλίμακες',icon:Activity},{id:'environmentTemplates',label:t('managementEnvironmentTemplatesLabel'),icon:Wind},{id:'bundles',label:t('managementPanel.preventionBundlesLabel'),icon:Layers3},{id:'haiCriteria',label:t('managementPanel.haiCriteriaLabel'),icon:ShieldAlert}]:[]),
  ...(ok(CAPABILITIES.MANAGE_INDICATORS)?[{id:'indicators',label:t('indicators'),icon:Activity}]:[]),...(ok(CAPABILITIES.MANAGE_BED_DAYS)?[{id:'patientDays',label:t('patientDays'),icon:Database}]:[]),...(ok(CAPABILITIES.MANAGE_HOSPITAL_STRUCTURE)?[{id:'hospitalStructure',label:language==='en'?'Structural indicators':'Δομικοί δείκτες',icon:Building2}]:[]),...(ok(CAPABILITIES.RECORD_PREVALENCE_SURVEY)?[{id:'prevalenceSurvey',label:language==='en'?'Prevalence survey (PPS)':'Επιπολασμός λοιμώξεων (PPS)',icon:Search}]:[]),...(ok(CAPABILITIES.MANAGE_EXTERNAL_REFERENCES)?[{id:'references',label:t('externalReferences'),icon:Globe2}]:[]),...(ok(CAPABILITIES.MANAGE_ROLES)?[{id:'roles',label:t('rolesPermissions'),icon:ShieldCheck}]:[]),...(isPlatformOwner?[{id:'platform',label:t('managementPlatformCenterLabel'),icon:KeyRound}]:[])]},[global,role,addOns,customCaps,t,isPlatformOwner,language])
 useEffect(()=>{if(tabs.length&&!tabs.some(item=>item.id===tab))setTab(tabs[0].id)},[tabs,tab]);function openTab(id){if(id==='platform'){navigate('/platform');return}setTab(id)}
 async function saveReference(){if(referenceEditor?.isGlobal&&!isPlatformOwner){notify(t('managementReferencePlatformOwnerOnly'),'warning');return}try{const saved=isDemo?referenceEditor:global?await saveGlobalExternalReference(referenceEditor):await updateExternalReference(tenant.id,referenceEditor);setReferences(rows=>mergeExternalReferences(rows.some(row=>(row.sourceKey||row.id)===(saved.sourceKey||saved.id))?rows.map(row=>(row.sourceKey||row.id)===(saved.sourceKey||saved.id)?saved:row):[...rows,saved]));setReferenceEditor(null);notify(t('managementPanel.externalSourceUpdated'),'success')}catch(error){notify(error?.message||t('managementPanel.saveFailed'),'error')}}
 async function deleteReference(item){if(item?.isGlobal&&!isPlatformOwner)return;const ok=await confirm({title:t('managementPanel.deleteExternalSourceTitle'),message:`${t('managementPanel.deleteExternalSourceMessagePrefix')} «${item.authority}» ${t('managementPanel.deleteExternalSourceMessageSuffix')}`,confirmLabel:t('delete'),danger:true});if(!ok)return;try{if(!isDemo)await(global?removeGlobalExternalReference(item):removeExternalReference(tenant.id,item));setReferences(rows=>mergeExternalReferences(rows.filter(row=>(row.sourceKey||row.id)!==(item.sourceKey||item.id))));notify(t('actionCompleted'),'success')}catch(error){notify(error?.message||t('managementPanel.saveFailed'),'error')}}
 async function refreshReferences(){if(isDemo){setReferences(mergeExternalReferences(externalSources));notify(t('actionCompleted'),'success');return}try{setManagementLoading(true);setReferences(mergeExternalReferences(await(global?loadGlobalExternalReferences():loadExternalReferences(tenant.id))));notify(t('actionCompleted'),'success')}catch(error){notify(error?.message||t('managementPanel.loadFailed'),'error')}finally{setManagementLoading(false)}}
 return <Page fill title={global?t('managementGlobalTitle'):t('management')} subtitle={global?t('managementGlobalSubtitle'):t('managementSubtitle')}><div className="management-shell workspace-fill">{onBack&&<div className="platform-registry-navigation"><BackButton onClick={onBack} label="Dashboard"/></div>}<ModuleTabs className="management-tabs" activeId={tab} onChange={openTab} ariaLabel={t('management')} tabs={tabs}/>
 {tab==='users'&&<ManagementUsersPanel/>}{tab==='announcements'&&<AnnouncementsPanel/>}{tab==='libraries'&&<LibrariesPanel global={global}/>}{tab==='questionnaires'&&<section className="management-section management-scroll-section"><QuestionnairesPanel/></section>}{tab==='clinicalScales'&&<section className="management-section management-scroll-section"><ClinicalScalesPanel/></section>}{tab==='environmentTemplates'&&<section className="management-section management-scroll-section"><EnvironmentalStandardsPanel embedded/></section>}{tab==='bundles'&&<section className="management-section management-scroll-section"><BundleLibraryPanel global={global}/></section>}{tab==='haiCriteria'&&<section className="management-section management-scroll-section"><HaiCriteriaLibraryPanel global={global}/></section>}{tab==='indicators'&&<IndicatorsPanel global={global}/>}{tab==='patientDays'&&<BedDaysPanel/>}{tab==='hospitalStructure'&&<HospitalStructurePanel/>}{tab==='prevalenceSurvey'&&<PrevalenceSurveyPanel/>}{tab==='roles'&&<ManagementRolesPanel/>}{tab==='liraAi'&&<LiraAiSettingsPanel/>}{tab==='liraKnowledge'&&<LiraKnowledgePanel/>}{tab==='liraOutbreaks'&&<LiraOutbreakInvestigationsPanel/>}
 {tab==='references'&&<section className="management-section management-scroll-section"><div className="section-toolbar"><div><h2>{t('externalReferences')}</h2><p>{t('externalReferenceNote')}</p></div><Button variant="secondary" onClick={refreshReferences}>{t('reload')}</Button></div>{managementLoading&&<div className="inline-empty">{t('loading')}</div>}<RegistryTable
   wrapperClassName="table-wrap scroll-table"
   columns={[{key:'source',label:t('officialSource')},{key:'authority',label:t('source')},{key:'scope',label:t('managementPanel.scopeLabel')},{key:'version',label:t('referenceVersion')},{key:'status',label:t('reviewStatusLabel')},{key:'actions',label:''}]}
   rows={references}
   rowKey={item=>item.sourceKey||item.id}
   renderRow={item=><><td><strong>{item.label||'—'}</strong>{item.isGlobal&&<small>{isPlatformOwner?'System · Owner':'System · Read only'}</small>}</td><td>{item.authority}</td><td>{language==='el'?item.scope:(item.scopeEn||item.scope)}</td><td>{language==='el'?item.version:(item.versionEn||item.version)}</td><td><span className="status-badge active">{t(item.status)}</span></td><td>{(!item.isGlobal||isPlatformOwner)&&<OverflowMenu items={[
     {id:'edit',label:t('edit'),icon:Pencil,onClick:()=>setReferenceEditor({...item})},
     {id:'delete',label:t('delete'),icon:X,tone:'danger',separatorBefore:true,onClick:()=>deleteReference(item)},
   ]}/>}</td></>}
 />{!managementLoading&&!references.length&&<div className="inline-empty">{t('noData')}</div>}</section>}
 {referenceEditor&&<ObserverDialog open title={t('externalReferences')} onClose={()=>setReferenceEditor(null)}><div className="entry-form-grid"><label className="field"><span>{t('officialSource')}</span><input value={referenceEditor.label||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,label:e.target.value}))}/></label><label className="field"><span>{t('source')}</span><input value={referenceEditor.authority||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,authority:e.target.value}))}/></label><label className="field"><span>{t('managementPanel.scopeLabel')}</span><input value={referenceEditor.scope||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,scope:e.target.value}))}/></label><label className="field"><span>{t('referenceVersion')}</span><input value={referenceEditor.version||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,version:e.target.value}))}/></label></div><DialogActions><Button variant="secondary" onClick={()=>setReferenceEditor(null)}>{t('cancel')}</Button>{(!referenceEditor.isGlobal||isPlatformOwner)&&<SaveButton onClick={saveReference}>{t('save')}</SaveButton>}</DialogActions></ObserverDialog>}
 </div></Page>
}
