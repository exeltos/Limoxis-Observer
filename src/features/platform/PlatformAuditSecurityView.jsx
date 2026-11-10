import './platformDashboard.css'
import { useCallback,useEffect,useMemo,useState } from 'react'
import { AlertTriangle,RefreshCw } from 'lucide-react'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { Page } from '../../design-system/Page'
import { IconButton } from '../../design-system/IconButton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { ExportMenu } from '../../design-system/ExportMenu'
import { exportRegistry } from '../../core/export/registryExports'
import { roleLabel } from '../../core/permissions/roleLabels'
import { listPlatformAuditEvents } from './platformAuditService'
import { athensDateTime } from './platformOverviewShared'
import { describeAuditGroup,entityLabel,eventLabel,groupAuditEvents } from './auditTrailModel'
import { RecordLink } from './RecordLink'
import { useRecordLinks,usePlatformUsers } from './useRecordLinks'

// dd/mm/yyyy, hh:mm in Athens time, as on every owner list.
export const fmtDate=athensDateTime

export { eventLabel,entityLabel }

export function PlatformAuditSecurityView({organizations=[],language='el',tabs=null}){
  const en=language==='en'
  const tx=(elText,enText)=>en?enText:elText
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(null)
  const [query,setQuery]=useState('')
  const [organizationId,setOrganizationId]=useState('all')
  const [eventType,setEventType]=useState('all')
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(15)
  const organizationMap=useMemo(()=>new Map(organizations.map(org=>[org.id,org])),[organizations])
  // The person who acted, the organization and the user or organization an action was about open their records; Back returns here.
  const users=usePlatformUsers()
  const {userOf,openUser,canOpenOrganization,openOrganization}=useRecordLinks({users})
  const userLink=(ref,label)=>{const person=userOf(ref);return person?<RecordLink title={tx('Άνοιγμα καρτέλας χρήστη','Open user record')} onClick={()=>openUser(person)}>{label}</RecordLink>:label}
  const organizationLink=(id,label)=>canOpenOrganization(id)?<RecordLink title={tx('Άνοιγμα καρτέλας οργανισμού','Open organization record')} onClick={()=>openOrganization(id)}>{label}</RecordLink>:label
  const names={organization:id=>organizationMap.get(id)?.name||'',user:ref=>userOf(ref)?.name||''}
  const entityLink=(row,label=entityLabel(row.entityType,en))=>{if(row.entityType==='organization')return organizationLink(row.entityId,label);if(row.entityType==='organization_member'||row.entityType==='profile')return userLink({userId:row.entityId,memberId:row.entityId},label);return label}

  const load=useCallback(async()=>{
    setLoading(true);setError(null)
    try{setRows(await listPlatformAuditEvents({limit:750}))}
    catch(err){setRows([]);setError(err)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{void load()},[load])

  const eventTypes=useMemo(()=>[...new Set(rows.map(row=>row.eventType).filter(Boolean))].sort(),[rows])
  const filtered=useMemo(()=>rows.filter(row=>{
    // Platform-level rows have no organization (including those of deleted organizations).
    if(organizationId==='platform'?Boolean(row.organizationId):organizationId!=='all'&&row.organizationId!==organizationId)return false
    if(eventType!=='all'&&row.eventType!==eventType)return false
    const needle=query.trim().toLocaleLowerCase(en?'en-US':'el-GR')
    if(!needle)return true
    const org=organizationMap.get(row.organizationId)
    return `${org?.name||row.metadata?.organization_name||''} ${org?.code||row.metadata?.organization_code||''} ${row.actorName} ${row.actorRole} ${row.eventType} ${row.entityType} ${row.entityId}`.toLocaleLowerCase(en?'en-US':'el-GR').includes(needle)
  }),[rows,organizationId,eventType,query,organizationMap,en])
  // Identical consecutive actions of one person within 15 minutes are one row with a count.
  const groups=useMemo(()=>groupAuditEvents([...filtered].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))),[filtered])
  const totalPages=Math.max(1,Math.ceil(groups.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=groups.slice((safePage-1)*pageSize,safePage*pageSize)
  useEffect(()=>setPage(1),[query,organizationId,eventType,pageSize])
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages])

  const ownerActions=rows.filter(row=>row.actorRole==='platform_owner').length
  const destructive=rows.filter(row=>/delete|purge|remove|revoke/i.test(row.eventType)).length
  const accessChanges=rows.filter(row=>/member|user|role|admin|invite|access/i.test(`${row.eventType} ${row.entityType}`)).length

  return <Page title={tx('Ιστορικό & Υγεία','History & Health')} actions={<div className="row-actions"><ExportMenu items={[{id:'audit',label:tx('Excel: ιστορικό ενεργειών','Excel: audit trail'),disabled:!filtered.length,onClick:()=>exportRegistry({name:tx('istoriko-energeion','audit-trail'),headers:[tx('Ημερομηνία / ώρα','Date / time'),tx('Οργανισμός','Organization'),tx('Χρήστης','User'),tx('Ρόλος','Role'),tx('Ενέργεια','Action'),tx('Αντικείμενο','Entity'),tx('Αναγνωριστικό','Identifier')],rows:filtered.map(row=>{const org=organizationMap.get(row.organizationId);return [fmtDate(row.createdAt),org?.name||tx('Επίπεδο πλατφόρμας','Platform level'),row.actorName||'',row.actorRole?roleLabel(row.actorRole,language):'',eventLabel(row.eventType,en),entityLabel(row.entityType,en),row.entityId||'']})})}]}/><IconButton label={tx('Ανανέωση','Refresh')} onClick={load} disabled={loading}><RefreshCw size={16}/></IconButton></div>}>
    {tabs}
    <div className="platform-registry-shell workspace-column">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={tx('Αναζήτηση οργανισμού, χρήστη ή ενέργειας…','Search organization, user or action…')} end={rows.length?<RegistryTotals label={tx('Σύνολα ιστορικού','History totals')} items={[{key:'all',value:rows.length,always:true,label:tx('ενέργειες','actions')},{key:'owner',value:ownerActions,label:tx('του Ιδιοκτήτη','by the Owner')},{key:'access',value:accessChanges,label:tx('αλλαγές πρόσβασης','access changes')},{key:'destructive',value:destructive,label:tx('διαγραφές','deletions'),tone:'danger'}]}/>:null} activeAdvancedCount={(organizationId!=='all'?1:0)+(eventType!=='all'?1:0)} onClear={()=>{setQuery('');setOrganizationId('all');setEventType('all')}}>
        <FilterSelect label={tx('Οργανισμός','Organization')} value={organizationId} onChange={setOrganizationId}><option value="all">{tx('Όλοι','All')}</option><option value="platform">{tx('Επίπεδο πλατφόρμας','Platform level')}</option>{organizations.map(org=><option key={org.id} value={org.id}>{org.name||org.code}</option>)}</FilterSelect>
        <FilterSelect label={tx('Ενέργεια','Action')} value={eventType} onChange={setEventType}><option value="all">{tx('Όλες','All')}</option>{eventTypes.map(value=><option key={value} value={value}>{eventLabel(value,en)}</option>)}</FilterSelect>
      </FilterBar>
      {loading?<div className="inline-empty">{tx('Φόρτωση ιστορικού ενεργειών…','Loading audit trail…')}</div>:filtered.length?<><div className="table-wrap scroll-table diagnostics-table-wrap"><table className="data-table sticky-table diagnostics-table"><thead><tr><th>{tx('Ημερομηνία / ώρα','Date / time')}</th><th>{tx('Οργανισμός','Organization')}</th><th>{tx('Χρήστης','User')}</th><th>{tx('Ρόλος','Role')}</th><th>{tx('Ενέργεια','Action')}</th><th>{tx('Αντικείμενο','Entity')}</th></tr></thead><tbody>{pagedRows.map(group=>{const row=group.rows[0],org=organizationMap.get(group.organizationId),text=describeAuditGroup(group,{en,names});return <tr key={group.id}><td><strong>{fmtDate(group.to)}</strong>{text.when&&<small>{text.when}</small>}</td><td><strong>{organizationLink(group.organizationId,org?.name||group.metadata?.organization_name||tx('Επίπεδο πλατφόρμας','Platform level'))}</strong><small>{org?.code||group.metadata?.organization_code||'—'}</small></td><td>{group.actorRole==='platform_owner'?(group.actorName||'—'):userLink({userId:group.actorId},group.actorName||'—')}</td><td>{group.actorRole?roleLabel(group.actorRole,language):'—'}</td><td><strong>{text.action}</strong></td><td title={text.technical||undefined}>{group.count===1?entityLink(row,text.entity):text.entity}{text.name&&<small>{text.name}</small>}</td></tr>})}</tbody></table></div><RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={groups.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/></>:<div className="registry-empty-state"><strong>{tx('Δεν υπάρχουν εγγραφές για τα επιλεγμένα φίλτρα.','No audit records match the selected filters.')}</strong></div>}
      {error&&!loading&&<div className="data-access-state warning" role="status"><AlertTriangle size={16}/><span>{tx('Δεν ήταν δυνατή η φόρτωση του ιστορικού ενεργειών.','The audit trail could not be loaded.')}</span></div>}
    </div>
  </Page>
}
