import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Database, KeyRound, Scale, Settings } from 'lucide-react'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'

// The platform's Settings: four tabs of one screen (lists, legislation & sources, LIRA & AI, the platform itself). The application
// menu is hidden there: «Exit» goes back. Legislation & sources has three small switches (legislation, guides, external sources).
const TARGETS = {
  lists: '/platform#management?group=libraries',
  legal: '/platform/legislation',
  lira: '/platform#management?group=lira',
  platform: '/platform/settings',
}
const LEGAL_TARGETS = {
  legislation: '/platform/legislation',
  guides: '/platform/library',
  sources: '/platform#management?group=sources',
}

export function PlatformLibrariesTabs() {
  const { language } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const en = language === 'en'
  const group = new URLSearchParams(location.hash.split('?')[1] || '').get('group')
  const legal = location.pathname.startsWith('/platform/legislation')
    ? 'legislation'
    : location.pathname.startsWith('/platform/library')
      ? 'guides'
      : group === 'sources'
        ? 'sources'
        : null
  const active = location.pathname.startsWith('/platform/settings') ? 'platform' : legal ? 'legal' : group === 'lira' ? 'lira' : 'lists'
  return (
    <>
      <div className="platform-settings-tabs-row">
        <Button variant="secondary" onClick={() => navigate('/platform')}>
          <ArrowLeft size={15} aria-hidden="true" />
          {en ? 'Exit' : 'Έξοδος'}
        </Button>
        <ModuleTabs
          className="platform-libraries-tabs"
          activeId={active}
          onChange={id => navigate(TARGETS[id])}
          ariaLabel={en ? 'Settings' : 'Ρυθμίσεις'}
          tabs={[
            { id: 'lists', label: en ? 'Lists' : 'Λίστες', icon: Database },
            { id: 'legal', label: en ? 'Legislation & sources' : 'Νομοθεσία & πηγές', icon: Scale },
            { id: 'lira', label: 'LIRA & AI', icon: KeyRound },
            { id: 'platform', label: en ? 'Platform' : 'Πλατφόρμα', icon: Settings },
          ]}
        />
      </div>
      {legal && (
        <div className="platform-settings-switch" role="group" aria-label={en ? 'Legislation & sources' : 'Νομοθεσία & πηγές'}>
          {[
            ['legislation', en ? 'Legislation' : 'Νομοθεσία'],
            ['guides', en ? 'Guides & sources' : 'Οδηγίες & πηγές'],
            ['sources', en ? 'External sources' : 'Εξωτερικές πηγές'],
          ].map(([id, label]) => (
            <button key={id} type="button" className={legal === id ? 'is-active' : ''} aria-pressed={legal === id} onClick={() => navigate(LEGAL_TARGETS[id])}>
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
