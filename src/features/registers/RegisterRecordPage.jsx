import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { BarChart3, CalendarRange, ClipboardList, History, Lock, Plus, Settings2, Upload } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { ExportMenu } from '../../design-system/ExportMenu'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { RegistryTable } from '../../design-system/RegistryTable'
import { ActionButton } from '../../design-system/ActionButton'
import { StatusBadge } from '../../design-system/StatusBadge'
import { HistoryTimeline } from '../../design-system/HistoryTimeline'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { formatDay } from '../../core/i18n/formatDay'
import { exportRegistry } from '../../core/export/registryExports'
import { loadEntries, loadRegister } from './registerService'
import { useRegisterAccess } from './registerAccess'
import { computeValues, formatValue, textOf } from './registerEngine'
import { registerKindLabel, registerStatusLabel } from './registerText'
import { RegisterSheet, dailyFromOf } from './RegisterSheet'
import { RegisterIndicators } from './RegisterIndicators'
import { RegisterBuilder } from './RegisterBuilder'
import './registers.css'

// One department register: its entries (cases, or the monthly sheet), its
// indicators with the report, its definition and its history.
export function RegisterRecordPage() {
  const { registerId } = useParams()
  const location = useLocation()
  const { language } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation('/registers')
  const access = useRegisterAccess()
  const [register, setRegister] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(() => location.state?.registerTab || 'entries')
  // «Set a target» in Indicators opens that indicator in Definition.
  const [defineIndicator, setDefineIndicator] = useState(null)
  const [newDayTick, setNewDayTick] = useState(0)
  // The indicators tab's export handlers, shown in the header like the entries' export.
  const [indicatorExport, setIndicatorExport] = useState(null)
  const withIdentity = register ? access.canSeeIdentity(register) : false
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const next = await loadRegister(tenant?.id, registerId)
      setRegister(next)
      setEntries(next ? await loadEntries(tenant?.id, next.id, { withIdentity: access.canSeeIdentity(next), register: next }) : [])
    } catch (error) {
      console.error(error)
      setRegister(null)
    } finally { setLoading(false) }
  }, [tenant?.id, registerId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void reload() }, [reload])

  if (loading && !register) return <Page fill><div className="inline-empty">{en ? 'Loading register…' : 'Φόρτωση μητρώου…'}</div></Page>
  if (!register || !access.canSee(register)) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Register not found' : 'Το μητρώο δεν βρέθηκε'}</strong><span>{en ? 'It does not exist or belongs to another department.' : 'Δεν υπάρχει ή ανήκει σε άλλο τμήμα.'}</span></div></Page>

  const sheet = register.kind === 'sheet'
  const tabs = [
    { id: 'entries', label: sheet ? (en ? `Days ${entries.length}` : `Ημέρες ${entries.length}`) : (en ? `Cases ${entries.length}` : `Περιστατικά ${entries.length}`), icon: sheet ? CalendarRange : ClipboardList },
    { id: 'indicators', label: en ? `Indicators ${register.indicators.length}` : `Δείκτες ${register.indicators.length}`, icon: BarChart3 },
    { id: 'definition', label: en ? 'Definition' : 'Ορισμός', icon: Settings2 },
    { id: 'history', label: en ? 'History' : 'Ιστορικό', icon: History },
  ]
  const onExport = entries.length ? () => exportRegistry(registerExport(register, entries, { language, withIdentity })) : null
  // The header on Entries and on Indicators: «Export ▾» (the entries, or the indicator report) and the primary action.
  const exportMenu = tab === 'indicators' ? <ExportMenu disabled={!indicatorExport || indicatorExport.disabled} onExcel={indicatorExport?.excel} onPdf={indicatorExport?.pdf} pdfBusy={Boolean(indicatorExport?.busy)} /> : onExport && <ExportMenu onExcel={onExport} />
  const importButton = tab === 'entries' && !sheet && access.canRecord(register) && withIdentity && <ActionButton label={en ? 'Import from FileMaker' : 'Εισαγωγή από FileMaker'} onClick={() => navigate(`/registers/${register.id}/import`)}><Upload size={16} /><span>{en ? 'Import' : 'Εισαγωγή'}</span></ActionButton>
  const beforeDaily = new Date().toISOString().slice(0, 7) < dailyFromOf(register)
  // «New day» opens today's sheet (from the first day of the daily sheets), also from the indicators tab.
  const primaryAction = access.canRecord(register) && (sheet
    ? <ActionButton tone="primary" label={en ? 'New day' : 'Νέα ημέρα'} disabled={beforeDaily} title={beforeDaily ? (en ? 'Daily entry starts on 1 November 2026' : 'Η ημερήσια καταχώριση ξεκινά 1/11/2026') : undefined} onClick={() => { setTab('entries'); setNewDayTick(tick => tick + 1) }}><Plus size={17} /><span>{en ? 'New day' : 'Νέα ημέρα'}</span></ActionButton>
    : <ActionButton tone="primary" label={en ? 'New case' : 'Νέο περιστατικό'} onClick={() => navigate(`/registers/${register.id}/entries/new`)}><Plus size={17} /><span>{en ? 'New case' : 'Νέο περιστατικό'}</span></ActionButton>)
  const headerActions = (tab === 'entries' || tab === 'indicators') && (exportMenu || importButton || primaryAction) ? <div className="row-actions">{exportMenu}{importButton}{primaryAction}</div> : undefined
  const status = <StatusBadge tone={register.status === 'active' ? 'success' : 'neutral'}>{registerStatusLabel(register.status, language)}</StatusBadge>
  const context = <span className="register-context">{[en ? register.departmentEn : register.department, registerKindLabel(register.kind, language), `${en ? 'version' : 'έκδοση'} ${register.version}`].filter(Boolean).join(' · ')}{!withIdentity && !sheet && <span className="register-privacy"><Lock size={13} />{en ? 'Names visible only to the department' : 'Τα ονόματα τα βλέπει μόνο το τμήμα'}</span>}</span>
  return <Page fill><EntityRecordShell className="register-record-shell workspace-fill" avatar={sheet ? <CalendarRange size={19} /> : <ClipboardList size={19} />} eyebrow={register.code} title={en ? register.nameEn : register.name} context={context} status={status} tabs={tabs} activeTab={tab} onTabChange={next => { setTab(next); setNewDayTick(0) }} onBack={goBack} headerActions={headerActions}
