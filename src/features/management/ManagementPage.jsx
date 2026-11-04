import { PlatformUpdateCenter } from './PlatformUpdateCenter'
import { PlatformLibrariesTabs } from '../platform/PlatformLibrariesTabs'
import { useEffect,useMemo,useState } from 'react'
import { Activity,Bell,CalendarDays,BookOpen,Building2,Database,Globe2,History,KeyRound,Layers3,Pencil,RefreshCcw,ShieldAlert,ShieldCheck,X,ClipboardList,Wind,Users,Lock } from 'lucide-react'
import './managementCenter.css'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
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
// The indicators list (definitions, numerator and denominator, approvals) left the menu for this tab.
import { IndicatorsPage } from '../indicators/IndicatorsPage'
import { PageEmbedProvider } from '../../design-system/Page'
import { ManagementUsersPanel } from './ManagementUsersPanel'
import { ManagementRolesPanel } from './ManagementRolesPanel'
import { EnvironmentalStandardsPanel } from './EnvironmentalStandardsPanel'
import { QuestionnairesPanel } from './QuestionnairesPanel'
import { ClinicalScalesPanel } from './ClinicalScalesPanel'
import { LiraAiSettingsPanel } from './LiraAiSettingsPanel'
import { LiraKnowledgePanel } from './LiraKnowledgePanel'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,can,isProfileDisabled } from '../../core/permissions/roles'
import { externalSources } from './managementData'
import { loadExternalReferences,loadGlobalExternalReferences,removeExternalReference,removeGlobalExternalReference,saveGlobalExternalReference,updateExternalReference } from './managementCloudService'
import {finishPlatformUpdateRun,loadClinicalContentSources,loadDetectedClinicalChanges,loadPendingClinicalUpdates,loadPlatformUpdateHistory,refreshClinicalContentSources,reviewClinicalUpdate,startPlatformUpdateRun} from './clinicalContentSourceService'
import { SecurityPanel } from './SecurityPanel'
import { IdentityPanel } from './IdentityPanel'

const coreExternalReferences=externalSources.map(item=>({...item,sourceKey:item.sourceKey||item.id,isGlobal:true,organizationId:null}))
function mergeExternalReferences(rows=[]){const merged=new Map(coreExternalReferences.map(item=>[item.sourceKey,item]));for(const item of rows||[]){const key=item.sourceKey||item.id;merged.set(key,{...(merged.get(key)||{}),...item})}return [...merged.values()].sort((a,b)=>String(a.authority||'').localeCompare(String(b.authority||'')))}

// Old links (?tab=…) to a screen that is now an item of a group open that group.
const HOSPITAL_TAB_OF={identity:'hospital',security:'hospital',announcements:'hospital',departments:'hospital',libraries:'lists',questionnaires:'lists',clinicalScales:'lists',environmentTemplates:'lists',bundles:'lists',haiCriteria:'lists',indicators:'lists'}

