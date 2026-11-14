import { useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Field } from '../../design-system/Field'
import { CheckboxField } from '../../design-system/CheckboxField'
import { Button } from '../../design-system/Button'
import { FieldMessage, FormSubmit, useFormValidation } from '../../design-system/FormValidation'
import { DEMO_REQUEST_LIMITS, DemoRequestError, isValidDemoEmail, submitDemoRequest, type DemoRequestFailure, type DemoRequestInput } from './demoRequestService'

// Η φόρμα «Ζητήστε παρουσίαση» της Σελίδας παρουσίασης. Υποχρεωτικά: ονοματεπώνυμο, νοσοκομείο/οργανισμός,
// ιδιότητα, email και αποδοχή της Πολιτικής απορρήτου. Το κρυφό πεδίο «website» είναι παγίδα για αυτόματους αποστολείς.
type Draft = Omit<DemoRequestInput, 'language'>
const EMPTY: Draft = { fullName: '', organization: '', role: '', email: '', phone: '', message: '', privacyAccepted: false, website: '' }

const copy = {
  el: {
    title: 'Ζητήστε παρουσίαση',
    subtitle: 'Συμπληρώστε τα στοιχεία σας και θα επικοινωνήσουμε μαζί σας για να κανονίσουμε μια παρουσίαση.',
    fullName: 'Ονοματεπώνυμο', organization: 'Νοσοκομείο / Οργανισμός', role: 'Ιδιότητα', roleHint: 'Π.χ. Υπεύθυνος Ελέγχου Λοιμώξεων, Διευθυντής Ποιότητας.',
    email: 'Email', phone: 'Τηλέφωνο', message: 'Μήνυμα', optional: 'Προαιρετικό',
    privacyBefore: 'Αποδέχομαι την ', privacyLink: 'Πολιτική απορρήτου', privacyAfter: ' και τη χρήση των στοιχείων μου για επικοινωνία.',
    privacyMissing: 'Χρειάζεται η αποδοχή της Πολιτικής απορρήτου.', privacyRule: 'Πολιτική απορρήτου',
    invalidEmail: 'Μη έγκυρο email.', tooShort: 'Τουλάχιστον 2 χαρακτήρες.',
    send: 'Αποστολή', sending: 'Αποστολή…', close: 'Κλείσιμο',
    doneTitle: 'Το αίτημά σας στάλθηκε', doneText: 'Ευχαριστούμε! Θα επικοινωνήσουμε μαζί σας σύντομα στο email που δώσατε.',
    errors: {
      rate: 'Έχουν σταλεί ήδη αρκετά αιτήματα από αυτό το email. Δοκιμάστε ξανά σε μία ώρα.',
      invalid: 'Ελέγξτε τα στοιχεία της φόρμας και δοκιμάστε ξανά.',
      unavailable: 'Η αποστολή δεν είναι διαθέσιμη αυτή τη στιγμή. Στείλτε μας email στο ',
      failed: 'Δεν ήταν δυνατή η αποστολή. Δοκιμάστε ξανά ή στείλτε μας email στο ',
    },
  },
  en: {
    title: 'Request a demo',
    subtitle: 'Fill in your details and we will contact you to arrange a demo.',
    fullName: 'Full name', organization: 'Hospital / Organization', role: 'Position', roleHint: 'E.g. Infection Control Lead, Quality Director.',
    email: 'Email', phone: 'Phone', message: 'Message', optional: 'Optional',
    privacyBefore: 'I accept the ', privacyLink: 'Privacy policy', privacyAfter: ' and the use of my details to contact me.',
    privacyMissing: 'Accepting the Privacy policy is required.', privacyRule: 'Privacy policy',
    invalidEmail: 'Invalid email.', tooShort: 'At least 2 characters.',
    send: 'Send', sending: 'Sending…', close: 'Close',
    doneTitle: 'Your request was sent', doneText: 'Thank you! We will contact you soon at the email you gave.',
    errors: {
      rate: 'Several requests have already been sent from this email. Please try again in an hour.',
      invalid: 'Check the form and try again.',
      unavailable: 'Sending is not available right now. Email us at ',
      failed: 'The request could not be sent. Try again or email us at ',
    },
  },
} as const

