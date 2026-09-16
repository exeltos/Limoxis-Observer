export function RecordLoadingSkeleton({className=''}){
  return <div className={`record-loading-skeleton ${className}`.trim()} role="status" aria-live="polite" aria-label="Loading">
    <div className="record-loading-header surface">
      <span className="record-loading-back skeleton-block" />
      <span className="record-loading-avatar skeleton-block" />
      <div className="record-loading-identity">
        <span className="skeleton-block skeleton-code" />
        <span className="skeleton-block skeleton-title" />
        <span className="skeleton-block skeleton-subtitle" />
      </div>
      <span className="skeleton-block skeleton-status" />
    </div>
    <div className="record-loading-tabs surface" aria-hidden="true">
      <span className="skeleton-block" /><span className="skeleton-block" /><span className="skeleton-block" /><span className="skeleton-block" /><span className="skeleton-block" />
    </div>
    <div className="record-loading-body surface" aria-hidden="true">
      <div className="record-loading-section-title skeleton-block" />
      <div className="record-loading-grid">
        <div className="record-loading-card"><span className="skeleton-block skeleton-label"/><span className="skeleton-block skeleton-value"/><span className="skeleton-block skeleton-line"/></div>
        <div className="record-loading-card"><span className="skeleton-block skeleton-label"/><span className="skeleton-block skeleton-value short"/><span className="skeleton-block skeleton-line"/></div>
        <div className="record-loading-card"><span className="skeleton-block skeleton-label"/><span className="skeleton-block skeleton-value"/><span className="skeleton-block skeleton-line"/></div>
      </div>
    </div>
    <span className="sr-only">Loading</span>
  </div>
}
