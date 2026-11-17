import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { formatDay } from '../../core/i18n/formatDay'
import { decideLateInfection, loadLateInfectionCandidates, type LateInfectionCandidate } from './registerService'
import type { Register, RegisterEntry } from './registerTypes'

// ΜΕΝΝ Ν6 (ιδιοκτήτης 17/11/2026): the laboratory's positive blood cultures taken 72 hours or more after a neonate's
// admission, for the NICU to confirm as a late-onset infection or reject. Shown above the indicators while any waits;
// the neonate reads by admission date (no name leaves the department).
const SHOWN = 5
interface LateInfectionReviewProps { register: Register, entries: RegisterEntry[], canDecide: boolean, onDecided: () => void }
export function LateInfectionReview({ register, entries, canDecide, onDecided }: LateInfectionReviewProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const { notifyError } = useFeedback()
  const [candidates, setCandidates] = useState<LateInfectionCandidate[]>([])
  const [all, setAll] = useState(false)
  const [busy, setBusy] = useState('')
  useEffect(() => {
    let live = true
    loadLateInfectionCandidates(register).then(rows => { if (live) setCandidates(rows) }).catch(() => { if (live) setCandidates([]) })
    return () => { live = false }
  }, [register])
  const byId = useMemo(() => new Map(entries.map(entry => [entry.id, entry])), [entries])
  // Waiting: not decided, and the neonate not already recorded with a confirmed late-onset infection.
  const waiting = candidates.filter(item => !item.decision && byId.get(item.entryId)?.values?.late_infection !== true)
  if (!waiting.length) return null
  const neonates = new Set(waiting.map(item => item.entryId)).size
  const decide = async (item: LateInfectionCandidate, decision: 'confirmed' | 'rejected') => {
    const entry = byId.get(item.entryId)
    if (!entry) return
    setBusy(item.sampleId)
    try {
      await decideLateInfection(tenant?.id, register, entry, item.sampleId, decision)
      setCandidates(current => current.map(row => (row.entryId === item.entryId && row.sampleId === item.sampleId ? { ...row, decision } : row)))
      onDecided()
    } catch (error) { notifyError(error) } finally { setBusy('') }
  }
  const days = (hours: number) => Math.floor(hours / 24)
  return <section className="register-late-review" aria-label={en ? 'Possible late-onset infections' : 'Πιθανές όψιμες λοιμώξεις'}>
    <header>
      <strong>{en ? `Possible late-onset infections to confirm · ${neonates} neonates` : `Πιθανές όψιμες λοιμώξεις προς επιβεβαίωση · ${neonates} νεογνά`}</strong>
      <small>{en ? 'Positive blood cultures of the department taken 72 hours or more after admission.' : 'Θετικές αιμοκαλλιέργειες του τμήματος 72 ώρες ή περισσότερο μετά την εισαγωγή.'}</small>
    </header>
    <ul>{(all ? waiting : waiting.slice(0, SHOWN)).map(item => {
      const entry = byId.get(item.entryId)
      const admitted = entry?.values?.admission_date ? formatDay(String(entry.values.admission_date), language) : '—'
      return <li key={`${item.entryId}|${item.sampleId}`}>
        <span>{en ? `Neonate admitted ${admitted}` : `Νεογνό με εισαγωγή ${admitted}`} · <b>{item.organism || (en ? 'positive' : 'θετική')}</b> · {en ? `blood culture ${formatDay(item.collectedAt, language)} (day ${days(item.hoursAfter)})` : `αιμοκαλλιέργεια ${formatDay(item.collectedAt, language)} (${days(item.hoursAfter)}η ημέρα)`}</span>
        {canDecide && <span className="register-late-actions">
          <Button variant="secondary" disabled={Boolean(busy)} onClick={() => decide(item, 'confirmed')}>{en ? 'Late-onset infection' : 'Όψιμη λοίμωξη'}</Button>
          <Button variant="secondary" disabled={Boolean(busy)} onClick={() => decide(item, 'rejected')}>{en ? 'Not an infection' : 'Όχι λοίμωξη'}</Button>
        </span>}
      </li>
    })}</ul>
    {waiting.length > SHOWN && <button type="button" className="register-late-more" onClick={() => setAll(value => !value)}>{all ? (en ? 'Show fewer' : 'Λιγότερα') : (en ? `Show all (${waiting.length - SHOWN} more)` : `Εμφάνιση όλων (${waiting.length - SHOWN} ακόμη)`)}</button>}
  </section>
}
