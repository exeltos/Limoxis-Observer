import { useCallback, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Field } from '../../design-system/Field'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { fmtStamp } from './interviewsModel'
import { STANCES, opinionProblems, roleKindLabel, stanceLabel, stanceTone } from './divisionsModel'
import { interviewsErrorMessage, loadOpinions, saveOpinion } from './interviewsService'

// «Αξιολόγηση ρόλων»: your own opinion on the candidate (Propose / Approve / Reserve / Reject
// and a comment) and, once it is submitted, the opinions of the other roles side by side.
// Until then only the number of opinions submitted is shown, so nobody is influenced.
export function useOpinions(candidateId) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const reload = useCallback(() => loadOpinions(candidateId).then(value => { setData(value); setError(false) }).catch(failure => { console.error(failure); setError(true) }), [candidateId])
  useEffect(() => { void reload() }, [reload])
  return { data, error, reload }
}

export function OpinionsPanel({ candidateId, onChanged }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { data, error, reload } = useOpinions(candidateId)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (data) setDraft({ stance: data.mine?.stance || '', comment: data.mine?.comment || '' }) }, [data])
  if (error) return <div className="inline-empty">{en ? 'The opinions could not be loaded.' : 'Δεν ήταν δυνατή η φόρτωση των γνωμών.'}</div>
  if (!data || !draft) return <div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div>
  const submitted = Boolean(data.mine?.submittedAt)
  const problems = opinionProblems(draft, language)
  async function save(submit) {
    setSaving(true)
    try {
      await saveOpinion(candidateId, { ...draft, submit })
      notify(submit ? (en ? 'Your opinion was submitted.' : 'Η γνώμη σας υποβλήθηκε.') : (en ? 'Draft saved.' : 'Το προσχέδιο αποθηκεύτηκε.'), 'success')
      await reload(); await onChanged?.()
    } catch (failure) { console.error(failure); notify(interviewsErrorMessage(failure, language), 'error') } finally { setSaving(false) }
  }
  return <div className="record-view-stack">
    <p className="interviews-muted">{submitted ? (en ? 'Your opinion was submitted — it can no longer be changed.' : 'Η γνώμη σας υποβλήθηκε — δεν αλλάζει πια.') : (en ? 'Your opinion: the other opinions appear after you submit yours.' : 'Η γνώμη σας: οι γνώμες των άλλων εμφανίζονται αφού υποβάλετε τη δική σας.')}</p>
    <div className="interviews-stances" role="group" aria-label={en ? 'Your opinion' : 'Η γνώμη σας'}>
      {STANCES.map(([key]) => <Button key={key} variant={draft.stance === key ? 'primary' : 'secondary'} disabled={submitted || saving} aria-pressed={draft.stance === key} onClick={() => setDraft({ ...draft, stance: key })}>{stanceLabel(key, language)}</Button>)}
    </div>
    <Field label={en ? 'Comment' : 'Σχόλιο'}><textarea rows={3} value={draft.comment} disabled={submitted || saving} onChange={event => setDraft({ ...draft, comment: event.target.value })} /></Field>
    {!submitted && <div className="row-actions">
      <Button variant="secondary" disabled={saving || !draft.stance} onClick={() => save(false)}>{en ? 'Save draft' : 'Αποθήκευση προσχεδίου'}</Button>
      <Button disabled={saving || problems.length > 0} onClick={() => save(true)}><Send size={15} />{en ? 'Submit opinion' : 'Υποβολή γνώμης'}</Button>
    </div>}
    {data.visible
      ? <>
        {data.disagreement && <div className="interviews-disagreement" role="status"><StatusBadge tone="danger">{en ? 'Disagreement' : 'Διαφωνία'}</StatusBadge><span>{en ? 'The roles differ: the final decision must state its reason.' : 'Οι ρόλοι διαφωνούν: η τελική απόφαση πρέπει να έχει αιτιολογία.'}</span></div>}
        {data.opinions.length
          ? <div className="interviews-opinion-cards">{data.opinions.map((item, index) => <article key={index} className={`interviews-opinion-card tone-${stanceTone(item.stance)}`}>
            <header><strong>{roleKindLabel(item.roleKind, item.division, language)}</strong><small>{item.author}{item.mine ? ` · ${en ? 'you' : 'εσείς'}` : ''}</small></header>
            <StatusBadge tone={stanceTone(item.stance)}>{stanceLabel(item.stance, language)}</StatusBadge>
            <p>{item.comment || (en ? 'No comment.' : 'Χωρίς σχόλιο.')}</p>
            <small>{fmtStamp(item.submittedAt, language)}</small>
          </article>)}</div>
          : <p className="interviews-muted">{en ? 'No opinions yet.' : 'Δεν υπάρχουν γνώμες ακόμα.'}</p>}
      </>
      : <p className="interviews-muted interviews-locked">{data.submittedCount ? (en ? `${data.submittedCount} opinion(s) submitted — shown here once you submit yours.` : `${data.submittedCount} γνώμη/ες έχουν υποβληθεί — θα φανούν εδώ αφού υποβάλετε τη δική σας.`) : (en ? 'No opinion has been submitted yet.' : 'Δεν έχει υποβληθεί ακόμα γνώμη.')}</p>}
  </div>
}