>
    {tab === 'entries' && (sheet ? <RegisterSheet register={register} entries={entries} onSaved={reload} newDayTick={newDayTick} /> : <RegisterCases register={register} entries={entries} withIdentity={withIdentity} canRecord={access.canRecord(register)} loading={loading} />)}
    {tab === 'indicators' && <RegisterIndicators register={register} entries={entries} onExportApi={setIndicatorExport} onDefineTarget={access.canDefine ? indicatorId => { setDefineIndicator(indicatorId); setTab('definition') } : null} />}
    {tab === 'definition' && <RegisterBuilder register={register} canEdit={access.canDefine} entryCount={entries.length} openIndicator={defineIndicator} onSaved={next => setRegister(next)} />}
    {tab === 'history' && <HistoryTimeline title={en ? 'History' : 'Ιστορικό'} subtitle={en ? 'Changes to the register’s definition.' : 'Αλλαγές στον ορισμό του μητρώου.'} events={[...(register.history || [])].reverse().map(event => ({ at: event.at, title: historyTitle(event.action, language), meta: [event.actor] }))} when={value => formatDay(value, language)} emptyText={en ? 'No changes yet.' : 'Δεν υπάρχουν αλλαγές ακόμη.'} />}
  </EntityRecordShell></Page>
}

const historyTitle = (action, language) => (language === 'en' ? { created: 'Register created', updated: 'Definition changed', archived: 'Register archived', activated: 'Register activated' } : { created: 'Δημιουργία μητρώου', updated: 'Αλλαγή ορισμού', archived: 'Αρχειοθέτηση μητρώου', activated: 'Ενεργοποίηση μητρώου' })[action] || action

// The columns of the case list: the date the case counts on, then the fields
// marked `list` (or the first four).
export function listFields(register) {
  const dateField = register.fields.find(field => field.key === register.settings?.entryDateField)
  const marked = register.fields.filter(field => field.list && field !== dateField)
  return [dateField, ...(marked.length ? marked : register.fields.filter(field => field !== dateField && field.type !== 'text').slice(0, 4))].filter(Boolean)
}

