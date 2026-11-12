import { RegistryTotals } from '../../design-system/RegistryTotals'
import { doneOf } from './ControlAdherencePanel'

// The programme counts as kept from 90% (the green of adherenceTone).
export const ADHERENCE_TARGET = 90


// The key figures of the open tab of «Controls», as totals beside the search and the period (owner, 7/11/2026: no cards
// above the list). A count that filters the list (overdue, due soon) is a button.
// expiry: { expired, expiring, departments, withExpired } · timeFit: { changes, rateNow, rateProposed, lines }
export function ControlsKpis({ view, language, loading, overdue, dueSoon, adherence, expiry, timeFit, status, onStatus, expiryState = null, onExpiryState }) {
  const en = language === 'en'
  const tr = (el, english) => (en ? english : el)
  const percent = (value) => (value == null ? null : `${value}%`)
  const dash = (value) => (loading ? '—' : value)
  const rate = { key: 'rate', always: true, value: adherence.rate ?? 0, display: dash(percent(adherence.rate) ?? '—'), label: tr('τήρηση', 'adherence') }
  let items
  if (view === 'adherence') {
    items = [rate,
      { key: 'done', always: true, value: 1, display: dash(adherence.expected ? `${doneOf(adherence)}/${adherence.expected}` : '—'), label: tr('έγιναν', 'done') },
      { key: 'onTime', value: adherence.onTimeRate ?? 0, display: dash(percent(adherence.onTimeRate)), label: tr('στην ώρα τους', 'on time') },
      { key: 'missed', value: adherence.expected ? adherence.missed : 0, label: tr('χάθηκαν', 'missed') }]
  } else if (view === 'expiry') {
    items = [
      { key: 'expired', always: true, value: expiry.expired || 0, label: tr('ληγμένα', 'expired'), active: expiryState === 'expired', onClick: onExpiryState && (() => onExpiryState('expired')) },
      { key: 'expiring', value: expiry.expiring || 0, label: tr('λήγουν σύντομα', 'expiring soon'), active: expiryState === 'expiring', onClick: onExpiryState && (() => onExpiryState('expiring')) },
      { key: 'departments', value: expiry.withExpired || 0, display: expiry.departments ? `${expiry.withExpired}/${expiry.departments}` : undefined, label: tr('τμήματα με ληγμένα', 'departments with expired') }]
  } else if (view === 'times') {
    const busy = (value) => (timeFit.loading ? '—' : value)
    items = [
      { key: 'changes', always: true, value: timeFit.changes || 0, display: busy(`${timeFit.changes ?? 0}/${timeFit.lines ?? 0}`), label: tr('με πρόταση ώρας', 'with a time proposal') },
      { key: 'now', value: timeFit.rateNow ?? 0, display: busy(percent(timeFit.rateNow)), label: tr('στην ώρα τώρα', 'on time now') },
      { key: 'proposed', value: timeFit.rateProposed ?? 0, display: busy(percent(timeFit.rateProposed)), label: tr('με τις προτάσεις', 'with the proposals') }]
  } else {
    // «Departments» and «Programme»: what is late, what is due soon (each narrows the programme) and the adherence.
    items = [
      { key: 'overdue', always: true, value: overdue || 0, display: dash(overdue || 0), label: tr('εκπρόθεσμοι', 'overdue'), active: status === 'overdue', onClick: () => onStatus('overdue') },
      { key: 'dueSoon', value: dueSoon || 0, label: tr('πλησιάζουν', 'due soon'), active: status === 'dueSoon', onClick: () => onStatus('dueSoon') },
      rate]
  }
  return <RegistryTotals label={tr('Σύνολα', 'Totals')} items={items} />
}

// «Times»: the proposals and the on-time rate now and with them, weighted by entries.
export function timeFitSummary(lines = []) {
  const entries = lines.reduce((sum, line) => sum + line.entries, 0)
  const rate = (key) => (entries ? Math.round(lines.reduce((sum, line) => sum + ((line[key] ?? 0) * line.entries) / 100, 0) / entries * 100) : null)
  return { lines: lines.length, changes: lines.filter((line) => line.changed).length, rateNow: rate('rateNow'), rateProposed: rate('rateProposed') }
}
