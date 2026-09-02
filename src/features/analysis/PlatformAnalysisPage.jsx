import { AnalysisPage } from './AnalysisPage'
import { PlatformAnalysisEmptyState } from './PlatformAnalysisEmptyState'

export function PlatformAnalysisPage({ organizations = [] }) {
  if (!organizations.length) return <PlatformAnalysisEmptyState />
  return <AnalysisPage platform organizations={organizations} />
}
