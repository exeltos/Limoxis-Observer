import { useState } from 'react'
import { AlertTriangle, CheckCircle2, PenLine, ShieldCheck } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { Field } from '../../design-system/Field'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { formatDay } from '../../core/i18n/formatDay'
import { SIGNING_ROLES, staleSignatures, validSignatures } from './regulationModel'
import { SignaturePad } from './SignaturePad'

// The two signatures an edition needs: the hospital administrator's and the
// infection control lead's. Each is given for the draft as it is saved; a
// change to the text afterwards asks for it again.
export function RegulationSignatures({ signatures = [], revision, signRoles = [], language = 'el', blocked = [], dirty = false, onSign, profileName = '' }) {
  const en = language === 'en'
  const valid = validSignatures(signatures, revision)
  const stale = staleSignatures(signatures, revision)
  const [signing, setSigning] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try { if (await onSign(signing)) setSigning(null) } finally { setBusy(false) }
  }

  return <div className="reg-sign-area">
    <p className="reg-sign-intro"><ShieldCheck size={16} />{en ? 'Each signs the draft as it is saved. If the text changes afterwards, the signatures are asked for again, so what is approved is exactly what was signed.' : 'Ο καθένας υπογράφει το προσχέδιο όπως είναι αποθηκευμένο. Αν το κείμενο αλλάξει μετά, οι υπογραφές ζητούνται ξανά· έτσι εγκρίνεται ακριβώς ό,τι υπογράφηκε.'}</p>
    {blocked.length > 0 && <div className="reg-sign-blocked"><AlertTriangle size={15} /><span>{en ? 'Before signing:' : 'Πριν από τις υπογραφές:'} {blocked.join(' · ')}</span></div>}
    <div className="reg-sign-slots">
      {SIGNING_ROLES.map(role => {
        const signature = valid.find(item => item.role === role.value)
        const canSign = signRoles.includes(role.value)
        return <section key={role.value} className={`reg-sign-slot ${signature ? 'is-signed' : ''}`}>
          <header><small>{role.label[en ? 1 : 0]}</small>{signature ? <span className="reg-sign-state is-ok"><CheckCircle2 size={14} />{en ? 'Signed' : 'Υπογράφηκε'}</span> : <span className="reg-sign-state">{stale.includes(role.value) ? (en ? 'Text changed: sign again' : 'Το κείμενο άλλαξε: νέα υπογραφή') : (en ? 'Awaiting signature' : 'Αναμένεται υπογραφή')}</span>}</header>
          <div className="reg-sign-ink">{signature?.image ? <img src={signature.image} alt={en ? `Signature of ${signature.name}` : `Υπογραφή ${signature.name}`} /> : signature ? <em>{en ? 'Signed electronically' : 'Υπογράφηκε ηλεκτρονικά'}</em> : null}</div>
          {signature ? <footer><strong>{signature.name}</strong>{signature.title && <span>{signature.title}</span>}<span>{formatDay(signature.signedAt, language)}</span></footer>
            : <footer><span className="reg-sign-who">{canSign ? (en ? 'You can sign in this role.' : 'Μπορείτε να υπογράψετε με αυτή την ιδιότητα.') : (en ? `Signed by the ${role.label[1].toLowerCase()}.` : `Υπογράφει ο/η ${role.label[0]}.`)}</span></footer>}
          {canSign && <Button variant={signature ? 'secondary' : 'primary'} disabled={blocked.length > 0} onClick={() => setSigning({ role: role.value, name: signature?.name || profileName, title: signature?.title || '', image: null })}><PenLine size={15} />{signature ? (en ? 'Sign again' : 'Νέα υπογραφή') : (en ? 'Sign' : 'Υπογραφή')}</Button>}
        </section>
      })}
    </div>
    {signing && <ObserverDialog title={en ? 'Sign the draft' : 'Υπογραφή προσχεδίου'} subtitle={SIGNING_ROLES.find(item => item.value === signing.role)?.label[en ? 1 : 0]} onClose={() => setSigning(null)}
      footer={<DialogActions onCancel={() => setSigning(null)} onSave={submit} saveLabel={dirty ? (en ? 'Save and sign' : 'Αποθήκευση και υπογραφή') : (en ? 'Sign' : 'Υπογραφή')} disabled={busy || String(signing.name || '').trim().length < 2 || !signing.image} />}>
      <div className="reg-sign-form">
        <div className="reg-sign-fields">
          <Field label={en ? 'Full name *' : 'Ονοματεπώνυμο *'}><input value={signing.name} onChange={event => setSigning(current => ({ ...current, name: event.target.value }))} /></Field>
          <Field label={en ? 'Position' : 'Θέση / ιδιότητα'}><input value={signing.title} onChange={event => setSigning(current => ({ ...current, title: event.target.value }))} placeholder={en ? 'e.g. Director of Nursing' : 'π.χ. Διευθύντρια Νοσηλευτικής Υπηρεσίας'} /></Field>
        </div>
        <SignaturePad language={language} onChange={image => setSigning(current => ({ ...current, image }))} />
        <p className="reg-sign-note">{dirty ? (en ? 'The draft has unsaved changes: it is saved first, and you sign the saved text.' : 'Το προσχέδιο έχει μη αποθηκευμένες αλλαγές: αποθηκεύεται πρώτα και υπογράφετε το αποθηκευμένο κείμενο.') : (en ? 'You sign the draft as it is saved now.' : 'Υπογράφετε το προσχέδιο όπως είναι αποθηκευμένο τώρα.')}</p>
      </div>
    </ObserverDialog>}
  </div>
}
