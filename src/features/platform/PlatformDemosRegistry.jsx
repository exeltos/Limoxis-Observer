import { useEffect,useMemo,useState } from 'react'
import { FlaskConical,LogIn,ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { BackButton } from '../../design-system/BackButton'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'

export function PlatformDemosRegistry({language='el',query,onQueryChange,demos,onBack,onEnterDemo,onCreate,onOpenDemo}){
 const en=language==='en',tx=(el,enText)=>en?enText:el
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const totalPages=Math.max(1,Math.ceil(demos.length/pageSize)),safePage=Math.min(page,totalPages)
 const pagedDemos=useMemo(()=>demos.slice((safePage-1)*pageSize,safePage*pageSize),[demos,safePage,pageSize])
 useEffect(()=>setPage(1),[query,pageSize]);useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages])
 return <Page title="Demo" subtitle={tx('Απομονωμένο περιβάλλον παρουσίασης. Τα demo δεδομένα υπάρχουν μόνο εδώ και δεν αναμειγνύονται με πραγματικούς οργανισμούς.','Isolated presentation environment. Demo data exists only here and never mixes with production organizations.')} actions={<><Button variant="secondary" className="platform-demo-enter-action" onClick={onEnterDemo}><LogIn size={15}/>{tx('Είσοδος Demo','Enter Demo')}</Button><Button onClick={onCreate}>+ {tx('Νέο Demo','New Demo')}</Button></>}>
  <div className="platform-registry-shell workspace-column"><div className="platform-registry-navigation"><BackButton onClick={onBack} label="Dashboard"/></div><div className="platform-governance"><ShieldCheck size={17}/>{tx('Τα Demo είναι πλήρως απομονωμένα από τα production δεδομένα.','Demo environments are fully isolated from production data.')}</div><FilterBar query={query} onQueryChange={onQueryChange} placeholder={tx('Αναζήτηση Demo…','Search demo…')}/><div className="platform-center-section platform-registry-card workspace-column">{demos.length?<><div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{tx('Demo οργανισμός','Demo organization')}</th><th>{tx('Επικοινωνία','Contact')}</th><th>{tx('Έναρξη','Start')}</th><th>{tx('Λήξη','End')}</th><th>{tx('Κατάσταση','Status')}</th></tr></thead><tbody>{pagedDemos.map(d=><tr key={d.id} tabIndex={0} className="platform-owner-clickable-row" onClick={()=>onOpenDemo(d)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpenDemo(d)}}}><td><strong>{d.organization?.name||d.label}</strong><small>{d.organization?.code||'DEMO'}</small></td><td>{d.contact_name||d.contact_email||'—'}</td><td>{d.valid_from||'—'}</td><td>{d.valid_until||'—'}</td><td><span className={`status-badge ${d.status==='active'?'active':d.status==='paused'?'temporary':'danger'}`}>{d.status==='active'?tx('Ενεργό','Active'):d.status==='paused'?tx('Σε παύση','Paused'):tx('Ανενεργό','Inactive')}</span></td></tr>)}</tbody></table></div><RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={demos.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/></>:<div className="empty-state platform-empty"><FlaskConical size={24}/><strong>{tx('Δεν υπάρχουν Demo προσβάσεις','No demo access records')}</strong><span>{tx('Δεν βρέθηκαν Demo για τα επιλεγμένα φίλτρα.','No demos match the selected filters.')}</span></div>}</div></div>
 </Page>
}
