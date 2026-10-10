import { useEffect,useState } from 'react'
import { Button } from '../../design-system/Button'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { FilterBar } from '../../design-system/FilterBar'

// Building blocks shared by the employee record tabs: section titles, empty and
// loading states, paging, the registry filter and status labels.
export function SectionTitle({title,subtitle,action}){return <div className="record-section-header"><div><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}
export function Empty({language,title}){return <div className="registry-empty-state employee-registry-empty"><strong>{title||(language==='en'?'No records':'Δεν υπάρχουν εγγραφές')}</strong></div>}
export function State({loading,error,language,onRetry}){if(loading)return <div className="inline-empty">{language==='en'?'Loading…':'Φόρτωση…'}</div>;if(error)return <div className="data-access-state error"><span>{language==='en'?'Could not load this employee data.':'Δεν ήταν δυνατή η φόρτωση των δεδομένων του εργαζομένου.'}</span><Button variant="secondary" onClick={()=>onRetry?.().catch(()=>{})}>{language==='en'?'Retry':'Επανάληψη'}</Button></div>;return null}
function usePaged(rows){const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15);const totalPages=Math.max(1,Math.ceil(rows.length/pageSize)),safePage=Math.min(page,totalPages),paged=rows.slice((safePage-1)*pageSize,safePage*pageSize);useEffect(()=>{if(page!==safePage)setPage(safePage)},[page,safePage]);return {page:safePage,pageSize,totalPages,paged,setPage,setPageSize}}
export function Pager({paging,total,language}){if(!total)return null;return <div className="employee-registry-pagination-slot"><RegistryPagination language={language} page={paging.page} totalPages={paging.totalPages} totalItems={total} pageSize={paging.pageSize} onPageChange={paging.setPage} onPageSizeChange={size=>{paging.setPageSize(size);paging.setPage(1)}}/></div>}
export function RegistryFilter({query,setQuery,language,count}){return <FilterBar query={query} onQueryChange={setQuery} placeholder={language==='en'?'Search records...':'Αναζήτηση εγγραφών...'} activeAdvancedCount={0} onClear={()=>setQuery('')} resultCount={count}/>}
export function useRegistryRows(rows){const [query,setQuery]=useState('');const filtered=query.trim()?rows.filter(row=>JSON.stringify(row).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())):rows;const paging=usePaged(filtered);return {query,setQuery,filtered,paging}}
export function statusClass(status){return ['complete','completed','fit','active','approved'].includes(status)?'active':['renew_soon','pending','scheduled','assigned','in_progress'].includes(status)?'temporary':['overdue','unfit','cancelled','declined'].includes(status)?'danger':''}
export function label(value,t){if(!value)return '—';const camel=String(value).replace(/_([a-z])/g,(_,c)=>c.toUpperCase());for(const key of [value,camel]){const translated=t?.(key);if(translated&&translated!==key)return translated}return value}
export function compactEpisodeCode(value){const code=String(value||'');if(code.startsWith('ESUR-')){const parts=code.split('-');if(parts.length>=3)return `ES-${parts[1]}-${parts.at(-1).slice(-4)}`}return code}
