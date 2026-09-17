import { Fragment } from 'react'

export function RecordDetailsGrid({ fields = [], className = '' }) {
  const visible = fields.filter(field => field && field.hidden !== true)
  return <div className={`detail-grid patient-detail-grid record-details-grid ${className}`.trim()}>
    {visible.map(field => <Fragment key={field.id || field.label}>
      <div className={`detail-item ${field.className || ''}`.trim()}>
        <span>{field.label}</span>
        <strong>{field.value === 0 ? 0 : (field.value || '—')}</strong>
        {field.meta && <small>{field.meta}</small>}
      </div>
    </Fragment>)}
  </div>
}
