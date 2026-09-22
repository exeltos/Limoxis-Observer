import { useEffect,useMemo,useState } from 'react'
import { BookOpenCheck,FileCheck2,FileClock,Files } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { Button } from '../../design-system/Button'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { useDocumentsData } from './useDocumentsData'
import { compareDocumentVersions, groupDocumentFamilies } from './documentService'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { MetricCard } from '../../design-system/MetricCard'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'

const labels={el:{types:{policy:'Πολιτική',procedure:'Διαδικασία',instruction:'Οδηγία',form:'Έντυπο',protocol:'Πρωτόκολλο',other:'Άλλο'},statuses:{draft:'Πρόχειρο',review:'Σε έλεγχο',approved:'Εγκεκριμένο',published:'Δημοσιευμένο',superseded:'Αντικαταστάθηκε',archived:'Αρχειοθετημένο'}},en:{types:{policy:'Policy',procedure:'Procedure',instruction:'Instruction',form:'Form',protocol:'Protocol',other:'Other'},statuses:{draft:'Draft',review:'In review',approved:'Approved',published:'Published',superseded:'Superseded',archived:'Archived'}}}

export function DocumentsPage(){
 const navigate=useNavigate(),registry=useRegistryMemory('documents'),{role,actualRole,isRolePreview,membership}=useTenant(),{language}=useLanguage();const en=language==='en',typeLabels=labels[language].types,statusLabels=labels[language].statuses
 const {data:rows,loading,error,reload}=useDocumentsData();const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[type,setType]=useState('all'),[reviewDueOnly,setReviewDueOnly]=useState(false),[sort,setSort]=useState({key:'updatedAt',dir:'desc'}),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[],permissionRole=isRolePreview?role:(actualRole||role);const canManage=can(permissionRole,CAPABILITIES.MANAGE_DOCUMENTS,addOns,custom)
 const families=useMemo(()=>groupDocumentFamilies(rows),[rows])
 const reviewCutoff=useMemo(()=>new Date(Date.now()+30*86400000).toISOString().slice(0,10),[])
 const isReviewDue=useMemo(()=>family=>{const x=family.activePublished;return Boolean(x?.reviewDate&&x.reviewDate<=reviewCutoff)},[reviewCutoff])
 const filtered=useMemo(()=>families.filter(family=>{const x=family.current,searchText=`${family.root?.id||''} ${family.versions.map(v=>v.id).join(' ')} ${x?.title||''} ${x?.owner||''} ${x?.department||''}`.toLowerCase();return (status==='all'||x?.status===status)&&(type==='all'||x?.type===type)&&(!reviewDueOnly||isReviewDue(family))&&searchText.includes(query.toLowerCase())}),[families,query,status,type,reviewDueOnly,isReviewDue])
 const sortAccessors=useMemo(()=>({code:family=>family.root?.id||family.current?.id||'',title:family=>family.current?.title||'',type:family=>typeLabels[family.current?.type]||family.current?.type||'',owner:family=>family.current?.owner||'',department:family=>family.current?.department||'',review:family=>(family.activePublished||family.current)?.reviewDate||'',status:family=>statusLabels[family.current?.status]||family.current?.status||'',updatedAt:family=>family.current?.updatedAt||''}),[typeLabels,statusLabels])
 const sorted=useMemo(()=>{const list=[...filtered];if(sort.key==='version'){list.sort((a,b)=>compareDocumentVersions(a.current,b.current));if(sort.dir==='desc')list.reverse();return list}const get=sortAccessors[sort.key]||sortAccessors.updatedAt;list.sort((a,b)=>String(get(a)).localeCompare(String(get(b)),language));if(sort.dir==='desc')list.reverse();return list},[filtered,sort,language,sortAccessors])
 function toggleSort(key){setSort(current=>current.key===key?{key,dir:current.dir==='asc'?'desc':'asc'}:{key,dir:'asc'})}
 function sortIndicator(key){return sort.key===key?(sort.dir==='asc'?' ▲':' ▼'):''}
 useEffect(()=>setPage(1),[query,status,type,reviewDueOnly,pageSize]);const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=sorted.slice((safePage-1)*pageSize,safePage*pageSize)
 const reviewDue=families.filter(isReviewDue).length
 const publishedCount=families.filter(family=>Boolean(family.activePublished)).length
 const draftCount=families.filter(family=>family.current?.status==='draft').length
 function action(a){if(a===UI_ACTIONS.CREATE)navigate('/documents/new')}
 function openDocument(family){const target=family.current;registry.openRecord(navigate,`/documents/${target.id}`,family.key,filtered.map(x=>x.key))}
 if(loading)return <RouteLoading/>
 if(error)return <Page title={en?'Documents':'Έγγραφα'}><div className="data-access-state error" role="alert"><span>{en?'Could not load documents.':'Δεν ήταν δυνατή η φόρτωση των εγγράφων.'}</span><Button variant="secondary" onClick={()=>reload()}>{en?'Retry':'Επανάληψη'}</Button></div></Page>
 return <Page fill title={en?'Documents':'Έγγραφα'} subtitle={en?'Central library of controlled documents, versions and distributions.':'Κεντρική βιβλιοθήκη ελεγχόμενων εγγράφων, εκδόσεων και κοινοποιήσεων.'} actions={<RecordActions actions={canManage?[UI_ACTIONS.CREATE]:[]} resourceCapability={CAPABILITIES.VIEW_DOCUMENTS} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_DOCUMENTS}} onAction={action}/>}>
  <div className="module-summary-strip"><Metric icon={Files} label={en?'Total':'Σύνολο'} value={families.length}/><Metric icon={FileCheck2} label={en?'Published':'Δημοσιευμένα'} value={publishedCount}/><Metric icon={FileClock} label={en?'Drafts':'Πρόχειρα'} value={draftCount}/><Metric icon={BookOpenCheck} label={en?'Review ≤30 days':'Αναθεώρηση ≤30 ημέρες'} value={reviewDue} tone={reviewDueOnly?'active':(reviewDue>0?'warning':'neutral')} onClick={()=>setReviewDueOnly(v=>!v)} active={reviewDueOnly}/></div>
  <section className="surface registry-workspace workspace-column workspace-fill"><FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search document, owner or department...':'Αναζήτηση εγγράφου, υπευθύνου ή τμήματος...'} activeAdvancedCount={(status!=='all'?1:0)+(type!=='all'?1:0)+(reviewDueOnly?1:0)} onClear={()=>{setQuery('');setStatus('all');setType('all');setReviewDueOnly(false)}}><FilterSelect label={en?'Type':'Τύπος'} value={type} onChange={setType}><option value="all">{en?'All':'Όλοι'}</option>{Object.entries(typeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</FilterSelect><FilterSelect label={en?'Status':'Κατάσταση'} value={status} onChange={setStatus}><option value="all">{en?'All':'Όλες'}</option>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</FilterSelect></FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table record-table-clickable"><thead><tr><th style={{cursor:'pointer'}} onClick={()=>toggleSort('code')}>{en?'Code':'Κωδικός'}{sortIndicator('code')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('title')}>{en?'Document':'Έγγραφο'}{sortIndicator('title')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('type')}>{en?'Type':'Τύπος'}{sortIndicator('type')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('version')}>{en?'Current version':'Τρέχουσα έκδοση'}{sortIndicator('version')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('owner')}>{en?'Owner':'Υπεύθυνος'}{sortIndicator('owner')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('department')}>{en?'Department / audience':'Τμήμα / κοινό'}{sortIndicator('department')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('review')}>{en?'Review':'Αναθεώρηση'}{sortIndicator('review')}</th><th style={{cursor:'pointer'}} onClick={()=>toggleSort('status')}>{en?'Status':'Κατάσταση'}{sortIndicator('status')}</th></tr></thead><tbody>{pagedRows.map(family=>{const x=family.current;return <tr key={family.key} {...registry.rowProps(family.key,()=>openDocument(family))}><td><strong>{family.root?.id||x.id}</strong></td><td><strong>{x.title}</strong><small>{x.description||'—'}</small></td><td>{typeLabels[x.type]||x.type}</td><td><strong>{x.version||'—'}</strong>{family.versionCount>1&&<small>{family.versionCount} {en?'versions':'εκδόσεις'}</small>}</td><td>{x.owner||'—'}</td><td>{x.department||'—'}</td><td>{(family.activePublished||x).reviewDate||'—'}</td><td><span className={`status-badge ${x.status==='published'?'active':x.status==='draft'?'temporary':''}`}>{statusLabels[x.status]||x.status}</span></td></tr>})}</tbody></table>{filtered.length===0&&<div className="inline-empty">{en?'No documents found.':'Δεν βρέθηκαν έγγραφα.'}</div>}</div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>
 </Page>
}
function Metric({icon:Icon,label,value,tone,onClick,active}){
 const card=<MetricCard icon={Icon} value={value} label={label} tone={tone}/>
 if(!onClick)return card
 return <button type="button" className="metric-card-reset" aria-pressed={active} onClick={onClick} style={{all:'unset',cursor:'pointer',display:'block'}}>{card}</button>
}
