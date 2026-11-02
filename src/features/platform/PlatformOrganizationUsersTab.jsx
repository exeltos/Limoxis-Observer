import { ShieldCheck, UserPlus, Users } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { roleLabel } from '../../core/permissions/roleLabels'
import { ExportMenu } from '../../design-system/ExportMenu'
import { exportRegistry } from '../../core/export/registryExports'
import { SubTabs } from '../../design-system/SubTabs'
import { BulkAccountsPanel } from './BulkAccountsPanel'

// «Users & Roles» of an organization record: the accounts, or the employee roster with who has no
// account yet. The state and the actions stay in PlatformOrganizationRecord (ctx).
export function PlatformOrganizationUsersTab({ ctx }) {
  const { filteredUsers, language, loadRoster, loadUsers, loadingUsers, onOpenEmployee, pagedUsers, record, roster, rosterLoading, rosterWithoutAccount, safeUserPage, setCreateUserDraft, setCreateUserOpen, setSelectedUserId, setUserPage, setUserPageSize, setUserQuery, setUsersView, tx, userPageSize, userQuery, userTotalPages, users, usersView } = ctx
  return (
          <div className="workspace-column workspace-fill">
            <div className="section-toolbar platform-users-toolbar">
              <div>
                <strong>{tx('Χρήστες & Ρόλοι', 'Users & Roles')}</strong>
                <span>
                  {usersView === 'roster'
                    ? tx(
                        'Λογαριασμοί του νοσοκομείου και εργαζόμενοι του μητρώου που δεν έχουν ακόμη λογαριασμό. Η μαζική δημιουργία γίνεται μόνο από τον Ιδιοκτήτη Πλατφόρμας.',
                        'The hospital accounts and the roster employees who have no account yet. Bulk creation is done only by the Platform Owner.',
                      )
                    : tx(
                        'Επίλεξε έναν χρήστη για πλήρη διαχείριση λογαριασμού, ρόλου και σύνδεσης με εργαζόμενο.',
                        'Select a user to manage the account, role and employee link.',
                      )}
                </span>
              </div>
              {usersView === 'roster' ? (
                <span className="bulk-accounts-owner-only">
                  <ShieldCheck size={13} aria-hidden="true" />
                  {tx('Μόνο Ιδιοκτήτης Πλατφόρμας', 'Platform Owner only')}
                </span>
              ) : (
              <div className="row-actions">
                <ExportMenu
                  items={[
                    {
                      id: 'users',
                      label: tx('Excel: χρήστες', 'Excel: users'),
                      disabled: !users.length,
                      onClick: () =>
                        exportRegistry({
                          name: `${record.code || 'organization'}-${tx('xristes', 'users')}`,
                          headers: [
                            tx('Ονοματεπώνυμο', 'Name'),
                            'Username',
                            'Email',
                            tx('Θέση', 'Job title'),
                            tx('Ρόλος', 'Role'),
                            tx('Κατάσταση', 'Status'),
                          ],
                          rows: users.map(user => [
                            user.name,
                            user.username,
                            user.email,
                            user.jobTitle,
                            roleLabel(user.role, language),
                            user.status === 'active'
                              ? tx('Ενεργός', 'Active')
                              : user.status === 'disabled'
                                ? tx('Σε παύση', 'Suspended')
                                : tx('Εκκρεμής', 'Pending'),
                          ]),
                        }),
                    },
                  ]}
                />
                <Button
                  onClick={() => {
                    setCreateUserDraft({ fullName: '', email: '', role: 'department_user' })
                    setCreateUserOpen(true)
                  }}
                >
                  <UserPlus size={15} />
                  {tx('Νέος χρήστης', 'New user')}
                </Button>
              </div>
              )}
            </div>
            <SubTabs
              ariaLabel={tx('Χρήστες & Ρόλοι', 'Users & Roles')}
              activeId={usersView}
              onChange={setUsersView}
              tabs={[
                { id: 'accounts', label: tx('Λογαριασμοί', 'Accounts'), icon: Users, count: users.length },
                { id: 'roster', label: tx('Εργαζόμενοι χωρίς λογαριασμό', 'Employees without account'), icon: UserPlus, count: rosterWithoutAccount },
              ]}
            />
            {usersView === 'roster' ? (
              <BulkAccountsPanel
                organization={record}
                language={language}
                roster={roster}
                loading={rosterLoading}
                onReload={loadRoster}
                onAccountsChanged={loadUsers}
                onOpenEmployee={onOpenEmployee}
              />
            ) : (
            <section className="surface registry-workspace workspace-column workspace-fill">
              <FilterBar
                query={userQuery}
                onQueryChange={setUserQuery}
                placeholder={tx('Αναζήτηση χρήστη, email ή ρόλου…', 'Search user, email or role…')}
              />
              {loadingUsers ? (
                <div className="inline-empty">{tx('Φόρτωση χρηστών…', 'Loading users…')}</div>
              ) : filteredUsers.length ? (
                <>
                  <div className="scroll-table">
                    <table className="data-table sticky-table">
                      <thead>
                        <tr>
                          <th>{tx('Χρήστης', 'User')}</th>
                          <th>Username</th>
                          <th>{tx('Ρόλος', 'Role')}</th>
                          <th>{tx('Κατάσταση', 'Status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedUsers.map(user => (
                          <tr
                            key={user.userId}
                            tabIndex={0}
                            className="platform-owner-clickable-row"
                            onClick={() => setSelectedUserId(user.userId)}
                            onKeyDown={event => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setSelectedUserId(user.userId)
                              }
                            }}
                          >
                            <td>
                              <strong>{user.name}</strong>
                              <small>{user.email || '—'}</small>
                            </td>
                            <td>{user.username}</td>
                            <td>{roleLabel(user.role, language)}</td>
                            <td>
                              <span
                                className={
                                  'status-badge ' +
                                  (user.status === 'active'
                                    ? 'active'
                                    : user.status === 'disabled'
                                      ? 'danger'
                                      : 'temporary')
                                }
                              >
                                {user.status === 'active'
                                  ? tx('Ενεργός', 'Active')
                                  : user.status === 'disabled'
                                    ? tx('Σε παύση', 'Suspended')
                                    : tx('Εκκρεμής', 'Pending')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <RegistryPagination
                    language={language}
                    page={safeUserPage}
                    totalPages={userTotalPages}
                    totalItems={filteredUsers.length}
                    pageSize={userPageSize}
                    onPageChange={setUserPage}
                    onPageSizeChange={setUserPageSize}
                  />
                </>
              ) : (
                <div className="registry-empty-state">
                  <strong>
                    {users.length
                      ? tx('Δεν βρέθηκαν χρήστες για την αναζήτηση.', 'No users match the search.')
                      : tx('Δεν υπάρχουν χρήστες.', 'No users.')}
                  </strong>
                  <span>
                    {users.length
                      ? ''
                      : tx(
                          'Δημιούργησε τον πρώτο χρήστη από το κουμπί Νέος χρήστης.',
                          'Create the first user with the New user button.',
                        )}
                  </span>
                </div>
              )}
            </section>
            )}
          </div>
  )
}
