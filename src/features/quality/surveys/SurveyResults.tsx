import { useState } from 'react'
import { BarChart3,CalendarDays,CheckSquare2,Building2 } from 'lucide-react'
import { CanonicalTabs } from '../../../design-system/CanonicalTabs'
import { Meter, Sparkline, meterTone } from '../../../design-system/MiniCharts'
import { formatDay } from '../../../core/i18n/formatDay'
import { departmentBreakdown, monthlyTrend, scaleOf, sectionLabel, surveySummary, textOf } from './surveyModel'
import type { AnyRecord } from '../../../types/featureTypes'
import type { Survey, SurveyResponse } from './surveyModel'

// A share as the language writes it: 86,6% in Greek, 86.6% in English.
const pct = (value: number | null | undefined, en = false) => (value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)}%`)
const npsText = (value: number | null | undefined) => (value == null ? '—' : value > 0 ? `+${value}` : String(value))
const toneFor = (value: number | null | undefined, target: number) => meterTone(value, { good: target, fair: Math.max(0, target - 15) })

// What the answers say: the headline figures, what falls below the target (each
// can open a corrective action), each department, the trend and every question.
export function SurveyResults({ survey, responses, language = 'el', canAct = false, onAction, showLine = true }: { survey: Survey, responses: SurveyResponse[], language?: string, canAct?: boolean, onAction?: (result: AnyRecord) => void, showLine?: boolean }) {
  const en = language === 'en'
  const summary = surveySummary(survey, responses)
  const departments = departmentBreakdown(survey, responses, language)
  const trend = monthlyTrend(survey, responses)
  const sections: string[] = [...new Set<string>((survey.questions || []).map((question: AnyRecord) => question.section || ''))]
  const [view, setView] = useState('summary')
  const views = [{ value: 'summary', icon: BarChart3, label: en ? 'Summary' : 'Σύνοψη' }, { value: 'departments', icon: Building2, label: en ? 'By department' : 'Ανά τμήμα' }, ...(trend.length > 1 ? [{ value: 'months', icon: CalendarDays, label: en ? 'Month by month' : 'Ανά μήνα' }] : [])]
  const shown = views.some(item => item.value === view) ? view : 'summary'
  // The recommendation score only when the questionnaire asks it.
  const hasNps = (survey.questions || []).some((question: AnyRecord) => question.type === 'nps')
  if (!responses.length) return <p className="risk-empty-note">{en ? 'No responses for this selection yet.' : 'Δεν υπάρχουν απαντήσεις για αυτή την επιλογή.'}</p>
  return <div className="survey-results">
    {showLine && <SurveyResultsLine survey={survey} responses={responses} language={language} />}
    <CanonicalTabs items={views} value={shown} onChange={setView} ariaLabel={en ? 'Results view' : 'Προβολή αποτελεσμάτων'} />
    <div className="survey-results-grid">
      {shown === 'summary' && <section className="quality-panel survey-flat-section survey-below-panel">
        <header><h3>{en ? 'Below target' : 'Κάτω από τον στόχο'}{summary.below.length > 0 && <span className="quality-panel-count">{summary.below.length}</span>}</h3><small>{en ? 'Share answering 4 or 5, with at least 10 answers' : 'Ποσοστό με 4 ή 5, από 10 απαντήσεις και πάνω'}</small></header>
        {!summary.below.length ? <p className="risk-empty-note">{en ? 'Every question reaches the target.' : 'Όλες οι ερωτήσεις πιάνουν τον στόχο.'}</p> : <ul className="survey-below">
          {summary.below.map((result: AnyRecord) => <li key={result.question.id}>
            <span><strong>{textOf(result.question, language)}</strong><small>{sectionLabel(result.question.section, language, survey.sections || [])} · {result.count} {en ? 'answers' : 'απαντήσεις'} · {en ? 'mean' : 'μέσος όρος'} {result.mean}</small></span>
            <Meter value={result.satisfied} tone={toneFor(result.satisfied, summary.target)} label={pct(result.satisfied, en)} /><strong>{pct(result.satisfied, en)}</strong>
            {canAct && <button type="button" className="quality-panel-all" onClick={() => onAction?.(result)}><CheckSquare2 size={13} /> {en ? 'Action' : 'Ενέργεια'}</button>}
          </li>)}
        </ul>}
      </section>}
      {shown === 'departments' && <section className="quality-panel survey-flat-section">
        <header><h3>{en ? 'By department' : 'Ανά τμήμα'}</h3><small>{hasNps ? (en ? 'Satisfied and recommendation score' : 'Ικανοποιημένοι και δείκτης σύστασης') : (en ? 'Satisfied' : 'Ικανοποιημένοι')}</small></header>
        <table className="data-table survey-table"><thead><tr><th>{en ? 'Department' : 'Τμήμα'}</th><th>{en ? 'Responses' : 'Απαντήσεις'}</th><th>{en ? 'Satisfied' : 'Ικανοποιημένοι'}</th>{hasNps && <th className="register-num">NPS</th>}</tr></thead><tbody>
          {departments.map(row => <tr key={row.key}><td>{row.department}</td><td>{row.responses}</td><td><span className="survey-meter-cell"><Meter value={row.satisfied} tone={toneFor(row.satisfied, summary.target)} label={pct(row.satisfied, en)} />{pct(row.satisfied, en)}</span></td>{hasNps && <td className="register-num">{npsText(row.nps)}</td>}</tr>)}
        </tbody></table>
      </section>}
      {shown === 'months' && trend.length > 1 && <section className="quality-panel survey-flat-section">
        <header><h3>{en ? 'Month by month' : 'Ανά μήνα'}</h3><small>{en ? 'Satisfied, with the target dashed' : 'Ικανοποιημένοι, ο στόχος με διακεκομμένη'}</small></header>
        <div className="survey-trend"><Sparkline points={trend.map(row => row.satisfied)} target={summary.target} width={720} height={70} label={en ? 'Satisfied by month' : 'Ικανοποιημένοι ανά μήνα'} /></div>
        <table className="data-table survey-table"><thead><tr><th>{en ? 'Month' : 'Μήνας'}</th><th>{en ? 'Responses' : 'Απαντήσεις'}</th><th>{en ? 'Satisfied' : 'Ικανοποιημένοι'}</th>{hasNps && <th className="register-num">NPS</th>}</tr></thead><tbody>
          {[...trend].reverse().map(row => <tr key={row.month}><td>{new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${row.month}-01T00:00:00Z`))}</td><td>{row.responses}</td><td><span className="survey-meter-cell"><Meter value={row.satisfied} tone={toneFor(row.satisfied, summary.target)} label={pct(row.satisfied, en)} />{pct(row.satisfied, en)}</span></td>{hasNps && <td className="register-num">{npsText(row.nps)}</td>}</tr>)}
        </tbody></table>
      </section>}
    </div>
    {shown === 'summary' && sections.map(section => <section key={section || 'main'} className="quality-panel survey-flat-section survey-section-results">
      <header><h3>{sectionLabel(section, language, survey.sections || []) || (en ? 'Questions' : 'Ερωτήσεις')}</h3>{sectionShare(summary.results, section) != null && <small className={Number(sectionShare(summary.results, section)) < summary.target ? 'quality-overdue-text' : undefined}>{pct(sectionShare(summary.results, section), en)} {en ? `satisfied (target ${summary.target}%)` : `ικανοποιημένοι (στόχος ${summary.target}%)`}</small>}</header>
      <ul className="survey-question-results">
        {summary.results.filter((result: AnyRecord) => (result.question.section || '') === section).map((result: AnyRecord) => <QuestionResult key={result.question.id} result={result} language={language} target={summary.target} />)}
      </ul>
    </section>)}
  </div>
}

