import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,ClipboardCheck,ExternalLink,FileWarning,Plus,ShieldCheck } from 'lucide-react'
import { ActionButton } from '../../design-system/ActionButton'
import { IconButton } from '../../design-system/IconButton'
import { MetricCard } from '../../design-system/MetricCard'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { loadControlProgramme } from '../controls/controlCloudService'
import { loadBundleAssessments } from '../prevention/bundleCloudService'
import { loadQualityRecords } from './qualityService'
import { capaPrefill,deviationQueue } from './qualityDeviations'

const PERIODS=[30,90,365]

export function useDeviationQueue(organizationId,enabled=true){
 const [sources,setSources]=useState({controls:[],bundles:[],capas:[]})
 const [loading,setLoading]=useState(enabled)
 useEffect(()=>{
  if(!enabled){setLoading(false);return}
  let active=true
  setLoading(true)
  const safe=promise=>promise.catch(()=>[])
  Promise.all([safe(loadControlProgramme(organizationId)),safe(loadBundleAssessments(organizationId)),safe(loadQualityRecords('capas',organizationId))])
   .then(([controls,bundles,capas])=>{if(active)setSources({controls,bundles,capas})})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[organizationId,enabled])
 return {sources,loading}
}

// Filters, period and quick filters of the deviations tab. The page holds
// them so the summary cards above the tabs and the table stay in step.
export function useDeviationView(sources){
 const [days,setDays]=useState(90)
 const [query,setQuery]=useState('')
 const [kind,setKind]=useState('all')
 const [quick,setQuick]=useState(null)
 const all=useMemo(()=>deviationQueue({...sources,days}),[sources,days])
 const filtered=useMemo(()=>all
  .filter(item=>kind==='all'||item.kind===kind)
  .filter(item=>!quick||(quick==='high'?item.priority==='high':item.kind===quick))
  .filter(item=>`${item.title} ${item.titleEn||''} ${item.department||''} ${item.notes||''}`.toLowerCase().includes(query.toLowerCase())),[all,kind,quick,query])
 const counts={total:all.length,control:all.filter(i=>i.kind==='control').length,bundle:all.filter(i=>i.kind==='bundle').length,high:all.filter(i=>i.priority==='high').length}
 return {days,setDays,query,setQuery,kind,setKind,quick,setQuick,all,filtered,counts}
}

// The same summary row as the other Quality tabs, so the tabs do not move.
export function DeviationSummary({view,language}){
 const en=language==='en'
 const toggle=key=>()=>view.setQuick(current=>current===key?null:key)
 return <div className="workspace-summary quality-summary"><div className="module-summary-strip">
  <MetricCard icon={FileWarning} value={view.counts.total} label={en?'Without CAPA':'Χωρίς CAPA'} onClick={()=>view.setQuick(null)} active={false}/>
  <MetricCard icon={ClipboardCheck} value={view.counts.control} label={en?'From controls':'Από ελέγχους'} onClick={toggle('control')} active={view.quick==='control'}/>
  <MetricCard icon={ShieldCheck} value={view.counts.bundle} label={en?'From bundles':'Από bundles'} onClick={toggle('bundle')} active={view.quick==='bundle'}/>
  <MetricCard icon={AlertTriangle} value={view.counts.high} label={en?'High priority':'Υψηλής προτεραιότητας'} onClick={toggle('high')} active={view.quick==='high'}/>
 </div></div>
}

export function deviationsExport(items,{en,t}){
 return {
  name:en?'deviations-without-capa':'apokliseis-xoris-capa',
  headers:en?['Date','Source','Deviation','Notes','Department','Result','Priority']:['Ημερομηνία','Πηγή','Απόκλιση','Σημειώσεις','Τμήμα','Αποτέλεσμα','Προτεραιότητα'],
  rows:items.map(item=>[String(item.at||'').slice(0,16).replace('T',' '),item.kind==='control'?(en?'Control':'Έλεγχος'):'Bundle',en?item.titleEn||item.title:item.title,item.notes||'',item.department||'',item.kind==='bundle'?(en?`${item.detail} criteria not met`:`${item.detail} κριτήρια δεν τηρήθηκαν`):(item.detail||''),t(item.priority)]),
 }
}

export function QualityDeviationQueue({view,loading,language,locale,t,onCreateCapa}){
 const en=language==='en'
 const {goTo}=useContextualNavigation('/quality')
 const [page,setPage]=useState(1)
 const [pageSize,setPageSize]=useState(15)
 const items=view.filtered
 useEffect(()=>setPage(1),[view.query,view.kind,view.quick,view.days,pageSize])
 const totalPages=Math.max(1,Math.ceil(items.length/pageSize)),safePage=Math.min(page,totalPages),pagedItems=items.slice((safePage-1)*pageSize,safePage*pageSize)
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:String(v).length>10?'short':undefined,hour12:false}).format(new Date(v)):'—'
 return <>
  <FilterBar query={view.query} onQueryChange={view.setQuery} placeholder={en?'Search deviations...':'Αναζήτηση αποκλίσεων...'} activeAdvancedCount={(view.kind!=='all'?1:0)+(view.days!==90?1:0)} onClear={()=>{view.setQuery('');view.setKind('all');view.setDays(90)}}>
   <FilterSelect label={en?'Period':'Περίοδος'} value={String(view.days)} onChange={value=>view.setDays(Number(value))}>{PERIODS.map(value=><option key={value} value={value}>{en?`Last ${value} days`:`Τελευταίες ${value} ημέρες`}</option>)}</FilterSelect>
   <FilterSelect label={en?'Source':'Πηγή'} value={view.kind} onChange={view.setKind}><option value="all">{en?'All':'Όλες'}</option><option value="control">{en?'Controls':'Έλεγχοι'}</option><option value="bundle">Bundles</option></FilterSelect>
  </FilterBar>
  <div className="scroll-table">
   <table className="data-table sticky-table quality-deviation-table">
    <thead><tr><th>{en?'Date':'Ημερομηνία'}</th><th>{en?'Source':'Πηγή'}</th><th>{en?'Deviation':'Απόκλιση'}</th><th>{t('department')}</th><th>{en?'Result':'Αποτέλεσμα'}</th><th>{t('priority')}</th><th className="quality-deviation-actions-col" aria-label={en?'Actions':'Ενέργειες'}/></tr></thead>
    <tbody>{pagedItems.map(item=>{const Icon=item.kind==='control'?ClipboardCheck:ShieldCheck;return <tr key={item.key}>
     <td className="nowrap-cell">{fmt(item.at)}</td>
     <td><span className="quality-deviation-kind"><Icon size={14} aria-hidden="true"/>{item.kind==='control'?(en?'Control':'Έλεγχος'):'Bundle'}</span></td>
     <td><strong>{en?item.titleEn:item.title}</strong>{item.notes&&<small>{item.notes}</small>}</td>
     <td>{item.department||'—'}</td>
     <td>{item.kind==='bundle'?(en?`${item.detail} criteria not met`:`${item.detail} κριτήρια δεν τηρήθηκαν`):(item.detail||(en?'Non-compliant':'Μη συμμόρφωση'))}</td>
     <td><span className={`status-badge ${item.priority==='high'?'danger':''}`}>{t(item.priority)}</span></td>
     <td className="quality-deviation-actions-col"><div className="row-actions">
      <IconButton size="sm" label={en?'Open source record':'Άνοιγμα εγγραφής προέλευσης'} onClick={()=>goTo(item.path,{returnTo:'/quality'})}><ExternalLink size={15}/></IconButton>
      <ActionButton tone="primary" label={en?'Create CAPA':'Δημιουργία CAPA'} onClick={()=>onCreateCapa(capaPrefill(item,language))}><Plus size={15}/><span>{en?'Create CAPA':'Δημιουργία CAPA'}</span></ActionButton>
     </div></td>
    </tr>})}</tbody>
   </table>
   {loading&&<div className="registry-empty-state"><strong>{en?'Loading deviations…':'Φόρτωση αποκλίσεων…'}</strong></div>}
   {!loading&&!items.length&&<div className="registry-empty-state"><strong>{en?'No deviations without a CAPA':'Δεν υπάρχουν αποκλίσεις χωρίς CAPA'}</strong><span>{en?'Control entries with a finding and failed bundle criteria appear here until a CAPA is created from them.':'Εδώ εμφανίζονται καταχωρήσεις ελέγχων με εύρημα και bundles με κριτήρια που δεν τηρήθηκαν, μέχρι να δημιουργηθεί CAPA από αυτά.'}</span></div>}
  </div>
  <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={items.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
 </>
}
