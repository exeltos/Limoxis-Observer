import { useMemo,useState } from 'react'
import { ClipboardCheck,Droplets,Pencil,Recycle,ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { useLocation,useNavigate,useSearchParams } from 'react-router-dom'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { useTenant } from '../../core/tenant/TenantContext'
import { downloadCsv } from '../../core/export/csvExport'
import { antisepticRows,bundleRows,handHygieneRows,wasteRows } from './preventionDemoData'
import { PreventionEntryModal } from './PreventionEntryModal'
import { WhoHandHygieneModal } from './WhoHandHygieneModal'
import { WasteEntryModal } from './WasteEntryModal'
import { AntisepticEntryModal,antisepticMethodLabel } from './AntisepticEntryModal'
import { BundleExecutionModal } from './BundleExecutionModal'
import { readRegistryViewState, useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { wasteCategoryTone } from './wasteVisuals'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { useAuth } from '../../core/auth/AuthContext'
import { auditActorFromAuth,auditEvent } from '../../core/audit/actor'

const tabs=[['handHygiene','handHygiene'],['waste','wasteManagement'],['antiseptics','antisepticConsumption'],['bundles','preventionBundles']]

export function PreventionPage(){
 const {t,language,locale}=useLanguage()
 const navigate=useNavigate()
 const location=useLocation()
 const [searchParams,setSearchParams]=useSearchParams()
 const {notify}=useFeedback()
 const {profile,user}=useAuth()
 const actor=useMemo(()=>auditActorFromAuth({profile,user}),[profile,user])
 const {role,membership,canAccessRecord}=useTenant()
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
 const [tab,setTab]=useState(()=>searchParams.get('tab')||'handHygiene')
 const registry=useRegistryMemory(`prevention-${tab}`)
 const savedView=registry.loadViewState({query:'',department:'all',period:'all',product:'all',method:'all'})
 const [query,setQuery]=useState(savedView.query),[department,setDepartment]=useState(savedView.department),[period,setPeriod]=useState(savedView.period),[product,setProduct]=useState(savedView.product),[method,setMethod]=useState(savedView.method)
 const [entryOpen,setEntryOpen]=useState(false),[editingRecord,setEditingRecord]=useState(null),[version,setVersion]=useState(0)
 const [governedEdit,setGovernedEdit]=useState(null)
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const departmentScoped=[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER].includes(role)
 const createCapability=tab==='handHygiene'?CAPABILITIES.RECORD_HAND_HYGIENE:tab==='waste'?CAPABILITIES.RECORD_WASTE:tab==='antiseptics'?CAPABILITIES.RECORD_ANTISEPTIC:CAPABILITIES.RECORD_PREVENTION_BUNDLE
 const canCreate=can(role,createCapability,addOns,custom)
 const visibleTabs=tabs.filter(([id])=>can(role,id==='handHygiene'?CAPABILITIES.RECORD_HAND_HYGIENE:id==='waste'?CAPABILITIES.RECORD_WASTE:id==='antiseptics'?CAPABILITIES.RECORD_ANTISEPTIC:CAPABILITIES.RECORD_PREVENTION_BUNDLE,addOns,custom)||can(role,CAPABILITIES.VIEW_PREVENTION,addOns,custom))
 const source=tab==='handHygiene'?handHygieneRows:tab==='waste'?wasteRows:tab==='antiseptics'?antisepticRows:bundleRows
 const departments=useMemo(()=>[...new Set(source.map(x=>language==='el'?x.departmentEl:x.departmentEn))],[source,language,version])
 const rows=useMemo(()=>source.filter(x=>x.lifecycleStatus!=='voided').filter(x=>canAccessRecord({...x,department:x.departmentEl})).filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase())).filter(x=>department==='all'||(language==='el'?x.departmentEl:x.departmentEn)===department).filter(x=>period==='all'||x.period===period).filter(x=>product==='all'||x.product===product).filter(x=>method==='all'||x.method===method),[source,query,department,period,product,method,language,canAccessRecord,version])
 const avg=handHygieneRows.length?handHygieneRows.reduce((sum,x)=>sum+x.rate,0)/handHygieneRows.length:0
 const fmtDate=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'
 function changeTab(id){
  registry.saveViewState({tab,query,department,period,product,method})
  const nextRegistry=readRegistryViewState(`prevention-${id}`)
  setTab(id)
  setQuery(nextRegistry?.query||'');setDepartment(nextRegistry?.department||'all');setPeriod(nextRegistry?.period||'all');setProduct(nextRegistry?.product||'all');setMethod(nextRegistry?.method||'all')
  setSearchParams({tab:id},{replace:true})
 }
 function openPreventionRecord(id,type){
  registry.saveViewState({tab:type,query,department,period,product,method})
  registry.openRecord(navigate,`/prevention/${type}/${id}?fromTab=${type}`,id,rows.map(x=>x.id))
 }

 function saveEntry(record){
  const target=tab==='handHygiene'?handHygieneRows:tab==='waste'?wasteRows:tab==='antiseptics'?antisepticRows:bundleRows
  if(editingRecord){
   const index=target.findIndex(x=>x.id===editingRecord.id)
   if(index>=0){
    const previous=target[index]
    const {_correctionReason:discardedInternalReason,...cleanRecord}=record
    const event=auditEvent('preventionRecordCorrected',{actor,reason:editingRecord._correctionReason||''})
    target[index]={...previous,...cleanRecord,id:editingRecord.id,updatedAt:new Date().toISOString(),updatedBy:actor.name,updatedById:actor.id,revisionHistory:[event,...(previous.revisionHistory||[])]}
   }
   notify('Η διορθωμένη εγγραφή αποθηκεύτηκε και καταγράφηκε στο ιστορικό.','success')
  }else{
   target.unshift({id:makeId(tab),...record})
   notify('Η καταχώρηση Πρόληψης αποθηκεύτηκε.','success')
  }
  setVersion(v=>v+1);setEntryOpen(false);setEditingRecord(null)
 }

 function editRow(record,event){event?.stopPropagation();setGovernedEdit(record)}
 function confirmGovernedEdit(reason){
  if(!governedEdit)return
  setEditingRecord({...governedEdit,_correctionReason:reason})
  setGovernedEdit(null)
  setEntryOpen(true)
 }
 function action(a){
  if(a===UI_ACTIONS.CREATE){setEditingRecord(null);setEntryOpen(true);return}
  if(a===UI_ACTIONS.PRINT){window.print();notify('Η προβολή είναι έτοιμη για εκτύπωση.','success');return}
  if(a===UI_ACTIONS.EXPORT){exportRows(tab,rows,t,language);notify('Η τρέχουσα λίστα εξήχθη.','success')}
 }

 return <Page fill title={t('preventionCenter')} subtitle={t('preventionSubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} actionCapabilities={{[UI_ACTIONS.CREATE]:createCapability}} onAction={action}/>}>
  <div className="workspace-summary">
   <div className="prevention-kpis">
    <Kpi icon={ShieldCheck} value={`${avg.toFixed(1)}%`} label={t('whoCompliance')}/>
    <Kpi icon={ClipboardCheck} value={bundleRows.length} label={t('activeBundles')}/>
    <Kpi icon={Recycle} value={`${wasteRows.reduce((s,x)=>s+x.weight,0).toFixed(1)} kg`} label={t('wasteRecorded')}/>
    <Kpi icon={Droplets} value={`${antisepticRows.reduce((s,x)=>s+x.litres,0).toFixed(1)} L`} label={t('antisepticRecorded')}/>
   </div>
   <div className="governance-banner"><ShieldCheck size={17}/><span>{t('preventionGovernance')}</span></div>
  </div>

  <div className="surface prevention-workspace workspace-fill">
   <div className="tabs prevention-tabs">{visibleTabs.map(([id,key])=><button key={id} className={`tab ${tab===id?'active':''}`} onClick={()=>changeTab(id)}>{t(key)}</button>)}</div>
   <FilterBar query={query} onQueryChange={setQuery} placeholder={t('searchPrevention')} onClear={()=>{setQuery('');setDepartment('all');setPeriod('all');setProduct('all');setMethod('all')}} advanced={tab==='antiseptics'?<>
     <FilterSelect label={t('period')} value={period} onChange={setPeriod}><option value="all">{t('all')}</option>{[...new Set(source.map(x=>x.period).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
     <FilterSelect label="Προϊόν" value={product} onChange={setProduct}><option value="all">Όλα τα προϊόντα</option>{[...new Set(source.map(x=>x.product).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>
     <FilterSelect label="Πηγή δεδομένων" value={method} onChange={setMethod}><option value="all">Όλες οι πηγές</option>{[...new Set(source.map(x=>x.method).filter(Boolean))].map(x=><option key={x} value={x}>{antisepticMethodLabel(x)}</option>)}</FilterSelect>
    </>:tab==='bundles'?<FilterSelect label={t('period')} value={period} onChange={setPeriod}><option value="all">{t('all')}</option>{[...new Set(source.map(x=>x.period).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</FilterSelect>:null} activeAdvancedCount={(department!=='all'?1:0)+(period!=='all'?1:0)+(product!=='all'?1:0)+(method!=='all'?1:0)}>
    <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect>
   </FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}>
    {tab==='handHygiene'&&<HandTable rows={rows} t={t} language={language} fmtDate={fmtDate} onOpen={id=>openPreventionRecord(id,'handHygiene')} registry={registry} canEdit={canCreate} onEdit={editRow}/>}
    {tab==='waste'&&<WasteTable rows={rows} t={t} language={language} fmtDate={fmtDate} onOpen={id=>openPreventionRecord(id,'waste')} registry={registry} canEdit={canCreate} onEdit={editRow}/>}
    {tab==='antiseptics'&&<AntisepticTable rows={rows} t={t} language={language} onOpen={id=>openPreventionRecord(id,'antiseptics')} registry={registry} canEdit={canCreate} onEdit={editRow}/>}
    {tab==='bundles'&&<BundleTable rows={rows} t={t} language={language} onOpen={id=>openPreventionRecord(id,'bundles')} registry={registry} canEdit={canCreate} onEdit={editRow}/>}
   </div>
  </div>

  {entryOpen&&canCreate&&(tab==='handHygiene'?<WhoHandHygieneModal initialRecord={editingRecord} fixedDepartment={departmentScoped?ownDepartment:''} onClose={()=>{setEntryOpen(false);setEditingRecord(null)}} onSave={saveEntry}/>:tab==='waste'?<WasteEntryModal initialRecord={editingRecord} fixedDepartment={departmentScoped?ownDepartment:''} onClose={()=>{setEntryOpen(false);setEditingRecord(null)}} onSave={saveEntry}/>:tab==='antiseptics'?<AntisepticEntryModal initialRecord={editingRecord} fixedDepartment={departmentScoped?ownDepartment:''} onClose={()=>{setEntryOpen(false);setEditingRecord(null)}} onSave={saveEntry}/>:tab==='bundles'?<BundleExecutionModal initialRecord={editingRecord} fixedDepartment={departmentScoped?ownDepartment:''} onClose={()=>{setEntryOpen(false);setEditingRecord(null)}} onSave={saveEntry}/>:<PreventionEntryModal tab={tab} initialRecord={editingRecord} fixedDepartment={departmentScoped?ownDepartment:''} onClose={()=>{setEntryOpen(false);setEditingRecord(null)}} onSave={saveEntry}/>)}
  <GovernedReasonDialog open={Boolean(governedEdit)} title="Διόρθωση καταγεγραμμένης μέτρησης" description="Η αρχική καταχώρηση παραμένει τεκμηριωμένη. Η αλλαγή απαιτεί αιτιολογία και θα προστεθεί στο revision history." confirmLabel="Έναρξη διόρθωσης" onCancel={()=>setGovernedEdit(null)} onConfirm={confirmGovernedEdit}/>
 </Page>
}

function makeId(tab){
 const stamp=new Date().toISOString().replace(/\D/g,'').slice(2,12)
 const prefix=tab==='handHygiene'?'HH':tab==='waste'?'W':tab==='antiseptics'?'A':'B'
 return `${prefix}-${stamp}-${Math.floor(Math.random()*900+100)}`
}

function exportRows(tab,rows,t,language){
 if(tab==='handHygiene')return downloadCsv('prevention-hand-hygiene.csv',['Ημερομηνία','Τμήμα','Κατηγορία','Παρατηρήσεις','Συμμορφούμενες','Συμμόρφωση','Παρατηρητής'],rows.map(x=>[x.date,language==='el'?x.departmentEl:x.departmentEn,t(x.profession),x.observations,x.compliant,`${x.rate}%`,x.observer]))
 if(tab==='waste')return downloadCsv('prevention-waste.csv',['Ημερομηνία','Τμήμα','Κατηγορία','Βάρος kg','Περιέκτες','Νοσηλευτικές ημέρες','Δείκτης kg/1.000','Παραστατικό','Εταιρεία συλλογής','Υπεύθυνος'],rows.map(x=>[x.date,language==='el'?x.departmentEl:x.departmentEn,language==='el'?(x.wasteType||x.type):(x.typeEn||x.wasteType||x.type),x.weight,x.containers,x.patientDays||'',x.indicator??'',x.documentNumber||'',x.collectionCompany||'',x.responsible||'']))
 if(tab==='antiseptics')return downloadCsv('prevention-antiseptics.csv',['Περίοδος','Τμήμα','Προϊόν','Κατανάλωση L','Νοσηλευτικές ημέρες','Δείκτης ABHR L/1.000','Πηγή δεδομένων','Αναφορά/Παραστατικό','Υπεύθυνος'],rows.map(x=>[x.period,language==='el'?x.departmentEl:x.departmentEn,language==='el'?x.product:(x.productEn||x.product),x.litres,x.patientDays||'',x.indicator??'',antisepticMethodLabel(x.method),x.referenceNumber||'',x.responsible||'']))
 return downloadCsv('prevention-bundles.csv',['Ημερομηνία','Bundle','Έκδοση','Τμήμα','Βάρδια','Ασθενής','Συσκευή','Score','All-or-none','Αποκλίσεις','Υπεύθυνος'],rows.map(x=>[x.date||x.period,x.templateName||x.bundle,x.templateVersion||'',language==='el'?x.departmentEl:x.departmentEn,x.shift||'',x.patientRef||'',x.deviceRef||'',`${x.score}%`,x.allOrNone?'Ναι':'Όχι',x.failedCount??x.findings?.length??0,x.owner||'']))
}

function Kpi({icon:Icon,value,label}){return <div className="prevention-kpi"><Icon size={18}/><div><strong>{value}</strong><span>{label}</span></div></div>}
function EditCell({record,canEdit,onEdit}){return <td className="prevention-row-action">{canEdit&&<button type="button" className="prevention-row-edit" title="Επεξεργασία" aria-label="Επεξεργασία" onClick={e=>onEdit(record,e)}><Pencil size={15}/></button>}</td>}
function HandTable({rows,t,language,fmtDate,onOpen,canEdit,onEdit,registry}){return <table className="data-table sticky-table"><thead><tr><th>{t('date')}</th><th>{t('department')}</th><th>{t('professionalCategory')}</th><th>{t('observations')}</th><th>{t('compliant')}</th><th>{t('compliance')}</th><th>{t('observer')}</th><th></th></tr></thead><tbody>{rows.map(x=>{const rp=registry.rowProps(x.id);return <tr key={x.id} {...rp} className={`${rp.className} clickable-row`} onClick={()=>onOpen(x.id)}><td>{fmtDate(x.date)}</td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td>{t(x.profession)}</td><td>{x.observations}</td><td>{x.compliant}</td><td><strong>{x.rate}%</strong></td><td>{x.observer}</td><EditCell record={x} canEdit={canEdit} onEdit={onEdit}/></tr>})}</tbody></table>}

function WasteTable({rows,t,language,fmtDate,onOpen,canEdit,onEdit,registry}){return <table className="data-table sticky-table"><thead><tr><th>{t('date')}</th><th>{t('department')}</th><th>Κατηγορία</th><th>Βάρος</th><th>Περιέκτες</th><th>Δείκτης</th><th>Παραστατικό</th><th></th></tr></thead><tbody>{rows.map(x=>{const rp=registry.rowProps(x.id);const category=x.wasteType||x.type;return <tr key={x.id} {...rp} className={`${rp.className} clickable-row`} onClick={()=>onOpen(x.id)}><td>{fmtDate(x.date)}</td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td><span className={`waste-category-badge ${wasteCategoryTone(category)}`}>{language==='el'?category:(x.typeEn||category)}</span></td><td>{Number(x.weight).toLocaleString('el-GR')} kg</td><td>{x.containers}</td><td>{x.indicator!=null?<><strong>{Number(x.indicator).toLocaleString('el-GR')}</strong><small className="table-cell-unit"> kg / 1.000</small></>:'—'}</td><td>{x.documentNumber||'—'}</td><EditCell record={x} canEdit={canEdit} onEdit={onEdit}/></tr>})}</tbody></table>}
function AntisepticTable({rows,t,language,onOpen,canEdit,onEdit,registry}){return <table className="data-table sticky-table"><thead><tr><th>{t('period')}</th><th>{t('department')}</th><th>Προϊόν</th><th>Κατανάλωση</th><th>Νοσηλευτικές ημέρες</th><th>Δείκτης ABHR</th><th>Πηγή</th><th></th></tr></thead><tbody>{rows.map(x=>{const rp=registry.rowProps(x.id);return <tr key={x.id} {...rp} className={`${rp.className} clickable-row`} onClick={()=>onOpen(x.id)}><td>{x.period}</td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td><strong>{language==='el'?x.product:(x.productEn||x.product)}</strong>{x.indicatorEligible===false&&<small className="table-cell-unit">εκτός δείκτη ABHR</small>}</td><td><strong>{Number(x.litres).toLocaleString('el-GR')} L</strong></td><td>{x.patientDays||'—'}</td><td>{x.indicator!=null?<><strong>{Number(x.indicator).toLocaleString('el-GR')}</strong><small className="table-cell-unit"> L / 1.000</small></>:'—'}</td><td><span className={`antiseptic-method-badge ${x.method||'other'}`}>{antisepticMethodLabel(x.method)}</span></td><EditCell record={x} canEdit={canEdit} onEdit={onEdit}/></tr>})}</tbody></table>}
function BundleTable({rows,t,language,onOpen,canEdit,onEdit,registry}){return <table className="data-table sticky-table"><thead><tr><th>Ημερομηνία</th><th>Bundle</th><th>{t('department')}</th><th>Πλαίσιο</th><th>Score</th><th>All-or-none</th><th>Αποκλίσεις</th><th></th></tr></thead><tbody>{rows.map(x=>{const rp=registry.rowProps(x.id);return <tr key={x.id} {...rp} className={`${rp.className} clickable-row`} onClick={()=>onOpen(x.id)}><td>{x.date||x.period}</td><td><strong>{x.templateName||x.bundle}</strong><small className="table-cell-unit">v{x.templateVersion||'1.0'}</small></td><td>{language==='el'?x.departmentEl:x.departmentEn}</td><td>{x.shift||'—'}</td><td><strong>{x.score}%</strong></td><td><span className={`bundle-all-badge ${x.allOrNone?'passed':'failed'}`}>{x.allOrNone?'Ναι':'Όχι'}</span></td><td>{(x.failedCount??x.findings?.length??0)>0?<span className="bundle-finding-count">{x.failedCount??x.findings?.length}</span>:'—'}</td><EditCell record={x} canEdit={canEdit} onEdit={onEdit}/></tr>})}</tbody></table>}