function RegisterCases({ register, entries, withIdentity, canRecord, loading }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [year, setYear] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const columns = listFields(register)
  const years = useMemo(() => [...new Set(entries.map(entry => String(entry.entryDate || '').slice(0, 4)).filter(Boolean))].sort().reverse(), [entries])
  const rows = useMemo(() => [...entries]
    .filter(entry => year === 'all' || String(entry.entryDate).startsWith(year))
    .filter(entry => !query.trim() || `${entry.identity?.caseNumber || ''} ${entry.identity?.patientName || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => String(b.entryDate).localeCompare(String(a.entryDate))), [entries, year, query])
  useEffect(() => setPage(1), [query, year, pageSize])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  // The cases open in the list's order, so the case page steps to the previous and next one.
  const registry = useRegistryMemory(`register-cases-${register.id}`)
  const open = entry => registry.openRecord(navigate, `/registers/${register.id}/entries/${entry.id}`, entry.id, rows.map(item => item.id))
  return <RecordTabPanel className="register-cases" title={en ? 'Cases' : 'Περιστατικά'} subtitle={withIdentity ? (en ? 'Your department’s cases. The case number and name stay inside the department.' : 'Τα περιστατικά του τμήματος. Αριθμός περιστατικού και όνομα μένουν στο τμήμα.') : (en ? 'The values the indicators read, without names.' : 'Οι τιμές που διαβάζουν οι δείκτες, χωρίς ονόματα.')}
    footer={<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={withIdentity ? (en ? 'Case number or name' : 'Αριθμός περιστατικού ή όνομα') : (en ? 'Search is by case number, inside the department' : 'Η αναζήτηση γίνεται με αριθμό περιστατικού, μέσα στο τμήμα')} activeAdvancedCount={year !== 'all' ? 1 : 0} onClear={() => { setQuery(''); setYear('all') }}>
      <FilterSelect label={en ? 'Year' : 'Έτος'} value={year} onChange={setYear}><option value="all">{en ? 'All years' : 'Όλα τα έτη'}</option>{years.map(item => <option key={item} value={item}>{item}</option>)}</FilterSelect>
    </FilterBar>
    <RegistryTable sortable={false} className="register-table" rows={paged} columns={[{ key: 'who', label: withIdentity ? (en ? 'Case' : 'Περιστατικό') : '#' }, ...columns.map(field => ({ key: field.key, label: textOf(field, language) }))]}
      rowProps={entry => ({ className: 'registry-row-clickable', onClick: () => open(entry), tabIndex: 0, onKeyDown: event => { if (event.key === 'Enter') open(entry) } })}
      renderRow={entry => {
        const values = computeValues(register.fields, entry.values)
        return <>
          <td>{withIdentity ? <><strong>{entry.identity?.patientName || '—'}</strong><small>{entry.identity?.caseNumber || ''}</small></> : <strong>{String(entry.id).slice(-6).toUpperCase()}</strong>}</td>
          {columns.map(field => <td key={field.key}>{formatValue(field, values[field.key], language)}</td>)}
        </>
      }}
      emptyTitle={!loading && !rows.length ? (en ? 'No cases' : 'Δεν υπάρχουν περιστατικά') : ''} emptyText={canRecord ? (en ? 'Record the first case with «New case».' : 'Καταχωρίστε το πρώτο με «Νέο περιστατικό».') : ''} />
  </RecordTabPanel>
}

// CSV for Excel: the values of every entry (no names, whoever exports).
export function registerExport(register, entries, { language = 'el' } = {}) {
  const en = language === 'en'
  const title = en ? register.nameEn : register.name
  if (register.kind === 'sheet') {
    const rows = register.sheet.rows || [], measures = register.sheet.measures || []
    return { name: `${register.code}_${title}`, headers: [en ? 'Month' : 'Μήνας', ...rows.flatMap(row => measures.map(measure => `${textOf(row, language)}${measures.length > 1 ? ` · ${textOf(measure, language)}` : ''}`))], rows: [...entries].sort((a, b) => String(a.periodStart).localeCompare(String(b.periodStart))).map(entry => [String(entry.periodStart).slice(0, 7), ...rows.flatMap(row => measures.map(measure => entry.values?.[row.key]?.[measure.key] ?? ''))]) }
  }
  const fields = register.fields.filter(field => field.type !== 'text')
  return { name: `${register.code}_${title}`, headers: ['#', ...fields.map(field => textOf(field, language))], rows: entries.map(entry => { const values = computeValues(register.fields, entry.values); return [String(entry.id).slice(-6).toUpperCase(), ...fields.map(field => { const value = values[field.key]; return value == null || value === '' ? '' : ['number', 'computed'].includes(field.type) ? Number(value) : formatValue(field, value, language) })] }) }
}
