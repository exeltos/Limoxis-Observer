import { AlertTriangle, Settings2 } from 'lucide-react'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

export function ReadinessState({ state, title, description, actionLabel, onAction }) {
  if (state !== 'not_configured' && state !== 'empty') return null
  const content = <EmptyState title={title} description={description} />
  if (!actionLabel || !onAction) return content
  return <div className={`readiness-state readiness-${state}`} data-readiness={state}>
    <Settings2 aria-hidden="true" size={20} />
    {content}
    <Button variant="secondary" onClick={onAction}>{actionLabel}</Button>
  </div>
}

export function RepositoryErrorState({ title, description, retryLabel, onRetry }) {
  return <div className="readiness-state readiness-error" role="alert" data-readiness="error">
    <AlertTriangle aria-hidden="true" size={20} />
    <EmptyState title={title} description={description} />
    {retryLabel && onRetry ? <Button variant="secondary" onClick={onRetry}>{retryLabel}</Button> : null}
  </div>
}