// `group`: on the platform screen the menu picks the group of tabs (libraries, data, LIRA); the page then shows only that group's tabs.
export function ManagementPage({global=false,group=null}={}){
 const {language,t}=useLanguage();const {tenant,role,membership,isDemo:tenantIsDemo,operatingProfile}=useTenant();const profileKey=`${operatingProfile?.profile}|${operatingProfile?.addons?.join(',')}`;const isDemo=!global&&tenantIsDemo;const {notify,confirm}=useFeedback();const navigate=useNavigate();// Platform-wide tools live only on the platform screen (global). Inside a
 // hospital the Platform Owner sees the same Management Center as the
 // Hospital Administrator.
 const isPlatformOwner=global
 // Outbreak investigations moved to Surveillance › Outbreak investigations; an old ?tab=liraOutbreaks link goes there.
 useEffect(()=>{if(!global&&typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('tab')==='liraOutbreaks')navigate('/surveillance?tab=outbreaks',{replace:true})},[global,navigate])
 // The indicator definitions moved to Indicators & objectives; an old ?tab=indicators link goes there.
 useEffect(()=>{if(!global&&typeof window!=='undefined'&&['indicators','indicatorDefinitions'].includes(new URLSearchParams(window.location.search).get('tab')))navigate('/quality/measures',{replace:true})},[global,navigate])
 const [tab,setTab]=useState(()=>{const asked=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('tab'):null;const requested=asked==='indicatorDefinitions'?'indicators':asked;return (global?requested:HOSPITAL_TAB_OF[requested]||requested)||(global?'libraries':'users')});const [railStart]=useState(()=>{const asked=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('tab'):null;return asked==='indicatorDefinitions'?'indicators':asked});const [updateCenterOpen,setUpdateCenterOpen]=useState(false),[pendingUpdates,setPendingUpdates]=useState([]),[reviewingUpdateId,setReviewingUpdateId]=useState(null),[updateHistory,setUpdateHistory]=useState([]),[detectedChanges,setDetectedChanges]=useState([]);const [references,setReferences]=useState(()=>mergeExternalReferences(isDemo?externalSources:[]));const [referenceEditor,setReferenceEditor]=useState(null);const [managementLoading,setManagementLoading]=useState(false);const [centerUpdate,setCenterUpdate]=useState(null)
 const addOns=useMemo(()=>membership?.capabilities??[],[membership]);const customCaps=useMemo(()=>membership?.customCapabilities??[],[membership])
 useEffect(()=>{if(!isPlatformOwner)return;Promise.all([loadPendingClinicalUpdates(),loadPlatformUpdateHistory(),loadDetectedClinicalChanges()]).then(([p,h,d])=>{setPendingUpdates(p);setUpdateHistory(h);setDetectedChanges(d)}).catch(()=>{})},[isPlatformOwner])
 useEffect(()=>{if(tab!=='references')return;if(isDemo){setReferences(mergeExternalReferences(externalSources));return}if(!global&&!tenant?.id)return;let active=true;setManagementLoading(true);(global?loadGlobalExternalReferences():loadExternalReferences(tenant.id)).then(rows=>active&&setReferences(mergeExternalReferences(rows))).catch(error=>active&&notify(error?.message||t('managementPanel.loadFailed'),'error')).finally(()=>active&&setManagementLoading(false));return()=>{active=false}},[global,isDemo,tenant?.id,tab,notify,t])
 const tabs=useMemo(()=>{
  if(global)return [{id:'libraries',label:t('libraries'),icon:Database},{id:'bundles',label:t('managementPanel.preventionBundlesLabel'),icon:Layers3},{id:'haiCriteria',label:t('managementPanel.haiCriteriaLabel'),icon:ShieldAlert},{id:'indicators',label:t('indicators'),icon:Activity},{id:'liraKnowledge',label:t('managementPanel.liraKnowledgeLabel'),icon:BookOpen},{id:'references',label:t('externalReferences'),icon:Globe2}]
  // `on`: the module the library belongs to is part of the organization's operating profile.
  // One row of tabs: Users, Roles, Hospital (identity, departments, security, announcements), Lists (every reference
  // list in one left list), Bed days and LIRA & AI. Structural indicators and PPS live in Indicators › Data.
  const ok=cap=>can(role,cap,addOns,customCaps),on=cap=>!isProfileDisabled(cap);return [
  ...(ok(CAPABILITIES.MANAGE_USERS)?[{id:'users',label:t('users'),icon:Users}]:[]),...(ok(CAPABILITIES.MANAGE_ROLES)?[{id:'roles',label:t('rolesPermissions'),icon:ShieldCheck}]:[]),
  ...(ok(CAPABILITIES.MANAGE_USERS)||ok(CAPABILITIES.MANAGE_ANNOUNCEMENTS)||ok(CAPABILITIES.MANAGE_LIBRARIES)?[{id:'hospital',label:t('managementHospitalLabel'),icon:Building2}]:[]),
  ...(ok(CAPABILITIES.MANAGE_LIBRARIES)?[{id:'lists',label:t('managementListsLabel'),icon:Database}]:[]),
  ...(ok(CAPABILITIES.MANAGE_BED_DAYS)?[{id:'patientDays',label:t('patientDays'),icon:CalendarDays}]:[]),
  ...(ok(CAPABILITIES.MANAGE_USERS)&&on(CAPABILITIES.VIEW_LIRA)?[{id:'liraAi',label:'LIRA & AI',icon:KeyRound}]:[]),
  ]},[global,role,addOns,customCaps,t,language,profileKey]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(tabs.length&&!tabs.some(item=>item.id===tab))setTab(tabs[0].id)},[tabs,tab]);
 const okCap=cap=>can(role,cap,addOns,customCaps),onModule=cap=>!isProfileDisabled(cap)
 const scroll=node=><section className="management-section management-scroll-section">{node}</section>
 const hospitalLead=okCap(CAPABILITIES.MANAGE_USERS)?[{id:'identity',label:t('managementIdentityLabel'),icon:Building2,tone:'blue',render:()=><IdentityPanel tenant={tenant} isDemo={isDemo}/>}]:[]
 const hospitalExtra=[...(okCap(CAPABILITIES.MANAGE_USERS)?[{id:'security',label:t('managementSecurityLabel'),icon:Lock,tone:'slate',render:()=><SecurityPanel tenant={tenant} isDemo={isDemo}/>}]:[]),...(okCap(CAPABILITIES.MANAGE_ANNOUNCEMENTS)?[{id:'announcements',label:t('announcements'),icon:Bell,tone:'amber',render:()=><AnnouncementsPanel/>}]:[])]
 // The platform's lists: the prevention bundles, the HAI criteria and the indicator definitions are entries of the same left list (no second row of tabs).
 const globalListsExtra=[{id:'bundles',label:t('managementPanel.preventionBundlesLabel'),icon:Layers3,tone:'green',render:()=>scroll(<BundleLibraryPanel global/>)},{id:'haiCriteria',label:t('managementPanel.haiCriteriaLabel'),icon:ShieldAlert,tone:'rose',render:()=>scroll(<HaiCriteriaLibraryPanel global/>)},{id:'indicators',label:t('indicators'),icon:Activity,tone:'blue',render:()=>scroll(<IndicatorsPanel global/>)}]
 const listsExtra=[
  ...(okCap(CAPABILITIES.MANAGE_LIBRARIES)&&onModule(CAPABILITIES.VIEW_CONTROLS)?[{id:'questionnaires',label:t('managementQuestionnairesLabel'),icon:ClipboardList,tone:'teal',render:()=>scroll(<QuestionnairesPanel/>)}]:[]),
  ...(okCap(CAPABILITIES.MANAGE_LIBRARIES)&&onModule(CAPABILITIES.VIEW_SURVEILLANCE)?[{id:'clinicalScales',label:t('managementClinicalScalesLabel'),icon:Activity,tone:'blue',render:()=>scroll(<ClinicalScalesPanel/>)}]:[]),
  ...(okCap(CAPABILITIES.MANAGE_LIBRARIES)?[{id:'environmentTemplates',label:t('managementEnvironmentTemplatesLabel'),icon:Wind,tone:'cyan',render:()=>scroll(<EnvironmentalStandardsPanel embedded/>)}]:[]),
  ...(okCap(CAPABILITIES.MANAGE_LIBRARIES)&&onModule(CAPABILITIES.VIEW_PREVENTION)?[{id:'bundles',label:t('managementPanel.preventionBundlesLabel'),icon:Layers3,tone:'green',render:()=>scroll(<BundleLibraryPanel global={false}/>)}]:[]),
  ...(okCap(CAPABILITIES.MANAGE_LIBRARIES)&&onModule(CAPABILITIES.VIEW_SURVEILLANCE)?[{id:'haiCriteria',label:t('managementPanel.haiCriteriaLabel'),icon:ShieldAlert,tone:'rose',render:()=>scroll(<HaiCriteriaLibraryPanel global={false}/>)}]:[]),
  // The indicator definitions live in «Indicators & objectives › Indicators» («Create › Indicator»): an old link goes there.
 ]
 // The lists in groups by area; the lists of a module the hospital does not use are left out.
 const LIST_GROUPS=[
  ['clinical',['microorganisms','antibiotics','deviceTypes','surveillanceDefinitions','haiCriteria','notifiableDiseases','clinicalSymptoms','clinicalRiskFactors','clinicalScales','isolationTypes']],
  ['laboratory',['sampleTypes','measurementUnits']],
  ['prevention',['bundles','questionnaires','controlTypes','controlAnswers','environmentTemplates','environmentalLocations','surfacePoints','antiseptics','wasteTypes']],
  ['staff',['professionalCategories','positions','vaccines']],
  ['quality',['documentCategories','incidentCategories','committeeTopics']],
  ['supplies',['medicinesSupplies','itemForms','equipment']],
 ].map(([id,ids])=>({id,label:t(`managementListGroups.${id}`),ids}))
 const listsHidden=[
  ...(!onModule(CAPABILITIES.VIEW_SURVEILLANCE)?['microorganisms','antibiotics','deviceTypes','surveillanceDefinitions','notifiableDiseases','clinicalSymptoms','clinicalRiskFactors','isolationTypes']:[]),
  ...(!onModule(CAPABILITIES.VIEW_LAB)?['sampleTypes']:[]),
  ...(!onModule(CAPABILITIES.VIEW_CONTROLS)?['controlTypes','controlAnswers','environmentalLocations','surfacePoints']:[]),
  ...(!onModule(CAPABILITIES.VIEW_QUALITY)?['incidentCategories']:[]),
 ]
 // Tabs in four groups: a row of groups, then only the chosen group's tabs.
 const TAB_GROUP={users:'access',roles:'access',security:'access',identity:'access',announcements:'access',liraAi:'lira',liraKnowledge:'lira',references:'sources',indicators:'libraries',patientDays:'data',hospitalStructure:'data',prevalenceSurvey:'data'}
 const groupOf=id=>TAB_GROUP[id]||'libraries'
 const groupTabs=[['access',t('managementGroupAccess'),Users],['libraries',t('managementGroupLibraries'),Database],['data',t('managementGroupData'),Activity],['lira',t('managementGroupLira'),KeyRound],['sources',t('externalReferences'),Globe2]].filter(([id])=>tabs.some(item=>groupOf(item.id)===id)).map(([id,label,icon])=>({id,label,icon}))
 const menuGroup=global&&group&&groupTabs.some(item=>item.id===group)?group:null
 const activeGroup=menuGroup||groupOf(tab)
 const tabGroup=groupOf(tab),firstOfMenuGroup=menuGroup?tabs.find(item=>groupOf(item.id)===menuGroup)?.id:null
 useEffect(()=>{if(menuGroup&&tabGroup!==menuGroup&&firstOfMenuGroup)setTab(firstOfMenuGroup)},[menuGroup,tabGroup,firstOfMenuGroup])
 const activeGroupLabel=groupTabs.find(item=>item.id===activeGroup)?.label||t('management')
 const visibleTabs=global&&groupTabs.length>1?tabs.filter(item=>groupOf(item.id)===activeGroup):tabs
 function openGroup(id){if(id===activeGroup)return;const first=tabs.find(item=>groupOf(item.id)===id);if(first)setTab(first.id)}
