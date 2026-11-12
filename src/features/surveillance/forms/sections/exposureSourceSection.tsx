import { ShieldAlert } from 'lucide-react'
import { useLanguage } from '../../../../core/i18n/LanguageContext'
import { CAPABILITIES, isProfileDisabled } from '../../../../core/permissions/roles'
import { ROLES } from '../../../../core/permissions/systemRoleMatrix'
import { countSourceExposuresAsync } from '../../../occupational-health/exposureIncidentService'
import { FormLine } from '../FormSection'
import type { AnyRecord } from '../../../../types/featureTypes'

// «Πηγή έκθεσης για N εργαζόμενους»: on the episode of the source patient, a number and nothing
// else (never names). It is read through surveillance_case_exposure_count, so it needs no right
// on the occupational-health tables. The link to the exposures is only for the roles that read them.
export const canOpenExposures = (ctx: AnyRecord) => ctx.role === ROLES.OCCUPATIONAL_PHYSICIAN || ctx.has(CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH)
const caseRef = (ctx: AnyRecord, episode: AnyRecord) => (ctx.isDemo ? episode.id : episode.recordId || episode.id)

interface ExposureSourceLineProps {
  ctx: AnyRecord
  section: string
}
function ExposureSourceLine({ ctx, section }: ExposureSourceLineProps) {
  const { t } = useLanguage()
  const count = Number(section.value) || 0
  if (!count) return null
  return (
    <FormLine
      id="exposureSource"
      icon={ShieldAlert}
      title={t('episodeForms.exposureSource.label')}
      summary={`${count} ${count === 1 ? t('episodeForms.exposureSource.one') : t('episodeForms.exposureSource.many')}`}
      action={
        canOpenExposures(ctx) && (
          <button type="button" className="episode-form-link" onClick={() => ctx.goTo('/occupational-health', { returnTab: 'episodeForms' })}>
            {t('episodeForms.exposureSource.view')}
          </button>
        )
      }
    />
  )
}

export const exposureSourceSection = {
  id: 'exposureSource',
  order: 95,
  canSee: (ctx: AnyRecord) => ctx.has(CAPABILITIES.VIEW_SURVEILLANCE) && !isProfileDisabled(CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH) && (ctx.episodes || []).length > 0,
  load: async (ctx: AnyRecord) => {
    const counts = await Promise.all((ctx.episodes || []).map(episode => countSourceExposuresAsync(ctx.organizationId, caseRef(ctx, episode))))
    return counts.reduce((sum, value) => sum + value, 0)
  },
  Component: ExposureSourceLine,
  buildReport(ctx: AnyRecord, section: string) {
    const count = Number(section.value) || 0
    if (!count) return null
    return {
      id: 'exposureSource',
      title: ctx.t('episodeForms.exposureSource.label'),
      list: [`${count} ${count === 1 ? ctx.t('episodeForms.exposureSource.one') : ctx.t('episodeForms.exposureSource.many')}`],
    }
  },
}
