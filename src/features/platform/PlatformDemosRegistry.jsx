import { readSessionValue, writeSessionValue } from '../../core/storage/browserStorage'
import { useEffect,useMemo,useState } from 'react'
import { ShieldCheck,Plus,Trash2 } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { DownloadMenu } from '../../design-system/DownloadMenu'
import { exportRegistry } from '../../core/export/registryExports'
import { OrganizationDeleteDialog } from './OrganizationDeleteDialog'
import { loadDemoOrganizationsWithNewRequests } from '../demo/demoEvaluationService'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import './platformDeletion.css'
import '../demo/demoEvaluation.css'

function daysBetween(a,b){return Math.max(0,Math.ceil((new Date(b)-new Date(a))/86400000))}
const fmtDay=(value,language)=>value?new Intl.DateTimeFormat(language==='en'?'en-GB':'el-GR').format(new Date(`${String(value).slice(0,10)}T12:00:00`)):'—'
function demoProgress(item){const today=new Date().toISOString().slice(0,10),total=Math.max(1,daysBetween(item.valid_from,item.valid_until)),remaining=daysBetween(today,item.valid_until);return{remaining,pct:Math.max(0,Math.min(100,Math.round((remaining/total)*100)))}}
// The state a Demo is really in: an "active" entitlement past its end date has expired.
const DEMO_EXPIRING_DAYS=7
export function demoState(item){if(item.status==='paused')return 'paused';if(item.status!=='active')return 'expired';const remaining=demoProgress(item).remaining;if(remaining<=0)return 'expired';return remaining<=DEMO_EXPIRING_DAYS?'expiring':'active'}
const STATE_BADGE={active:'active',expiring:'warning',paused:'',expired:'danger'}

