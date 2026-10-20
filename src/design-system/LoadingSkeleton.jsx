import './LoadingSkeleton.css'
import { useLanguage } from '../core/i18n/LanguageContext'

// The one loading look of every screen: grey placeholders in the shape of what
// is coming (a page header, a row of figures, table lines), shown at once in the
// content area while the sidebar and top bar stay. A screen never shows its empty
// state («Δεν υπάρχουν…») or 0 figures before its first load has finished.

// A whole page that is still loading (header, figures, list).
export function PageSkeleton({ metrics = 4, rows = 7, className = '' }){
  const { t } = useLanguage()
  return <div className={`page-loading-skeleton ${className}`.trim()} role="status" aria-busy="true" aria-live="polite">
    <span className="loading-skeleton-label">{t('loading')}</span>
    <div className="loading-skeleton-header" aria-hidden="true"><i/><i/></div>
    {metrics>0&&<div className="loading-skeleton-metrics" aria-hidden="true">{Array.from({ length: metrics }, (_, index) => <i key={index}/>)}</div>}
    <TableSkeletonLines rows={rows}/>
  </div>
}

// The lines of a list whose rows are still loading (inside a registry or a panel).
export function TableSkeleton({ rows = 6, className = '' }){
  const { t } = useLanguage()
  return <div className={`table-loading-skeleton ${className}`.trim()} role="status" aria-busy="true" aria-live="polite">
    <span className="loading-skeleton-label">{t('loading')}</span>
    <TableSkeletonLines rows={rows}/>
  </div>
}

function TableSkeletonLines({ rows }){
  return <div className="loading-skeleton-lines" aria-hidden="true">{Array.from({ length: rows }, (_, index) => <i key={index}/>)}</div>
}

// A figure (KPI tile value) that is not known yet.
export function MetricSkeleton(){
  return <span className="metric-loading-skeleton" aria-hidden="true"/>
}