function openTab(id){if(id==='platform'){navigate('/platform');return}setTab(id)}
 async function saveReference(){if(referenceEditor?.isGlobal&&!isPlatformOwner){notify(t('managementReferencePlatformOwnerOnly'),'warning');return}try{const saved=isDemo?referenceEditor:global?await saveGlobalExternalReference(referenceEditor):await updateExternalReference(tenant.id,referenceEditor);setReferences(rows=>mergeExternalReferences(rows.some(row=>(row.sourceKey||row.id)===(saved.sourceKey||saved.id))?rows.map(row=>(row.sourceKey||row.id)===(saved.sourceKey||saved.id)?saved:row):[...rows,saved]));setReferenceEditor(null);notify(t('managementPanel.externalSourceUpdated'),'success')}catch(error){notify(error?.message||t('managementPanel.saveFailed'),'error')}}
 async function deleteReference(item){if(item?.isGlobal&&!isPlatformOwner)return;const ok=await confirm({title:t('managementPanel.deleteExternalSourceTitle'),message:`${t('managementPanel.deleteExternalSourceMessagePrefix')} «${item.authority}» ${t('managementPanel.deleteExternalSourceMessageSuffix')}`,confirmLabel:t('delete'),danger:true});if(!ok)return;try{if(!isDemo)await(global?removeGlobalExternalReference(item):removeExternalReference(tenant.id,item));setReferences(rows=>mergeExternalReferences(rows.filter(row=>(row.sourceKey||row.id)!==(item.sourceKey||item.id))));notify(t('actionCompleted'),'success')}catch(error){notify(error?.message||t('managementPanel.saveFailed'),'error')}}
 async function refreshReferences(){if(isDemo){setReferences(mergeExternalReferences(externalSources));notify(t('actionCompleted'),'success');return}try{setManagementLoading(true);setReferences(mergeExternalReferences(await(global?loadGlobalExternalReferences():loadExternalReferences(tenant.id))));notify(t('actionCompleted'),'success')}catch(error){notify(error?.message||t('managementPanel.loadFailed'),'error')}finally{setManagementLoading(false)}}
 async function updateManagementCenter(){if(!isPlatformOwner||centerUpdate)return;const stages=[t('externalReferences'),t('managementPanel.clinicalGovernedSources'),t('managementPanel.finalValidation')];let run=null;try{run=await startPlatformUpdateRun('manual');setCenterUpdate({total:3,current:0,label:stages[0],detail:''});const refs=global?await loadGlobalExternalReferences():tenant?.id?await loadExternalReferences(tenant.id):[];setReferences(mergeExternalReferences(refs));setCenterUpdate({total:3,current:1,label:stages[1],detail:''});const sources=await loadClinicalContentSources();await refreshClinicalContentSources(p=>setCenterUpdate({total:3,current:1,label:stages[1],detail:p?.source?.name||p?.source?.source_authority||'',subCurrent:p?.current||0,subTotal:p?.total||sources.length}));setCenterUpdate({total:3,current:2,label:stages[2],detail:''});await loadClinicalContentSources();const pending=await loadPendingClinicalUpdates();setPendingUpdates(pending);const detected=await loadDetectedClinicalChanges();setDetectedChanges(detected);if(run)await finishPlatformUpdateRun(run.id,{checked:sources.length,changed:detected.filter(item=>new Date(item.checked_at)>=new Date(run.started_at)).length,summary:{areas:['external_references','clinical_scales','indicators','criteria','libraries'],note:'Governed source check; clinical changes require owner review.'}});setUpdateHistory(await loadPlatformUpdateHistory());setCenterUpdate({total:3,current:3,label:t('managementPanel.updateCompleted'),detail:''});notify(t('managementPanel.centerUpdateSuccess'),'success');setTimeout(()=>setCenterUpdate(null),1200)}catch(error){if(run)await finishPlatformUpdateRun(run.id,{errors:1,summary:{error:error?.message||'Update failed'}}).catch(()=>{});notify(error?.message||t('managementPanel.loadFailed'),'error');setCenterUpdate(null)}}
 async function reviewUpdate(item,status){setReviewingUpdateId(`${item.id}:${status}`);try{await reviewClinicalUpdate(item.id,status);setPendingUpdates(current=>current.filter(row=>row.id!==item.id));notify(status==='approved'?t('managementPanel.updateReviewedDone'):t('managementPanel.updateDeferredDone'),'success');setPendingUpdates(await loadPendingClinicalUpdates());setDetectedChanges(await loadDetectedClinicalChanges())}catch(error){notify(error?.message||t('managementPanel.saveFailed'),'error')}finally{setReviewingUpdateId(null)}}
 // The platform's Central Management is titled by the group open in the menu (libraries, indicator data, LIRA & AI).
 const globalGroupLabel=global?groupTabs.find(item=>item.id===activeGroup)?.label:''
 // The platform update (check the sources, history, pending reviews) sits in the page header as three buttons, not as a banner.
 const updateActions=isPlatformOwner?<div className="row-actions">{pendingUpdates.length>0&&<Button variant="secondary" onClick={()=>setUpdateCenterOpen(true)}><ShieldAlert size={15}/>{pendingUpdates.length} {t('managementPanel.updatesRequireReview')}</Button>}<Button variant="secondary" onClick={()=>setUpdateCenterOpen(true)}><History size={15}/>{t('managementPanel.updateHistory')}</Button><Button onClick={updateManagementCenter} disabled={Boolean(centerUpdate)}><RefreshCcw size={15}/>{centerUpdate?t('managementPanel.updatingAll'):t('managementPanel.platformUpdateAction')}</Button></div>:null
 return <Page fill actions={updateActions} title={global?t('platformNav.settingsAndLibraries'):t('management')} subtitle={global?(globalGroupLabel?`${t('managementGlobalTitle')} · ${t('managementGlobalSubtitle')}`:t('managementGlobalSubtitle')):t('managementSubtitle')}>{global&&<PlatformLibrariesTabs/>}{centerUpdate&&<div className="management-center-update-progress"><div className="section-toolbar"><div><strong>{centerUpdate.label}</strong>{centerUpdate.detail&&<small>{centerUpdate.detail}</small>}</div><strong>{centerUpdate.current}/{centerUpdate.total}</strong></div><progress max={centerUpdate.total} value={centerUpdate.current}/>{centerUpdate.subTotal>0&&<small>{t('managementPanel.sourcesProgress')+' '}{centerUpdate.subCurrent}/{centerUpdate.subTotal}</small>}</div>}{global&&!menuGroup&&groupTabs.length>1&&<CanonicalTabs className="management-tab-groups" value={activeGroup} onChange={openGroup} ariaLabel={t('management')} items={groupTabs.map(item=>({value:item.id,label:item.label,icon:item.icon}))}/>}{!global&&!(menuGroup&&visibleTabs.length<2)&&<CanonicalTabs className={global?'lo-subtabs management-tabs':'management-tabs'} value={tab} onChange={openTab} ariaLabel={activeGroupLabel} items={visibleTabs.map(item=>({value:item.id,label:item.label,icon:item.icon}))}/>}<div className="management-shell workspace-fill">
 {tab==='users'&&<ManagementUsersPanel/>}{!global&&tab==='hospital'&&<LibrariesPanel key="hospital" only={okCap(CAPABILITIES.MANAGE_LIBRARIES)?['departments']:[]} leadItems={hospitalLead} extraItems={hospitalExtra} initial={railStart} title={t('libraryDepartments')} subtitle={t('managementDepartmentsSubtitle')}/>}{!global&&tab==='lists'&&<LibrariesPanel key="lists" only={okCap(CAPABILITIES.MANAGE_LIBRARIES)?null:[]} exclude={['departments',...listsHidden]} extraItems={listsExtra} groups={LIST_GROUPS} initial={railStart}/>}{tab==='security'&&<SecurityPanel tenant={tenant} isDemo={isDemo}/>}{tab==='identity'&&<IdentityPanel tenant={tenant} isDemo={isDemo}/>}{tab==='announcements'&&<AnnouncementsPanel/>}{tab==='libraries'&&<LibrariesPanel global={global} extraItems={global?globalListsExtra:[]}/>}{tab==='questionnaires'&&<section className="management-section management-scroll-section"><QuestionnairesPanel/></section>}{tab==='clinicalScales'&&<section className="management-section management-scroll-section"><ClinicalScalesPanel/></section>}{tab==='environmentTemplates'&&<section className="management-section management-scroll-section"><EnvironmentalStandardsPanel embedded/></section>}{tab==='bundles'&&<section className="management-section management-scroll-section"><BundleLibraryPanel global={global}/></section>}{tab==='haiCriteria'&&<section className="management-section management-scroll-section"><HaiCriteriaLibraryPanel global={global}/></section>}{/* Indicator definitions: the platform keeps the versioned library; a hospital has one list of its indicators (figures on top, one «New indicator»). */}{tab==='indicators'&&(global?<IndicatorsPanel global={global}/>:<section className="management-section management-scroll-section"><PageEmbedProvider><IndicatorsPage/></PageEmbedProvider></section>)}{tab==='patientDays'&&<BedDaysPanel/>}{tab==='hospitalStructure'&&<HospitalStructurePanel/>}{tab==='prevalenceSurvey'&&<PrevalenceSurveyPanel/>}{tab==='roles'&&<ManagementRolesPanel/>}{tab==='liraAi'&&<LiraAiSettingsPanel/>}{tab==='liraKnowledge'&&<LiraKnowledgePanel/>}
 {tab==='references'&&<section className="management-section management-scroll-section"><div className="section-toolbar"><div><h2>{t('externalReferences')}</h2><p>{t('externalReferenceNote')}</p></div><Button variant="secondary" onClick={refreshReferences}>{t('reload')}</Button></div>{managementLoading&&<div className="inline-empty">{t('loading')}</div>}<RegistryTable
   wrapperClassName="table-wrap scroll-table"
   columns={[{key:'source',label:t('officialSource')},{key:'authority',label:t('source')},{key:'scope',label:t('managementPanel.scopeLabel')},{key:'version',label:t('referenceVersion')},{key:'status',label:t('reviewStatusLabel')},{key:'actions',label:''}]}
   rows={references}
   rowKey={item=>item.sourceKey||item.id}
   renderRow={item=><><td><strong>{item.label||'—'}</strong>{item.isGlobal&&<small>{t(isPlatformOwner?'managementPanel.systemOwnerBadge':'managementPanel.systemReadOnlyBadge')}</small>}</td><td>{item.authority}</td><td>{language==='el'?item.scope:(item.scopeEn||item.scope)}</td><td>{language==='el'?item.version:(item.versionEn||item.version)}</td><td><span className="status-badge active">{t(item.status)}</span></td><td>{(!item.isGlobal||isPlatformOwner)&&<OverflowMenu items={[
     {id:'edit',label:t('edit'),icon:Pencil,onClick:()=>setReferenceEditor({...item})},
     {id:'delete',label:t('delete'),icon:X,tone:'danger',separatorBefore:true,onClick:()=>deleteReference(item)},
   ]}/>}</td></>}
 />{!managementLoading&&!references.length&&<div className="inline-empty">{t('noData')}</div>}</section>}
 {referenceEditor&&<ObserverDialog width="standard" eyebrow={t('externalReferences')} title={referenceEditor.label?t('managementPanel.editExternalSourceTitle'):t('externalReferences')} subtitle={t('managementPanel.editExternalSourceSubtitle')} onClose={()=>setReferenceEditor(null)} footer={<DialogActions onCancel={()=>setReferenceEditor(null)} onSave={(!referenceEditor.isGlobal||isPlatformOwner)?saveReference:undefined}/>}><div className="entry-grid external-source-form"><label className="entry-span-2"><span>{t('officialSource')}</span><input value={referenceEditor.label||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,label:e.target.value}))}/></label><label><span>{t('managementPanel.authorityOrgLabel')}</span><input value={referenceEditor.authority||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,authority:e.target.value}))}/></label><label><span>{t('referenceVersion')}</span><input value={referenceEditor.version||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,version:e.target.value}))}/></label><label className="entry-span-2"><span>{t('managementPanel.usageScopeLabel')}</span><textarea rows={3} value={referenceEditor.scope||''} disabled={referenceEditor.isGlobal&&!isPlatformOwner} onChange={e=>setReferenceEditor(v=>({...v,scope:e.target.value}))}/></label></div></ObserverDialog>}
 {updateCenterOpen&&<PlatformUpdateCenter language={language} pending={pendingUpdates} history={updateHistory} changes={detectedChanges} reviewingId={reviewingUpdateId} onReview={reviewUpdate} onRun={updateManagementCenter} running={centerUpdate} onClose={()=>setUpdateCenterOpen(false)}/>} </div></Page>
}