// The share of 4–5 answers over the 1–5 answers of one section (null when it has no rating question).
function sectionShare(results: AnyRecord[], section: string) {
  const ratings = results.filter((result: AnyRecord) => (result.question.section || '') === section && result.question.type === 'rating')
  const answered = ratings.reduce((sum: number, result: AnyRecord) => sum + result.count, 0)
  return answered ? (ratings.reduce((sum: number, result: AnyRecord) => sum + (result.distribution?.[3] || 0) + (result.distribution?.[4] || 0), 0) / answered) * 100 : null
}

function QuestionResult({ result, language, target }: { result: AnyRecord, language: string, target: number }) {
  const en = language === 'en'
  const { question } = result
  const label = textOf(question, language)
  if (question.type === 'text') return <li className="survey-result-text"><strong>{label}</strong><small>{result.texts.length} {en ? 'comments' : 'σχόλια'}</small>
    {result.texts.length > 0 && <ul className="survey-comments">{result.texts.slice(0, 30).map((item: AnyRecord) => <li key={item.id}><p>{item.text}</p><small>{[(en ? item.departmentEn : item.department), formatDay(item.submittedAt, language)].filter(Boolean).join(' · ')}</small></li>)}</ul>}
  </li>
  const max = Math.max(1, ...(result.distribution || result.options?.map((item: AnyRecord) => item.count) || [1]))
  return <li>
    <span className="survey-result-label"><strong>{label}</strong><small>{result.count} {en ? 'answers' : 'απαντήσεις'}{question.type === 'rating' && result.mean != null ? ` · ${en ? 'mean' : 'μέσος όρος'} ${result.mean}` : ''}</small></span>
    {question.type === 'rating' && <>
      <span className="survey-meter-cell"><Meter value={result.satisfied} tone={toneFor(result.satisfied, target)} label={pct(result.satisfied, en)} />{pct(result.satisfied, en)}</span>
      <span className="survey-distribution" aria-label={en ? 'Answers 1 to 5' : 'Απαντήσεις 1 έως 5'}>{result.distribution.map((count: number, index: number) => <i key={index} title={`${index + 1} · ${scaleOf(question)[index][en ? 1 : 0]}: ${count}`} style={{ height: `${(count * 100) / max}%` }} className={`is-${index + 1}`} />)}</span>
    </>}
    {question.type === 'nps' && <><span className="survey-nps"><strong>{npsText(result.nps)}</strong><small>{en ? `${pct(result.promoters, en)} promoters · ${pct(result.detractors, en)} detractors` : `${pct(result.promoters, en)} υποστηρικτές · ${pct(result.detractors, en)} επικριτές`}</small></span><span /></>}
    {question.type === 'yesno' && <><span className="survey-meter-cell"><Meter value={result.yes} tone={meterTone(result.yes)} label={pct(result.yes, en)} />{en ? `${pct(result.yes, en)} yes` : `${pct(result.yes, en)} ναι`}</span><span /></>}
    {['single', 'multiple'].includes(question.type) && <ul className="quality-bars survey-option-bars">{result.options.map((option: AnyRecord) => <li key={option.value}><span>{textOf(option, language)}</span><span className="quality-bar"><i style={{ width: `${(option.count * 100) / max}%` }} /></span><strong>{option.count}</strong><small>{pct(option.share, en)}</small></li>)}</ul>}
  </li>
}

