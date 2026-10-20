import { useMemo } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { Button } from '../../../../design-system/Button'
import { useLanguage } from '../../../../core/i18n/LanguageContext'
import { CAPABILITIES } from '../../../../core/permissions/roles'
import { loadLinkedIncidents } from '../../../quality/qualityService'
import { FormEmpty, FormRow, FormRows } from '../FormRow'
import { FormSection } from '../FormSection'
import { FORM_STATUS } from '../formStatus'
import { incidentSource } from '../formPrefill'

const episodeIds = ctx => (ctx.episodes || []).map(episode => episode.recordId || episode.id)
const incidentTitle = (row, language) => (language === 'en' ? row.titleEn || row.title : row.title) || row.id
const isClosed = row => row.status === 'closed' || row.lifecycleStatus === 'voided'

export function incidentRows(ctx, rows = []) {
  return rows.map(row => ({
    key: row.id,
    row,
    title: incidentTitle(row, ctx.language),
    code: row.displayId || row.id,
    date: row.date,
    done: isClosed(row),
  }))
}

function IncidentsSection({ ctx, section }) {
  const { t } = useLanguage()
  const { fmtDate } = ctx
  const rows = useMemo(() => incidentRows(ctx, section.value || []), [ctx, section.value])
  const open = rows.filter(row => !row.done).length
  const summary = rows.length ? `${rows.length} ${t('episodeForms.incidents.count')}${open ? ` · ${open} ${t('episodeForms.status.pending').toLowerCase()}` : ''}` : t('episodeForms.incidents.none')
  const report = () =>
    ctx.goTo('/quality/report', { returnTab: 'episodeForms', state: { episodeSource: incidentSource(ctx) } })
  return (
    <FormSection
      id="incidents"
      title={t('episodeForms.incidents.title')}
      icon={AlertTriangle}
      summary={summary}
      actions={
        <Button variant="secondary" onClick={report}>
          <Plus size={14} aria-hidden="true" />
          {t('episodeForms.incidents.report')}
        </Button>
      }
    >
      {rows.length === 0 ? (
        <FormEmpty>{t('episodeForms.incidents.empty')}</FormEmpty>
      ) : (
        <FormRows label={t('episodeForms.incidents.title')}>
          {rows.map(item => (
            <FormRow
              key={item.key}
              title={item.title}
              detail={[item.code, ctx.language === 'en' ? item.row.departmentEn || item.row.department : item.row.department].filter(Boolean).join(' · ')}
              status={item.done ? FORM_STATUS.DONE : FORM_STATUS.PENDING}
              statusDetail={t(item.row.status)}
              date={item.date ? fmtDate(item.date) : ''}
              dateLabel={item.date ? t('episodeForms.incidents.date') : ''}
              action={{ label: t('episodeForms.open'), onClick: () => ctx.goTo(`/quality/incidents/${item.row.id}`, { returnTab: 'episodeForms' }) }}
            />
          ))}
        </FormRows>
      )}
    </FormSection>
  )
}

export const incidentsSection = {
  id: 'incidents',
  order: 40,
  // Whoever can report an incident or read Quality; the list shows only what the policies let them read.
  canSee: ctx => (ctx.has(CAPABILITIES.REPORT_INCIDENT) || ctx.has(CAPABILITIES.VIEW_QUALITY)) && Boolean(ctx.record || ctx.admission),
  load: ctx =>
    loadLinkedIncidents(ctx.organizationId, {
      caseIds: episodeIds(ctx),
      admissionId: ctx.isDemo ? null : ctx.admission?.id || null,
      patientCode: ctx.patient?.id || '',
    }),
  Component: IncidentsSection,
  buildReport(ctx, section) {
    const rows = incidentRows(ctx, section.value || [])
    if (!rows.length) return null
    return {
      id: 'incidents',
      title: ctx.t('episodeForms.incidents.title'),
      list: rows.map(item => [item.code, item.title, item.date && ctx.fmtDate(item.date), ctx.t(item.row.status)].filter(Boolean).join(' · ')),
    }
  },
}
