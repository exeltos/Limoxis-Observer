import { AlertOctagon, AlertTriangle, Building2, CalendarClock, CalendarX2, CheckCircle2, Clock, Gauge, ListChecks } from 'lucide-react'
import { KpiCard, KpiStrip } from '../../design-system/KpiCard'
import { formatDay } from '../../core/i18n/formatDay'
import { doneOf, extraOf } from './ControlAdherencePanel'
import { periodShort } from './controlAdherence'

// The programme counts as kept from 90% (the green of adherenceTone).
export const ADHERENCE_TARGET = 90

const adherenceStatus = (rate) => (rate == null ? null : rate >= ADHERENCE_TARGET ? 'good' : rate >= 75 ? 'warning' : 'danger')
const isoDay = (date) => { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// The key figures of the open tab of «Controls», each with its period and target.
// expiry: { expired, expiring, departments, withExpired } · timeFit: { changes, rateNow, rateProposed, lines }
export function ControlsKpis({ view, language, loading, overdue, dueSoon, period, until, adherence, expiry, timeFit, status, onStatus }) {
  const en = language === 'en'
  const tr = (el, english) => (en ? english : el)
  const pct = (value) => (value == null ? null : value)
  const span = periodShort(period, language)
  // The figures end on the last day with entries while those are still kept elsewhere.
  const untilHint = until ? tr(`έως ${formatDay(isoDay(until), language)}`, `up to ${formatDay(isoDay(until), language)}`) : null
  const rateCard = <KpiCard loading={loading} icon={Gauge} label={tr('Τήρηση προγράμματος', 'Programme adherence')} period={span} value={pct(adherence.rate)} unit="%" status={adherenceStatus(adherence.rate)} target={tr(`στόχος ≥ ${ADHERENCE_TARGET}%`, `target ≥ ${ADHERENCE_TARGET}%`)} meter={adherence.rate} meterTarget={ADHERENCE_TARGET} hint={untilHint} />
  if (view === 'adherence') {
    const extra = extraOf(adherence)
    return <KpiStrip label={tr('Τήρηση', 'Adherence')} columns={4}>
      {rateCard}
      <KpiCard loading={loading} icon={CheckCircle2} label={tr('Έγιναν', 'Done')} period={span} value={adherence.expected ? `${doneOf(adherence)}/${adherence.expected}` : null} hint={extra ? tr(`+${extra} επιπλέον, εκτός προγράμματος`, `+${extra} extra, beyond the programme`) : tr('όσες ζητούσε το πρόγραμμα', 'of those the programme asked for')} />
      <KpiCard loading={loading} icon={Clock} label={tr('Στην ώρα τους', 'On time')} period={span} value={pct(adherence.onTimeRate)} unit="%" meter={adherence.onTimeRate} />
      <KpiCard loading={loading} icon={AlertOctagon} label={tr('Χάθηκαν', 'Missed')} period={span} value={adherence.expected ? adherence.missed : null} status={adherence.expected ? (adherence.missed ? 'danger' : 'good') : null} target={tr('στόχος: 0', 'target: 0')} />
    </KpiStrip>
  }
  if (view === 'expiry') {
    return <KpiStrip label={tr('Λήξεις', 'Expiry')} columns={3}>
      <KpiCard loading={loading} icon={CalendarX2} label={tr('Ληγμένα', 'Expired')} value={expiry.expired} status={expiry.expired ? 'danger' : 'good'} statusLabel={expiry.expired ? tr('Για απόσυρση', 'To withdraw') : undefined} target={tr('στόχος: 0', 'target: 0')} />
      <KpiCard loading={loading} icon={CalendarClock} label={tr('Λήγουν σύντομα', 'Expiring soon')} value={expiry.expiring} status={expiry.expiring ? 'warning' : null} statusLabel={expiry.expiring ? tr('Για αντικατάσταση', 'To replace') : undefined} hint={tr('μέσα στο διάστημα ειδοποίησης', 'within the alert window')} />
      <KpiCard loading={loading} icon={Building2} label={tr('Τμήματα με ληγμένα', 'Departments with expired')} value={expiry.departments ? `${expiry.withExpired}/${expiry.departments}` : null} status={expiry.departments ? (expiry.withExpired ? 'danger' : 'good') : null} target={tr('στόχος: κανένα', 'target: none')} />
    </KpiStrip>
  }
  if (view === 'times') {
    const days = tr('30 ημ.', '30 days')
    return <KpiStrip label={tr('Ώρες εκτέλεσης', 'Execution times')} columns={3}>
      <KpiCard loading={timeFit.loading} icon={ListChecks} label={tr('Προτάσεις αλλαγής ώρας', 'Time change proposals')} period={days} value={timeFit.lines ? timeFit.changes : null} hint={tr(`από ${timeFit.lines} ελέγχους`, `of ${timeFit.lines} controls`)} />
      <KpiCard loading={timeFit.loading} icon={Clock} label={tr('Στην ώρα με τις ορισμένες ώρες', 'On time with the set times')} period={days} value={pct(timeFit.rateNow)} unit="%" status={adherenceStatus(timeFit.rateNow)} meter={timeFit.rateNow} meterTarget={ADHERENCE_TARGET} target={tr(`στόχος ≥ ${ADHERENCE_TARGET}%`, `target ≥ ${ADHERENCE_TARGET}%`)} />
      <KpiCard loading={timeFit.loading} icon={CheckCircle2} label={tr('Στην ώρα με τις προτεινόμενες', 'On time with the proposed times')} period={days} value={pct(timeFit.rateProposed)} unit="%" status={adherenceStatus(timeFit.rateProposed)} meter={timeFit.rateProposed} meterTarget={ADHERENCE_TARGET} hint={untilHint} />
    </KpiStrip>
  }
  // «Departments» and «Programme»: what is late, what is due soon and the adherence.
  return <KpiStrip label={tr('Έλεγχοι', 'Controls')} columns={3}>
    <KpiCard loading={loading} icon={AlertOctagon} label={tr('Εκπρόθεσμοι', 'Overdue')} period={untilHint} value={overdue} status={overdue ? 'danger' : 'good'} statusLabel={overdue ? tr('Χρειάζονται ενέργεια', 'Need action') : undefined} target={tr('στόχος: 0', 'target: 0')} className={status === 'overdue' ? 'is-active' : ''} onOpen={() => onStatus('overdue')} />
    <KpiCard loading={loading} icon={AlertTriangle} label={tr('Πλησιάζουν', 'Due soon')} period={untilHint} value={dueSoon} status={dueSoon ? 'warning' : null} statusLabel={dueSoon ? tr('Προγραμματίστε', 'Plan them') : undefined} hint={tr('η προθεσμία τους είναι κοντά', 'their deadline is near')} className={status === 'dueSoon' ? 'is-active' : ''} onOpen={() => onStatus('dueSoon')} />
    {rateCard}
  </KpiStrip>
}

// «Times»: the proposals and the on-time rate now and with them, weighted by entries.
export function timeFitSummary(lines = []) {
  const entries = lines.reduce((sum, line) => sum + line.entries, 0)
  const rate = (key) => (entries ? Math.round(lines.reduce((sum, line) => sum + ((line[key] ?? 0) * line.entries) / 100, 0) / entries * 100) : null)
  return { lines: lines.length, changes: lines.filter((line) => line.changed).length, rateNow: rate('rateNow'), rateProposed: rate('rateProposed') }
}
