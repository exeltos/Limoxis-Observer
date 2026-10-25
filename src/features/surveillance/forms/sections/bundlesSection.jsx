import { useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { ObserverDialog } from '../../../../design-system/ObserverDialog'
import { useLanguage } from '../../../../core/i18n/LanguageContext'
import { CAPABILITIES, isProfileDisabled } from '../../../../core/permissions/roles'
import { loadEpisodeBundleAssessments } from '../../../prevention/bundleCloudService'
import { FormEmpty, FormRow, FormRows } from '../FormRow'
import { FormSection } from '../FormSection'
import { FORM_STATUS, athensToday, bundleStatusForDevice, isActiveDevice } from '../formStatus'
import { hospitalDay } from '../../patientRecordScope'

// The devices of the episodes in scope, with the episode each belongs to. A bundle needs a
// device type that has one (central line, urinary catheter, ventilator).
export function bundleDevices(ctx) {
  return (ctx.episodes || []).flatMap(episode =>
    (episode.devices || []).filter(isActiveDevice).map(device => ({ device, episode })),
  )
}
export function bundleRowsFor(ctx, assessments, today = athensToday()) {
  return bundleDevices(ctx)
    .map(({ device, episode }) => ({ device, episode, info: bundleStatusForDevice({ device, assessments: assessments || [], today }) }))
    .filter(row => row.info.bundleKeys.length > 0)
}

const keyLabel = info => info.bundleKeys[0]
export function deviceTitle(device, language) {
  return (language === 'en' ? device.nameEn || device.name : device.name) || '—'
}

function BundleHistory({ row, ctx, onClose }) {
  const { t, language } = useLanguage()
  const { fmtDate } = ctx
  return (
    <ObserverDialog
      width="standard"
      title={t('episodeForms.bundles.history')}
      subtitle={`${deviceTitle(row.device, language)} · ${keyLabel(row.info)}`}
      onClose={onClose}
    >
      {row.info.history.length === 0 ? (
        <FormEmpty>{t('episodeForms.bundles.historyEmpty')}</FormEmpty>
      ) : (
        <FormRows label={t('episodeForms.bundles.history')}>
          {row.info.history.map(check => (
            <FormRow
              key={check.id}
              title={`${fmtDate(check.date)}${check.shift ? ` · ${check.shift}` : ''}`}
              detail={
                check.score != null
                  ? `${t('episodeForms.bundles.compliance')} ${Math.round(check.score)}%${check.deviceDay ? ` · ${t('episodeForms.bundles.day')} ${check.deviceDay}` : ''}`
                  : check.deviceDay
                    ? `${t('episodeForms.bundles.day')} ${check.deviceDay}`
                    : ''
              }
              statusLabel={check.status === 'completed' ? t('episodeForms.status.done') : t('episodeForms.status.draft')}
              date={fmtDate(check.date)}
              action={{ label: t('episodeForms.open'), onClick: () => ctx.goTo(`/prevention/bundles/${check.id}?fromTab=bundles`, { returnTab: 'episodeForms' }) }}
            />
          ))}
        </FormRows>
      )}
    </ObserverDialog>
  )
}

function BundlesSection({ ctx, section }) {
  const { t, language } = useLanguage()
  const { fmtDate } = ctx
  const [historyOf, setHistoryOf] = useState(null)
  const today = athensToday()
  const rows = useMemo(() => bundleRowsFor(ctx, section.value, today), [ctx, section.value, today])
  const overdue = rows.filter(row => row.info.status === FORM_STATUS.OVERDUE).length
  const pending = rows.filter(row => row.info.status === FORM_STATUS.PENDING).length
  // Without a device with a bundle there is nothing to show: no section, no instructions.
  if (rows.length === 0) return null
  const summary = [
    overdue && `${overdue} ${t('episodeForms.status.overdue').toLowerCase()}`,
    pending && `${pending} ${t('episodeForms.status.pending').toLowerCase()}`,
    rows.length - overdue - pending > 0 && `${rows.length - overdue - pending} ${t('episodeForms.status.done').toLowerCase()}`,
  ].filter(Boolean).join(' · ')
  return (
    <FormSection id="bundles" title={t('episodeForms.bundles.title')} icon={ShieldCheck} defaultOpen summary={summary} needsAttention={overdue > 0}>
      <FormRows label={t('episodeForms.bundles.title')}>
        {rows.map(({ device, episode, info }) => {
          const statusDetail =
            info.status === FORM_STATUS.OVERDUE
              ? `${t('episodeForms.bundles.dueWas')} ${fmtDate(info.dueOn)}`
              : info.status === FORM_STATUS.DONE
                ? `${t('episodeForms.bundles.checkedOn')} ${fmtDate(info.lastDate)}`
                : info.dueOn <= today
                  ? t('episodeForms.bundles.dueToday')
                  : `${t('episodeForms.bundles.dueOn')} ${fmtDate(info.dueOn)}`
          const detail = [
            info.deviceDay && `${t('episodeForms.bundles.day')} ${info.deviceDay}`,
            keyLabel(info),
            info.compliance != null && `${t('episodeForms.bundles.compliance')} ${info.compliance}%${info.applicable ? ` (${info.yes}/${info.applicable})` : ''}`,
            ctx.episodes.length > 1 && episode.id,
          ].filter(Boolean).join(' · ')
          return (
            <FormRow
              key={device.id}
              title={deviceTitle(device, language)}
              detail={detail}
              status={info.status}
              statusDetail={statusDetail}
              date={info.lastDate ? fmtDate(hospitalDay(info.lastDate)) : ''}
              dateLabel={info.lastDate ? t('episodeForms.bundles.lastCheck') : t('episodeForms.bundles.noCheck')}
              action={{ label: t('episodeForms.bundles.history'), onClick: () => setHistoryOf({ device, episode, info }) }}
            />
          )
        })}
      </FormRows>
      {historyOf && <BundleHistory row={historyOf} ctx={ctx} onClose={() => setHistoryOf(null)} />}
    </FormSection>
  )
}

// Section definition for the registry. The bundle checks are read once per episode scope.
export const bundlesSection = {
  id: 'bundles',
  order: 10,
  canSee: ctx =>
    ctx.has(CAPABILITIES.VIEW_SURVEILLANCE) &&
    !isProfileDisabled(CAPABILITIES.VIEW_PREVENTION) &&
    (ctx.has(CAPABILITIES.RECORD_PREVENTION_BUNDLE) || ctx.has(CAPABILITIES.VIEW_PREVENTION)) &&
    (ctx.episodes || []).length > 0,
  load: ctx => loadEpisodeBundleAssessments(ctx.organizationId, (ctx.episodes || []).map(episode => episode.recordId || episode.id)),
  Component: BundlesSection,
  buildReport(ctx, section) {
    const rows = bundleRowsFor(ctx, section.value)
    if (!rows.length) return null
    const { language, t, fmtDate } = ctx
    return {
      id: 'bundles',
      title: t('episodeForms.bundles.title'),
      list: rows.map(({ device, info }) =>
        [
          deviceTitle(device, language),
          keyLabel(info),
          info.deviceDay && `${t('episodeForms.bundles.day')} ${info.deviceDay}`,
          t(`episodeForms.status.${info.status}`),
          info.lastDate && `${t('episodeForms.bundles.lastCheck')} ${fmtDate(info.lastDate)}`,
          info.compliance != null && `${t('episodeForms.bundles.compliance')} ${info.compliance}%`,
        ].filter(Boolean).join(' · '),
      ),
    }
  },
}
