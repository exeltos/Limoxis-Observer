import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpenCheck, Database, KeyRound, LibraryBig, Scale } from 'lucide-react'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { useLanguage } from '../../core/i18n/LanguageContext'

// The platform's Libraries: the lists and settings, the indicator data, LIRA & AI, the legislation and the
// Library's sources are tabs of one menu entry.
const TARGETS = {
  lists: '/platform#management?group=libraries',
  data: '/platform#management?group=data',
  lira: '/platform#management?group=lira',
  legislation: '/platform/legislation',
  sources: '/platform/library',
}

export function PlatformLibrariesTabs() {
  const { language } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const en = language === 'en'
  const group = new URLSearchParams(location.hash.split('?')[1] || '').get('group')
  const active = location.pathname.startsWith('/platform/legislation')
    ? 'legislation'
    : location.pathname.startsWith('/platform/library')
      ? 'sources'
      : group === 'data'
        ? 'data'
        : group === 'lira'
          ? 'lira'
          : 'lists'
  return (
    <ModuleTabs
      className="platform-libraries-tabs"
      activeId={active}
      onChange={id => navigate(TARGETS[id])}
      ariaLabel={en ? 'Libraries' : 'Βιβλιοθήκες'}
      tabs={[
        { id: 'lists', label: en ? 'Lists & settings' : 'Λίστες & ρυθμίσεις', icon: Database },
        { id: 'data', label: en ? 'Indicator data' : 'Δεδομένα δεικτών', icon: BookOpenCheck },
        { id: 'lira', label: 'LIRA & AI', icon: KeyRound },
        { id: 'legislation', label: en ? 'Legislation' : 'Νομοθεσία', icon: Scale },
        { id: 'sources', label: en ? 'Guides & sources' : 'Οδηγίες & πηγές', icon: LibraryBig },
      ]}
    />
  )
}
