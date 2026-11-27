// Παραγωγή › «Αποψύξεις» και «Πολτοποιήσεις» (owner, 27/11/2026, structure A): every record of every day in one list, as
// FileMaker's «Λίστα Αποψύξεων», with a «From / To» filter. Each record still belongs to its production day; a row opens it.
import { ShieldCheck } from 'lucide-react'
import { SignalBadge } from '../../design-system/StatusBadge'
import { FilterDate, FilterSelect } from '../../design-system/FilterBar'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { KitchenList, LimitBadge, matches, type KitchenFilterProps, type KitchenPanelProps } from './KitchenShared'
import { fmtDay, fmtStamp } from './KitchenPanels'
import { dayOf, defrostMethodLabel, fmtQty, fmtTemp, pureeMethodLabel, unitLabel } from './kitchenModel'

const timeOf = (value: string | null | undefined) => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const temp = (value: unknown, text: string | undefined, language: string) => (value !== '' && value != null ? fmtTemp(value, language) : text || '—')
const inPeriod = (day: string, from: string, to: string) => (!from || day >= from) && (!to || day <= to)
const checkText = (value: boolean | null | undefined, en: boolean) => (value == null ? '—' : value ? (en ? 'OK' : 'Εντάξει') : (en ? 'Not OK' : 'Όχι'))

type ListProps = Pick<KitchenPanelProps, 'state' | 'onOpenDay'> & KitchenFilterProps

// The filters both lists share: from / to, and out of limits.
function PeriodFilters({ filters, set, en }: { filters: Record<string, string>, set: (key: string, value: string) => void, en: boolean }) {
  return <>
    <FilterDate label={en ? 'From' : 'Από'} value={filters.from} onChange={value => set('from', value)} />
    <FilterDate label={en ? 'To' : 'Έως'} value={filters.to} onChange={value => set('to', value)} />
    <FilterSelect label={en ? 'Limits' : 'Όρια'} value={filters.limits || 'all'} onChange={value => set('limits', value)}><option value="all">{en ? 'All' : 'Όλα'}</option><option value="out">{en ? 'Out of limits' : 'Εκτός ορίων'}</option></FilterSelect>
  </>
}
const activeOf = (filters: Record<string, string>) => (filters.from ? 1 : 0) + (filters.to ? 1 : 0) + (filters.limits && filters.limits !== 'all' ? 1 : 0)

export function DefrostListPanel({ state, filters, setFilters, onOpenDay, switcher = null }: ListProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const set = (key: string, value: string) => setFilters(current => ({ ...current, [key]: value }))
  const rows = (state.defrosting || [])
    .filter(row => inPeriod(dayOf(row.startedAt), filters.from, filters.to) && (filters.limits !== 'out' || row.limitStatus === 'out')
      && matches(filters.query, row.productName, defrostMethodLabel(row.method, language), row.verifiedByName, row.correctiveAction))
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search product…' : 'Αναζήτηση προϊόντος…'} end={switcher}
    activeFilters={activeOf(filters)} onClear={() => setFilters(current => ({ ...current, query: '', from: '', to: '', limits: 'all' }))}
    filters={<PeriodFilters filters={filters} set={set} en={en} />}
    columns={[{ key: 'product', label: en ? 'Product' : 'Προϊόν' }, { key: 'method', label: en ? 'Method' : 'Μέθοδος' }, { key: 'start', label: en ? 'Start' : 'Έναρξη' }, { key: 'end', label: en ? 'End' : 'Λήξη' }, { key: 'result', label: en ? 'Limits' : 'Όρια' }, { key: 'sign', label: en ? 'HACCP sign-off' : 'Επαλήθευση HACCP' }]}
    empty={!rows.length} emptyTitle={en ? 'No defrosting' : 'Καμία απόψυξη'} emptyText={en ? 'Defrosting is recorded in the production day, from a frozen batch of the stock.' : 'Η απόψυξη καταγράφεται στην ημέρα παραγωγής, από μια παρτίδα κατεψυγμένου του αποθέματος.'}
    rowProps={row => (row.productionId ? { className: 'registry-row-clickable', onClick: () => onOpenDay(row.productionId as string) } : {})}
    renderRow={row => <>
      <td><strong>{row.productName}</strong><small>{fmtQty(row.quantity, language)} {unitLabel(row.unit, language)}</small></td>
      <td>{defrostMethodLabel(row.method, language)}</td>
      <td className="nowrap-cell">{fmtDay(dayOf(row.startedAt))} {timeOf(row.startedAt)}<small>{temp(row.startTemp, row.startText, language)}</small></td>
      <td className="nowrap-cell">{row.endedAt ? <>{fmtDay(dayOf(row.endedAt))} {timeOf(row.endedAt)}<small>{temp(row.endTemp, row.endText, language)}</small></> : (en ? 'In progress' : 'Σε εξέλιξη')}</td>
      <td><LimitBadge status={row.limitStatus} language={language} /></td>
      <td>{row.verifiedAt ? <span className="kitchen-signoff"><SignalBadge tone="success"><ShieldCheck size={13} />{row.verifiedByName || '—'}</SignalBadge><small>{fmtStamp(row.verifiedAt, language)}</small></span> : <SignalBadge tone="warning">{en ? 'Pending' : 'Εκκρεμεί'}</SignalBadge>}</td>
    </>} />
}

export function PureeingListPanel({ state, filters, setFilters, onOpenDay, switcher = null }: ListProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const set = (key: string, value: string) => setFilters(current => ({ ...current, [key]: value }))
  const rows = (state.pureeing || [])
    .filter(row => inPeriod(String(row.pureedOn || '').slice(0, 10), filters.from, filters.to) && (filters.limits !== 'out' || row.limitStatus === 'out')
      && matches(filters.query, row.productName, pureeMethodLabel(row.method, language), row.correctiveAction, row.recordedByName))
    .sort((a, b) => String(b.pureedOn).localeCompare(String(a.pureedOn)))
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search dish…' : 'Αναζήτηση πιάτου…'} end={switcher}
    activeFilters={activeOf(filters)} onClear={() => setFilters(current => ({ ...current, query: '', from: '', to: '', limits: 'all' }))}
    filters={<PeriodFilters filters={filters} set={set} en={en} />}
    columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'dish', label: en ? 'Dish / product' : 'Πιάτο / προϊόν' }, { key: 'method', label: en ? 'Method' : 'Μέθοδος' }, { key: 'visual', label: en ? 'Visual check' : 'Οπτικός έλεγχος' }, { key: 'blade', label: en ? 'Blade check' : 'Έλεγχος λεπίδας' }, { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα' }]}
    empty={!rows.length} emptyTitle={en ? 'No pureeing' : 'Καμία πολτοποίηση'} emptyText={en ? 'Pureeing is recorded in the production day.' : 'Η πολτοποίηση καταγράφεται στην ημέρα παραγωγής.'}
    rowProps={row => (row.productionId ? { className: 'registry-row-clickable', onClick: () => onOpenDay(row.productionId) } : {})}
    renderRow={row => <>
      <td className="nowrap-cell"><strong>{fmtDay(row.pureedOn)}</strong><small>{row.recordedByName || ''}</small></td>
      <td><strong>{row.productName}</strong></td>
      <td>{pureeMethodLabel(row.method, language)}</td>
      <td>{checkText(row.visualCheck, en)}</td>
      <td>{checkText(row.bladeCheck, en)}</td>
      <td><LimitBadge status={row.limitStatus} language={language} /></td>
    </>} />
}
