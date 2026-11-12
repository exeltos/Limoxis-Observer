// A value the form shows but does not edit (the department of the admission,
// the patient's bed): label above, a box exactly as tall as an input, and the
// helper text below — so it lines up with the inputs of the same row.
export function ReadOnlyField({ label, value, hint, className = '' }) {
  return (
    <div className={`lo-readonly-field ${className}`.trim()}>
      <span className="lo-field-label">{label}</span>
      <div className="lo-readonly-field-value" aria-readonly="true">
        {value || '—'}
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}
