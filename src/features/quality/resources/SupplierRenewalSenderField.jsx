import { useEffect, useState } from 'react'
import { MailCheck } from 'lucide-react'
import { CheckboxField } from '../../../design-system/CheckboxField'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { loadSupplierRenewalSender, setSupplierRenewalSender } from './supplierRenewalService'
import './resources.css'

// The add-on supplier_renewal_sender of one member: may send (and re-send, remind)
// the renewal requests of expired certificates to suppliers. Only the Platform Owner
// sees and changes it (Management → Users, and the organization record of the platform).
export function SupplierRenewalSenderField({ organizationId, membershipId, userId, disabled = false, className = 'management-user-section' }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    setLoading(true)
    loadSupplierRenewalSender(membershipId).then(value => { if (alive) setEnabled(Boolean(value)) }).catch(error => console.error(error)).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [membershipId])
  async function change(next) {
    if (busy) return
    setBusy(true)
    try { await setSupplierRenewalSender(organizationId, { membershipId, userId }, next); setEnabled(next); notify(next ? (en ? 'They may now send renewal requests to suppliers.' : 'Μπορεί πλέον να στέλνει αιτήματα ανανέωσης σε προμηθευτές.') : (en ? 'They may no longer send renewal requests.' : 'Δεν μπορεί πλέον να στέλνει αιτήματα ανανέωσης.'), 'success') }
    catch (error) { console.error(error); notify(en ? 'The change was not saved.' : 'Η αλλαγή δεν αποθηκεύτηκε.', 'error') } finally { setBusy(false) }
  }
  return <div className={`${className} supplier-renewal-sender`}>
    <div><strong><MailCheck size={15} /> {en ? 'Supplier certificate renewals' : 'Ανανέωση πιστοποιητικών προμηθευτών'}</strong><p>{en ? 'May approve, send, resend and remind the e-mails to suppliers for their expired certificates. Set only by the Platform Owner.' : 'Εγκρίνει, στέλνει, ξαναστέλνει και υπενθυμίζει τα email προς τους προμηθευτές για τα ληγμένα πιστοποιητικά τους. Ορίζεται μόνο από τον Platform Owner.'}</p></div>
    <CheckboxField label={en ? 'May send renewal requests' : 'Μπορεί να στέλνει αιτήματα ανανέωσης'} checked={enabled} disabled={disabled || loading || busy} onChange={change} />
  </div>
}