export function DemoRequestDialog({ language, contactEmail, onClose }: { language: 'el' | 'en', contactEmail: string, onClose: () => void }) {
  const t = copy[language]
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [failure, setFailure] = useState<DemoRequestFailure | null>(null)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(current => ({ ...current, [key]: value }))
  const filled = (value: string) => value.trim().length >= 2
  const emailFilled = Boolean(draft.email.trim())
  const form = useFormValidation([
    { key: 'fullName', label: t.fullName, valid: filled(draft.fullName), message: draft.fullName.trim() ? t.tooShort : undefined },
    { key: 'organization', label: t.organization, valid: filled(draft.organization), message: draft.organization.trim() ? t.tooShort : undefined },
    { key: 'role', label: t.role, valid: filled(draft.role), message: draft.role.trim() ? t.tooShort : undefined },
    { key: 'email', label: t.email, valid: isValidDemoEmail(draft.email), message: emailFilled ? t.invalidEmail : undefined },
    { key: 'privacy', label: t.privacyRule, valid: draft.privacyAccepted, message: t.privacyMissing },
  ])
  async function send() {
    setSending(true)
    setFailure(null)
    try {
      await submitDemoRequest({ ...draft, language })
      setDone(true)
    } catch (error) {
      setFailure(error instanceof DemoRequestError ? error.reason : 'failed')
    } finally { setSending(false) }
  }

  if (done) {
    return <ObserverDialog width="compact" title={t.title} onClose={onClose} footer={<Button onClick={onClose}>{t.close}</Button>}>
      <div className="landing-request-done" role="status">
        <CheckCircle2 size={36} aria-hidden="true"/>
        <strong>{t.doneTitle}</strong>
        <p>{t.doneText}</p>
      </div>
    </ObserverDialog>
  }

  const mailHref = `mailto:${contactEmail}`
  return <ObserverDialog width="standard" title={t.title} subtitle={t.subtitle} onClose={onClose} footer={<FormSubmit form={form} onSubmit={send} disabled={sending} loading={sending} savingLabel={t.sending} icon={false}>{t.send}</FormSubmit>}>
    <div ref={form.scopeRef} className="landing-request-form">
      {failure && <div className="landing-request-error" role="alert"><AlertCircle size={17} aria-hidden="true"/><span>{t.errors[failure]}{(failure === 'unavailable' || failure === 'failed') && <a href={mailHref}>{contactEmail}</a>}</span></div>}
      <Field label={t.fullName} {...form.field('fullName')}><input autoFocus autoComplete="name" maxLength={DEMO_REQUEST_LIMITS.fullName} value={draft.fullName} onChange={e => set('fullName', e.target.value)}/></Field>
      <Field label={t.organization} {...form.field('organization')}><input autoComplete="organization" maxLength={DEMO_REQUEST_LIMITS.organization} value={draft.organization} onChange={e => set('organization', e.target.value)}/></Field>
      <Field label={t.role} hint={t.roleHint} {...form.field('role')}><input autoComplete="organization-title" maxLength={DEMO_REQUEST_LIMITS.role} value={draft.role} onChange={e => set('role', e.target.value)}/></Field>
      <Field label={t.email} {...form.field('email')}><input type="email" autoComplete="email" maxLength={DEMO_REQUEST_LIMITS.email} value={draft.email} onChange={e => set('email', e.target.value)}/></Field>
      <Field label={<>{t.phone} <small>· {t.optional}</small></>}><input type="tel" autoComplete="tel" maxLength={DEMO_REQUEST_LIMITS.phone} value={draft.phone} onChange={e => set('phone', e.target.value)}/></Field>
      <Field label={<>{t.message} <small>· {t.optional}</small></>} className="landing-request-wide"><textarea rows={4} maxLength={DEMO_REQUEST_LIMITS.message} value={draft.message} onChange={e => set('message', e.target.value)}/></Field>
      {/* Παγίδα για αυτόματους αποστολείς: εκτός οθόνης, εκτός σειράς Tab, κρυμμένη από τους αναγνώστες οθόνης. */}
      <div className="landing-request-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" value={draft.website} onChange={e => set('website', e.target.value)}/></label></div>
      <div className="field field-with-message landing-request-wide" data-field-key="privacy" data-invalid={form.errorFor('privacy') ? 'true' : undefined}>
        <CheckboxField checked={draft.privacyAccepted} onChange={value => set('privacyAccepted', value)} label={<>{t.privacyBefore}<a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{t.privacyLink}</a>{t.privacyAfter}<span className="lo-required-mark" aria-hidden="true"/></>}/>
        <FieldMessage error={form.errorFor('privacy')}/>
      </div>
    </div>
  </ObserverDialog>
}
