import { useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { binServerRecord, canDeleteRecord } from '../../core/recycleBin/recycleBinService'
import { useTenant } from '../../core/tenant/TenantContext'

// «Delete» of one record of the clinical file, for a «…» menu: it moves to the deleter's
// recycle bin (30 days). Returns the menu item, or null when the person may not delete it:
// the Platform Owner, the Hospital Admin and the Infection Control Lead delete any record,
// everyone else only what they entered (`createdBy`; the server checks the same).
//   table / id   the database record (production: bin_delete moves it with what hangs from it)
//   demo         Demo only: removes it from the session lists and files it in the local bin
//   onDone       reloads the screen after the move
export function useRecordDelete() {
  const { tenant, isDemo, role, actualRole } = useTenant()
  const actor = useAuditActor()
  const { language } = useLanguage()
  const { notify, notifyError, confirm } = useFeedback()
  const en = language === 'en'
  return useCallback(
    ({ createdBy, table, id, label, detail = '', demo = null, onDone = null }) => {
      if (!canDeleteRecord({ role, actualRole, userId: actor?.id, createdBy })) return null
      return {
        id: `delete-${table}-${id}`,
        label: en ? 'Delete' : 'Διαγραφή',
        icon: Trash2,
        tone: 'danger',
        separatorBefore: true,
        onClick: async () => {
          const ok = await confirm({
            title: en ? 'Move to recycle bin' : 'Μεταφορά στον Κάδο',
            message: en ? 'The record moves to the recycle bin; you can restore it for 30 days.' : 'Η εγγραφή μεταφέρεται στον Κάδο και μπορείτε να την επαναφέρετε για 30 ημέρες.',
            confirmLabel: en ? 'Move to recycle bin' : 'Μεταφορά στον Κάδο',
            danger: true,
          })
          if (!ok) return
          try {
            if (isDemo) await demo?.()
            else await binServerRecord(tenant?.id, { table, id, label, detail })
            notify(en ? 'Moved to the recycle bin.' : 'Μεταφέρθηκε στον Κάδο.', 'success')
            await onDone?.()
          } catch (error) {
            notifyError(error, 'delete', { operation: 'recycle_bin_delete' })
          }
        },
      }
    },
    [tenant?.id, isDemo, role, actualRole, actor?.id, en, notify, notifyError, confirm],
  )
}
