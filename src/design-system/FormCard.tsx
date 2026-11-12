import './FormCard.css'

// A titled group of fields in a form page (New control, New report…): cards sit
// two to a row on a laptop and one per row on a portrait tablet.
export function FormCard({ title, hint, icon: Icon, wide = false, className = '', children }) {
  return (
    <section className={`lo-form-card ${wide ? 'is-wide' : ''} ${className}`.trim()}>
      {(title || hint) && <header><strong>{Icon && <Icon size={15} aria-hidden="true" />}{title}</strong>{hint && <span>{hint}</span>}</header>}
      {children}
    </section>
  )
}

export function FormGrid({ columns, className = '', children }) {
  return <div className={`lo-form-grid ${columns ? `cols-${columns}` : ''} ${className}`.trim()}>{children}</div>
}
