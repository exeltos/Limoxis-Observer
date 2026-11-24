import { createOrganizationUser, manageOrganizationUser } from '../../core/tenant/tenantService'

import type { Dispatch, SetStateAction } from 'react'
import type { useFeedback } from '../../core/feedback/FeedbackContext'
import type { CreateUserDraft, InvitationLinkView, OrganizationEmployee, OrganizationMember, OrganizationRecordRow, OrganizationUserDraft } from './platformOrganizationShared'

type Feedback = ReturnType<typeof useFeedback>
type Setter<T> = Dispatch<SetStateAction<T>>
export type OrganizationUserActionsContext = {
  record: OrganizationRecordRow
  employees: OrganizationEmployee[]
  working: boolean
  setWorking: Setter<boolean>
  setInvitationLink: Setter<InvitationLinkView | null>
  employeeLinkDrafts: Record<string, string>
  setSelectedUserId: (id: string, backTab?: string) => void
  setUserEditing: Setter<boolean>
  userDraft: OrganizationUserDraft
  setCreateUserOpen: Setter<boolean>
  createUserDraft: CreateUserDraft
  setCreateUserDraft: Setter<CreateUserDraft>
  loadUsers: () => Promise<OrganizationMember[]>
  selectedUser: OrganizationMember | null
  createUserValid: boolean
  notify: Feedback['notify']
  notifyError: Feedback['notifyError']
  confirm: Feedback['confirm']
  tx: (el: string, en: string) => string
}

