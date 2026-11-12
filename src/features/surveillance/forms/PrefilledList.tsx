import { Lock } from 'lucide-react'
import { DetailList } from '../../../design-system/DetailList'
import { useLanguage } from '../../../core/i18n/LanguageContext'

// The one «Προσυμπληρωμένα» block of every form opened from an episode: what the form
// already knows (patient, admission, episode, device …) as a locked read-only list, so the
// user fills in only what is new. `items` is [{ label, value }]; blanks are left out.
export function PrefilledList({ items = [], className = '' }) {
  const { t } = useLanguage()
  const shown = items.filter(item => item && item.value != null && String(item.value).trim() !== '')
  if (!shown.length) return null
  return (
    <section className={`episode-prefilled ${className}`.trim()} aria-label={t('episodeForms.prefilled')}>
      <p className="episode-prefilled-title">
        <Lock size={12} aria-hidden="true" />
        {t('episodeForms.prefilled')}
      </p>
      <DetailList sections={[{ key: 'prefilled', items: shown }]} />
    </section>
  )
}
