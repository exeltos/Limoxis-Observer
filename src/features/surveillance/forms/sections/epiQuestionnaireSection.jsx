import { useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useLanguage } from '../../../../core/i18n/LanguageContext'
import { CAPABILITIES } from '../../../../core/permissions/roles'
import { FormEmpty, FormRow, FormRows } from '../FormRow'
import { FormSection } from '../FormSection'
import { FORM_STATUS } from '../formStatus'
import { EpiQuestionnaireDialog } from '../../epiQuestionnaire/EpiQuestionnaireViews'
import { activeEpiQuestions, applyEpiSettings, answerOf, epiCounts, epiSummary, epiText } from '../../epiQuestionnaire/epiQuestionnaireModel'
import { canWriteEpi, fill, originWords, riskWords } from '../../epiQuestionnaire/epiQuestionnaireText'
import { loadEpiQuestionnaires, loadEpiSettings } from '../../epiQuestionnaire/epiQuestionnaireService'

// «Επιδημιολογικό ιστορικό»: the epidemiological questionnaire of the episode, as a section of the
// «Φόρμες & ερωτηματολόγια» tab. One row per episode (the questionnaire is one per episode); the
// action opens the same dialog that fills it in and corrects it later. See docs/EPI_QUESTIONNAIRE.md.
export const epiCaseKey = (ctx, episode) => (ctx.isDemo ? episode.id : episode.recordId || episode.id)

const samplesOf = (ctx, episode) =>
  (ctx.samples || []).filter(sample => [episode.id, episode.recordId].filter(Boolean).map(String).includes(String(sample.surveillanceCase || sample.surveillanceCaseId || '')))

// One entry per episode: the stored questionnaire (or none), and what is worked out from it.
export function epiRows(ctx, value) {
  const stored = value?.rows || {}
  return (ctx.episodes || []).map(episode => {
    const row = stored[epiCaseKey(ctx, episode)] || null
    return { key: epiCaseKey(ctx, episode), episode, row, summary: epiSummary({ row, record: episode, admissionDate: ctx.admission?.admissionDate || ctx.patient?.admissionDate, samples: samplesOf(ctx, episode) }) }
  })
}

function EpiQuestionnaireSection({ ctx, section, reload }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(null)
  const rows = useMemo(() => epiRows(ctx, section.value), [ctx, section.value])
  const settings = useMemo(() => section.value?.settings || [], [section.value])
  const questions = useMemo(() => activeEpiQuestions(applyEpiSettings(settings)), [settings])
  const pending = rows.filter(item => item.summary.status !== 'done').length
  const canEdit = canWriteEpi(ctx.role)
  const first = rows[0]
  const counts = first?.row ? epiCounts(first.row.answers, questions) : null
  const summary = pending
    ? `${t('epiQuestionnaire.pending')}${rows.length === 1 ? ` · ${t('epiQuestionnaire.coreHint')}` : ''}`
    : counts && rows.length === 1
      ? fill(t('epiQuestionnaire.rowDetail'), { answered: counts.answered, total: counts.total, unknown: counts.unknown })
      : t('episodeForms.status.done')
  return (
    <FormSection id="epiQuestionnaire" title={t('epiQuestionnaire.sectionTitle')} icon={ClipboardList} summary={summary} needsAttention={pending > 0 && canEdit}>
      {rows.length === 0 ? (
        <FormEmpty>{t('epiQuestionnaire.empty')}</FormEmpty>
      ) : (
        <FormRows label={t('epiQuestionnaire.sectionTitle')}>
          {rows.map(item => {
            const done = item.summary.status === 'done'
            const rowCounts = item.row ? epiCounts(item.row.answers, questions) : null
            const detail = [
              rows.length > 1 && item.episode.id,
              done ? fill(t('epiQuestionnaire.rowDetail'), { answered: rowCounts.answered, total: rowCounts.total, unknown: rowCounts.unknown }) : t('epiQuestionnaire.rowPendingDetail'),
            ]
              .filter(Boolean)
              .join(' · ')
            const updated = item.row?.updatedAt || ''
            return (
              <FormRow
                key={item.key}
                title={t('epiQuestionnaire.sectionTitle')}
                detail={detail}
                status={done ? FORM_STATUS.DONE : FORM_STATUS.PENDING}
                date={updated ? ctx.fmtDate(updated) : ''}
                dateLabel={updated ? t('epiQuestionnaire.updatedOn') : ''}
                action={{ label: t('episodeForms.open'), onClick: () => setOpen(item) }}
              />
            )
          })}
        </FormRows>
      )}
      {open && (
        <EpiQuestionnaireDialog
          ctx={ctx}
          episode={open.episode}
          row={open.row}
          settings={settings}
          canEdit={canEdit}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null)
            reload()
          }}
        />
      )}
    </FormSection>
  )
}

export const epiQuestionnaireSection = {
  id: 'epiQuestionnaire',
  order: 50,
  canSee: ctx => ctx.has(CAPABILITIES.VIEW_SURVEILLANCE) && (ctx.episodes || []).length > 0,
  load: async ctx => {
    const ids = (ctx.episodes || []).map(episode => epiCaseKey(ctx, episode))
    const [rows, settings] = await Promise.all([loadEpiQuestionnaires(ctx.organizationId, ids, { isDemo: ctx.isDemo }), loadEpiSettings(ctx.organizationId, { isDemo: ctx.isDemo }).catch(() => [])])
    return { rows, settings }
  },
  Component: EpiQuestionnaireSection,
  // The printed report: origin, risk factors and every answer in words (one block per episode).
  buildReport(ctx, section) {
    const rows = epiRows(ctx, section.value)
    if (!rows.length || !section.value) return null
    const questions = activeEpiQuestions(applyEpiSettings(section.value.settings || []))
    const word = key => ctx.t(`epiQuestionnaire.${key}`)
    const items = rows.map(item => {
      const answers = item.row?.answers || {}
      const pairs = [[word('originLabel'), originWords(item.summary.origin, ctx.t)]]
      if (item.summary.status === 'done') {
        pairs.push([word('riskLabel'), riskWords(item.row, ctx.language, ctx.t)])
        for (const question of questions) {
          const answer = answerOf(answers, question.key)
          if (!answer) continue
          const detail = answers[question.key].detail
          pairs.push([epiText(question.short, ctx.language), `${word(answer)}${answer === 'yes' && detail ? ` · ${detail}` : ''}`])
        }
        pairs.push([word('version'), String(item.row.definitionVersion || 1)])
      } else pairs.push([word('link'), word('pending').split(': ')[1] || word('pending')])
      return { title: rows.length > 1 ? item.episode.id : '', pairs }
    })
    return { id: 'epiQuestionnaire', title: ctx.t('epiQuestionnaire.sectionTitle'), items }
  },
}
