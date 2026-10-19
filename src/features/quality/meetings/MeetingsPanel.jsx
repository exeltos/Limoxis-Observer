import { useCallback, useEffect, useMemo, useState } from 'react'
import { FilterBar, FilterSelect } from '../../../design-system/FilterBar'
import { RegistryPagination } from '../../../design-system/RegistryPagination'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { useRegisterAccess } from '../../registers/registerAccess'
import { loadMeetings } from './meetingService'
import { lateDecisions, latestMeetings, meetingAccess, meetingStatusLabel, openDecisions } from './meetingModel'

// The department meetings the user may see: every department for Quality, the
// own department(s) for its members (the database filters the same way).
export function useMeetings(enabled = true) {
  const { tenant, role, membership, actualRole, isRolePreview } = useTenant()
  const registerAccess = useRegisterAccess()
  const canManage = (!isRolePreview && actualRole === ROLES.PLATFORM_OWNER) || can(role, CAPABILITIES.MANAGE_QUALITY, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const access = useMemo(() => meetingAccess(registerAccess, canManage), [registerAccess, canManage])
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(enabled)
  const reload = useCallback(() => {
    if (!enabled) { setLoading(false); return }
    setLoading(true)
    loadMeetings(tenant?.id).then(setMeetings).catch(() => setMeetings([])).finally(() => setLoading(false))
  }, [tenant?.id, enabled])
  useEffect(() => { reload() }, [reload])
  const visible = useMemo(() => meetings.filter(access.canSee), [meetings, access])
  return { meetings: visible, all: meetings, loading, reload, access, canManage, seesAll: registerAccess.seesAll }
}

const departmentOf = (meeting, en) => (en ? meeting.departmentEn : meeting.department) || meeting.department || '—'
const monthLabel = (day, language) => (day ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(day).slice(0, 7)}-01T00:00:00Z`)) : '—')

export function filterMeetings(meetings, filters, en) {
  const q = String(filters.query || '').trim().toLowerCase()
  // Open and late decisions are followed on each department's latest meeting.
  const latest = new Set(latestMeetings(meetings).map(meeting => meeting.id))
  return meetings
    .filter(meeting => !['open', 'late'].includes(filters.quick) || latest.has(meeting.id))
    .filter(meeting => !q || `${meeting.code} ${meeting.title} ${meeting.department} ${meeting.departmentEn || ''} ${meeting.minutes || ''}`.toLowerCase().includes(q))
    .filter(meeting => filters.department === 'all' || departmentOf(meeting, en) === filters.department)
    .filter(meeting => filters.status === 'all' || meeting.status === filters.status)
    .filter(meeting => !filters.quick || (filters.quick === 'open' ? openDecisions(meeting).length > 0 : filters.quick === 'late' ? lateDecisions(meeting).length > 0 : filters.quick === 'draft' ? meeting.status === 'draft' : true))
}

export function meetingsExport(meetings, language) {
  const en = language === 'en'
  return {
    name: en ? 'department-meetings' : 'synantiseis-tmimaton',
    headers: en ? ['Code', 'Department', 'Date', 'Indicators of', 'Decisions', 'Open decisions', 'Next meeting', 'Status'] : ['Κωδικός', 'Τμήμα', 'Ημερομηνία', 'Δείκτες του', 'Αποφάσεις', 'Ανοιχτές αποφάσεις', 'Επόμενη', 'Κατάσταση'],
    rows: meetings.map(meeting => [meeting.code, departmentOf(meeting, en), formatDay(meeting.meetingDate, language), monthLabel(meeting.periodMonth, language), meeting.decisions.length, openDecisions(meeting).length, formatDay(meeting.nextMeetingDate, language), meetingStatusLabel(meeting.status, language)]),
  }
}

export function MeetingsList({ list, filters, setFilters, onOpen, filterEnd = null }) {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const rows = useMemo(() => filterMeetings(list.meetings, filters, en), [list.meetings, filters, en])
  useEffect(() => setPage(1), [filters, pageSize])
  const departments = useMemo(() => [...new Set(list.meetings.map(meeting => departmentOf(meeting, en)))].sort((a, b) => a.localeCompare(b, 'el')), [list.meetings, en])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  const today = new Date().toISOString().slice(0, 10)
  const advanced = ['department', 'status'].filter(key => filters[key] !== 'all').length
  return <>
    <FilterBar query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search meetings…' : 'Αναζήτηση συνάντησης…'} activeAdvancedCount={advanced} onClear={() => setFilters(current => ({ ...current, query: '', department: 'all', status: 'all', quick: null }))} end={filterEnd}>
      {departments.length > 1 && <FilterSelect label={t('department')} value={filters.department} onChange={value => set('department', value)}><option value="all">{t('allDepartments')}</option>{departments.map(value => <option key={value} value={value}>{value}</option>)}</FilterSelect>}
      <FilterSelect label={t('status')} value={filters.status} onChange={value => set('status', value)}><option value="all">{t('all')}</option><option value="draft">{meetingStatusLabel('draft', language)}</option><option value="final">{meetingStatusLabel('final', language)}</option></FilterSelect>
    </FilterBar>
    <div className="scroll-table">
      <RegistryTable bare className="quality-table quality-register-table" rows={rows.slice((safePage - 1) * pageSize, safePage * pageSize)} rowKey={meeting => meeting.id} empty={!list.loading && !rows.length} emptyFiltered={list.meetings.length > 0} onClearFilters={() => setFilters(current => ({ ...current, query: '', department: 'all', status: 'all', quick: null }))}
        columns={[{ key: 'code', label: t('code') }, { key: 'department', label: t('department') }, { key: 'date', label: t('date') }, { key: 'period', label: en ? 'Indicators of' : 'Δείκτες του' }, { key: 'decisions', label: en ? 'Decisions' : 'Αποφάσεις' }, { key: 'next', label: en ? 'Next meeting' : 'Επόμενη' }, { key: 'status', label: t('status') }]}
        emptyTitle={en ? 'No department meetings' : 'Δεν υπάρχουν συναντήσεις τμημάτων'} emptyText={en ? 'A department records its meetings here: the month’s indicators, what was discussed and what was decided.' : 'Εδώ το τμήμα καταγράφει τις συναντήσεις του: τους δείκτες του μήνα, τι συζητήθηκε και τι αποφασίστηκε.'}
        rowProps={meeting => ({ className: 'registry-row-clickable', onClick: () => onOpen(meeting) })}
        renderRow={meeting => { const open = openDecisions(meeting).length, late = lateDecisions(meeting).length, nextLate = meeting.nextMeetingDate && meeting.nextMeetingDate < today; return <>
          <td><strong>{meeting.code || '—'}</strong><small>{meeting.kind === 'extraordinary' ? (en ? 'Extraordinary' : 'Έκτακτη') : (en ? 'Regular' : 'Τακτική')}</small></td>
          <td>{departmentOf(meeting, en)}<small>{meeting.title}</small></td>
          <td className="nowrap-cell">{formatDay(meeting.meetingDate, language)}</td>
          <td>{monthLabel(meeting.periodMonth, language)}</td>
          <td>{meeting.decisions.length}<small className={late ? 'quality-overdue-text' : ''}>{late ? (en ? `${late} overdue` : `${late} εκπρόθεσμες`) : (en ? `${open} open` : `${open} ανοιχτές`)}</small></td>
          <td className={`nowrap-cell${nextLate ? ' quality-overdue' : ''}`}>{formatDay(meeting.nextMeetingDate, language) || '—'}{nextLate && <small>{en ? 'Overdue' : 'Εκπρόθεσμη'}</small>}</td>
          <td><StatusBadge tone={meeting.status === 'final' ? 'success' : 'info'}>{meetingStatusLabel(meeting.status, language)}</StatusBadge></td>
        </> }} />
    </div>
    {rows.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
  </>
}
