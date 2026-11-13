import { useState } from 'react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { TEMPORARY_PASSWORD_DAYS, isValidMobile, normalizeMobile } from './activeUsersModel'
import { reissueTemporaryPassword } from './activeUsersService'
import type { ReissueResult } from './activeUsersService'
import './activeUsers.css'

// «Νέος προσωρινός κωδικός»: for a person who never changed the first password (or whose 7 days ran out
// and the account was locked). The password is shown once; the person changes it at the next sign-in.
export function ReissuePasswordDialog({ organizationId, user, onClose, onDone }: { organizationId: string, user: { userId?: string | null, name?: string | null }, onClose: () => void, onDone?: () => void }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const tx = (el: string, english: string) => (en ? english : el)
  const { notifyError } = useFeedback()
  const [mode, setMode] = useState('random')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ReissueResult | null>(null)
  const phoneOk = mode !== 'phone' || isValidMobile(phone)
  async function submit() {
    setBusy(true)
    try {
      const data = await reissueTemporaryPassword({ organizationId, userId: user.userId, passwordMode: mode, phone: normalizeMobile(phone) })
      setResult(data)
      onDone?.()
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(result!.temporaryPassword)
    } catch {
      /* the password is on screen; it can be selected */
    }
  }
  const until = result?.temporaryPasswordExpiresAt ? new Date(result.temporaryPasswordExpiresAt).toLocaleDateString(en ? 'en-GB' : 'el-GR', { timeZone: 'Europe/Athens' }) : ''
  return (
    <ObserverDialog
      width="standard"
      title={tx('Νέος προσωρινός κωδικός', 'New temporary password')}
      onClose={onClose}
      footer={
        result ? (
          <DialogActions onSave={copy} saveLabel={tx('Αντιγραφή', 'Copy')} />
        ) : (
          <DialogActions onSave={submit} saveLabel={tx('Δημιουργία κωδικού', 'Create password')} disabled={busy || !phoneOk} />
        )
      }
    >
      {result ? (
        <>
          <p>{tx(`Δώστε τον κωδικό στον/στην ${user.name}. Ισχύει έως ${until} και αλλάζει στην πρώτη σύνδεση. Δεν θα εμφανιστεί ξανά.`, `Give the password to ${user.name}. It is valid until ${until} and is changed at the first sign-in. It will not be shown again.`)}</p>
          <input className="platform-invitation-link" readOnly value={result.temporaryPassword} onFocus={event => event.target.select()} aria-label={tx('Προσωρινός κωδικός', 'Temporary password')} />
        </>
      ) : (
        <>
          <p>{tx(`Ο παλιός κωδικός παύει να ισχύει. Ο νέος ισχύει ${TEMPORARY_PASSWORD_DAYS} ημέρες και, αν ο λογαριασμός είχε κλειδώσει, ξεκλειδώνει.`, `The old password stops working. The new one is valid for ${TEMPORARY_PASSWORD_DAYS} days and, if the account was locked, it is unlocked.`)}</p>
          <label className="field active-users-mode">
            <span>{tx('Προσωρινός κωδικός', 'Temporary password')}</span>
            <select value={mode} disabled={busy} onChange={event => setMode(event.target.value)}>
              <option value="random">{tx('Τυχαίος', 'Random')}</option>
              <option value="phone">{tx('Το κινητό του χρήστη', "The user's mobile number")}</option>
            </select>
          </label>
          {mode === 'phone' && (
            <label className="field">
              <span>{tx('Κινητό', 'Mobile')}</span>
              <input value={phone} disabled={busy} inputMode="tel" placeholder="69XXXXXXXX" onChange={event => setPhone(event.target.value)} />
              {phone && !phoneOk && <small>{tx('Κινητό 10 ψηφίων που αρχίζει από 69.', 'A 10-digit mobile number starting with 69.')}</small>}
            </label>
          )}
        </>
      )}
    </ObserverDialog>
  )
}
