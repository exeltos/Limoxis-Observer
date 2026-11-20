import { AlertOctagon, ArrowRight, ClipboardList } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { StatusBadge } from '../../design-system/StatusBadge'
import { textOf, type IndicatorResult } from '../registers/registerEngine'
import { formatIndicatorValue, indicatorStatusLabel, indicatorStatusTone, shortUnit } from '../registers/registerText'
import { odipyLabel } from '../quality/odipyCategories'
import { INCIDENT_DAYS, INCIDENT_KINDS, type DepartmentFocus, type DepartmentIncidents } from './departmentFocusService'
import type { Tone } from '../../design-system/types'
import type { RegisterIndicator } from '../registers/registerTypes'
import { periodRangeLabel } from './departmentHomeModel'

// The bottom-middle card of «Το τμήμα μου»: the department register's main indicators in the period the page shows, each
// with its change from the comparison period (green better, red worse, by the indicator's direction), or the
// department's incidents of the last 30 days. A fixed number of lines that share the card's height: it never scrolls.
interface DepartmentFocusCardProps { focus: DepartmentFocus, language: string, canOpen: (to: string) => boolean, onOpen: (to: string, options?: { state?: unknown }) => void }
export function DepartmentFocusCard({ focus, language, canOpen, onOpen }: DepartmentFocusCardProps) {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const openButton = (action: () => void) => <button type="button" className="text-button" onClick={action}>{tr('Άνοιγμα', 'Open')}<ArrowRight size={14}/></button>
  if (focus.kind === 'none') return null
  // Until it is known whether the department has a register, a card of the same size without a title.
  if (focus.kind === 'loading') return <Card className="dashboard-card dephome-focus" aria-busy="true"><div className="inline-empty">{tr('Φόρτωση…', 'Loading…')}</div></Card>
  if (focus.kind === 'register') {
    const { register, period, compare, choice, rows } = focus
    return <Card className="dashboard-card dephome-focus">
      <CardHeader icon={ClipboardList} title={`${tr('Μητρώο', 'Register')}: ${en ? register.nameEn || register.name : register.name}`} subtitle={choice === 'none' ? periodRangeLabel(period, language) : `${periodRangeLabel(period, language)} · ${tr('σύγκριση:', 'vs')} ${periodRangeLabel(compare, language)}`} actions={openButton(() => onOpen(`/registers/${register.id}`, { state: { registerTab: 'indicators' } }))}/>
      {rows.length ? <ul className="dephome-focus-list">{rows.map(({ indicator, current, previous, lastYear }) => {
        const target = indicator.target === '' || indicator.target == null ? null : Number(indicator.target)
        const unit = en ? indicator.unitEn || indicator.unit : indicator.unit
        const value = current.notRecorded ? tr('Δεν καταγράφεται', 'Not recorded') : formatIndicatorValue(current.value, { unit: shortUnit(unit), unitEn: '' }, language)
        return <li key={indicator.id}>
          <span className="dephome-focus-copy"><strong title={textOf(indicator, language)}>{textOf(indicator, language)}</strong><small>{target == null ? tr('χωρίς στόχο', 'no target') : `${tr('στόχος', 'target')} ${indicator.direction === 'higher' ? '≥' : '≤'} ${formatIndicatorValue(target, { unit: shortUnit(unit), unitEn: '' }, language)}`}</small></span>
          <b className="dephome-focus-value">{value}</b>
          {choice === 'none' ? <span className="dephome-change"/> : <IndicatorChange now={current} before={choice === 'lastYear' ? lastYear : previous} indicator={indicator} language={language}/>}
          {current.status && current.status !== 'context' ? <StatusBadge tone={indicatorStatusTone(current.status) as Tone}>{indicatorStatusLabel(current.status, language)}</StatusBadge> : <span/>}
        </li>
      })}</ul> : <div className="inline-empty">{tr('Το μητρώο δεν έχει ακόμη δείκτες.', 'The register has no indicators yet.')}</div>}
    </Card>
  }
  const incidents: DepartmentIncidents | null = focus.incidents
  const list = '/quality?tab=incidents'
  const lines: Array<[string, string, number | undefined, boolean]> = [
    ...INCIDENT_KINDS.map(([kind, key]) => [kind, odipyLabel(key, language, false), incidents?.[kind], false] as [string, string, number | undefined, boolean]),
    ['other', tr('Λοιπά συμβάντα', 'Other incidents'), incidents?.other, false],
    ['open', tr('Ανοιχτά (υπό αξιολόγηση)', 'Still open (under review)'), incidents?.open, true],
  ]
  return <Card className="dashboard-card dephome-focus">
    <CardHeader icon={AlertOctagon} title={tr('Συμβάντα τμήματος', 'Department incidents')} subtitle={incidents ? tr(`${INCIDENT_DAYS} ημέρες · ${incidents.total} συνολικά`, `${INCIDENT_DAYS} days · ${incidents.total} in all`) : tr(`τελευταίες ${INCIDENT_DAYS} ημέρες`, `last ${INCIDENT_DAYS} days`)} actions={canOpen(list) && openButton(() => onOpen(list))}/>
    {!incidents ? <div className="inline-empty">{tr('Τα συμβάντα του τμήματος δεν φορτώθηκαν.', 'The department’s incidents did not load.')}</div> : <ul className="dephome-focus-list is-counts">{lines.map(([key, label, count, open]) => <li key={key} className={open ? 'is-open' : undefined}>
      <span className="dephome-focus-copy"><strong>{label}</strong></span>
      <b className={`dephome-focus-value${open && Number(count) > 0 ? ' is-warning' : ''}`}>{count ?? '—'}</b>
    </li>)}</ul>}
  </Card>
}

// The change from the comparison period: «▲4», «▼0,3» («μον.» for a percentage); nothing to compare, nothing shown.
function IndicatorChange({ now, before, indicator, language }: { now: IndicatorResult, before?: IndicatorResult, indicator: RegisterIndicator, language: string }) {
  const en = language === 'en'
  if (now.notRecorded || now.value == null || before?.value == null) return <span className="dephome-change"/>
  const diff = Number((now.value - before.value).toFixed(2))
  if (diff === 0) return <span className="dephome-change">=</span>
  const better = indicator.direction === 'lower' ? diff < 0 : indicator.direction === 'higher' ? diff > 0 : null
  const unit = en ? indicator.unitEn || indicator.unit : indicator.unit
  return <span className={`dephome-change${better == null ? '' : better ? ' is-better' : ' is-worse'}`} title={en ? `Change from the comparison period (${formatIndicatorValue(before.value, { unit: '', unitEn: '' }, language)})` : `Μεταβολή από την περίοδο σύγκρισης (${formatIndicatorValue(before.value, { unit: '', unitEn: '' }, language)})`}>
    {diff > 0 ? '▲' : '▼'}{formatIndicatorValue(Math.abs(diff), { unit: '', unitEn: '' }, language)}{unit === '%' ? (en ? ' pts' : ' μον.') : ''}
  </span>
}