// The headline figures in one line (beside the filters on the Results tab); the definitions are in the tooltips.
export function SurveyResultsLine({ survey, responses, language = 'el' }: { survey: Survey, responses: SurveyResponse[], language?: string }) {
  const en = language === 'en'
  const summary = surveySummary(survey, responses)
  if (!responses.length) return null
  return <p className="survey-results-line">{[
      `${survey.targetResponses ? `${summary.responses} / ${survey.targetResponses}` : summary.responses} ${en ? 'responses' : 'απαντήσεις'}`,
      <span key="satisfied" title={en ? 'Satisfied = share answering 4 or 5' : 'Ικανοποιημένοι = ποσοστό που απαντά 4 ή 5'} className={summary.satisfied != null && summary.satisfied < summary.target ? 'quality-overdue-text' : undefined}>{pct(summary.satisfied, en)} {en ? `satisfied (target ${summary.target}%)` : `ικανοποιημένοι (στόχος ${summary.target}%)`}</span>,
      (survey.questions || []).some((question: AnyRecord) => question.type === 'nps') ? <span key="nps" title={en ? 'Recommendation score = promoters (9–10) minus detractors (0–6)' : 'Δείκτης σύστασης = υποστηρικτές (9–10) μείον επικριτές (0–6)'}>{en ? 'recommendation score' : 'δείκτης σύστασης'} {npsText(summary.nps)}</span> : null,
      <span key="below" className={summary.below.length ? 'quality-overdue-text' : undefined}>{summary.below.length} {en ? 'questions below target' : 'ερωτήσεις κάτω από τον στόχο'}</span>,
      `${summary.comments} ${en ? 'comments' : 'σχόλια'}`,
    ].filter(Boolean).flatMap((part, index) => (index ? [<span key={`sep-${index}`} aria-hidden="true"> · </span>, part] : [part]))}</p>
}
