import { useEffect,useMemo,useState } from 'react'
import { Building2 } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { BackButton } from '../../design-system/BackButton'
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
  onBack,
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

  return (
    <Page
      title={tx('Οργανισμοί', 'Organizations')}
      subtitle={tx(
        'Ένα registry για οργανισμούς, χρήστες, πρόσβαση και λειτουργική διαχείριση.',
        'One registry for organizations, users, access and operational management.'
      )}
      actions={<Button onClick={onCreate}>+ {tx('Νέος οργανισμός', 'New organization')}</Button>}
    >
      <div className="platform-registry-shell">
        <div className="platform-registry-navigation">
          <BackButton onClick={onBack} label={tx('Dashboard', 'Dashboard')} />
        </div>
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
                      <th>Hospital Admin</th>
                      <th>{tx('Κατάσταση', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedOrganizations.map(org => (
                      <tr
                        key={org.id}
                        tabIndex={0}
                        className="platform-owner-clickable-row"
                        onClick={() => onOpenOrganization(org)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onOpenOrganization(org)
                          }
                        }}
                      >
                        <td>
                          <strong>{org.name}</strong>
                          <small>{org.type || 'hospital'}</small>
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
            <div className="empty-state platform-empty">
              <Building2 size={22} />
              <strong>{tx('Δεν υπάρχουν οργανισμοί', 'No organizations')}</strong>
              <span>{tx('Δεν βρέθηκαν οργανισμοί για τα επιλεγμένα φίλτρα.', 'No organizations match the selected filters.')}</span>
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}
