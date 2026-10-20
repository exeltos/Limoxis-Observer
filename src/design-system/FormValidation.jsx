import { useRef, useState } from 'react'
import { useOptionalLanguage } from '../core/i18n/LanguageContext'
import { Button } from './Button'
import { SaveButton } from './SaveButton'

// The one rule for every form of the app: a form never saves empty.
// - required fields carry «*» in their label (`required` on the field);
// - the primary button looks disabled while something is missing, and a line
//   beside it says what: «Συμπληρώστε: Τμήμα, Ημερομηνία λήψης»;
// - pressing it anyway validates: each missing field shows a message under it
//   and the first one gets the focus. Nothing is saved.
//
//   const form = useFormValidation([
//     { key: 'source', label: 'Ανατομική θέση', valid: Boolean(d.source.trim()) },
//   ])
//   <Field label="Ανατομική θέση" {...form.field('source')}>…</Field>
//   footer={<FormSubmit form={form} onSubmit={save}>Αποθήκευση</FormSubmit>}
//
// A rule may be left out (null / false) when it does not apply in the current mode.
export function useFormValidation(rules = []) {
  const language = useOptionalLanguage()?.language
  const en = language === 'en'
  const [attempted, setAttempted] = useState(false)
  const scopeRef = useRef(null)
  const active = rules.filter(Boolean)
  const missing = active.filter(rule => !rule.valid)
  const isMissing = key => missing.some(rule => rule.key === key)
  const message = rule => rule?.message || (en ? 'Required field' : 'Υποχρεωτικό πεδίο')
  const errorFor = key => (attempted && isMissing(key) ? message(missing.find(rule => rule.key === key)) : '')
  const field = key => ({ required: true, fieldKey: key, error: errorFor(key) })
  function focusFirst() {
    const first = missing[0]
    if (!first || typeof document === 'undefined') return
    const scope = scopeRef.current || document
    const holders = scope.querySelectorAll(`[data-field-key="${first.key}"]`)
    const holder = holders[holders.length - 1]
    if (!holder) return
    const target = holder.matches('input,select,textarea,button')
      ? holder
      : holder.querySelector('input:not([type="hidden"]):not([tabindex="-1"]),textarea,select,button')
    if (!target) return
    // Quiet focus: a searchable select does not open its list for it.
    target.dataset.quietFocus = '1'
    target.focus?.()
    delete target.dataset.quietFocus
    target.scrollIntoView?.({ block: 'nearest' })
  }
  // Wraps the save handler: with something missing it only shows what.
  const submit = handler => (...args) => {
    if (missing.length) {
      setAttempted(true)
      setTimeout(focusFirst, 0)
      return false
    }
    return handler?.(...args)
  }
  return {
    valid: missing.length === 0,
    missing,
    missingLabels: missing.map(rule => rule.label),
    attempted,
    errorFor,
    field,
    submit,
    scopeRef,
    reset: () => setAttempted(false),
  }
}

// «Συμπληρώστε: Τμήμα, Ημερομηνία λήψης» — what still keeps the form from saving.
export function MissingFieldsSummary({ labels = [], className = '' }) {
  const language = useOptionalLanguage()?.language
  if (!labels.length) return null
  return (
    <p className={`form-missing-summary ${className}`.trim()} role="status">
      <strong>{language === 'en' ? 'Fill in:' : 'Συμπληρώστε:'}</strong> {labels.join(', ')}
    </p>
  )
}

// The primary button of a form with its «Συμπληρώστε: …» line. It stays
// pressable while fields are missing (aria-disabled), so a press shows the
// messages and focuses the first missing field instead of doing nothing.
// `disabled` is for real busy states (saving). `icon={false}` drops the save icon.
export function FormSubmit({
  form,
  onSubmit,
  children,
  disabled = false,
  loading = false,
  savingLabel,
  icon = true,
  className = '',
}) {
  const blocked = !form.valid
  const props = {
    disabled,
    loading,
    'aria-disabled': blocked || undefined,
    className: `${blocked ? 'is-blocked' : ''} ${className}`.trim(),
    onClick: form.submit(onSubmit),
  }
  return (
    <>
      <MissingFieldsSummary labels={form.missingLabels} />
      {icon ? (
        <SaveButton savingLabel={savingLabel} {...props}>
          {children}
        </SaveButton>
      ) : (
        <Button {...props}>{loading && savingLabel ? savingLabel : children}</Button>
      )}
    </>
  )
}

// A field label with the «*» of a required field or the «· Προαιρετικό» of an optional one.
// The «*» is drawn by CSS: the label's text (its accessible name) stays the field's name,
// and the input itself says it is required (aria-required).
export function FieldLabelText({ label, required = false, optional = false, optionalLabel }) {
  return (
    <>
      {label}
      {required && <span className="lo-required-mark" aria-hidden="true" />}
      {optional && optionalLabel && <small> · {optionalLabel}</small>}
    </>
  )
}

// What goes under a field: the error once the form was submitted, else the helper text.
export function FieldMessage({ error, hint }) {
  if (error) return <span className="field-error">{error}</span>
  if (hint) return <span className="field-hint">{hint}</span>
  return null
}