export function PlatformDemosRegistry({language='el',query,onQueryChange,demos,onCreate,onOpenDemo,onDeleted}){
  // Coming back from a demo record, its row stays highlighted.
  const [lastOpenedId,setLastOpenedId]=useState(()=>readSessionValue('limoxis.registry.platform-demos.selected','')||'')
  const openDemo=d=>{const id=String(d.id);writeSessionValue('limoxis.registry.platform-demos.selected',id);setLastOpenedId(id);onOpenDemo(d)}
 const en=language==='en',tx=(el,enText)=>en?enText:el
 const stateLabel=state=>({active:tx('Ενεργό','Active'),expiring:tx('Λήγει σύντομα','Expiring soon'),paused:tx('Σε παύση','Paused'),expired:tx('Έληξε','Expired')})[state]
 const [stateFilter,setStateFilter]=useState('all'),[selectedIds,setSelectedIds]=useState([]),[deleteTargets,setDeleteTargets]=useState(null)
 // Demo whose evaluator pressed "I want the application" (request still new).
 const [interested,setInterested]=useState(()=>new Set())
 useEffect(()=>{let active=true;if(isOwnerPreview())return undefined;loadDemoOrganizationsWithNewRequests().then(ids=>{if(active)setInterested(new Set(ids))}).catch(()=>{});return ()=>{active=false}},[demos])
 const counts=useMemo(()=>demos.reduce((a,d)=>{a[demoState(d)]+=1;return a},{active:0,expiring:0,paused:0,expired:0}),[demos])
 const visibleDemos=useMemo(()=>stateFilter==='all'?demos:stateFilter==='interested'?demos.filter(d=>interested.has(d.organization_id)):demos.filter(d=>demoState(d)===stateFilter),[demos,stateFilter,interested])
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const totalPages=Math.max(1,Math.ceil(visibleDemos.length/pageSize)),safePage=Math.min(page,totalPages)
 const pagedDemos=useMemo(()=>visibleDemos.slice((safePage-1)*pageSize,safePage*pageSize),[visibleDemos,safePage,pageSize])
 useEffect(()=>setPage(1),[query,pageSize,stateFilter]);useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages])
 // Selection survives paging but drops Demo that are no longer listed.
 useEffect(()=>{setSelectedIds(current=>current.filter(id=>demos.some(d=>String(d.id)===id)))},[demos])
 const selectable=d=>Boolean(d.organization_id)
 const selectedDemos=demos.filter(d=>selectedIds.includes(String(d.id)))
 const pageSelectable=pagedDemos.filter(selectable),allPageSelected=pageSelectable.length>0&&pageSelectable.every(d=>selectedIds.includes(String(d.id)))
 const toggle=d=>{const id=String(d.id);setSelectedIds(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id])}
 const togglePage=()=>{const ids=pageSelectable.map(d=>String(d.id));setSelectedIds(current=>allPageSelected?current.filter(id=>!ids.includes(id)):[...new Set([...current,...ids])])}
 const allSelectedExpired=selectedDemos.length>0&&selectedDemos.every(d=>demoState(d)==='expired')
 function requestDelete(){setDeleteTargets(selectedDemos.map(d=>({id:d.organization_id,name:d.organization?.name||d.label,code:d.organization?.code||'',is_demo:true})))}
 async function handleDeleted(organizationIds){setDeleteTargets(null);setSelectedIds(current=>current.filter(id=>!demos.some(d=>String(d.id)===id&&organizationIds.includes(d.organization_id))));await onDeleted?.(organizationIds)}
 const chips=[['all',tx('Όλα','All'),demos.length],['active',tx('Ενεργά','Active'),counts.active],['expiring',tx(`Λήγουν ≤ ${DEMO_EXPIRING_DAYS} ημ.`,`Expiring ≤ ${DEMO_EXPIRING_DAYS} d`),counts.expiring],['expired',tx('Έληξαν','Expired'),counts.expired],['paused',tx('Σε παύση','Paused'),counts.paused],...(interested.size?[['interested',tx('Θέλουν την εφαρμογή','Want the application'),demos.filter(d=>interested.has(d.organization_id)).length]]:[])]
 return <Page title="Demo" subtitle={tx('Απομονωμένο περιβάλλον παρουσίασης. Τα demo δεδομένα υπάρχουν μόνο εδώ και δεν αναμειγνύονται με πραγματικούς οργανισμούς.','Isolated presentation environment. Demo data exists only here and never mixes with production organizations.')} actions={<div className="row-actions"><DownloadMenu items={[{id:'demos',label:tx('Excel: demo','Excel: demos'),disabled:!demos.length,onClick:()=>exportRegistry({name:'demo',headers:[tx('Demo οργανισμός','Demo organization'),tx('Κωδικός','Code'),tx('Επαφή','Contact'),'Email',tx('Έναρξη','Start'),tx('Λήξη','End'),tx('Υπόλοιπο ημερών','Days left'),tx('Κατάσταση','Status')],rows:demos.map(d=>[d.organization?.name||d.label,d.organization?.code||'',d.contact_name||'',d.contact_email||'',fmtDay(d.valid_from,language),fmtDay(d.valid_until,language),demoProgress(d).remaining,stateLabel(demoState(d))])})}]}/><Button onClick={onCreate}><Plus size={15}/>{tx('Νέο Demo','New Demo')}</Button></div>}>
  <div className="platform-registry-shell workspace-column"><div className="platform-governance"><ShieldCheck size={17}/>{tx('Τα Demo είναι πλήρως απομονωμένα από τα πραγματικά δεδομένα.','Demo environments are fully isolated from production data.')}</div><FilterBar query={query} onQueryChange={onQueryChange} placeholder={tx('Αναζήτηση Demo…','Search demo…')}/><div className="platform-demo-status-chips" role="group" aria-label={tx('Φίλτρο κατάστασης','Status filter')}>{chips.map(([value,label,count])=><button key={value} type="button" className={`platform-demo-status-chip${stateFilter===value?' is-active':''}`} aria-pressed={stateFilter===value} onClick={()=>setStateFilter(value)}>{label}<b>{count}</b></button>)}</div><div className="platform-center-section platform-registry-card workspace-column">{selectedDemos.length>0&&<div className="platform-demo-bulk-frame"><div className="platform-demo-bulk-bar" role="region" aria-label={tx('Επιλεγμένα Demo','Selected Demo')}><span><strong>{tx(`${selectedDemos.length} επιλεγμένα`,`${selectedDemos.length} selected`)}</strong>{allSelectedExpired&&<small>{tx('· όλα έχουν λήξει','· all expired')}</small>}</span><span className="platform-demo-bulk-spacer"/><Button variant="secondary" onClick={()=>setSelectedIds([])}>{tx('Καθαρισμός','Clear')}</Button><Button variant="danger" className="button-destructive" onClick={requestDelete}><Trash2 size={15}/>{tx(`Διαγραφή επιλεγμένων (${selectedDemos.length})`,`Delete selected (${selectedDemos.length})`)}</Button></div></div>}{visibleDemos.length?<><div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th className="platform-demo-select-cell"><input type="checkbox" checked={allPageSelected} disabled={!pageSelectable.length} onChange={togglePage} aria-label={tx('Επιλογή όλων στη σελίδα','Select all on this page')}/></th><th>{tx('Demo οργανισμός','Demo organization')}</th><th>{tx('Επικοινωνία','Contact')}</th><th>{tx('Έναρξη','Start')}</th><th>{tx('Λήξη / υπόλοιπο','End / remaining')}</th><th>{tx('Κατάσταση','Status')}</th></tr></thead><tbody>{pagedDemos.map(d=>{const progress=demoProgress(d),state=demoState(d),warning=state==='expiring'||state==='expired',checked=selectedIds.includes(String(d.id));return <tr key={d.id} tabIndex={0} data-record-id={d.id} className={`platform-owner-clickable-row${lastOpenedId===String(d.id)?' registry-row-returned':''}${checked?' is-selected':''}`} onClick={()=>openDemo(d)} onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();openDemo(d)}}}><td className="platform-demo-select-cell" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={checked} disabled={!selectable(d)} onChange={()=>toggle(d)} aria-label={tx(`Επιλογή ${d.organization?.name||d.label}`,`Select ${d.organization?.name||d.label}`)}/></td><td><strong>{d.organization?.name||d.label}{interested.has(d.organization_id)&&<span className="demo-interest-badge">{tx('Θέλει την εφαρμογή','Wants the application')}</span>}</strong><small>{d.organization?.code||'DEMO'}</small></td><td>{d.contact_name||d.contact_email||'—'}</td><td>{fmtDay(d.valid_from,language)}</td><td><strong>{fmtDay(d.valid_until,language)}</strong><div style={{width:150,maxWidth:'100%',height:6,marginTop:7,borderRadius:999,overflow:'hidden',background:'var(--lo-shell-control-hover)'}}><span style={{display:'block',width:`${progress.pct}%`,height:'100%',borderRadius:'inherit',background:warning?'var(--lo-status-warning-fg)':'var(--lo-color-primary)'}}/></div><small style={{marginTop:5,color:warning?'var(--lo-status-warning-fg)':'var(--lo-color-muted)',fontWeight:700}}>{state==='expired'?tx('Έληξε','Expired'):`${progress.remaining} ${tx('ημέρες υπόλοιπο','days remaining')}`}</small></td><td><span className={`status-badge ${STATE_BADGE[state]}`}>{stateLabel(state)}</span></td></tr>})}</tbody></table></div><RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={visibleDemos.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/></>:<div className="registry-empty-state"><strong>{tx('Δεν υπάρχουν Demo προσβάσεις','No demo access records')}</strong><span>{tx('Δεν βρέθηκαν Demo για τα επιλεγμένα φίλτρα.','No demos match the selected filters.')}</span></div>}</div></div>
  {deleteTargets&&<OrganizationDeleteDialog organizations={deleteTargets} language={language} onClose={()=>setDeleteTargets(null)} onDeleted={handleDeleted}/>}
 </Page>
}
