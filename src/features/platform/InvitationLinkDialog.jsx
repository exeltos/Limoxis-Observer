import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useLanguage } from '../../core/i18n/LanguageContext'

// The activation link of a pending invitation, shown with a copy button, for when the
// invitation email does not arrive. Shared by the Platform Center and hospital user management.
export function InvitationLinkDialog({ link, name, onClose }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      notify(en ? 'Link copied.' : 'Ο σύνδεσμος αντιγράφηκε.', 'success')
    } catch {
      notify(en ? 'Copying was blocked; select the link and copy it with Ctrl+C.' : 'Η αντιγραφή δεν επιτράπηκε· επιλέξτε τον σύνδεσμο και αντιγράψτε τον με Ctrl+C.', 'warning')
    }
  }
  return (
    <ObserverDialog
      width="standard"
      title={en ? 'Invitation link' : 'Σύνδεσμος πρόσκλησης'}
      onClose={onClose}
      footer={<DialogActions onCancel={onClose} cancelLabel={en ? 'Close' : 'Κλείσιμο'} onSave={copy} saveLabel={en ? 'Copy' : 'Αντιγραφή'} />}
    >
      <p className="platform-invitation-link-note">
        {en
          ? `Send the link to ${name} through your own channel (e.g. Teams or SMS). It opens the activation page to set a password. It is valid for a limited time and once only; do not share it with anyone else.`
          : `Στείλτε τον σύνδεσμο στον/στην ${name} με δικό σας μέσο (π.χ. Teams ή SMS). Ανοίγει τη σελίδα ενεργοποίησης για να ορίσει κωδικό. Ισχύει για περιορισμένο χρόνο και μόνο μία φορά· μην τον κοινοποιείτε σε άλλους.`}
      </p>
      <input className="platform-invitation-link" readOnly value={link} onFocus={event => event.target.select()} aria-label={en ? 'Invitation link' : 'Σύνδεσμος πρόσκλησης'} />
    </ObserverDialog>
  )
}
