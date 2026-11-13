import { readSessionValue, writeSessionValue } from '../../core/storage/browserStorage'
import { Plus, Settings } from 'lucide-react'
import { useEffect,useMemo,useState } from 'react'
import { Page } from '../../design-system/Page'
import { FilterBar } from '../../design-system/FilterBar'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { StatusBadge } from '../../design-system/StatusBadge'
import { ExportMenu } from '../../design-system/ExportMenu'
import { exportRegistry } from '../../core/export/registryExports'
import { listLoginSessions } from './platformAuditService'
import { initialsOf, latestSessionByUser, sinceText, statusOf } from './platformOverviewShared'
import './platformLifecycle.css'
import './platformDashboard.css'
import type { Translate } from '../../types/featureTypes'
import type { LoginSession, PlatformMember } from './platformTypes'
import type { OrganizationRecordRow } from './platformOrganizationShared'

// A membership row as the registry counts it (listPlatformOrganizationMembers), with the person.
type RegistryMember = PlatformMember & { user_id: string }
// Per organization: its members, the Hospital Admin's status and the latest sign-in of any member.
type OrganizationFacts = { total: number, active: number, adminStatus: string | null | undefined, lastSession: LoginSession | null }

// Οργανισμοί (owner, 9/11/2026): as the Overview's hospitals — initials, users active / all, the latest
// sign-in of any of its users and one status; the totals beside the search filter by status.
export function PlatformOrganizationsRegistry({
  tx,
  query,
  onQueryChange,
  organizations,
  members = [],
  onCreate,
  onOpenOrganization,
  onSettings,
}: {
  tx: Translate
  query: string
  onQueryChange: (query: string) => void
  organizations: OrganizationRecordRow[]
  members?: RegistryMember[]
  onCreate?: () => void
  onOpenOrganization: (organization: OrganizationRecordRow) => void
  onSettings?: () => void
}) {
  const language=tx('el','en')
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(15)
  const [statusFilter,setStatusFilter]=useState('')
  const [sessions,setSessions]=useState<LoginSession[]>([])
  useEffect(()=>{let active=true;listLoginSessions({days:90}).then(rows=>{if(active)setSessions(rows||[])}).catch(()=>{if(active)setSessions([])});return()=>{active=false}},[])
  // Per organization: its members, the Hospital Admin's status and the latest sign-in of any member.
  const facts=useMemo(()=>{const latest=latestSessionByUser(sessions),byOrg: Record<string,OrganizationFacts>={};for(const m of members){const item=byOrg[m.organization_id]||(byOrg[m.organization_id]={total:0,active:0,adminStatus:'',lastSession:null});item.total+=1;if(m.status==='active')item.active+=1;if(m.role==='hospital_admin'&&!item.adminStatus)item.adminStatus=m.status;const session=latest.get(m.user_id);if(session&&(!item.lastSession||String(session.startedAt)>String(item.lastSession.startedAt)))item.lastSession=session}return byOrg},[members,sessions])
  const factsOf=(org: OrganizationRecordRow): OrganizationFacts=>facts[org.id]||{total:0,active:0,adminStatus:'',lastSession:null}
  const statusFor=(org: OrganizationRecordRow)=>statusOf(tx,org,factsOf(org).adminStatus)
  const countBy=(key: string)=>organizations.filter(org=>statusFor(org)[2]===key).length
  const shownOrganizations=statusFilter?organizations.filter(org=>statusFor(org)[2]===statusFilter):organizations
  const totalPages=Math.max(1,Math.ceil(shownOrganizations.length/pageSize))
  const safePage=Math.min(page,totalPages)
  const pagedOrganizations=shownOrganizations.slice((safePage-1)*pageSize,safePage*pageSize)
  useEffect(()=>setPage(1),[query,pageSize,statusFilter])
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages])
  // Coming back from an organization record, its row stays highlighted.
  const [lastOpenedId,setLastOpenedId]=useState(()=>readSessionValue('limoxis.registry.platform-organizations.selected','')||'')
  const openOrganization=(org: OrganizationRecordRow)=>{const id=String(org.id);writeSessionValue('limoxis.registry.platform-organizations.selected',id);setLastOpenedId(id);onOpenOrganization(org)}

  const lastSignIn=(session: LoginSession | null)=>session?`${sinceText(session.startedAt,tx)} · ${session.fullName||session.username||'—'}`:'—'
  const toggleStatus=(key: string)=>setStatusFilter(current=>current===key?'':key)
  const totals=[
    {key:'active',value:countBy('active'),always:true,label:tx('ενεργοί','active'),active:statusFilter==='active',onClick:()=>toggleStatus('active')},
    {key:'pending',value:countBy('pending'),always:true,label:tx('εκκρεμεί διαχειριστής','admin pending'),tone:countBy('pending')?'warning':undefined,active:statusFilter==='pending',onClick:()=>toggleStatus('pending')},
    {key:'paused',value:countBy('paused'),always:true,label:tx('σε παύση','paused'),tone:countBy('paused')?'danger':undefined,active:statusFilter==='paused',onClick:()=>toggleStatus('paused')},
    {key:'deletion',value:countBy('deletion'),label:tx('προς διαγραφή','deletion scheduled'),tone:'danger',active:statusFilter==='deletion',onClick:()=>toggleStatus('deletion')},
  ]
  const fmt=(value: string|null|undefined)=>value?new Intl.DateTimeFormat(tx('el-GR','en-GB'),{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):''
  function exportOrganizations(){
    exportRegistry({name:tx('organismoi','organizations'),
      headers:[tx('Οργανισμός','Organization'),tx('Κωδικός','Code'),tx('Πόλη','City'),tx('Περιφέρεια','Region'),tx('Ενεργοί χρήστες','Active users'),tx('Σύνολο χρηστών','All users'),tx('Τελευταία σύνδεση','Last sign-in'),tx('Χρήστης τελευταίας σύνδεσης','Last signed-in user'),tx('Κατάσταση','Status'),tx('Προφίλ λειτουργίας','Operating profile'),tx('Κλείδωμα οθόνης (λεπτά)','Screen lock (minutes)')],
      rows:shownOrganizations.map((org: OrganizationRecordRow)=>{const item=factsOf(org);return [org.name,org.code,org.city||'',org.region||'',item.active,item.total,fmt(item.lastSession?.startedAt),item.lastSession?.fullName||item.lastSession?.username||'',statusFor(org)[1],org.operating_profile||'',org.idle_lock_minutes??'']})})
  }

  return (
    <Page
      title={tx('Οργανισμοί', 'Organizations')}
      actions={<div className="row-actions">{onSettings&&<IconButton label={tx('Ρυθμίσεις οργανισμών','Organization settings')} onClick={onSettings}><Settings size={16}/></IconButton>}<ExportMenu items={[{id:'organizations',label:tx('Excel: οργανισμοί','Excel: organizations'),disabled:!shownOrganizations.length,onClick:exportOrganizations}]}/><Button onClick={onCreate}><Plus size={15} />{tx('Νέος οργανισμός', 'New organization')}</Button></div>}
    >
      <div className="platform-registry-shell">
        <FilterBar
          query={query}
          onQueryChange={onQueryChange}
          placeholder={tx('Αναζήτηση οργανισμού…', 'Search organization…')}
          end={organizations.length ? <RegistryTotals label={tx('Σύνολα οργανισμών', 'Organization totals')} items={totals}/> : null}
        />
        <div className="platform-center-section platform-registry-card workspace-column">
          {shownOrganizations.length ? (
            <>
              <div className="scroll-table">
                <table className="data-table sticky-table">
                  <thead>
                    <tr>
                      <th>{tx('Οργανισμός', 'Organization')}</th>
                      <th>{tx('Χρήστες', 'Users')}</th>
                      <th>{tx('Τελευταία σύνδεση', 'Last sign-in')}</th>
                      <th>{tx('Κατάσταση', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedOrganizations.map((org: OrganizationRecordRow) => {
                      const item = factsOf(org), [tone, label] = statusFor(org)
                      return (
                      <tr
                        key={org.id}
                        tabIndex={0}
                        data-record-id={org.id}
                        className={`platform-owner-clickable-row${lastOpenedId === String(org.id) ? ' registry-row-returned' : ''}`}
                        onClick={() => openOrganization(org)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openOrganization(org)
                          }
                        }}
                      >
                        <td>
                          <div className="platform-overview-org"><span className="platform-overview-avatar" aria-hidden="true">{initialsOf(org.name)}</span><span><strong>{org.name}</strong><small>{[org.code, org.city].filter(Boolean).join(' · ') || '—'}</small></span></div>
                        </td>
                        <td className="platform-overview-num">{item.active} / {item.total}</td>
                        <td className="platform-organizations-last">{lastSignIn(item.lastSession)}</td>
                        <td><StatusBadge tone={tone}>{label}</StatusBadge></td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
              <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={shownOrganizations.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
            </>
          ) : (
            <div className="registry-empty-state">
              <strong>{tx('Δεν υπάρχουν οργανισμοί', 'No organizations')}</strong>
              <span>{organizations.length || query ? tx('Δεν βρέθηκαν οργανισμοί για τα επιλεγμένα φίλτρα.', 'No organizations match the selected filters.') : tx('Δημιουργήστε τον πρώτο με «Νέος οργανισμός».', 'Create the first one with “New organization”.')}</span>
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}
