// The Prevention registry's pieces: key figures, empty state and the table of each tab.
import { ClipboardCheck, Droplets, Plus, Recycle, ShieldCheck } from 'lucide-react'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { ABHR_TARGET, HAND_HYGIENE_TARGET, antisepticKpis, bundleKpis, handHygieneKpis, wasteKpis } from './preventionKpis'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDay } from '../../core/i18n/formatDay'
import { translate } from '../../core/i18n/LanguageContext'
import { antisepticMethodLabel, antisepticPeriodLabel } from './antisepticMethods'
import { wasteCategoryTone, wastePeriodLabel } from './wasteVisuals'
import type { RegistryTotal } from '../../design-system/RegistryTotals'
import type { SortState } from '../../design-system/useTableSort'
import type { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import type { AntisepticRecord, BundleAssessment, HandHygieneSession, PreventionEmployee, PreventionRecord, WasteMeasurement } from './preventionTypes'
import type { Vaccination } from '../occupational-health/vaccinationService'

// What every tab's table gets from the page: its sorted rows, the sort, the registry memory
// (highlighted row, scroll) and how to open a record.
interface PreventionTableProps<T extends PreventionRecord = PreventionRecord> { sort?: SortState | null; onSort?: (key: string) => void; rows: T[]; t: (key: string) => string; language: string; onOpen: (id: string) => void; registry: ReturnType<typeof useRegistryMemory> }
type DatedTableProps<T extends PreventionRecord> = PreventionTableProps<T> & { fmtDate: (value: string | null | undefined) => string }
// The vaccinations open from the row itself, with its employee.
type VaccinationTableProps = Omit<DatedTableProps<Vaccination>, 'onOpen'> & { employeeMap: Record<string, PreventionEmployee>; onOpen: (row: Vaccination) => void }
// The rows of the tabs with key figures, as the page loaded them.
interface KpiSource<T> { rows: T[]; loading?: boolean }

// Numbers in the user's language (79,1% in Greek) and the antiseptic month
// as MM/YYYY instead of the stored YYYY-MM.
const fmtNumber = (value: unknown, language: string) =>
  new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(
    Number(value),
  )
// Every prevention date as dd/mm/yyyy (two-digit day and month), like the other registries.
export const dayLabel = (value: string | null | undefined, language: string) => {
  const text = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return formatDay(value, language)
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${text}T12:00:00`))
}
export const fmtMonth = (value: string | null | undefined) => antisepticPeriodLabel(value)
export const tabIcons: Record<string, typeof ShieldCheck> = {
  handHygiene: ClipboardCheck,
  waste: Recycle,
  antiseptics: Droplets,
  bundles: ShieldCheck,
  vaccinations: ShieldCheck,
}
// The key figures of the open tab, with their period and target (preventionKpis.js): one line of totals beside the
// search (owner, 8/11/2026: no cards); the period and the target are in the tooltip.
export function PreventionKpis({ tab, language, hand, waste, antiseptic, bundle }: { tab: string; language: string; hand: KpiSource<HandHygieneSession>; waste: KpiSource<WasteMeasurement>; antiseptic: KpiSource<AntisepticRecord>; bundle: KpiSource<BundleAssessment> }) {
  const en = language === 'en'
  const tr = (key: string, values: Record<string, string | number> = {}) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), translate(`preventionKpis.${key}`, language))
  const fmt = (value: number | null | undefined) => (value == null ? null : new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value))
  const days30 = tr('days30')
  const item = (key: string, label: string, value: unknown, { unit = '', tone, title }: { unit?: string; tone?: string | null; title?: string } = {}): RegistryTotal | null => (value == null || value === '' ? null : { key, always: true, value: 0, display: `${value}${unit}`, label, tone: tone as string | undefined, title: [label, title].filter(Boolean).join(' · ') })
  const strip = (label: string, items: (RegistryTotal | null)[]) => <RegistryTotals label={label} items={items.filter(Boolean)} />
  if (tab === 'handHygiene') {
    const k = handHygieneKpis(hand.rows)
    return strip(tr('handHygiene'), [
      item('rate', tr('whoCompliance'), fmt(k.rate), { unit: '%', tone: k.rate == null ? null : k.rate >= HAND_HYGIENE_TARGET ? 'good' : 'danger', title: `${days30} · ${tr('handTarget', { value: HAND_HYGIENE_TARGET })}` }),
      item('opportunities', tr('opportunities'), k.opportunities, { title: days30 }),
      item('below', tr('belowTarget'), k.departments ? `${k.below}/${k.departments}` : null, { tone: k.departments ? (k.below ? 'warning' : 'good') : null, title: days30 }),
    ])
  }
  if (tab === 'waste') {
    const k = wasteKpis(waste.rows)
    const period = k.month ? fmtMonth(k.month) : ''
    return strip(tr('waste'), [
      item('total', tr('shortMonth'), fmt(k.current?.total), { unit: ' kg', title: `${tr('wasteMonth')} · ${period}` }),
      item('perThousand', tr('shortPerThousand'), fmt(k.current?.perThousand), { unit: ' kg', title: `${tr('perThousand')} · ${period}` }),
      item('departments', tr('shortDepartments'), k.current ? `${k.current.departments}/${k.allDepartments}` : null, { tone: k.current ? (k.current.departments >= k.allDepartments ? 'good' : 'warning') : null, title: `${tr('departmentsRecorded')} · ${period}` }),
    ])
  }
  if (tab === 'antiseptics') {
    const k = antisepticKpis(antiseptic.rows)
    const period = k.month ? fmtMonth(k.month) : ''
    const value = k.current?.perThousand
    return strip(tr('antiseptics'), [
      item('abhr', tr('shortAbhr'), fmt(value), { unit: ` ${tr('abhrUnit')}`, tone: value == null ? null : value >= ABHR_TARGET ? 'good' : 'danger', title: `${tr('abhr')} · ${period} · ${tr('abhrTarget', { value: ABHR_TARGET })}` }),
      item('use', tr('shortMonth'), fmt(k.current?.total), { unit: ' L', title: `${tr('useMonth')} · ${period}` }),
      item('departments', tr('shortDepartments'), k.current ? `${k.current.departments}/${k.allDepartments}` : null, { tone: k.current ? (k.current.departments >= k.allDepartments ? 'good' : 'warning') : null, title: `${tr('departmentsRecorded')} · ${period}` }),
    ])
  }
  if (tab === 'bundles') {
    const k = bundleKpis(bundle.rows)
    return strip(tr('bundles'), [
      item('rate', tr('fullCompliance'), fmt(k.rate), { unit: '%', tone: k.rate == null ? null : k.rate >= 95 ? 'good' : k.rate >= 80 ? 'warning' : 'danger', title: `${days30} · ${tr('allOrNone')}` }),
      item('assessments', tr('assessments'), k.assessments, { title: days30 }),
      item('deviations', tr('deviations'), k.deviations, { tone: k.assessments ? (k.deviations ? 'danger' : 'good') : null, title: days30 }),
    ])
  }
  return null
}
const preventionEmptyTitleKeys: Record<string, string> = {
  handHygiene: 'preventionEmptyHandHygieneTitle',
  waste: 'preventionEmptyWasteTitle',
  antiseptics: 'preventionEmptyAntisepticsTitle',
  bundles: 'preventionEmptyBundlesTitle',
}
// The empty list says what to do next: the filters when they hide everything,
// else the button that adds the first record.
export function PreventionEmpty({ t, tab, filtered, createLabel, onCreate, onClearFilters }: { t: (key: string) => string; tab: string; filtered: boolean; createLabel?: string; onCreate?: () => void; onClearFilters?: () => void }) {
  const text = filtered
    ? undefined
    : createLabel
      ? t('preventionEmptyCreateText').replace('{action}', createLabel)
      : t('preventionEmptyGenericText')
  return (
    <RegistryEmptyState
      filtered={filtered}
      onClearFilters={onClearFilters}
      title={tab === 'vaccinations' ? t('noVaccinationRecords') : t(preventionEmptyTitleKeys[tab])}
      text={text}
      icon={tabIcons[tab]}
      action={createLabel ? { label: createLabel, onClick: onCreate, icon: Plus } : undefined}
    />
  )
}
function rowPropsWithOpen(registry: PreventionTableProps['registry'], id: string, onOpen: (id: string) => void) {
  const rp = registry.rowProps(id)
  return { ...rp, className: `${rp.className} clickable-row`, onClick: () => onOpen(id) }
}
export function HandTable({ sort, onSort, rows, t, language, fmtDate, onOpen, registry }: DatedTableProps<HandHygieneSession>) {
  return (
    <RegistryTable
      bare
      sort={sort}
      onSort={onSort}
      columns={[
        { key: 'date', label: t('date'), sortable: true },
        { key: 'department', label: t('department'), sortable: true },
        { key: 'profession', label: t('professionalCategory'), sortable: true },
        { key: 'observations', label: t('observations'), sortable: true },
        { key: 'compliant', label: t('compliant'), sortable: true },
        { key: 'compliance', label: t('compliance'), sortable: true },
        { key: 'observer', label: t('observer'), sortable: true },
      ]}
      rows={rows}
      rowKey={x => x.id}
      rowProps={x => rowPropsWithOpen(registry, x.id, onOpen)}
      renderRow={x => (
        <>
          <td>{fmtDate(x.date)}</td>
          <td>{language === 'el' ? x.departmentEl : x.departmentEn}</td>
          <td>{t(x.profession)}</td>
          <td>{x.observations}</td>
          <td>{x.compliant}</td>
          <td>
            <StatusBadge
              tone={Number(x.rate) < 80 ? 'danger' : 'success'}
              title={Number(x.rate) < 80 ? t('belowWhoHandHygieneTarget') : undefined}
            >
              {fmtNumber(x.rate, language)}%
            </StatusBadge>
          </td>
          <td>{x.observer}</td>
        </>
      )}
    />
  )
}
export function WasteTable({ sort, onSort, rows, t, language, fmtDate, onOpen, registry }: DatedTableProps<WasteMeasurement>) {
  return (
    <RegistryTable
      bare
      sort={sort}
      onSort={onSort}
      columns={[
        { key: 'period', label: t('period'), sortable: true },
        { key: 'department', label: t('department'), sortable: true },
        { key: 'category', label: t('exportCategory'), sortable: true },
        { key: 'weight', label: t('weight'), sortable: true },
        { key: 'containers', label: t('containers'), sortable: true },
        { key: 'indicator', label: t('preventionIndexWaste'), sortable: true },
        { key: 'document', label: t('documentNumber'), sortable: true },
      ]}
      rows={rows}
      rowKey={x => x.id}
      rowProps={x => rowPropsWithOpen(registry, x.id, onOpen)}
      renderRow={x => {
        const category = x.wasteType || x.type
        return (
          <>
            <td>{wastePeriodLabel(x, fmtDate)}</td>
            <td>{language === 'el' ? x.departmentEl : x.departmentEn}</td>
            <td>
              <span className={`waste-category-badge ${wasteCategoryTone(category)}`}>
                {language === 'el' ? category : x.typeEn || category}
              </span>
            </td>
            <td>{Number(x.weight).toLocaleString(localeFromLanguage(language))} kg</td>
            <td>{x.containers}</td>
            <td>
              {x.indicator != null ? (
                <>
                  <strong>
                    {Number(x.indicator).toLocaleString(localeFromLanguage(language))}
                  </strong>
                </>
              ) : (
                '—'
              )}
            </td>
            <td>{x.documentNumber || '—'}</td>
          </>
        )
      }}
    />
  )
}
// The usual source (direct measurement) is not repeated on every row: the column appears only
// when some record has another one.
const DEFAULT_SOURCE = 'direct_measurement'
export function AntisepticTable({ sort, onSort, rows, t, language, onOpen, registry }: PreventionTableProps<AntisepticRecord>) {
  const showSource = rows.some(x => x.method !== DEFAULT_SOURCE)
  return (
    <RegistryTable
      bare
      sort={sort}
      onSort={onSort}
      columns={[
        { key: 'period', label: t('period'), sortable: true },
        { key: 'department', label: t('department'), sortable: true },
        { key: 'product', label: t('product'), sortable: true },
        { key: 'litres', label: t('consumptionLitres'), sortable: true },
        { key: 'patientDays', label: t('patientDays'), sortable: true },
        { key: 'indicator', label: t('preventionIndexAbhr'), sortable: true },
        ...(showSource ? [{ key: 'source', label: t('dataSourceShort'), sortable: true }] : []),
      ]}
      rows={rows}
      rowKey={x => x.id}
      rowProps={x => rowPropsWithOpen(registry, x.id, onOpen)}
      renderRow={x => (
        <>
          <td>{fmtMonth(x.period)}</td>
          <td>{language === 'el' ? x.departmentEl : x.departmentEn}</td>
          <td>
            <strong>{language === 'el' ? x.product : x.productEn || x.product}</strong>
            {x.indicatorEligible === false && (
              <small className="table-cell-unit">{t('notApplicable')} ABHR</small>
            )}
          </td>
          <td>
            <strong>{Number(x.litres).toLocaleString(localeFromLanguage(language))} L</strong>
          </td>
          <td>{x.patientDays || '—'}</td>
          <td>
            {x.indicator != null ? (
              <>
                <strong>{Number(x.indicator).toLocaleString(localeFromLanguage(language))}</strong>
              </>
            ) : (
              '—'
            )}
          </td>
          {showSource && (
            <td>
              {x.method === DEFAULT_SOURCE ? (
                '—'
              ) : (
                <span className={`antiseptic-method-badge ${x.method || 'other'}`}>
                  {antisepticMethodLabel(x.method, language)}
                </span>
              )}
            </td>
          )}
        </>
      )}
    />
  )
}
export function BundleTable({ sort, onSort, rows, t, language, onOpen, registry }: PreventionTableProps<BundleAssessment>) {
  return (
    <RegistryTable
      bare
      sort={sort}
      onSort={onSort}
      columns={[
        { key: 'date', label: t('date'), sortable: true },
        { key: 'bundle', label: t('bundle'), sortable: true },
        { key: 'department', label: t('department'), sortable: true },
        { key: 'context', label: t('context'), sortable: true },
        { key: 'score', label: t('score'), sortable: true },
        { key: 'allOrNone', label: t('allOrNone'), sortable: true },
        { key: 'deviations', label: t('deviations'), sortable: true },
      ]}
      rows={rows}
      rowKey={x => x.id}
      rowProps={x => rowPropsWithOpen(registry, x.id, onOpen)}
      renderRow={x => (
        <>
          <td>{dayLabel(x.date || x.period, language)}</td>
          <td>
            <strong>
              {language === 'el'
                ? x.templateTitle || x.templateName || x.bundle
                : x.templateName || x.bundle}
            </strong>
          </td>
          <td>{language === 'el' ? x.departmentEl : x.departmentEn}</td>
          <td>
            {t(`shift_${x.shift}`) !== `shift_${x.shift}` ? t(`shift_${x.shift}`) : x.shift || '—'}
          </td>
          <td>
            <strong>{x.score == null ? '—' : `${x.score}%`}</strong>
          </td>
          <td>
            <span className={`bundle-answer ${x.allOrNone ? 'is-yes' : 'is-no'}`}>
              {x.allOrNone ? t('yes') : t('no')}
            </span>
          </td>
          <td>
            {(x.failedCount ?? x.findings?.length ?? 0) > 0 ? (
              <span className="bundle-finding-count">{x.failedCount ?? x.findings?.length}</span>
            ) : (
              '—'
            )}
          </td>
        </>
      )}
    />
  )
}
export function VaccinationTable({ sort, onSort, rows, t, language, fmtDate, employeeMap, onOpen, registry }: VaccinationTableProps) {
  const name = (e: PreventionEmployee | undefined) =>
    !e
      ? '—'
      : language === 'el'
        ? `${e.lastName} ${e.firstName}`
        : `${e.firstNameEn || e.firstName} ${e.lastNameEn || e.lastName}`
  return (
    <RegistryTable
      bare
      sort={sort}
      onSort={onSort}
      columns={[
        { key: 'employee', label: t('employee'), sortable: true },
        { key: 'vaccine', label: t('vaccine'), sortable: true },
        { key: 'dose', label: t('dose'), sortable: true },
        { key: 'date', label: t('date'), sortable: true },
        { key: 'validUntil', label: t('validUntil'), sortable: true },
        { key: 'status', label: t('status'), sortable: true },
      ]}
      rows={rows}
      rowKey={x => x.id}
      rowProps={x => {
        const rp = registry.rowProps(x.id)
        return { ...rp, className: `${rp.className} clickable-row`, onClick: () => onOpen(x) }
      }}
      renderRow={x => {
        const e = employeeMap[x.employeeId]
        return (
          <>
            <td>
              <strong>{name(e)}</strong>
              <small>{e?.id || '—'}</small>
            </td>
            <td>{x.vaccine || '—'}</td>
            <td>{x.dose || '—'}</td>
            <td>{fmtDate(x.date)}</td>
            <td>{fmtDate(x.validUntil)}</td>
            <td>
              <StatusBadge tone={x.status === 'complete' ? 'success' : 'neutral'}>
                {t(x.status)}
              </StatusBadge>
            </td>
          </>
        )
      }}
    />
  )
}
function localeFromLanguage(language: string) {
  return language === 'en' ? 'en-GB' : 'el-GR'
}
