import { useCallback,useEffect,useMemo,useState } from 'react'
import { AlertTriangle,RefreshCw,ShieldCheck,UserRoundCog } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { BackButton } from '../../design-system/BackButton'
import { IconButton } from '../../design-system/IconButton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { roleLabel } from '../../core/permissions/roleLabels'
import { listPlatformAuditEvents } from './platformAuditService'

function fmtDate(value){
  if(!value)return '—'
  const date=new Date(value)
  if(Number.isNaN(date.getTime()))return value
  const dd=String(date.getDate()).padStart(2,'0')
  const mm=String(date.getMonth()+1).padStart(2,'0')
  const yyyy=date.getFullYear()
  const hh=String(date.getHours()).padStart(2,'0')
  const min=String(date.getMinutes()).padStart(2,'0')
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
}

function eventLabel(value,en){
  const labels={
    create:{el:'Δημιουργία',en:'Created'},update:{el:'Ενημέρωση',en:'Updated'},delete:{el:'Διαγραφή',en:'Deleted'},
    platform_organization_create:{el:'Δημιουργία οργανισμού',en:'Organization created'},platform_organization_update:{el:'Ενημέρωση οργανισμού',en:'Organization updated'},
    platform_organization_delete:{el:'Διαγραφή οργανισμού',en:'Organization deleted'},platform_organization_status:{el:'Αλλαγή κατάστασης οργανισμού',en:'Organization status changed'},
    platform_admin_assign:{el:'Ανάθεση Hospital Admin',en:'Hospital Admin assigned'},platform_admin_invite:{el:'Πρόσκληση Hospital Admin',en:'Hospital Admin invited'},
    platform_settings_update:{el:'Αλλαγή ρυθμίσεων πλατφόρμας',en:'Platform settings changed'},
  }
  return labels[value]?.[en?'en':'el']||String(value||'—').replaceAll('_',' ')
}

function entityLabel(value,en){
  const labels={organization:{el:'Οργανισμός',en:'Organization'},organization_member:{el:'Χρήστης / ρόλος',en:'User / role'},demo_entitlement:{el:'Demo πρόσβαση',en:'Demo access'},profile:{el:'Προφίλ',en:'Profile'},platform_settings:{el:'Ρυθμίσεις πλατφόρμας',en:'Platform settings'}}
  return labels[value]?.[en?'en':'el']||String(value||'—').replaceAll('_',' ')
}

