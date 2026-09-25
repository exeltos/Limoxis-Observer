import { readSessionValue, writeSessionValue } from '../../core/storage/browserStorage'
import { Plus } from 'lucide-react'
import { useEffect,useMemo,useState } from 'react'
import { Page } from '../../design-system/Page'
import { FilterBar } from '../../design-system/FilterBar'
import { Button } from '../../design-system/Button'
import { RegistryPagination } from '../../design-system/RegistryPagination'

export function PlatformOrganizationsRegistry({
  tx,
  query,
  onQueryChange,
  organizations,
  memberCountByOrg,
  hospitalAdminStatusByOrg,
  onCreate,
  onOpenOrganization,
}) {
  const language=tx('el','en')
  const [page,setPage]=useState(1)
  const [pageSize,setPageSize]=useState(15)
  const totalPages=Math.max(1,Math.ceil(organizations.length/pageSize))
  const safePage=Math.min(page,totalPages)
  const pagedOrganizations=useMemo(()=>organizations.slice((safePage-1)*pageSize,safePage*pageSize),[organizations,safePage,pageSize])
  useEffect(()=>setPage(1),[query,pageSize])
  useEffect(()=>{if(page>totalPages)setPage(totalPages)},[page,totalPages])
  // Coming back from an organization record, its row stays highlighted.
  const [lastOpenedId,setLastOpenedId]=useState(()=>readSessionValue('limoxis.registry.platform-organizations.selected','')||'')
  const openOrganization=org=>{const id=String(org.id);writeSessionValue('limoxis.registry.platform-organizations.selected',id);setLastOpenedId(id);onOpenOrganization(org)}

  return (
    <Page
      title={tx('Οργανισμοί', 'Organizations')}
      subtitle={tx(
        'Μητρώο οργανισμών, χρηστών, πρόσβασης και λειτουργικής διαχείρισης.',
        'One registry for organizations, users, access and operational management.'
      )}
      actions={<Button onClick={onCreate}><Plus size={15} />{tx('Νέος οργανισμός', 'New organization')}</Button>}
    >
      <div className="platform-registry-shell">
        <FilterBar
          query={query}
          onQueryChange={onQueryChange}
          placeholder={tx('Αναζήτηση οργανισμού…', 'Search organization…')}
        />
        <div className="platform-center-section platform-registry-card workspace-column">
          {organizations.length ? (
            <>
              <div className="scroll-table">
                <table className="data-table sticky-table">
                  <thead>
                    <tr>
                      <th>{tx('Οργανισμός', 'Organization')}</th>
                      <th>{tx('Κωδικός', 'Code')}</th>
                      <th>{tx('Πόλη / Περιφέρεια', 'City / Region')}</th>
                      <th>{tx('Χρήστες', 'Users')}</th>
                      <th>{tx('Διαχειριστής', 'Hospital admin')}</th>
                      <th>{tx('Κατάσταση', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedOrganizations.map(org => (
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
                          <strong>{org.name}</strong>
                          <small>{({hospital:tx('Νοσοκομείο','Hospital'),clinic:tx('Κλινική','Clinic'),rehab:tx('Κέντρο αποκατάστασης','Rehabilitation center')})[org.type||'hospital']||org.type}</small>
                        </td>
                        <td>{org.code}</td>
                        <td>{org.city || '—'} · {org.region || '—'}</td>
                        <td>{memberCountByOrg[org.id] || 0}</td>
                        <td>
                          {hospitalAdminStatusByOrg[org.id] === 'active' ? (
                            <span className="status-badge active">{tx('Ενεργός', 'Active')}</span>
                          ) : hospitalAdminStatusByOrg[org.id] === 'disabled' ? (
                            <span className="status-badge danger">{tx('Σε παύση', 'Suspended')}</span>
                          ) : hospitalAdminStatusByOrg[org.id] === 'invited' ? (
                            <span className="status-badge temporary">{tx('Εκκρεμής', 'Pending')}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${org.status === 'active' ? 'active' : 'danger'}`}>
                            {org.status === 'active' ? tx('Ενεργός', 'Active') : tx('Σε παύση', 'Suspended')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={organizations.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>
            </>
          ) : (
            <div className="registry-empty-state">
              <strong>{tx('Δεν υπάρχουν οργανισμοί', 'No organizations')}</strong>
              <span>{tx('Δεν βρέθηκαν οργανισμοί για τα επιλεγμένα φίλτρα.', 'No organizations match the selected filters.')}</span>
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}
