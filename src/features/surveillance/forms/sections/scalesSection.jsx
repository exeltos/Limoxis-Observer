import { Stethoscope } from 'lucide-react'
import { useLanguage } from '../../../../core/i18n/LanguageContext'
import { CAPABILITIES } from '../../../../core/permissions/roles'
import { PatientClinicalScalesPanel } from '../../../clinical-scales/PatientClinicalScalesPanel'
import { FormSection } from '../FormSection'

function ScalesSection({ ctx }) {
  const { t } = useLanguage()
  const { patient, admission, episodes } = ctx
  return (
    <FormSection id="scales" title={t('episodeForms.scales.title')} icon={Stethoscope} defaultOpen>
      <PatientClinicalScalesPanel
        organizationId={ctx.organizationId}
        patient={patient}
        admission={admission}
        isDemo={ctx.isDemo}
        language={ctx.language}
        canRecord={ctx.has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)}
        hasActiveEpisode={episodes.some(ep => ep.status === 'active')}
        onStartProtocol={ctx.startProtocol}
      />
    </FormSection>
  )
}

export const scalesSection = {
  id: 'scales',
  order: 20,
  canSee: ctx => Boolean(ctx.patient) && ctx.has(CAPABILITIES.VIEW_SURVEILLANCE),
  Component: ScalesSection,
}
