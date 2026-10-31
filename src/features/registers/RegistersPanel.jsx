import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, ClipboardList } from 'lucide-react'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { formatDay } from '../../core/i18n/formatDay'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { loadEntries, loadRegisters } from './registerService'
import { indicatorReport, periodLabel, periodOf } from './registerEngine'
import { useRegisterAccess } from './registerAccess'
import { registerKindLabel, registerStatusLabel } from './registerText'
import './registers.css'

// The registers a user may open: every register for Quality, the registers of
// their own department for a department. Used by the Quality Center tab and by
// the department's «Registers» page.
export function useRegisterList() {
  const { tenant } = useTenant()
  const access = useRegisterAccess()
  const [registers, setRegisters] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    loadRegisters(tenant?.id).then(rows => { if (active) setRegisters(rows) }).catch(() => { if (active) setRegisters([]) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tenant?.id])
  const visible = useMemo(() => registers.filter(register => access.canSee(register)), [registers, access])
  return { registers: visible, loading }
}

// How each register's indicators stand for the last full month: read one register after the other,
// kept for the session, so the list shows «2 past the limit» without opening the register.
const healthCache = new Map()
const lastFullMonth = () => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - 1); return date.toISOString().slice(0, 7) }
function useRegisterHealth(registers) {
  const { tenant } = useTenant()
  const [health, setHealth] = useState(() => new Map())
  const signature = registers.map(register => `${register.id}:${register.entryCount}:${register.lastEntry}:${register.indicators?.length}`).join('|')
  useEffect(() => {
    let active = true
    const period = periodOf('month', `${lastFullMonth()}-01`)
    ;(async () => {
      for (const register of registers) {
        if (!register.indicators?.length) continue
        const key = `${tenant?.id}:${register.id}:${register.entryCount}:${register.lastEntry}:${period.key}:${JSON.stringify(register.indicators.map(item => [item.id, item.target, item.threshold, item.direction]))}`
        if (!healthCache.has(key)) {
          try {
            const entries = await loadEntries(tenant?.id, register.id, { withIdentity: false, register })
            const report = indicatorReport(register, entries, period)
            healthCache.set(key, { breach: report.filter(row => row.current.status === 'breach').length, attention: report.filter(row => row.current.status === 'attention').length, onTarget: report.filter(row => row.current.status === 'onTarget').length, period })
          } catch { continue }
        }
        if (!active) return
        setHealth(current => new Map(current).set(register.id, healthCache.get(key)))
      }
    })()
    return () => { active = false }
  }, [signature, tenant?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return health
}

// filterEnd: content at the right of the filter row (the Quality Center's view switch).
// only: a predicate the caller narrows the list with (registers without recent entries).
export function RegistersPanel({ list, only = null, onBeforeOpen, filterEnd = null, onRowsChange }) {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const registry = useRegistryMemory('registers')
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('all')
  const [kind, setKind] = useState('all')
  const departments = useMemo(() => [...new Set(list.registers.map(register => (en ? register.departmentEn : register.department)).filter(Boolean))], [list.registers, en])
  const rows = useMemo(() => list.registers
    .filter(register => !only || only(register))
    .filter(register => `${register.code} ${register.name} ${register.nameEn} ${register.department}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(register => department === 'all' || (en ? register.departmentEn : register.department) === department)
    .filter(register => kind === 'all' || register.kind === kind), [list.registers, only, query, department, kind, en])
  // The Quality Center's «Download» exports what the filters leave on screen.
  useEffect(() => { onRowsChange?.(rows) }, [rows, onRowsChange])
  const health = useRegisterHealth(list.registers)
  const open = register => { onBeforeOpen?.(); registry.openRecord(navigate, `/registers/${register.id}`, register.id, rows.map(row => row.id)) }
  return <>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={en ? 'Search register or department' : 'Αναζήτηση μητρώου ή τμήματος'} activeAdvancedCount={(department !== 'all' ? 1 : 0) + (kind !== 'all' ? 1 : 0)} onClear={() => { setQuery(''); setDepartment('all'); setKind('all') }} end={filterEnd}>
      <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(name => <option key={name} value={name}>{name}</option>)}</FilterSelect>
      <FilterSelect label={en ? 'Kind' : 'Είδος'} value={kind} onChange={setKind}><option value="all">{t('all')}</option><option value="case">{registerKindLabel('case', language)}</option><option value="sheet">{registerKindLabel('sheet', language)}</option></FilterSelect>
    </FilterBar>
    <RegistryTable className="register-table" wrapperRef={registry.scrollRef} rows={rows} columns={[{ key: 'name', label: en ? 'Register' : 'Μητρώο', sortValue: register => (en ? register.nameEn : register.name) }, { key: 'department', label: t('department'), sortValue: register => (en ? register.departmentEn : register.department) }, { key: 'kind', label: en ? 'Kind' : 'Είδος', sortValue: register => register.kind }, { key: 'entries', label: en ? 'Entries' : 'Καταχωρίσεις', sortValue: register => register.entryCount ?? 0 }, { key: 'last', label: en ? 'Last entry' : 'Τελευταία καταχώριση', sortValue: register => register.lastEntry }, { key: 'indicators', label: en ? 'Indicators' : 'Δείκτες', sortValue: register => register.indicators?.length || 0 }, { key: 'status', label: t('status') }]}
      rowProps={register => ({ ...registry.rowProps(register.id), onClick: () => open(register) })}
      renderRow={register => <>
        <td><strong>{en ? register.nameEn : register.name}</strong><small>{register.code}</small></td>
        <td>{(en ? register.departmentEn : register.department) || '—'}</td>
        <td><span className="register-kind">{register.kind === 'sheet' ? <CalendarRange size={14} /> : <ClipboardList size={14} />}{registerKindLabel(register.kind, language)}</span></td>
        <td>{register.entryCount ?? 0}</td>
        <td>{formatDay(register.lastEntry, language) || '—'}</td>
        <td>{register.indicators?.length || 0}{(item => item && (item.breach ? <StatusBadge tone="danger" title={periodLabel(item.period, language)}>{en ? `${item.breach} past the limit` : `${item.breach} πέρα από το όριο`}</StatusBadge> : item.attention ? <StatusBadge tone="warning" title={periodLabel(item.period, language)}>{en ? `${item.attention} below target` : `${item.attention} εκτός στόχου`}</StatusBadge> : item.onTarget ? <StatusBadge tone="success" title={periodLabel(item.period, language)}>{en ? 'On target' : 'Εντός στόχου'}</StatusBadge> : null))(health.get(register.id))}</td>
        <td><StatusBadge tone={register.status === 'active' ? 'success' : register.status === 'draft' ? 'info' : 'neutral'}>{registerStatusLabel(register.status, language)}</StatusBadge></td>
      </>}
      emptyTitle={!list.loading && !rows.length ? (en ? 'No registers' : 'Δεν υπάρχουν μητρώα') : ''}
      emptyText={en ? 'Quality creates a register for a department from a template (NICU, Endoscopy, Ophthalmology) or from scratch.' : 'Η Ποιότητα δημιουργεί μητρώο για ένα τμήμα από πρότυπο (ΜΕΝΝ, Ενδοσκοπικό, Οφθαλμολογικό) ή από την αρχή.'} />
  </>
}
