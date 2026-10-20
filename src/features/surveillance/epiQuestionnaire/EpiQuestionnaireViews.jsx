import { useContext, useEffect, useMemo, useState } from 'react'
import { Link2, ShieldAlert } from 'lucide-react'
import { ObserverDialog } from '../../../design-system/ObserverDialog'
import { ModeSwitch } from '../../../design-system/ModeSwitch'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { FormSubmit, useFormValidation } from '../../../design-system/FormValidation'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { TenantContext } from '../../../core/tenant/TenantContext'
import {
  EPI_ANSWER,
  EPI_CORE_KEYS,
  EPI_STEPS,
  activeEpiQuestions,
  answerOf,
  applyEpiSettings,
  buildEpiPrefill,
  cleanAnswers,
  coreOnly,
  epiCounts,
  epiDefinitionVersion,
  epiText,
  isCoreComplete,
  setEpiAnswer,
  startingAnswers,
} from './epiQuestionnaireModel'
import { fill, originWords, riskWords } from './epiQuestionnaireText'
import { loadEpiQuestionnaires, loadEpiSettings, saveEpiCoreAnswers, saveEpiQuestionnaire } from './epiQuestionnaireService'
import { athensToday } from '../forms/formStatus'
import './epiQuestionnaire.css'

const OPTIONS = t => [
  { value: EPI_ANSWER.YES, label: t('epiQuestionnaire.yes') },
  { value: EPI_ANSWER.NO, label: t('epiQuestionnaire.no') },
  { value: EPI_ANSWER.UNKNOWN, label: t('epiQuestionnaire.unknown') },
]

// One question: the wording, Ναι / Όχι / Άγνωστο, an optional detail and where a prefilled answer came from.
function QuestionRow({ question, entry, suggestion, onChange, form, withDetail = true, disabled = false }) {
  const { t, language } = useLanguage()
  const key = `question:${question.key}`
  const answer = entry?.a || null
  const label = epiText(question.label, language)
  const help = epiText(question.help, language)
  const fromSystem = entry?.src === 'prefill' || entry?.src === 'prefill_edited'
  const source = suggestion?.source ? t(`epiQuestionnaire.sources.${suggestion.source}`) : ''
  return (
    <li className={`epi-q${withDetail ? '' : ' no-detail'}`} data-field-key={key}>
      <div className="epi-q-text">
        <strong>
          {label}
          {question.core && <span className="lo-required-mark" aria-hidden="true" />}
        </strong>
        {help && <small>{help}</small>}
        {form?.errorFor(key) && <span className="field-error">{form.errorFor(key)}</span>}
      </div>
      <ModeSwitch className="epi-q-switch" ariaLabel={label} value={answer} disabled={disabled} options={OPTIONS(t)} onChange={value => onChange({ a: value })} />
      {withDetail && (
        <div className="epi-q-side">
          {answer === EPI_ANSWER.YES && (
            <input className="epi-q-detail" value={entry?.detail || ''} disabled={disabled} aria-label={`${t('epiQuestionnaire.detail')}: ${label}`} placeholder={t('epiQuestionnaire.detail')} onChange={event => onChange({ detail: event.target.value })} />
          )}
          {fromSystem && source && (
            <small className="epi-q-pre">
              <Link2 size={12} aria-hidden="true" />
              {entry.src === 'prefill_edited' && suggestion
                ? fill(t('epiQuestionnaire.edited'), { answer: t(`epiQuestionnaire.${suggestion.a}`).toLowerCase() })
                : `${t('epiQuestionnaire.prefilledFrom')}: ${source}`}
            </small>
          )}
        </div>
      )}
    </li>
  )
}

const stepOf = (question, step) => question.step === step.id

// The hospital's settings applied (wording, help, on / off) once per mount.
const useEffectiveQuestions = settings => useMemo(() => applyEpiSettings(settings || []), [settings])

