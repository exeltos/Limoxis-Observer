import { FieldLabelText, FieldMessage } from './FormValidation'

// A labelled field. `required` adds «*»; `error` (from useFormValidation) shows
// under the field and marks it; `hint` is the helper text in its place — a long
// example goes there, never in a placeholder that the field would cut off.
// The message sits outside the <label>, so the field's name stays its label alone.
export function Field({ label, hint, error, required = false, fieldKey, className = '', children }) {
  const caption = <span className="field-label lo-field-label"><FieldLabelText label={label} required={required}/></span>
  if (!required && !hint && !error && !fieldKey) return <label className={`field ${className}`.trim()}>{caption}{children}</label>
  return <div className={`field field-with-message ${className}`.trim()} data-field-key={fieldKey} data-invalid={error ? 'true' : undefined}><label className="field-with-message-label">{caption}{children}</label><FieldMessage error={error} hint={hint}/></div>
}
