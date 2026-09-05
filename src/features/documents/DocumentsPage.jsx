import { useEffect,useMemo,useState } from 'react'
import { BookOpenCheck,FileCheck2,FileClock,Files } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { useDocumentsData } from './useDocumentsData'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { MetricCard } from '../../design-system/MetricCard'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'

const labels={el:{types:{policy:'Πολιτική',procedure:'Διαδικασία',instruction:'Οδηγία',form:'Έντυπο',protocol:'Πρωτόκολλο',other:'Άλλο'},statuses:{draft:'Πρόχειρο',review:'Σε έλεγχο',approved:'Εγκεκριμένο',published:'Δημοσιευμένο',superseded:'Αντικαταστάθηκε',archived:'Αρχειοθετημένο'}},en:{types:{policy:'Policy',procedure:'Procedure',instruction:'Instruction',form:'Form',protocol:'Protocol',other:'Other'},statuses:{draft:'Draft',review:'In review',approved:'Approved',published:'Published',superseded:'Superseded',archived:'Archived'}}}

export function DocumentsPage(){
 const navigate=useNavigate(),registry=useRegistryMemory('documents'),{role,membership}=useTenant(),{language}=useLanguage();const en=language==='en',typeLabels=labels[language].types,statusLabels=labels[language].statuses
 const {data:rows,loading,error,reload}=useDocumentsData();const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[type,setType]=useState('all'),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[];const canManage=can(role,CAPABILITIES.MANAGE_DOCUMENTS,addOns,custom)
 const filtered=useMemo(()=>rows.filter(x=>(status==='all'||x.status===status)&&(type==='all'||x.type===type)&&`${x.id} ${x.title} ${x.owner||''} ${x.department||''}`.toLowerCase().includes(query.toLowerCase())),[rows,query,status,type])
 useEffect(()=>setPage(1),[query,status,type,pageSize]);const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
 const reviewDue=rows.filter(x=>x.reviewDate&&x.reviewDate<=new Date(Date.now()+30*86400000).toISOString().slice(0,10)&&x.status==='published').length
 function action(a){if(a===UI_ACTIONS.CREATE)navigate('/documents/new')}
 function openDocument(row){registry.openRecord(navigate,`/documents/${row.id}`,row.id,filtered.map(x=>x.id))}
 if(loading)return <RouteLoading/>
 if(error)return <Page title={en?'Documents':'Έγγραφα'}><div className="data-access-state error" role="alert"><span>{en?'Could not load documents.':'Δεν ήταν δυνατή η φόρτωση των εγγράφων.'}</span><button type="button" onClick={()=>reload()}>{en?'Retry':'Επανάληψη'}</button></div></Page>
 return <Page fill title={en?'Documents':'Έγγραφα'} subtitle={en?'Central library of controlled documents, versions and distributions.':'Κεντρική βιβλιοθήκη ελεγχόμενων εγγράφων, εκδόσεων και κοινοποιήσεων.'} actions={<RecordActions actions={canManage?[UI_ACTIONS.CREATE]:[]} resourceCapability={CAPABILITIES.VIEW_DOCUMENTS} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_DOCUMENTS}} onAction={action}/>}>
  <div className="module-summary-strip"><Metric icon={Files} label={en?'Total':'Σύνολο'} value={rows.length}/><Metric icon={FileCheck2} label={en?'Published':'Δημοσιευμένα'} value={rows.filter(x=>x.status==='published').length}/><Metric icon={FileClock} label={en?'Drafts':'Πρόχειρα'} value={rows.filter(x=>x.status==='draft').length}/><Metric icon={BookOpenCheck} label={en?'Review ≤30 days':'Review ≤30 ημέρες'} value={reviewDue}/></div>
  <section className="surface registry-workspace workspace-column workspace-fill"><FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search document, owner or department...':'Αναζήτηση εγγράφου, υπευθύνου ή τμήματος...'} activeAdvancedCount={(status!=='all'?1:0)+(type!=='all'?1:0)} onClear={()=>{setQuery('');setStatus('all');setType('all')}}><FilterSelect label={en?'Type':'Τύπος'} value={type} onChange={setType}><option value="all">{en?'All':'Όλοι'}</option>{Object.entries(typeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</FilterSelect><FilterSelect label={en?'Status':'Κατάσταση'} value={status} onChange={setStatus}><option value="all">{en?'All':'Όλες'}</option>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</FilterSelect></FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{en?'Code':'Κωδικός'}</th><th>{en?'Document':'Έγγραφο'}</th><th>{en?'Type':'Τύπος'}</th><th>{en?'Version':'Έκδοση'}</th><th>{en?'Owner':'Υπεύθυνος'}</th><th>{en?'Department / audience':'Τμήμα / κοινό'}</th><th>Review</th><th>{en?'Status':'Κατάσταση'}</th></tr></thead><tbody>{pagedRows.map(x=><tr key={x.id} {...registry.rowProps(x.id,()=>openDocument(x))}><td><strong>{x.id}</strong></td><td><strong>{x.title}</strong><small>{x.description||'—'}</small></td><td>{typeLabels[x.type]||x.type}</td><td>{x.version||'—'}</td><td>{x.owner||'—'}</td><td>{x.department||'—'}</td><td>{x.reviewDate||'—'}</td><td><span className={`status-badge ${x.status==='published'?'active':x.status==='draft'?'temporary':''}`}>{statusLabels[x.status]||x.status}</span></td></tr>)}</tbody></table>{filtered.length===0&&<div className="inline-empty">{en?'No documents found.':'Δεν βρέθηκαν έγγραφα.'}</div>}</div>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  </section>
 </Page>
}
function Metric({icon:Icon,label,value}){return <MetricCard icon={Icon} value={value} label={label}/>}