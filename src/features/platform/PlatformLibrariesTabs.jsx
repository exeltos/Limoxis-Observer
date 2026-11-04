import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpenCheck, Database, KeyRound, LibraryBig, Scale, Settings } from 'lucide-react'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'

// The platform's Settings & libraries: the lists, the indicator data, LIRA & AI, the legislation, the Library's guides and
// sources and the platform settings are tabs of one screen (the application menu is hidden there: «Exit» goes back).
const TARGETS = {
  lists: '/platform#management?group=libraries',
  data: '/platform#management?group=data',
  lira: '/platform#management?group=lira',
  legislation: '/platform/legislation',
  sources: '/platform/library',
  platform: '/platform/settings',
}

export function PlatformLibrariesTabs() {
  const { language } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const en = language === 'en'
  const group = new URLSearchParams(location.hash.split('?')[1] || '').get('group')
  const active = location.pathname.startsWith('/platform/settings')
    ? 'platform'
    : location.pathname.startsWith('/platform/legislation')
    ? 'legislation'
    : location.pathname.startsWith('/platform/library')
      ? 'sources'
      : group === 'data'
        ? 'data'
        : group === 'lira'
          ? 'lira'
          : 'lists'
  return (
    <div className="platform-settings-tabs-row">
      <Button variant="secondary" onClick={() => navigate('/platform')}>
        <ArrowLeft size={15} aria-hidden="true" />
        {en ? 'Exit' : 'Έξοδος'}
      </Button>
      <ModuleTabs
      className="platform-libraries-tabs"
      activeId={active}
      onChange={id => navigate(TARGETS[id])}
      ariaLabel={en ? 'Settings & libraries' : 'Ρυθμίσεις & Βιβλιοθήκες'}
      tabs={[
        { id: 'lists', label: en ? 'Lists & settings' : 'Λίστες & ρυθμίσεις', icon: Database },
        { id: 'data', label: en ? 'Indicator data' : 'Δεδομένα δεικτών', icon: BookOpenCheck },
        { id: 'lira', label: 'LIRA & AI', icon: KeyRound },
        { id: 'legislation', label: en ? 'Legislation' : 'Νομοθεσία', icon: Scale },
        { id: 'sources', label: en ? 'Guides & sources' : 'Οδηγίες & πηγές', icon: LibraryBig },
        { id: 'platform', label: en ? 'Platform settings' : 'Ρυθμίσεις πλατφόρμας', icon: Settings },
      ]}
    />
    </div>
  )
}