// The actions on one user of the organization: create, link to an employee record, invitation link, new temporary password, save, delete, suspend / reactivate.
// Split out of PlatformOrganizationRecord (24/11/2026); the record hands over its state and setters (ctx).
export function organizationUserActions(ctx: OrganizationUserActionsContext) {
  const { record, employees, working, setWorking, setInvitationLink, employeeLinkDrafts, setSelectedUserId, setUserEditing, userDraft, setCreateUserOpen, createUserDraft, setCreateUserDraft, loadUsers, selectedUser, createUserValid, notify, notifyError, confirm, tx } = ctx
  async function createOrganizationMember() {
    if (!createUserValid || working) return
    const fullName = createUserDraft.fullName.trim(),
      email = createUserDraft.email.trim().toLowerCase(),
      role = createUserDraft.role
    setWorking(true)
    try {
      const result = await createOrganizationUser({
        organizationId: record.id,
        fullName,
        role,
        email,
      })
      const rows = await loadUsers()
      const created = rows.find(user => String(user.email || '').toLowerCase() === email)
      setCreateUserOpen(false)
      setCreateUserDraft({ fullName: '', email: '', role: 'department_user' })
      if (created) setSelectedUserId(created.userId)
      if (result?.reused) {
        notify(
          tx(
            'Ο υπάρχων λογαριασμός προστέθηκε στον οργανισμό με τον επιλεγμένο ρόλο.',
            'The existing account was added to this organization with the selected role.',
          ),
          'success',
          { operation: 'platform_user_create' },
        )
      } else if (result?.emailSent) {
        notify(
          tx(
            'Ο χρήστης δημιουργήθηκε και η πρόσκληση στάλθηκε.',
            'User created and invitation sent.',
          ),
          'success',
          { operation: 'platform_user_create' },
        )
      } else {
        notify(
          tx(
            'Ο χρήστης δημιουργήθηκε, αλλά η πρόσκληση δεν μπόρεσε να αποσταλεί.',
            'User created, but the invitation could not be delivered.',
          ),
          'warning',
          { operation: 'platform_user_create' },
        )
      }
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_user_create' })
    } finally {
      setWorking(false)
    }
  }
  async function linkUserEmployee(user: OrganizationMember) {
    const employeeDbId = employeeLinkDrafts[user.userId] || ''
    if (!employeeDbId || working) return
    const employee = employees.find(item => item.dbId === employeeDbId)
    if (!employee) return
    const ok = await confirm({
      title: tx('Σύνδεση καρτέλας εργαζομένου', 'Link employee record'),
      message: tx(
        `Ο χρήστης ${user.name} θα συνδεθεί με την καρτέλα ${employee.lastName} ${employee.firstName} (${employee.id}).`,
        `User ${user.name} will be linked to employee record ${employee.firstName} ${employee.lastName} (${employee.id}).`,
      ),
      confirmLabel: tx('Σύνδεση', 'Link'),
    })
    if (!ok) return
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: user.userId,
        action: 'link_employee',
        employeeDbId,
      })
      await loadUsers()
      notify(
        tx(
          'Η καρτέλα εργαζομένου συνδέθηκε με τον λογαριασμό.',
          'Employee record linked to the account.',
        ),
        'success',
        { operation: 'platform_user_employee_link' },
      )
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_user_employee_link' })
    } finally {
      setWorking(false)
    }
  }
  // The activation link of a pending invitation, for when the email does not arrive.
  async function showInvitationLink(user: OrganizationMember) {
    if (!user || working) return
    setWorking(true)
    try {
      const result = await manageOrganizationUser({ organizationId: record.id, userId: user.userId, action: 'invitation_link' })
      setInvitationLink({ link: result.link, name: user.name })
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_user_invitation_link' })
    } finally {
      setWorking(false)
    }
  }
  async function resetUserAccess(user: OrganizationMember) {
    if (!user || working) return
    const invited = user.status === 'invited'
    const ok = await confirm({
      title: invited
        ? tx('Επαναποστολή πρόσκλησης', 'Resend invitation')
        : tx('Επαναφορά κωδικού', 'Reset password'),
      message: invited
        ? tx(
            `Η πρόσκληση θα σταλεί ξανά στο ${user.email || 'καταχωρημένο email'}.`,
            `The invitation will be sent again to ${user.email || 'the registered email'}.`,
          )
        : tx(
            `Θα σταλεί email επαναφοράς κωδικού στο ${user.email || 'καταχωρημένο email'}.`,
            `A password reset email will be sent to ${user.email || 'the registered email'}.`,
          ),
      confirmLabel: invited ? tx('Επαναποστολή', 'Resend') : tx('Αποστολή email', 'Send email'),
    })
    if (!ok) return
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: user.userId,
        action: invited ? 'resend_invitation' : 'reset_password',
      })
      await loadUsers()
      notify(
        invited
          ? tx('Η πρόσκληση επαναποστάλθηκε.', 'Invitation resent.')
          : tx('Στάλθηκε email επαναφοράς κωδικού.', 'Password reset email sent.'),
        'success',
        { operation: 'platform_user_access_reset' },
      )
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_user_access_reset' })
    } finally {
      setWorking(false)
    }
  }
  async function saveSelectedUser() {
    if (!selectedUser || working) return
    const fullName = userDraft.fullName.trim(),
      email = userDraft.email.trim().toLowerCase()
    if (fullName.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) {
      notify(
        tx('Συμπλήρωσε έγκυρο ονοματεπώνυμο και email.', 'Enter a valid full name and email.'),
        'error',
      )
      return
    }
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: selectedUser.userId,
        action: 'update',
        fullName,
        email,
        phone: userDraft.phone.trim() || null,
        jobTitle: userDraft.jobTitle.trim() || null,
        role: userDraft.role || selectedUser.role,
      })
      await loadUsers()
      setUserEditing(false)
      notify(tx('Τα στοιχεία του χρήστη ενημερώθηκαν.', 'User details updated.'), 'success', {
        operation: 'platform_user_update',
      })
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_user_update' })
    } finally {
      setWorking(false)
    }
  }
  async function deleteSelectedUser() {
    if (!selectedUser || working) return
    const ok = await confirm({
      title: tx('Διαγραφή χρήστη', 'Delete user'),
      message: tx(
        'Ο χρήστης ' +
          selectedUser.name +
          ' θα διαγραφεί οριστικά από το Limoxis Observer. Η ενέργεια δεν αναιρείται.',
        'User ' +
          selectedUser.name +
          ' will be permanently deleted from Limoxis Observer. This action cannot be undone.',
      ),
      confirmLabel: tx('Διαγραφή', 'Delete'),
      danger: true,
    })
    if (!ok) return
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: selectedUser.userId,
        action: 'delete',
      })
      setSelectedUserId('')
      await loadUsers()
      notify(tx('Ο χρήστης διαγράφηκε.', 'User deleted.'), 'success', {
        operation: 'platform_user_delete',
      })
    } catch (error) {
      notifyError(error, 'delete', { operation: 'platform_user_delete' })
    } finally {
      setWorking(false)
    }
  }
  async function toggleSelectedUserStatus() {
    if (!selectedUser || working) return
    const action = selectedUser.status === 'disabled' ? 'reactivate' : 'suspend'
    const ok = await confirm({
      title:
        action === 'suspend'
          ? tx('Παύση χρήστη', 'Suspend user')
          : tx('Ενεργοποίηση χρήστη', 'Reactivate user'),
      message:
        action === 'suspend'
          ? tx(
              'Ο χρήστης δεν θα μπορεί να συνδεθεί μέχρι να ενεργοποιηθεί ξανά.',
              'The user will not be able to sign in until reactivated.',
            )
          : tx('Να ενεργοποιηθεί ξανά ο χρήστης;', 'Reactivate this user?'),
      confirmLabel:
        action === 'suspend' ? tx('Παύση', 'Suspend') : tx('Ενεργοποίηση', 'Reactivate'),
    })
    if (!ok) return
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: selectedUser.userId,
        action,
      })
      await loadUsers()
      notify(
        action === 'suspend'
          ? tx('Ο χρήστης τέθηκε σε παύση.', 'User suspended.')
          : tx('Ο χρήστης ενεργοποιήθηκε.', 'User reactivated.'),
        'success',
        { operation: 'platform_user_status' },
      )
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_user_status' })
    } finally {
      setWorking(false)
    }
  }
  return { createOrganizationMember, linkUserEmployee, showInvitationLink, resetUserAccess, saveSelectedUser, deleteSelectedUser, toggleSelectedUserStatus }
}
