import { useState } from 'react'
import { BarChart3,CalendarDays,CheckSquare2,Building2, MessageSquareText, Smile, ThumbsUp, TrendingDown, Users } from 'lucide-react'
import { CanonicalTabs } from '../../../design-system/CanonicalTabs'
import { MetricCard } from '../../../design-system/MetricCard'
import { Meter, Sparkline, meterTone } from '../../../design-system/MiniCharts'
import { formatDay } from '../../../core/i18n/formatDay'
import { departmentBreakdown, monthlyTrend, scaleOf, sectionLabel, surveySummary, textOf } from './surveyModel'

const pct = value => (value == null ? '—' : `${value}%`)
const npsText = value => (value == null ? '—' : value > 0 ? `+${value}` : String(value))
const toneFor = (value, target) => meterTone(value, { good: target, fair: Math.max(0, target - 15) })

// What the answers say: the headline figures, what falls below the target (each
// can open a corrective action), each department, the trend and every question.
export function SurveyResults({ survey, responses, language = 'el', canAct = false, onAction }) {
  const en = language === 'en'
  const summary = surveySummary(survey, responses)
  const departments = departmentBreakdown(survey, responses, language)
  const trend = monthlyTrend(survey, responses)
  const sections = [...new Set((survey.questions || []).map(question => question.section || ''))]
  const [view, setView] = useState('summary')
  const views = [{ value: 'summary', icon: BarChart3, label: en ? 'Summary' : 'Σύνοψη' }, { value: 'departments', icon: Building2, label: en ? 'By department' : 'Ανά τμήμα' }, ...(trend.length > 1 ? [{ value: 'months', icon: CalendarDays, label: en ? 'Month by month' : 'Ανά μήνα' }] : [])]
  const shown = views.some(item => item.value === view) ? view : 'summary'
  if (!responses.length) return <p className="risk-empty-note">{en ? 'No responses for this selection yet.' : 'Δεν υπάρχουν απαντήσεις για αυτή την επιλογή.'}</p>
  return <div className="survey-results">
    <div className="module-summary-strip">
      <MetricCard icon={Users} value={survey.targetResponses ? `${summary.responses} / ${survey.targetResponses}` : summary.responses} label={en ? 'Responses' : 'Απαντήσεις'} />
      <MetricCard icon={Smile} tone={summary.satisfied == null ? 'neutral' : summary.satisfied >= summary.target ? 'active' : 'warning'} value={pct(summary.satisfied)} label={en ? `Satisfied (target ${summary.target}%)` : `Ικανοποιημένοι (στόχος ${summary.target}%)`} />
      <MetricCard icon={ThumbsUp} value={npsText(summary.nps)} label={en ? 'Recommendation score (NPS)' : 'Δείκτης σύστασης (NPS)'} />
      <MetricCard icon={TrendingDown} tone={summary.below.length ? 'warning' : 'neutral'} value={summary.below.length} label={en ? 'Questions below target' : 'Ερωτήσεις κάτω από τον στόχο'} />
      <MetricCard icon={MessageSquareText} value={summary.comments} label={en ? 'Comments' : 'Σχόλια'} />
    </div>
    <CanonicalTabs items={views} value={shown} onChange={setView} ariaLabel={en ? 'Results view' : 'Προβολή αποτελεσμάτων'} />
    <div className="survey-results-grid">
      {shown === 'summary' && <section className="risk-panel quality-panel survey-below-panel">
        <header><h3>{en ? 'Below target' : 'Κάτω από τον στόχο'}{summary.below.length > 0 && <span className="quality-panel-count">{summary.below.length}</span>}</h3><small>{en ? 'Share answering 4 or 5, with at least 10 answers' : 'Ποσοστό με 4 ή 5, από 10 απαντήσεις και πάνω'}</small></header>
        {!summary.below.length ? <p className="risk-empty-note">{en ? 'Every question reaches the target.' : 'Όλες οι ερωτήσεις πιάνουν τον στόχο.'}</p> : <ul className="survey-below">
          {summary.below.map(result => <li key={result.question.id}>
            <span><strong>{textOf(result.question, language)}</strong><small>{sectionLabel(result.question.section, language, survey.sections || [])} · {result.count} {en ? 'answers' : 'απαντήσεις'} · {en ? 'mean' : 'μέσος όρος'} {result.mean}</small></span>
            <Meter value={result.satisfied} tone={toneFor(result.satisfied, summary.target)} label={pct(result.satisfied)} /><strong>{pct(result.satisfied)}</strong>
            {canAct && <button type="button" className="quality-panel-all" onClick={() => onAction(result)}><CheckSquare2 size={13} /> {en ? 'Action' : 'Ενέργεια'}</button>}
          </li>)}
        </ul>}
      </section>}
      {shown === 'departments' && <section className="risk-panel quality-panel">
        <header><h3>{en ? 'By department' : 'Ανά τμήμα'}</h3><small>{en ? 'Satisfied and recommendation score' : 'Ικανοποιημένοι και δείκτης σύστασης'}</small></header>
        <table className="data-table survey-table"><thead><tr><th>{en ? 'Department' : 'Τμήμα'}</th><th className="register-num">{en ? 'Responses' : 'Απαντήσεις'}</th><th>{en ? 'Satisfied' : 'Ικανοποιημένοι'}</th><th className="register-num">NPS</th></tr></thead><tbody>
          {departments.map(row => <tr key={row.key}><td>{row.department}</td><td className="register-num">{row.responses}</td><td><span className="survey-meter-cell"><Meter value={row.satisfied} tone={toneFor(row.satisfied, summary.target)} label={pct(row.satisfied)} />{pct(row.satisfied)}</span></td><td className="register-num">{npsText(row.nps)}</td></tr>)}
        </tbody></table>
      </section>}
      {shown === 'months' && trend.length > 1 && <section className="risk-panel quality-panel">
        <header><h3>{en ? 'Month by month' : 'Ανά μήνα'}</h3><small>{en ? 'Satisfied, with the target dashed' : 'Ικανοποιημένοι, ο στόχος με διακεκομμένη'}</small></header>
        <div className="survey-trend"><Sparkline points={trend.map(row => row.satisfied)} target={summary.target} width={320} height={60} label={en ? 'Satisfied by month' : 'Ικανοποιημένοι ανά μήνα'} /></div>
        <table className="data-table survey-table"><thead><tr><th>{en ? 'Month' : 'Μήνας'}</th><th className="register-num">{en ? 'Responses' : 'Απαντήσεις'}</th><th className="register-num">{en ? 'Satisfied' : 'Ικανοποιημένοι'}</th><th className="register-num">NPS</th></tr></thead><tbody>
          {[...trend].reverse().map(row => <tr key={row.month}><td>{new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${row.month}-01T00:00:00Z`))}</td><td className="register-num">{row.responses}</td><td className="register-num">{pct(row.satisfied)}</td><td className="register-num">{npsText(row.nps)}</td></tr>)}
        </tbody></table>
      </section>}
    </div>
    {shown === 'summary' && sections.map(section => <section key={section || 'main'} className="risk-panel quality-panel survey-section-results">
      <header><h3>{sectionLabel(section, language, survey.sections || []) || (en ? 'Questions' : 'Ερωτήσεις')}</h3></header>
      <ul className="survey-question-results">
        {summary.results.filter(result => (result.question.section || '') === section).map(result => <QuestionResult key={result.question.id} result={result} language={language} target={summary.target} />)}
      </ul>
    </section>)}
  </div>
}

function QuestionResult({ result, language, target }) {
  const en = language === 'en'
  const { question } = result
  const label = textOf(question, language)
  if (question.type === 'text') return <li className="survey-result-text"><strong>{label}</strong><small>{result.texts.length} {en ? 'comments' : 'σχόλια'}</small>
    {result.texts.length > 0 && <ul className="survey-comments">{result.texts.slice(0, 30).map(item => <li key={item.id}><p>{item.text}</p><small>{[(en ? item.departmentEn : item.department), formatDay(item.submittedAt, language)].filter(Boolean).join(' · ')}</small></li>)}</ul>}
  </li>
  const max = Math.max(1, ...(result.distribution || result.options?.map(item => item.count) || [1]))
  return <li>
    <span className="survey-result-label"><strong>{label}</strong><small>{result.count} {en ? 'answers' : 'απαντήσεις'}{question.type === 'rating' && result.mean != null ? ` · ${en ? 'mean' : 'μέσος όρος'} ${result.mean}` : ''}</small></span>
    {question.type === 'rating' && <>
      <span className="survey-meter-cell"><Meter value={result.satisfied} tone={toneFor(result.satisfied, target)} label={pct(result.satisfied)} />{pct(result.satisfied)}</span>
      <span className="survey-distribution" aria-label={en ? 'Answers 1 to 5' : 'Απαντήσεις 1 έως 5'}>{result.distribution.map((count, index) => <i key={index} title={`${index + 1} · ${scaleOf(question)[index][en ? 1 : 0]}: ${count}`} style={{ height: `${(count * 100) / max}%` }} className={`is-${index + 1}`} />)}</span>
    </>}
    {question.type === 'nps' && <><span className="survey-nps"><strong>{npsText(result.nps)}</strong><small>{en ? `${pct(result.promoters)} promoters · ${pct(result.detractors)} detractors` : `${pct(result.promoters)} υποστηρικτές · ${pct(result.detractors)} επικριτές`}</small></span><span /></>}
    {question.type === 'yesno' && <><span className="survey-meter-cell"><Meter value={result.yes} tone={meterTone(result.yes)} label={pct(result.yes)} />{en ? `${pct(result.yes)} yes` : `${pct(result.yes)} ναι`}</span><span /></>}
    {['single', 'multiple'].includes(question.type) && <ul className="quality-bars survey-option-bars">{result.options.map(option => <li key={option.value}><span>{textOf(option, language)}</span><span className="quality-bar"><i style={{ width: `${(option.count * 100) / max}%` }} /></span><strong>{option.count}</strong><small>{pct(option.share)}</small></li>)}</ul>}
  </li>
}
