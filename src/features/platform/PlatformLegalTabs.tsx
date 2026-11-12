import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe2, Inbox, Link2, Radar, Scale } from 'lucide-react'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { loadCandidates, loadSources } from '../legislation/legislationService'
import { sourceHealth } from '../legislation/legislationModel'
import './platformLegalTabs.css'
import type { AnyRecord } from '../../types/featureTypes'

// «Νομοθεσία & πηγές» of the owner's menu (owner, 9/11/2026): one row of choices in the normal shell — the platform's
// legislation library, what the automatic check found, the sources it checks, the Library's guides & links and the
// external sources. Each choice keeps its own address, so the old links still open it.
const TARGETS: Record<string, string> = {
  legislation: '/platform/legislation',
  review: '/platform/legislation?view=review',
  checks: '/platform/legislation?view=sources',
  guides: '/platform/library',
  references: '/platform#management?group=sources',
}

export function PlatformLegalTabs({ active, counts = null }: { active: string, counts?: AnyRecord | null }) {
  const { language } = useLanguage()
  const navigate = useNavigate()
  const en = language === 'en'
  const [loaded, setLoaded] = useState<AnyRecord | null>(null)
  // The legislation screen passes its own counts; the other choices read them once.
  useEffect(() => {
    if (counts) return undefined
    let alive = true
    Promise.all([loadCandidates().catch(() => []), loadSources().catch(() => [])]).then(([candidates, sources]) => {
      if (alive) setLoaded({ review: candidates.filter(item => item.status === 'pending').length, checks: sources.filter(item => sourceHealth(item) === 'failing').length })
    })
    return () => { alive = false }
  }, [counts])
  const shown = counts || loaded || {}
  const count = (value: number) => (value > 0 ? value : null)
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
      ]}
    />
  )
}