// The full questionnaire of an episode: one dialog to fill in and to correct later.
export function EpiQuestionnaireDialog({ ctx, episode, row, settings, canEdit, onClose, onSaved }) {
  const { t, language } = useLanguage()
  const { notify } = useFeedback()
  const questions = useEffectiveQuestions(settings)
  const shown = activeEpiQuestions(questions)
  const episodeSamples = useMemo(
    () => (ctx.samples || []).filter(sample => [episode.id, episode.recordId].filter(Boolean).map(String).includes(String(sample.surveillanceCase || sample.surveillanceCaseId || ''))),
    [ctx.samples, episode],
  )
  const prefill = useMemo(
    () => buildEpiPrefill({ record: episode, admission: ctx.admission, samples: episodeSamples, today: athensToday(), fmtDate: ctx.fmtDate }),
    [episode, ctx.admission, episodeSamples, ctx.fmtDate],
  )
  const suggestions = useMemo(() => ({ ...prefill, ...(row?.prefilled || {}) }), [prefill, row])
  const [answers, setAnswers] = useState(() => startingAnswers(row, prefill))
  const [busy, setBusy] = useState(false)
  const counts = epiCounts(answers, shown)
  const form = useFormValidation(
    EPI_CORE_KEYS.map(key => ({ key: `question:${key}`, label: epiText(questions.find(question => question.key === key)?.label, language), valid: Boolean(answerOf(answers, key)) })),
  )
  const patch = (key, change) => setAnswers(current => setEpiAnswer(current, key, change, suggestions[key]))
  async function save() {
    setBusy(true)
    try {
      const saved = await saveEpiQuestionnaire(
        ctx.organizationId,
        ctx.isDemo ? episode.id : episode.recordId || episode.id,
        { answers: cleanAnswers(answers), prefilled: suggestions, definitionVersion: epiDefinitionVersion(settings), actorName: '' },
        { isDemo: ctx.isDemo },
      )
      notify(t('epiQuestionnaire.saved'), 'success')
      onSaved(saved)
    } catch (error) {
      notify(error?.message || t('epiQuestionnaire.saveFailed'), 'danger')
    } finally {
      setBusy(false)
    }
  }
  const subtitle = [ctx.patient?.id || episode.patientId, language === 'en' ? ctx.patient?.nameEn || episode.patientEn || episode.patient : ctx.patient?.name || episode.patient, t('epiQuestionnaire.dialogIntro')].filter(Boolean).join(' · ')
  return (
    <ObserverDialog
      width="wide"
      className="epi-q-dialog"
      eyebrow={t('epiQuestionnaire.dialogEyebrow')}
      title={t('epiQuestionnaire.dialogTitle')}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <p className="epi-q-summary" role="status">
            {fill(t('epiQuestionnaire.summary'), { answered: counts.answered, total: counts.total, core: counts.coreAnswered, unknown: counts.unknown, prefilled: counts.prefilled })}
          </p>
          {canEdit ? (
            <FormSubmit form={form} onSubmit={save} disabled={busy} loading={busy}>
              {t('save')}
            </FormSubmit>
          ) : null}
        </>
      }
    >
      <div className="epi-q-body" ref={form.scopeRef}>
        {!canEdit && <p className="field-hint">{t('epiQuestionnaire.readOnly')}</p>}
        {EPI_STEPS.map(step => {
          const list = shown.filter(question => stepOf(question, step))
          if (!list.length) return null
          return (
            <section className="epi-q-section" key={step.id}>
              <div className="epi-q-heading">
                <span>{step.id}</span>
                <div>
                  <strong>{epiText(step.title, language)}</strong>
                  <small>{epiText(step.hint, language)}</small>
                </div>
              </div>
              <ul className="epi-q-list">
                {list.map(question => (
                  <QuestionRow key={question.key} question={question} entry={answers[question.key]} suggestion={suggestions[question.key]} form={form} disabled={!canEdit} onChange={change => patch(question.key, change)} />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </ObserverDialog>
  )
}

// ---- the mini version: the three core questions, in the sample request and the sample entry ------
// `useEpiMini` keeps the three answers of a form. With an episode it loads the stored questionnaire
// (prefilled from the episode) and `save()` writes the same stored data; without one the answers
// go into the sample (`clinicalContext`) and prefill the questionnaire when an episode is opened.
export function useEpiMini({ episode = null, admission = null, samples = [], enabled = true } = {}) {
  const { language } = useLanguage()
  // Optional: the mini version also renders in dialogs opened outside a tenant (tests, previews).
  const { tenant, isDemo } = useContext(TenantContext) || {}
  const [settings, setSettings] = useState([])
  const questions = useEffectiveQuestions(settings)
  const core = useMemo(() => questions.filter(question => question.core), [questions])
  const [state, setState] = useState({ answers: {}, suggestions: {}, loaded: !episode })
  const caseKey = episode ? (isDemo ? episode.id : episode.recordId || episode.id) : ''
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    // The hospital's wording of the questions, then the stored questionnaire of the episode (if any).
    Promise.all([
      loadEpiSettings(tenant?.id, { isDemo }).catch(() => []),
      episode ? loadEpiQuestionnaires(tenant?.id, [caseKey], { isDemo }).catch(() => ({})) : Promise.resolve({}),
    ]).then(([loadedSettings, rows]) => {
      if (!alive) return
      setSettings(loadedSettings)
      if (!episode) return
      const row = rows[caseKey] || null
      const prefill = buildEpiPrefill({ record: episode, admission, samples, today: athensToday() })
      const suggestions = { ...prefill, ...(row?.prefilled || {}) }
      setState({ answers: coreOnly(startingAnswers(row, prefill)), suggestions, loaded: true })
    })
    return () => {
      alive = false
    }
    // The episode and its prefill sources are read once when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseKey, tenant?.id, isDemo, enabled])
  const rules = enabled
    ? core.map(question => ({ key: `question:${question.key}`, label: epiText(question.label, language), valid: Boolean(answerOf(state.answers, question.key)) }))
    : []
  return {
    core,
    answers: state.answers,
    suggestions: state.suggestions,
    loaded: state.loaded,
    rules,
    complete: isCoreComplete(state.answers),
    patch: (key, change) => setState(current => ({ ...current, answers: setEpiAnswer(current.answers, key, change, current.suggestions[key]) })),
    // Writes the three answers to the episode's questionnaire (the same stored data as the full dialog).
    save: () => (episode ? saveEpiCoreAnswers(tenant?.id, caseKey, cleanAnswers(state.answers), { isDemo, actorName: '' }) : Promise.resolve(null)),
    // The sample's own copy (no episode yet).
    context: () => cleanAnswers(state.answers),
  }
}

export function EpiMiniQuestions({ mini, form, episodeCode = '', className = '' }) {
  const { t } = useLanguage()
  const counts = EPI_CORE_KEYS.filter(key => answerOf(mini.answers, key)).length
  return (
    <section className={`epi-q-mini ${className}`.trim()} aria-label={t('epiQuestionnaire.miniTitle')}>
      <div className="epi-q-heading">
        <div>
          <strong>{t('epiQuestionnaire.miniTitle')}</strong>
          <small>{t('epiQuestionnaire.miniHint')}</small>
        </div>
      </div>
      <p className="epi-q-intro">
        <Link2 size={13} aria-hidden="true" />
        <span>{episodeCode ? fill(t('epiQuestionnaire.miniFromEpisode'), { code: episodeCode }) : t('epiQuestionnaire.miniAtSample')}</span>
      </p>
      <ul className="epi-q-list">
        {mini.core.map(question => (
          <QuestionRow key={question.key} question={question} entry={mini.answers[question.key]} suggestion={mini.suggestions[question.key]} form={form} withDetail={false} onChange={change => mini.patch(question.key, change)} />
        ))}
      </ul>
      <p className="field-hint">{fill(t('epiQuestionnaire.miniCount'), { n: counts })}</p>
    </section>
  )
}

// ---- header line and list reminder -----------------------------------------------------------------
// «Προέλευση: νοσοκομειακή (>48 ώρες) · Παράγοντες κινδύνου: …» in the episode header: words, no chips.
export function EpiRiskLine({ summary, row, onOpen }) {
  const { t, language } = useLanguage()
  if (!summary) return null
  return (
    <div className="epi-risk-line">
      <ShieldAlert size={14} aria-hidden="true" />
      <span>
        {t('epiQuestionnaire.originLabel')}: <b>{originWords(summary.origin, t)}</b>
      </span>
      {summary.status === 'done' ? (
        <span>
          {t('epiQuestionnaire.riskLabel')}: <b>{riskWords(row, language, t)}</b>
        </span>
      ) : (
        <span>{t('epiQuestionnaire.riskPending')}</span>
      )}
      {onOpen && (
        <button type="button" className="epi-link" onClick={onOpen}>
          {t('epiQuestionnaire.link')}
        </button>
      )}
    </div>
  )
}

// The neutral grey reminder of a list row (not a safety signal, so not coloured).
export function EpiReminder() {
  const { t } = useLanguage()
  return <StatusBadge tone="neutral">{t('epiQuestionnaire.pending')}</StatusBadge>
}
