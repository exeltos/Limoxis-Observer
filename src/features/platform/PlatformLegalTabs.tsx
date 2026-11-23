import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe2, History, Inbox, Link2, Radar, Scale } from 'lucide-react'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { loadCandidates, loadSources } from '../legislation/legislationService'
import { sourceHealth } from '../legislation/legislationModel'
import { loadPendingClinicalUpdates } from '../management/clinicalContentSourceService'
import './platformLegalTabs.css'

// «Νομοθεσία & πηγές» of the owner's menu (owner, 9/11/2026): one row of choices in the normal shell — the platform's
// legislation library, what the automatic check found, the sources it checks, the Library's guides & links, the
// external sources and the clinical sources' update center. Each choice keeps its own address, so the old links still open it.
const TARGETS: Record<string, string> = {
  legislation: '/platform/legislation',
  review: '/platform/legislation?view=review',
  checks: '/platform/legislation?view=sources',
  guides: '/platform/library',
  references: '/platform#management?group=sources',
  clinical: '/platform#management?group=clinical',
}

// The counts on the tabs: legislation to review, failing sources and clinical source changes to review.
export type LegalTabCounts = { review?: number, checks?: number, clinical?: number }

// clinicalCount: the screen that holds the clinical review queue passes its live length, so the badge follows a review.
export function PlatformLegalTabs({ active, counts = null, clinicalCount }: { active: string, counts?: LegalTabCounts | null, clinicalCount?: number }) {
  const { language } = useLanguage()
  const navigate = useNavigate()
  const en = language === 'en'
  const [loaded, setLoaded] = useState<LegalTabCounts | null>(null)
  // The legislation screen passes its own counts; the other choices read them once.
  useEffect(() => {
    let alive = true
    // The legislation screen passes its own counts: only the clinical ones are read here then.
    if (counts) {
      loadPendingClinicalUpdates().then(rows => { if (alive) setLoaded({ clinical: rows.length }) }).catch(() => {})
      return () => { alive = false }
    }
    Promise.all([loadCandidates().catch(() => []), loadSources().catch(() => []), loadPendingClinicalUpdates().catch(() => [])]).then(([candidates, sources, clinical]) => {
      if (alive) setLoaded({ review: candidates.filter(item => item.status === 'pending').length, checks: sources.filter(item => sourceHealth(item) === 'failing').length, clinical: clinical.length })
    })
    return () => { alive = false }
  }, [counts])
  const shown: LegalTabCounts = { ...loaded, ...counts, ...(clinicalCount !== undefined ? { clinical: clinicalCount } : {}) }
  const count = (value: number | undefined) => (value !== undefined && value > 0 ? value : null)
  return (
    <ModuleTabs
      className="platform-legal-tabs"
      activeId={active}
      onChange={id => id !== active && navigate(TARGETS[id])}
      ariaLabel={en ? 'Legislation & sources' : 'Νομοθεσία & πηγές'}
      tabs={[
        { id: 'legislation', label: en ? 'Legislation' : 'Νομοθεσία', icon: Scale },
        { id: 'review', label: en ? 'To review' : 'Προς έλεγχο', icon: Inbox, count: count(shown.review) },
        { id: 'checks', label: en ? 'Legislation sources' : 'Πηγές νομοθεσίας', icon: Radar, count: count(shown.checks) },
        { id: 'guides', label: en ? 'Guides & links' : 'Οδηγίες & σύνδεσμοι', icon: Link2 },
        { id: 'references', label: en ? 'External sources' : 'Εξωτερικές πηγές', icon: Globe2 },
        // The governed clinical sources (SCCM, WHO, CDC…): what changed since the last check, and its history (owner, 23/11/2026).
        { id: 'clinical', label: en ? 'Clinical sources' : 'Κλινικές πηγές', icon: History, count: count(shown.clinical) },
      ]}
    />
  )
}
