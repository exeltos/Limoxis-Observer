import type { ReactNode } from 'react'

interface EmptyStateProps { title?: ReactNode; description?: ReactNode }

export function EmptyState({title,description}: EmptyStateProps) { return <div className="empty-state"><strong>{title}</strong><span>{description}</span></div> }
