import { Biohazard } from 'lucide-react'
import { useLanguage } from '../../../../core/i18n/LanguageContext'
import { CAPABILITIES, isProfileDisabled } from '../../../../core/permissions/roles'
import { ROLES } from '../../../../core/permissions/systemRoleMatrix'
import { loadPatientOutbreakLinks } from '../../../lira/liraPatientLinks'
import { FormLine } from '../FormSection'

// The roles the database lets read the outbreak investigations (RLS of lira_outbreak_*). The
// line is read-only information, not a form: it closes the tab and says nothing to others.
export const OUTBREAK_ROLES = Object.freeze([ROLES.PLATFORM_OWNER, ROLES.HOSPITAL_ADMIN, ROLES.INFECTION_CONTROL_LEAD, ROLES.INFECTION_CONTROL_MEMBER, ROLES.LABORATORY, ROLES.DOCTOR_REVIEWER, ROLES.QUALITY_MANAGER])

export function outbreakText(ctx, link) {
  const en = ctx.language === 'en'
  const month = link.from ? new Date(link.from).toLocaleDateString(en ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric' }) : ''
  const status = ctx.t(`episodeForms.outbreak.status.${link.status}`)
  const cases = link.cases ? `${link.cases} ${ctx.t('episodeForms.outbreak.cases')}` : ''
  return `${[link.title, en ? link.departmentEn || link.department : link.department, month].filter(Boolean).join(' · ')} (${[status, cases].filter(Boolean).join(', ')})`
}

function OutbreakLine({ ctx, section }) {
  const { t } = useLanguage()
  const links = section.value || []
  if (!links.length) return null
  const canOpen = ctx.has(CAPABILITIES.VIEW_LIRA)
  return links.map(link => (
    <FormLine
      key={link.id}
      id="outbreak"
      icon={Biohazard}
      title={t('episodeForms.outbreak.label')}
      summary={outbreakText(ctx, link)}
      action={
        canOpen && (
          <button type="button" className="episode-form-link" onClick={() => ctx.goTo(`/surveillance?tab=outbreaks&investigation=${encodeURIComponent(link.id)}`, { returnTab: 'episodeForms' })}>
            {t('episodeForms.outbreak.open')}
          </button>
        )
      }
    />
  ))
}

export const outbreakSection = {
  id: 'outbreak',
  order: 90,
  canSee: ctx => OUTBREAK_ROLES.includes(ctx.role) && !isProfileDisabled(CAPABILITIES.VIEW_LIRA) && Boolean(ctx.patient),
  load: ctx => loadPatientOutbreakLinks(ctx.organizationId, { patientRecordId: ctx.patient?.recordId || null, patientCode: ctx.patient?.id || '' }, { isDemo: ctx.isDemo }),
  Component: OutbreakLine,
  buildReport(ctx, section) {
    const links = section.value || []
    if (!links.length) return null
    return { id: 'outbreak', title: ctx.t('episodeForms.outbreak.label'), list: links.map(link => outbreakText(ctx, link)) }
  },
}
