import './LoadingSkeleton.css'
import { LoaderCircle } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useLoadingMark } from './loadingActivity'

// The one loading look of every screen (owner, 8/11/2026): one round spinner over the frozen screen, and everything
// shows at once after the load (loadingActivity.js, AppShell). The placeholders keep the room of what is coming
// (a page header, a row of figures, table lines) without grey blocks, and mark the screen as loading while they are on
// it. A screen never shows its empty state («Δεν υπάρχουν…») or 0 figures before its first load has finished.

// A whole page that is still loading (header, figures, list).
export function PageSkeleton({ metrics = 4, rows = 7, className = '' }){
  const { t } = useLanguage()
  useLoadingMark()
  return <div className={`page-loading-skeleton ${className}`.trim()} role="status" aria-busy="true" aria-live="polite">
    <span className="loading-skeleton-label">{t('loading')}</span>
    <LoaderCircle className="loading-spinner page-loading-own-spinner" size={34} aria-hidden="true"/>
    <div className="loading-skeleton-header" aria-hidden="true"><i/><i/></div>
    {metrics>0&&<div className="loading-skeleton-metrics" aria-hidden="true">{Array.from({ length: metrics }, (_, index) => <i key={index}/>)}</div>}
    <TableSkeletonLines rows={rows}/>
  </div>
}

// The lines of a list whose rows are still loading (inside a registry or a panel).
export function TableSkeleton({ rows = 6, className = '' }){
  const { t } = useLanguage()
  useLoadingMark()
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
  useLoadingMark()
  return <span className="metric-loading-skeleton" aria-hidden="true"/>
}