export function PlatformAuditSecurityView({organizations=[],language='el',onBack}){
  const en=language==='en'
  const tx=(elText,enText)=>en?enText:elText
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(null)
  const [query,setQuery]=useState('')
  const [organizationId,setOrganizationId]=useState('all')
  const [eventType,setEventType]=useState('all')
  const organizationMap=useMemo(()=>new Map(organizations.map(org=>[org.id,org])),[organizations])

  const load=useCallback(async()=>{
    setLoading(true);setError(null)
    try{setRows(await listPlatformAuditEvents({limit:750}))}
    catch(err){setRows([]);setError(err)}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{void load()},[load])

  const eventTypes=useMemo(()=>[...new Set(rows.map(row=>row.eventType).filter(Boolean))].sort(),[rows])
  const filtered=useMemo(()=>rows.filter(row=>{
    if(organizationId!=='all'&&row.organizationId!==organizationId)return false
    if(eventType!=='all'&&row.eventType!==eventType)return false
    const needle=query.trim().toLocaleLowerCase(en?'en-US':'el-GR')
    if(!needle)return true
    const org=organizationMap.get(row.organizationId)
    return `${org?.name||''} ${org?.code||''} ${row.actorName} ${row.actorRole} ${row.eventType} ${row.entityType} ${row.entityId}`.toLocaleLowerCase(en?'en-US':'el-GR').includes(needle)
  }),[rows,organizationId,eventType,query,organizationMap,en])

  const ownerActions=rows.filter(row=>row.actorRole==='platform_owner').length
  const destructive=rows.filter(row=>/delete|purge|remove|revoke/i.test(row.eventType)).length
  const accessChanges=rows.filter(row=>/member|user|role|admin|invite|access/i.test(`${row.eventType} ${row.entityType}`)).length

  return <Page title={tx('Audit & Ασφάλεια','Audit & Security')} subtitle={tx('Ιχνηλασιμότητα ενεργειών Platform Owner, αλλαγών πρόσβασης και σημαντικών διοικητικών μεταβολών.','Traceability of Platform Owner actions, access changes and significant administrative changes.')}>
    <div className="platform-registry-shell">
      <div className="platform-registry-navigation"><BackButton onClick={onBack} label={tx('Dashboard','Dashboard')}/></div>
      <div className="platform-section-tools"><IconButton label={tx('Ανανέωση','Refresh')} onClick={load} disabled={loading}><RefreshCw size={16}/></IconButton></div>
      <div className="diagnostics-summary-strip platform-summary-strip">
        <div className="diagnostics-summary"><span>{tx('Καταγεγραμμένες ενέργειες','Recorded actions')}</span><strong>{rows.length}</strong></div>
        <div className="diagnostics-summary"><span>{tx('Ενέργειες Platform Owner','Platform Owner actions')}</span><strong>{ownerActions}</strong></div>
        <div className="diagnostics-summary"><span>{tx('Αλλαγές πρόσβασης','Access changes')}</span><strong>{accessChanges}</strong></div>
        <div className="diagnostics-summary"><span>{tx('Κρίσιμες / διαγραφές','Critical / destructive')}</span><strong>{destructive}</strong></div>
      </div>
      <FilterBar query={query} onQueryChange={setQuery} placeholder={tx('Αναζήτηση οργανισμού, χρήστη ή ενέργειας…','Search organization, user or action…')} activeAdvancedCount={(organizationId!=='all'?1:0)+(eventType!=='all'?1:0)} onClear={()=>{setQuery('');setOrganizationId('all');setEventType('all')}}>
        <FilterSelect label={tx('Οργανισμός','Organization')} value={organizationId} onChange={setOrganizationId}><option value="all">{tx('Όλοι','All')}</option><option value="platform">{tx('Επίπεδο πλατφόρμας','Platform level')}</option>{organizations.map(org=><option key={org.id} value={org.id}>{org.name||org.code}</option>)}</FilterSelect>
        <FilterSelect label={tx('Ενέργεια','Action')} value={eventType} onChange={setEventType}><option value="all">{tx('Όλες','All')}</option>{eventTypes.map(value=><option key={value} value={value}>{eventLabel(value,en)}</option>)}</FilterSelect>
      </FilterBar>
      {loading?<div className="inline-empty">{tx('Φόρτωση audit trail…','Loading audit trail…')}</div>:filtered.length?<div className="table-wrap scroll-table diagnostics-table-wrap"><table className="data-table sticky-table diagnostics-table"><thead><tr><th>{tx('Ημερομηνία / ώρα','Date / time')}</th><th>{tx('Οργανισμός','Organization')}</th><th>{tx('Χρήστης','User')}</th><th>{tx('Ρόλος','Role')}</th><th>{tx('Ενέργεια','Action')}</th><th>{tx('Αντικείμενο','Entity')}</th><th>{tx('Αναγνωριστικό','Identifier')}</th></tr></thead><tbody>{filtered.map(row=>{const org=organizationMap.get(row.organizationId);return <tr key={row.id}><td><strong>{fmtDate(row.createdAt)}</strong></td><td><strong>{org?.name||tx('Επίπεδο πλατφόρμας','Platform level')}</strong><small>{org?.code||'—'}</small></td><td>{row.actorName||'—'}</td><td>{row.actorRole?roleLabel(row.actorRole,language):'—'}</td><td><strong>{eventLabel(row.eventType,en)}</strong></td><td>{entityLabel(row.entityType,en)}</td><td><small>{row.entityId||'—'}</small></td></tr>})}</tbody></table></div>:<div className="inline-empty"><ShieldCheck size={20}/><strong>{tx('Δεν υπάρχουν εγγραφές για τα επιλεγμένα φίλτρα.','No audit records match the selected filters.')}</strong></div>}
      {error&&!loading&&<div className="data-access-state warning" role="status"><AlertTriangle size={16}/><span>{tx('Δεν ήταν δυνατή η φόρτωση του audit trail.','The audit trail could not be loaded.')}</span></div>}
      <div className="platform-governance"><UserRoundCog size={17}/>{tx('Το audit trail είναι μόνο για ανάγνωση. Οι εγγραφές δημιουργούνται από τις ελεγχόμενες λειτουργίες της πλατφόρμας και δεν τροποποιούνται από αυτή την οθόνη.','The audit trail is read-only. Records are created by controlled platform operations and cannot be edited from this workspace.')}</div>
    </div>
  </Page>
}
