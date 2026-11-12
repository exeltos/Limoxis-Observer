import { useEffect, useState } from 'react'
import { CheckSquare2, ChevronRight } from 'lucide-react'
import { StatusBadge } from '../../design-system/StatusBadge'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { formatDay } from '../../core/i18n/formatDay'
import { loadQualityRecords } from './qualityService'
import { actionsOfSource } from './capaSources'
import { qualityStatusTone } from './qualityVocabulary'
import './quality.css'
import type { AnyRecord } from '../../types/featureTypes'

// «Ενέργειες»: the corrective actions opened from this record (their source is `sourceId`, or starts with it when
// `prefix`), each with its status and due date, opening the action. Nothing is shown while there is none.
export function LinkedActions({ sourceId, prefix = false, organizationId, returnTab = null, className = '' }: { sourceId: string, prefix?: boolean, organizationId: string | null | undefined, returnTab?: string | null, className?: string }) {
  const { language, t } = useLanguage()
  const en = language === 'en'
  const { goTo } = useContextualNavigation('/quality')
  const [capas, setCapas] = useState<AnyRecord[]>([])
  useEffect(() => {
    if (!sourceId) { setCapas([]); return undefined }
    let active = true
    loadQualityRecords('capas', organizationId).then(rows => { if (active) setCapas(actionsOfSource(rows || [], sourceId, { prefix })) }).catch(() => { if (active) setCapas([]) })
    return () => { active = false }
  }, [sourceId, prefix, organizationId])
  if (!capas.length) return null
  return <section className={`linked-actions ${className}`.trim()} aria-label={en ? 'Actions' : 'Ενέργειες'}>
    <h3>{en ? `Actions (${capas.length})` : `Ενέργειες (${capas.length})`}</h3>
    <ul>{capas.map(capa => <li key={capa.id}>
      <button type="button" onClick={() => goTo(`/quality/capas/${capa.id}`, { tab: returnTab })}>
        <CheckSquare2 size={15} aria-hidden="true" />
        <span className="linked-actions-main"><strong>{capa.code || capa.id}</strong><small>{en ? capa.titleEn || capa.title : capa.title}</small></span>
        {capa.dueDate && <span className="linked-actions-due">{formatDay(capa.dueDate, language)}</span>}
        <StatusBadge tone={qualityStatusTone(capa.status)}>{t(capa.status)}</StatusBadge>
        <ChevronRight size={15} aria-hidden="true" />
      </button>
    </li>)}</ul>
  </section>
}
