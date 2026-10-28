import { KeyRound, Link2, PauseCircle, Pencil, PlayCircle, Save, Trash2, X } from 'lucide-react'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { ActionButton } from '../../design-system/ActionButton'
import { roleLabel } from '../../core/permissions/roleLabels'
import { SupplierRenewalSenderField } from '../quality/resources/SupplierRenewalSenderField'
import { InvitationLinkDialog } from './InvitationLinkDialog'
import { ROLES } from './platformOrganizationShared'

// The record of one user of the organization (opened from «Users & Roles»). The state and the
// actions stay in PlatformOrganizationRecord (ctx).
export function PlatformOrganizationUserRecord({ ctx }) {
  const { deleteSelectedUser, employeeLinkDrafts, employeeOptions, invitationLink, language, linkUserEmployee, organization, resetUserAccess, saveSelectedUser, selectedEmployee, selectedUser, setEmployeeLinkDrafts, setInvitationLink, setSelectedUserId, setUserDraft, setUserEditing, showInvitationLink, toggleSelectedUserStatus, tx, userDraft, userEditing, working } = ctx
    const initials =
      (selectedUser.name || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase() || 'U'
    return (
      <>
      <EntityRecordShell
        className="platform-owner-record-shell platform-user-record-shell workspace-fill"
        avatar={initials}
        eyebrow={tx('ΧΡΗΣΤΗΣ ΟΡΓΑΝΙΣΜΟΥ', 'ORGANIZATION USER')}
        title={selectedUser.name}
        subtitle={(selectedUser.email || '—') + ' · ' + (selectedUser.username || '—')}
        status={
          <span
            className={
              'status-badge ' +
              (selectedUser.status === 'active'
                ? 'active'
                : selectedUser.status === 'disabled'
                  ? 'danger'
                  : 'temporary')
            }
          >
            {selectedUser.status === 'active'
              ? tx('Ενεργός', 'Active')
              : selectedUser.status === 'disabled'
                ? tx('Σε παύση', 'Suspended')
                : tx('Εκκρεμής', 'Pending')}
          </span>
        }
        onBack={() => setSelectedUserId('')}
        backLabel={tx('Πίσω', 'Back')}
        headerActions={
          <div className="platform-user-record-header-actions">
            {!userEditing ? (
              <ActionButton
                tone="edit"
                label={tx('Επεξεργασία', 'Edit')}
                onClick={() => setUserEditing(true)}
              >
                <Pencil size={15} />
                <span>{tx('Επεξεργασία', 'Edit')}</span>
              </ActionButton>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setUserDraft({
                      fullName: selectedUser.name || '',
                      email: selectedUser.email || '',
                      phone: selectedUser.phone || '',
                      jobTitle: selectedUser.jobTitle || '',
                      role: selectedUser.role || '',
                    })
                    setUserEditing(false)
                  }}
                >
                  <X size={15} />
                  {tx('Ακύρωση', 'Cancel')}
                </Button>
                <Button disabled={working} onClick={saveSelectedUser}>
                  <Save size={15} />
                  {tx('Αποθήκευση', 'Save')}
                </Button>
              </>
            )}
            <ActionButton
              tone="danger"
              label={tx('Διαγραφή', 'Delete')}
              disabled={working}
              onClick={deleteSelectedUser}
            >
              <Trash2 size={15} />
              <span>{tx('Διαγραφή', 'Delete')}</span>
            </ActionButton>
          </div>
        }
      >
        <div className="platform-user-record-workspace">
          <section className="platform-user-record-section">
            <div className="platform-user-record-section-heading">
              <div>
                <strong>{tx('Στοιχεία χρήστη', 'User details')}</strong>
                <span>
                  {tx(
                    'Στοιχεία ταυτότητας και επικοινωνίας του λογαριασμού.',
                    'Identity and contact details for this account.',
                  )}
                </span>
              </div>
            </div>
            <div className="platform-user-record-grid">
              <label className="field">
                <span>{tx('Ονοματεπώνυμο', 'Full name')}</span>
                <input
                  value={userDraft.fullName}
                  readOnly={!userEditing}
                  onChange={e => setUserDraft(x => ({ ...x, fullName: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={userDraft.email}
                  readOnly={!userEditing}
                  onChange={e => setUserDraft(x => ({ ...x, email: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Username</span>
                <input value={selectedUser.username || '—'} readOnly />
              </label>
              <label className="field">
                <span>{tx('Τηλέφωνο', 'Phone')}</span>
                <input
                  value={userDraft.phone}
                  readOnly={!userEditing}
                  onChange={e => setUserDraft(x => ({ ...x, phone: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>{tx('Θέση / Ιδιότητα', 'Job title')}</span>
                <input
                  value={userDraft.jobTitle}
                  readOnly={!userEditing}
                  onChange={e => setUserDraft(x => ({ ...x, jobTitle: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>{tx('Ρόλος', 'Role')}</span>
                <select
                  value={userDraft.role || selectedUser.role}
                  disabled={!userEditing}
                  onChange={e => setUserDraft(x => ({ ...x, role: e.target.value }))}
                >
                  {ROLES.map(role => (
                    <option key={role} value={role}>
                      {roleLabel(role, language)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section className="platform-user-record-section">
            <div className="platform-user-record-section-heading">
              <div>
                <strong>{tx('Καρτέλα εργαζομένου', 'Employee record')}</strong>
                <span>
                  {selectedEmployee
                    ? tx(
                        'Συνδεδεμένη με ' +
                          selectedEmployee.lastName +
                          ' ' +
                          selectedEmployee.firstName +
                          ' (' +
                          selectedEmployee.id +
                          ').',
                        'Linked to ' +
                          selectedEmployee.firstName +
                          ' ' +
                          selectedEmployee.lastName +
                          ' (' +
                          selectedEmployee.id +
                          ').',
                      )
                    : tx('Δεν έχει συνδεθεί καρτέλα εργαζομένου.', 'No employee record is linked.')}
                </span>
              </div>
            </div>
            <div className="platform-user-record-link-row">
              <select
                className="platform-role-select"
                value={employeeLinkDrafts[selectedUser.userId] || ''}
                disabled={!userEditing}
                onChange={e =>
                  setEmployeeLinkDrafts(x => ({ ...x, [selectedUser.userId]: e.target.value }))
                }
              >
                <option value="">{tx('Επιλογή εργαζομένου…', 'Select employee…')}</option>
                {employeeOptions.map(employee => (
                  <option key={employee.dbId} value={employee.dbId}>
                    {employee.lastName +
                      ' ' +
                      employee.firstName +
                      ' · ' +
                      employee.id +
                      (employee.department ? ' · ' + employee.department : '')}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                disabled={
                  !userEditing ||
                  working ||
                  !employeeLinkDrafts[selectedUser.userId] ||
                  selectedEmployee?.dbId === employeeLinkDrafts[selectedUser.userId]
                }
                onClick={() => linkUserEmployee(selectedUser)}
              >
                {tx(
                  selectedEmployee ? 'Αλλαγή σύνδεσης' : 'Σύνδεση καρτέλας',
                  selectedEmployee ? 'Change link' : 'Link record',
                )}
              </Button>
            </div>
          </section>
          <SupplierRenewalSenderField
            className="platform-user-record-section"
            organizationId={organization.id}
            membershipId={selectedUser.id}
            userId={selectedUser.userId}
            disabled={working}
          />
          <section className="platform-user-record-section platform-user-record-security">
            <div className="platform-user-record-section-heading">
              <div>
                <strong>{tx('Πρόσβαση & ασφάλεια', 'Access & security')}</strong>
                <span>
                  {tx(
                    'Διαχείριση κατάστασης λογαριασμού και ανάκτησης πρόσβασης.',
                    'Manage account status and access recovery.',
                  )}
                </span>
              </div>
            </div>
            <div className="platform-user-record-actions">
              <Button
                variant="secondary"
                disabled={working}
                onClick={() => resetUserAccess(selectedUser)}
              >
                <KeyRound size={15} />
                {selectedUser.status === 'invited'
                  ? tx('Επαναποστολή πρόσκλησης', 'Resend invitation')
                  : tx('Επαναφορά κωδικού', 'Reset password')}
              </Button>
              {selectedUser.status === 'invited' && (
                <Button variant="secondary" disabled={working} onClick={() => showInvitationLink(selectedUser)}>
                  <Link2 size={15} />
                  {tx('Σύνδεσμος πρόσκλησης', 'Invitation link')}
                </Button>
              )}
              <Button variant="secondary" disabled={working} onClick={toggleSelectedUserStatus}>
                {selectedUser.status === 'disabled' ? (
                  <PlayCircle size={15} />
                ) : (
                  <PauseCircle size={15} />
                )}{' '}
                {selectedUser.status === 'disabled'
                  ? tx('Ενεργοποίηση', 'Reactivate')
                  : tx('Παύση', 'Suspend')}
              </Button>
            </div>
          </section>
        </div>
      </EntityRecordShell>
      {invitationLink && <InvitationLinkDialog link={invitationLink.link} name={invitationLink.name} onClose={() => setInvitationLink(null)} />}
      </>
    )
}
