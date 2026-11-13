import { useState } from 'react'
import { FileUp, Mail, ShieldCheck, UserCheck, UserPlus } from 'lucide-react'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { FilterBar } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { roleLabel } from '../../core/permissions/roleLabels'
import { ExportMenu } from '../../design-system/ExportMenu'
import { exportRegistry } from '../../core/export/registryExports'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { BulkAccountsPanel } from './BulkAccountsPanel'
import { ActiveUsersDialog } from './ActiveUsersDialog'
import { latestSessionByUser } from './platformOverviewShared'
import { USER_STATE_BADGE, UserNameCell, lastSignInContent, userStateLabel } from './PlatformUserCells'
import type { OrganizationMember, OrganizationUsersContext } from './platformOrganizationShared'

// A total beside the search: filter key, label, count, tone and whether it shows at zero.
type TotalRow = [string, string, number, string?, boolean?]

// «Χρήστες» of an organization record: the accounts, or the employee roster with who has no
// account yet. The state and the actions stay in PlatformOrganizationRecord (ctx).
export function PlatformOrganizationUsersTab({ ctx }: { ctx: OrganizationUsersContext }) {
  const { startMode = '', filteredUsers, language, loadRoster, loadUsers, loadingUsers, onOpenEmployee, onlineUserIds, orgUserState, pagedUsers, record, roster, rosterLoading, rosterWithoutAccount, safeUserPage, sessions = [], setCreateUserDraft, setCreateUserOpen, setSelectedUserId, setUserPage, setUserFilter, setUserPageSize, setUserQuery, setUsersView, tx, userFilter, userPageSize, userQuery, userTotalPages, users, usersView } = ctx
  // «Νέος ενεργός χρήστης» / «Εισαγωγή χρηστών από αρχείο»: accounts active at once,
  // with a temporary password the owner hands over (ActiveUsersDialog).
  const [activeUsersMode, setActiveUsersMode] = useState(startMode)
  // The latest sign-in of each user (last 90 days): when and from which IP.
  const latest = latestSessionByUser(sessions)
  // The totals beside the search, as on «Χρήστες πλατφόρμας»: each one filters the list; a second click clears it.
  const counts = users.reduce((acc: Record<string, number>, user: OrganizationMember) => { const state = orgUserState(user); if (state === 'active') acc.active += 1; if (state === 'pending' || state === 'expired') acc.invited += 1; if (state === 'inactive') acc.inactive += 1; if (onlineUserIds.has(user.userId)) acc.online += 1; return acc }, { active: 0, invited: 0, inactive: 0, online: 0 })
  const toggleFilter = (key: string) => setUserFilter(current => (current === key ? 'all' : key))
  const totals = ([['active', tx('ενεργοί', 'active'), counts.active, undefined, true], ['online', tx('συνδεδεμένοι τώρα', 'online now'), counts.online, 'good'], ['invited', tx('εκκρεμείς προσκλήσεις', 'pending invitations'), counts.invited, 'warning'], ['inactive', tx('ανενεργοί', 'inactive'), counts.inactive, 'danger']] satisfies TotalRow[]).map(([key, label, value, tone, always]) => ({ key, label, value, always, tone: value ? tone : undefined, active: userFilter === key, onClick: () => toggleFilter(key) }))
  // Short labels with the count as a small number; the full text stays as the name and tooltip.
  const viewSwitch = (
    <ModeSwitch
      ariaLabel={tx('Χρήστες', 'Users')}
      value={usersView}
      onChange={setUsersView}
      options={[
        { value: 'accounts', label: <>{tx('Λογαριασμοί', 'Accounts')} <small className="platform-org-users-count">{users.length}</small></>, ariaLabel: tx(`Λογαριασμοί (${users.length})`, `Accounts (${users.length})`), title: tx('Λογαριασμοί', 'Accounts') },
        { value: 'roster', label: <>{tx('Χωρίς λογαριασμό', 'No account')} <small className="platform-org-users-count">{rosterWithoutAccount}</small></>, ariaLabel: tx(`Εργαζόμενοι χωρίς λογαριασμό (${rosterWithoutAccount})`, `Employees without an account (${rosterWithoutAccount})`), title: tx('Εργαζόμενοι χωρίς λογαριασμό', 'Employees without an account') },
      ]}
    />
  )
  // The tab carries its name: no inner heading; «Εξαγωγή» and «Νέος χρήστης» sit beside the search, after the totals and the view switch.
  const accountActions = (
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
                          rows: users.map((user: OrganizationMember) => [
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
                {/* One «Νέος χρήστης ▾» (owner, 9/11/2026): active with a temporary password, an e-mail invitation, or a file. */}
                <OverflowMenu
                  label={tx('Νέος χρήστης', 'New user')}
                  triggerTone="primary"
                  width={280}
                  trigger={<><UserPlus size={15} aria-hidden="true" />{tx('Νέος χρήστης', 'New user')}</>}
                  items={[
                    { id: 'active', label: tx('Ενεργός με προσωρινό κωδικό', 'Active, with a temporary password'), icon: UserCheck, onClick: () => setActiveUsersMode('single') },
                    {
                      id: 'invite',
                      label: tx('Πρόσκληση με email', 'Invitation by e-mail'),
                      icon: Mail,
                      onClick: () => {
                        setCreateUserDraft({ fullName: '', email: '', role: 'department_user' })
                        setCreateUserOpen(true)
                      },
                    },
                    { id: 'file', label: tx('Εισαγωγή από αρχείο (Excel/CSV)', 'Import from a file (Excel/CSV)'), icon: FileUp, separatorBefore: true, onClick: () => setActiveUsersMode('file') },
                  ]}
                />
              </div>
  )
  return (
          <div className="workspace-column workspace-fill">
            {/* One row above the frame: the view switch at the left, the actions at the right (Εξαγωγή, then the primary «Νέος χρήστης»). */}
            <div className="platform-org-users-actions">
              {viewSwitch}
              {usersView === 'roster' ? (
                <span className="bulk-accounts-owner-only">
                  <ShieldCheck size={13} aria-hidden="true" />
                  {tx('Μόνο Ιδιοκτήτης Πλατφόρμας', 'Platform Owner only')}
                </span>
              ) : accountActions}
            </div>
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
                end={<>{users.length ? <RegistryTotals label={tx('Σύνολα χρηστών', 'User totals')} items={totals} /> : null}</>}
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
                          <th>{tx('Όνομα χρήστη', 'Username')}</th>
                          <th>{tx('Ρόλος', 'Role')}</th>
                          <th>{tx('Τελευταία σύνδεση', 'Last sign-in')}</th>
                          <th>{tx('Κατάσταση', 'Status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedUsers.map((user: OrganizationMember) => (
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
                            <td><UserNameCell name={user.name} email={user.email} online={onlineUserIds.has(user.userId)} tx={tx} /></td>
                            <td>{user.username && user.username !== '—' ? <code>{user.username}</code> : '—'}</td>
                            <td>{roleLabel(user.role, language)}</td>
                            <td className="platform-users-last">{lastSignInContent(latest.get(user.userId), onlineUserIds.has(user.userId), tx)}</td>
                            <td><span className={`status-badge ${USER_STATE_BADGE[orgUserState(user)]}`}>{userStateLabel(tx, orgUserState(user))}</span></td>
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
            {activeUsersMode && (
              <ActiveUsersDialog
                mode={activeUsersMode}
                organization={record}
                departments={roster.departments || []}
                language={language}
                onClose={() => setActiveUsersMode('')}
                onCreated={() => {
                  loadUsers()
                  loadRoster()
                }}
              />
            )}
          </div>
  )
}
