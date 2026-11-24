import { createOrganizationUser, manageOrganizationUser, setPlatformOrganizationStatus, updatePlatformOrganization, type OrganizationPatch } from '../../core/tenant/tenantService'
import { toDraft } from './platformOrganizationShared'

import type { Dispatch, SetStateAction } from 'react'
import type { useFeedback } from '../../core/feedback/FeedbackContext'
import type { NewAdminDraft, OrganizationDraft, OrganizationMember, OrganizationRecordRow } from './platformOrganizationShared'

type Feedback = ReturnType<typeof useFeedback>
type Setter<T> = Dispatch<SetStateAction<T>>
export type OrganizationActionsContext = {
  record: OrganizationRecordRow
  setRecord: Setter<OrganizationRecordRow>
  draft: OrganizationDraft
  setDraft: Setter<OrganizationDraft>
  saving: boolean
  setSaving: Setter<boolean>
  working: boolean
  setWorking: Setter<boolean>
  newAdmin: NewAdminDraft
  setNewAdmin: Setter<NewAdminDraft>
  setEditing: Setter<boolean>
  loadUsers: () => Promise<OrganizationMember[]>
  admins: OrganizationMember[]
  canSave: boolean
  notify: Feedback['notify']
  notifyError: Feedback['notifyError']
  confirm: Feedback['confirm']
  tx: (el: string, en: string) => string
  onChanged?: (organization: OrganizationRecordRow) => void
}

// The organization's own actions: save its details, suspend / reactivate it, reset or invite its Hospital Admin.
// Split out of PlatformOrganizationRecord (24/11/2026); the record hands over its state and setters (ctx).
export function organizationActions(ctx: OrganizationActionsContext) {
  const { record, setRecord, draft, setDraft, saving, setSaving, working, setWorking, newAdmin, setNewAdmin, setEditing, loadUsers, admins, canSave, notify, notifyError, confirm, tx, onChanged } = ctx
  async function saveOrganization() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const next = await updatePlatformOrganization(record.id, draft as OrganizationPatch)
      setRecord(next)
      setDraft(toDraft(next))
      onChanged?.(next)
      setEditing(false)
      notify(
        tx('Τα στοιχεία του οργανισμού ενημερώθηκαν.', 'Organization details updated.'),
        'success',
        { operation: 'platform_organization_update' },
      )
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_organization_update' })
    } finally {
      setSaving(false)
    }
  }
  async function togglePause() {
    if (working) return
    const next = record.status === 'suspended' ? 'active' : 'suspended'
    const ok = await confirm({
      title:
        next === 'suspended'
          ? tx('Παύση οργανισμού', 'Suspend organization')
          : tx('Ενεργοποίηση οργανισμού', 'Reactivate organization'),
      message:
        next === 'suspended'
          ? tx(
              'Οι χρήστες του οργανισμού δεν θα μπορούν να λειτουργούν κανονικά μέχρι την επανενεργοποίηση.',
              'Organization access will be suspended until reactivation.',
            )
          : tx('Να ενεργοποιηθεί ξανά ο οργανισμός;', 'Reactivate this organization?'),
      confirmLabel:
        next === 'suspended' ? tx('Παύση', 'Suspend') : tx('Ενεργοποίηση', 'Reactivate'),
    })
    if (!ok) return
    setWorking(true)
    try {
      const updated = await setPlatformOrganizationStatus(record.id, next)
      setRecord(updated)
      setDraft(toDraft(updated))
      onChanged?.(updated)
      notify(
        next === 'suspended'
          ? tx('Ο οργανισμός τέθηκε σε παύση.', 'Organization suspended.')
          : tx('Ο οργανισμός ενεργοποιήθηκε.', 'Organization reactivated.'),
        'success',
        { operation: 'platform_organization_status' },
      )
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_organization_status' })
    } finally {
      setWorking(false)
    }
  }
  async function resetAdmin() {
    const admin = admins[0]
    if (!admin || working) return
    const invited = admin.status === 'invited'
    const ok = await confirm({
      title: invited
        ? tx('Επαναποστολή πρόσκλησης Διαχειριστή Νοσοκομείου', 'Resend Hospital Admin invitation')
        : tx('Επαναφορά κωδικού Διαχειριστή Νοσοκομείου', 'Reset Hospital Admin password'),
      message: invited
        ? tx(
            `Η πρόσκληση θα σταλεί ξανά στο ${admin.email || 'καταχωρημένο email'}.`,
            `The invitation will be sent again to ${admin.email || 'the registered email'}.`,
          )
        : tx(
            `Θα σταλεί email επαναφοράς κωδικού στο ${admin.email || 'καταχωρημένο email'}.`,
            `A password reset email will be sent to ${admin.email || 'the registered email'}.`,
          ),
      confirmLabel: invited ? tx('Επαναποστολή', 'Resend') : tx('Αποστολή email', 'Send email'),
    })
    if (!ok) return
    setWorking(true)
    try {
      await manageOrganizationUser({
        organizationId: record.id,
        userId: admin.userId,
        action: invited ? 'resend_invitation' : 'reset_password',
      })
      await loadUsers()
      notify(
        invited
          ? tx('Η πρόσκληση επαναποστάλθηκε.', 'Invitation resent.')
          : tx('Στάλθηκε email επαναφοράς κωδικού.', 'Password reset email sent.'),
        'success',
        { operation: 'platform_admin_account' },
      )
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_admin_account' })
    } finally {
      setWorking(false)
    }
  }
  async function inviteAdmin() {
    const name = newAdmin.name.trim(),
      email = newAdmin.email.trim()
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || working) return
    setWorking(true)
    try {
      const result = await createOrganizationUser({
        organizationId: record.id,
        fullName: name,
        role: 'hospital_admin',
        email,
      })
      if (!result?.emailSent)
        throw new Error(
          tx('Η πρόσκληση δεν μπόρεσε να αποσταλεί.', 'Invitation could not be sent.'),
        )
      setNewAdmin({ name: '', email: '' })
      await loadUsers()
      notify(
        tx(
          'Ο Διαχειριστής Νοσοκομείου δημιουργήθηκε και η πρόσκληση στάλθηκε.',
          'Hospital Admin created and invitation sent.',
        ),
        'success',
        { operation: 'platform_admin_create' },
      )
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_admin_create' })
    } finally {
      setWorking(false)
    }
  }
  return { saveOrganization, togglePause, resetAdmin, inviteAdmin }
}
