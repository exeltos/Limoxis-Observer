import { useCallback, useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react'
import { FilterBar } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { SignalBadge } from '../../design-system/StatusBadge'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { CAPABILITIES, ROLES, can } from '../../core/permissions/roles'
import { kitchenSince, loadKitchen, loadKitchenDay, loadKitchenReceipt, loadKitchenTrace, mergeKitchenState } from './kitchenService'
import { limitFor, limitText, statusLabel, statusTone } from './kitchenLimits'
import './kitchen.css'
import type { KitchenDefrostDraft, KitchenHaccpStep, KitchenMenu, KitchenProduct, KitchenProduction, KitchenPureeing, KitchenReceipt, KitchenRecallDrill, KitchenScreenState, KitchenState, KitchenStockRow, KitchenThermal, KitchenUsage } from './kitchenTypes'
import type { RegistryColumn } from '../../design-system/RegistryTable'
import type { EmptyStateAction } from '../../design-system/RegistryEmptyState'
import type { IconType } from '../../design-system/types'
import type { KitchenLimits } from './kitchenLimits'

// Who may do what in the kitchen: read (view), record the day's entries (record),
// manage limits, plan, catalogue, sign-off and deletions (manage).
export function useKitchenAccess() {
  const { role, membership, actualRole, isRolePreview } = useTenant()
  const owner = !isRolePreview && actualRole === ROLES.PLATFORM_OWNER
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  const canManage = owner || can(role, CAPABILITIES.MANAGE_KITCHEN, addOns, custom)
  const canRecord = canManage || can(role, CAPABILITIES.RECORD_KITCHEN, addOns, custom)
  const canView = canRecord || can(role, CAPABILITIES.VIEW_KITCHEN, addOns, custom)
  return { canView, canRecord, canManage }
}

export type KitchenAccess = ReturnType<typeof useKitchenAccess>

// What the kitchen page gives its panels (KitchenPage: props and filtersFor).
export interface KitchenPanelProps {
  state: KitchenState; access: KitchenAccess; reload: () => Promise<unknown>; organizationId: string | null; stock: KitchenStockRow[]
  onDialog: (dialog: KitchenDialog | null) => void; onOpenDay: (id: string) => void; onTrace: (receiptItemId: string | null) => void; onRecall: (drill: KitchenRecallDrill | null) => void
}
// The filters of a list (query, period, the selects): text values, 'all' when unfiltered.
export type KitchenFilters = Record<string, string>
export interface KitchenFilterProps { filters: KitchenFilters; setFilters: (next: KitchenFilters | ((current: KitchenFilters) => KitchenFilters)) => void; switcher?: ReactNode }
// A dialog the kitchen page or a record opens (KitchenDialogHost): its type, and the record
// it edits (initial: a new… draft of kitchenModel or a saved row) or the batch it withdraws from.
export type KitchenDialog =
  | { type: 'receipt'; initial: KitchenReceipt }
  | { type: 'thermal'; initial: KitchenThermal }
  | { type: 'defrost'; initial: KitchenDefrostDraft }
  | { type: 'pureeing'; initial: KitchenPureeing }
  | { type: 'usage'; initial: KitchenUsage }
  | { type: 'writeoff'; batch: KitchenStockRow }
  | { type: 'product'; initial: KitchenProduct }
  | { type: 'menu'; initial: KitchenMenu }
  | { type: 'step'; initial: Partial<KitchenHaccpStep> }
  | { type: 'production'; initial: KitchenProduction }
  | { type: 'limits' | 'settings' }
// What a trace reads beyond the loaded state (loadKitchenTrace).
export type KitchenTraceSubject = NonNullable<Parameters<typeof loadKitchenTrace>[1]>

// The kitchen, with each entry's in / out of limits: the register from `since` on
// (showSince(day) reads further back, showSince(null) the whole history), or one
// receipt (receiptId) or production day (productionId) with what its page needs.
export function useKitchen({ receiptId = null, productionId = null }: { receiptId?: string | null, productionId?: string | null } = {}) {
  const { tenant } = useTenant()
  const [state, setState] = useState<KitchenScreenState | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [since, setSince] = useState<string | null>(() => kitchenSince())
  const reload = useCallback(() => {
    setLoading(true)
    const read = receiptId ? loadKitchenReceipt(tenant?.id, receiptId) : productionId ? loadKitchenDay(tenant?.id, productionId) : loadKitchen(tenant?.id, { since })
    return read.then(next => { setState(next); setFailed(false) }).catch(error => { console.error(error); setFailed(true) }).finally(() => setLoading(false))
  }, [tenant?.id, receiptId, productionId, since])
  useEffect(() => { void reload() }, [reload])
  const showSince = useCallback((day: string | null) => setSince(current => (current && (day === null || (day && day < current)) ? day : current)), [])
  return { state, loading, failed, reload, organizationId: tenant?.id || null, since, showSince }
}

// The state with what a trace needs beyond it (every use of the subject's batches),
// read from the database; `ready` once it is there. The demo has it all already.
export function useKitchenTrace<S extends KitchenState>(state: S, organizationId: string | null | undefined, subject: KitchenTraceSubject | null | undefined) {
  const key = subject ? JSON.stringify(subject) : ''
  const [extra, setExtra] = useState<{ key: string, rows: Awaited<ReturnType<typeof loadKitchenTrace>> } | null>(null)
  useEffect(() => {
    if (!key) return undefined
    let active = true
    loadKitchenTrace(organizationId, JSON.parse(key)).then(rows => { if (active) setExtra({ key, rows }) }).catch(error => { console.error(error); if (active) setExtra({ key, rows: null }) })
    return () => { active = false }
  }, [key, organizationId])
  const ready = !key || extra?.key === key
  const merged = useMemo(() => (key && extra?.key === key ? mergeKitchenState(state, extra.rows) : state), [state, extra, key])
  return { state: merged, ready }
}

// The person recording: the signed-in user (and their employee record when linked).
export function useKitchenActor() {
  const actor = useAuditActor()
  const { membership } = useTenant()
  const employeeId = (membership as { employeeId?: string } | null)?.employeeId
  return useMemo(() => ({ id: actor?.id || null, name: actor?.name || (actor as { fullName?: string } | null)?.fullName || '', employeeId: employeeId || '' }), [actor, employeeId])
}

// Out of limits is the only chip; within limits shows nothing in a list (live: plain text while typing).
export function LimitBadge({ status, language, live = false }: { status?: string | null, language: string, live?: boolean }) {
  if (status === 'in' && !live) return null
  return <SignalBadge tone={statusTone(status)}>{statusLabel(status, language)}</SignalBadge>
}

// The live check under a measurement while it is typed: the result and the limit.
export function LiveLimit({ status, limits, limitKey, language, text = '' }: { status?: string | null, limits?: KitchenLimits, limitKey?: string, language: string, text?: string }) {
  const en = language === 'en'
  const limit = limitKey ? limitFor(limits, limitKey) : null
  return <div className={`kitchen-live-check is-${status || 'none'}`} role="status" aria-live="polite">
    <LimitBadge status={status} language={language} live />
    <span>{text || (limit ? `${en ? 'Limit' : 'Όριο'} ${limitText(limit, language)}` : '')}</span>
  </div>
}

// A row of a kitchen list: its key is its id (a batch of the stock: its receipt item).
export interface KitchenListItem { id?: string; receiptItemId?: string }
interface KitchenListProps<T extends KitchenListItem> {
  rows: T[]; query: string; onQueryChange: (query: string) => void; placeholder?: string; filters?: ReactNode; activeFilters?: number; onClear?: () => void
  columns: RegistryColumn<T>[]; renderRow: (row: T) => ReactNode; rowProps?: (row: T) => HTMLAttributes<HTMLTableRowElement> | null | undefined
  empty?: boolean; emptyTitle?: ReactNode; emptyText?: ReactNode; emptyIcon?: IconType; emptyAction?: EmptyStateAction | null; end?: ReactNode; className?: string
}

// A kitchen list: search, filters, the table and pagination, as the registries.
export function KitchenList<T extends KitchenListItem>({ rows, query, onQueryChange, placeholder, filters = null, activeFilters = 0, onClear, columns, renderRow, rowProps, empty, emptyTitle, emptyText, emptyIcon, emptyAction, end = null, className = '' }: KitchenListProps<T>) {
  const { language } = useLanguage()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  useEffect(() => setPage(1), [query, activeFilters, pageSize, rows.length])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  return <>
    <FilterBar query={query} onQueryChange={onQueryChange} placeholder={placeholder} activeAdvancedCount={activeFilters} onClear={onClear} end={end}>{filters}</FilterBar>
    <div className="scroll-table">
      <RegistryTable sortable={false} bare className={`kitchen-table ${className}`.trim()} rows={rows.slice((safePage - 1) * pageSize, safePage * pageSize)} rowKey={row => (row.id || row.receiptItemId) as string} columns={columns} renderRow={renderRow} rowProps={rowProps}
        empty={empty} emptyFiltered={empty && (Boolean(query) || activeFilters > 0)} onClearFilters={onClear} emptyTitle={emptyTitle} emptyText={emptyText} emptyIcon={emptyIcon} emptyAction={emptyAction} />
    </div>
    {rows.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
  </>
}

export const matches = (query: string, ...values: unknown[]) => {
  const needle = String(query || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  if (!needle) return true
  return values.join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(needle)
}
