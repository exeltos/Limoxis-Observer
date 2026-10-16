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
import { loadRegisters } from './registerService'
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

// filterEnd: content at the right of the filter row (the Quality Center's view switch).
export function RegistersPanel({ list, onBeforeOpen, filterEnd = null, onRowsChange }) {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const registry = useRegistryMemory('registers')
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('all')
  const [kind, setKind] = useState('all')
  const departments = useMemo(() => [...new Set(list.registers.map(register => (en ? register.departmentEn : register.department)).filter(Boolean))], [list.registers, en])
  const rows = useMemo(() => list.registers
    .filter(register => `${register.code} ${register.name} ${register.nameEn} ${register.department}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(register => department === 'all' || (en ? register.departmentEn : register.department) === department)
    .filter(register => kind === 'all' || register.kind === kind), [list.registers, query, department, kind, en])
  // The Quality Center's «Download» exports what the filters leave on screen.
  useEffect(() => { onRowsChange?.(rows) }, [rows, onRowsChange])
  const open = register => { onBeforeOpen?.(); registry.openRecord(navigate, `/registers/${register.id}`, register.id, rows.map(row => row.id)) }
  return <>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={en ? 'Search register or department' : 'Αναζήτηση μητρώου ή τμήματος'} activeAdvancedCount={(department !== 'all' ? 1 : 0) + (kind !== 'all' ? 1 : 0)} onClear={() => { setQuery(''); setDepartment('all'); setKind('all') }} end={filterEnd}>
      <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(name => <option key={name} value={name}>{name}</option>)}</FilterSelect>
      <FilterSelect label={en ? 'Kind' : 'Είδος'} value={kind} onChange={setKind}><option value="all">{t('all')}</option><option value="case">{registerKindLabel('case', language)}</option><option value="sheet">{registerKindLabel('sheet', language)}</option></FilterSelect>
    </FilterBar>
    <RegistryTable className="register-table" wrapperRef={registry.scrollRef} rows={rows} columns={[{ key: 'name', label: en ? 'Register' : 'Μητρώο' }, { key: 'department', label: t('department') }, { key: 'kind', label: en ? 'Kind' : 'Είδος' }, { key: 'entries', label: en ? 'Entries' : 'Καταχωρίσεις' }, { key: 'last', label: en ? 'Last entry' : 'Τελευταία καταχώριση' }, { key: 'indicators', label: en ? 'Indicators' : 'Δείκτες' }, { key: 'status', label: t('status') }]}
      rowProps={register => ({ ...registry.rowProps(register.id), onClick: () => open(register) })}
      renderRow={register => <>
        <td><strong>{en ? register.nameEn : register.name}</strong><small>{register.code}</small></td>
        <td>{(en ? register.departmentEn : register.department) || '—'}</td>
        <td><span className="register-kind">{register.kind === 'sheet' ? <CalendarRange size={14} /> : <ClipboardList size={14} />}{registerKindLabel(register.kind, language)}</span></td>
        <td>{register.entryCount ?? 0}</td>
        <td>{formatDay(register.lastEntry, language) || '—'}</td>
        <td>{register.indicators?.length || 0}</td>
        <td><StatusBadge tone={register.status === 'active' ? 'success' : register.status === 'draft' ? 'info' : 'neutral'}>{registerStatusLabel(register.status, language)}</StatusBadge></td>
      </>}
      emptyTitle={!list.loading && !rows.length ? (en ? 'No registers' : 'Δεν υπάρχουν μητρώα') : ''}
      emptyText={en ? 'Quality creates a register for a department from a template (NICU, Endoscopy, Ophthalmology) or from scratch.' : 'Η Ποιότητα δημιουργεί μητρώο για ένα τμήμα από πρότυπο (ΜΕΝΝ, Ενδοσκοπικό, Οφθαλμολογικό) ή από την αρχή.'} />
  </>
}
