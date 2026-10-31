import { useCallback, useMemo, useState } from 'react'
import { Plus, Stethoscope } from 'lucide-react'
import { Button } from '../../../../design-system/Button'
import { useLanguage } from '../../../../core/i18n/LanguageContext'
import { CAPABILITIES } from '../../../../core/permissions/roles'
import { PatientClinicalScalesPanel } from '../../../clinical-scales/PatientClinicalScalesPanel'
import { scaleShortName } from '../../../clinical-scales/ClinicalRiskFlags'
import { scoreBandLabel } from '../../../clinical-scales/ClinicalScaleViews'
import { FormEmpty, FormRow, FormRows } from '../FormRow'
import { FormSection } from '../FormSection'
import { FORM_STATUS } from '../formStatus'
import { episodeContext } from '../formPrefill'
import { scaleTrend } from '../scaleTrend'

// A scale appears when it has an assessment, or when the hospital requires it; the others
// are reached from «New assessment», which lists every tool.
const listed = item => item.latest || item.availability === 'required'
const statusOf = item => (item.state === 'overdue' ? FORM_STATUS.OVERDUE : item.state === 'completed' || item.state === 'current' ? FORM_STATUS.DONE : FORM_STATUS.PENDING)
// «Κλίμακες» rows as plain data (screen and printed report share it).
export function scaleLines({ scaleContext = [], ctx }) {
  const en = ctx.language === 'en'
  return scaleContext.filter(listed).map(item => {
    const band = item.latest ? scoreBandLabel(item.scale_key, item.latest.score, en) : null
    const trend = scaleTrend({ item, t: ctx.t, fmtDate: ctx.fmtDate })
    return { item, band, trend, status: statusOf(item) }
  })
}

function ScalesSection({ ctx }) {
  const { t } = useLanguage()
  const [data, setData] = useState({ scaleContext: [], rows: [] })
  const [request, setRequest] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const canRecord = ctx.has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)
  const onContext = useCallback(value => setData(value), [])
  const lines = useMemo(() => scaleLines({ scaleContext: data.scaleContext, ctx }), [data.scaleContext, ctx])
  const base = episodeContext(ctx)
  const prefillItems = [
    { label: t('episodeForms.prefill.patient'), value: base.patientLabel },
    { label: t('episodeForms.prefill.admission'), value: base.admissionLabel },
    { label: t('episodeForms.prefill.episode'), value: base.episodeLabel },
  ]
  const ask = definitionId => setRequest({ nonce: Date.now(), definitionId })
  const flagged = lines.filter(line => line.item.latest).slice(0, 4)
  const summary = flagged.length ? flagged.map(line => `${scaleShortName(line.item.scale_key)} ${line.item.latest.score}`).join(' · ') : t('episodeForms.scales.none')
  const overdue = lines.some(line => line.status === FORM_STATUS.OVERDUE)
  return (
    <FormSection
      id="scales"
      title={t('episodeForms.scales.title')}
      icon={Stethoscope}
      defaultOpen
      summary={summary}
      needsAttention={overdue}
      actions={
        canRecord && (
          <Button variant="secondary" onClick={() => ask(null)}>
            <Plus size={14} aria-hidden="true" />
            {t('episodeForms.scales.new')}
          </Button>
        )
      }
    >
      {lines.length === 0 ? (
        <FormEmpty>{canRecord ? t('episodeForms.scales.empty') : t('episodeForms.scales.emptyReadOnly')}</FormEmpty>
      ) : (
        <FormRows label={t('episodeForms.scales.title')}>
          {lines.map(({ item, band, trend, status }) => {
            // The risk band is the badge beside the title when it is a safety signal; else it is a word here.
            const flagged = band && (band.tone === 'danger' || band.tone === 'warning')
            const detail = item.latest
              ? [`${t('episodeForms.scales.score')} ${item.latest.score}`, !flagged && band?.label, trend.text].filter(Boolean).join(' · ')
              : t('episodeForms.scales.notRecorded')
            return (
              <FormRow
                key={item.id}
                title={`${scaleShortName(item.scale_key)}`}
                badge={flagged ? { label: band.label, tone: band.tone === 'danger' ? 'danger' : 'warning' } : null}
                detail={detail}
                status={status}
                date={item.latest ? ctx.fmtDateTime(item.latest.assessed_at) : ''}
                dateLabel={item.latest ? t('episodeForms.scales.lastAssessment') : ''}
                action={canRecord ? { label: t('episodeForms.new'), onClick: () => ask(item.id) } : null}
              />
            )
          })}
        </FormRows>
      )}
      <div className="episode-form-more">
        {data.rows.length > 0 && (
          <button type="button" className="episode-form-link" onClick={() => setShowAll(value => !value)} aria-expanded={showAll}>
            {showAll ? t('episodeForms.scales.hideAll') : `${t('episodeForms.scales.all')} (${data.rows.length})`}
          </button>
        )}
      </div>
      <PatientClinicalScalesPanel
        organizationId={ctx.organizationId}
        patient={ctx.patient}
        admission={ctx.admission}
        episode={ctx.record}
        isDemo={ctx.isDemo}
        language={ctx.language}
        canRecord={canRecord}
        hasActiveEpisode={ctx.episodes.some(ep => ep.status === 'active')}
        onStartProtocol={ctx.startProtocol}
        hideTable={!showAll}
        newRequest={request}
        onContext={onContext}
        onChange={ctx.onScalesChanged}
        prefillItems={prefillItems}
        canDelete={ctx.canDelete}
      />
    </FormSection>
  )
}

export const scalesSection = {
  id: 'scales',
  order: 20,
  canSee: ctx => Boolean(ctx.patient) && (ctx.has(CAPABILITIES.VIEW_SURVEILLANCE) || ctx.has(CAPABILITIES.VIEW_PATIENTS)),
  Component: ScalesSection,
  // The printed record lists the patient's latest score per scale (the page already read them for the header chips).
  buildReport(ctx) {
    const latest = new Map()
    for (const row of ctx.scaleRows || []) if (!latest.has(row.scale_key)) latest.set(row.scale_key, row)
    if (!latest.size) return null
    return {
      id: 'scales',
      title: ctx.t('episodeForms.scales.title'),
      list: [...latest.values()].map(row =>
        [scaleShortName(row.scale_key), `${ctx.t('episodeForms.scales.score')} ${row.score ?? '—'}`, row.assessed_at && ctx.fmtDateTime(row.assessed_at)].filter(Boolean).join(' · '),
      ),
    }
  },
}
