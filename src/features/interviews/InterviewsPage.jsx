import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, FilePlus2, Handshake, Inbox, Plus, Tablet, UserCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { KpiFigures } from '../../design-system/KpiCard'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { StatusBadge } from '../../design-system/StatusBadge'
import { ExportMenu } from '../../design-system/ExportMenu'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { CandidateStatusBadge, useInterviews, useInterviewsAccess } from './InterviewsShared'
import { CandidateDialog } from './InterviewsDialogs'
import { ApplicationLinkDialog } from './ApplicationLinkDialog'
import { employmentLabel, filterCandidates, fmtDay, fmtRating, fmtStamp, latestEvaluation, newCandidate, nextInterview, pipelineCounts, positionsOf, ratingTone, statusLabel, statusOptions, upcomingInterviews } from './interviewsModel'
import { exportCandidates } from './interviewsReports'

// The four steps that ask for something; screening, interviewed, rejected and withdrawn are in their notes and in «Filters».
const PIPELINE = [['new', Inbox, 'warning'], ['interview_scheduled', CalendarClock, 'warning'], ['offer', Handshake], ['hired', UserCheck]]

// Συνεντεύξεις: the applications, the pipeline at the top, the interviews to come.
export function InterviewsPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const access = useInterviewsAccess()
  const { state, loading, reload, organizationId } = useInterviews()
  const registry = useRegistryMemory('interviews')
  const saved = registry.loadViewState({ query: '', status: 'open', position: 'all' })
  const [query, setQuery] = useState(saved.query)
  const [status, setStatus] = useState(saved.status)
  const [position, setPosition] = useState(saved.position)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [dialog, setDialog] = useState(null)
  const [tablet, setTablet] = useState(false)
  const candidates = useMemo(() => state?.candidates || [], [state])
  const counts = useMemo(() => pipelineCounts(candidates), [candidates])
  const positions = useMemo(() => positionsOf(candidates), [candidates])
  const rows = useMemo(() => filterCandidates(candidates, { query, status, position }).sort((a, b) => String(b.appliedOn || '').localeCompare(String(a.appliedOn || '')) || String(b.code).localeCompare(String(a.code))), [candidates, query, status, position])
  const upcoming = useMemo(() => upcomingInterviews(candidates).slice(0, 5), [candidates])
  useEffect(() => setPage(1), [query, status, position, pageSize])

  if (!state) return <Page fill title={en ? 'Interviews' : 'Συνεντεύξεις'}><div className="inline-empty">{loading ? (en ? 'Loading…' : 'Φόρτωση…') : (en ? 'The applications could not be loaded.' : 'Δεν ήταν δυνατή η φόρτωση των αιτήσεων.')}</div></Page>

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  const open = item => { registry.saveViewState({ query, status, position }); registry.openRecord(navigate, `/interviews/${encodeURIComponent(item.id)}`, item.id, rows.map(row => row.id)) }
  const clear = () => { setQuery(''); setStatus('all'); setPosition('all') }
  const actions = <div className="row-actions">
    <ExportMenu onExcel={() => exportCandidates(rows, language)} />
    {/* «New application ▾»: typed here, or filled in by the candidate on a tablet. */}
    {access.canManage && <OverflowMenu label={en ? 'New application' : 'Νέα αίτηση'} triggerTone="primary" width={240} trigger={<><FilePlus2 size={15} aria-hidden="true" />{en ? 'New application' : 'Νέα αίτηση'}</>} items={[
      { id: 'new', label: en ? 'New application' : 'Νέα αίτηση', icon: FilePlus2, onClick: () => setDialog(newCandidate()) },
      { id: 'tablet', label: en ? 'Application from a tablet' : 'Αίτηση από tablet', icon: Tablet, onClick: () => setTablet(true) },
    ]} />}
  </div>
  return <Page fill className="registry-fill-page interviews-page" title={en ? 'Interviews' : 'Συνεντεύξεις'} subtitle={en ? 'Candidate applications, interviews with their evaluation, the decision and the hiring.' : 'Αιτήσεις υποψηφίων, συνεντεύξεις με την αξιολόγησή τους, απόφαση και πρόσληψη.'} actions={actions}>
    <KpiFigures label={en ? 'Applications' : 'Αιτήσεις'} figures={PIPELINE.map(([key, Icon, tone]) => ({ key, icon: Icon, value: counts[key], label: statusLabel(key, language), tone, active: status === key, go: () => setStatus(status === key ? 'all' : key),
      hint: key === 'new' && counts.screening ? (en ? `${counts.screening} in screening` : `${counts.screening} σε έλεγχο`) : key === 'offer' && counts.interviewed ? (en ? `${counts.interviewed} interviewed` : `${counts.interviewed} έγινε συνέντευξη`) : key === 'hired' ? (en ? `${counts.rejected} rejected · ${counts.withdrawn} withdrawn` : `${counts.rejected} απορρίφθηκαν · ${counts.withdrawn} αποσύρθηκαν`) : null }))} />
    {upcoming.length > 0 && <section className="surface interviews-upcoming" aria-label={en ? 'Upcoming interviews' : 'Επόμενες συνεντεύξεις'}>
      <strong>{en ? 'Upcoming interviews' : 'Επόμενες συνεντεύξεις'}</strong>
      {upcoming.map(item => <button type="button" key={item.id} className="interviews-upcoming-item" onClick={() => open(item.candidate)}><CalendarClock size={14} /><span>{fmtStamp(item.scheduledAt, language)}</span><b>{item.candidate.fullName}</b><small>{item.candidate.requestedPosition}</small></button>)}
    </section>}
    <section className="surface registry-workspace workspace-column workspace-fill">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={en ? 'Search name, code, phone, email, position…' : 'Αναζήτηση ονόματος, κωδικού, τηλεφώνου, email, θέσης…'} activeAdvancedCount={(status !== 'all' ? 1 : 0) + (position !== 'all' ? 1 : 0)} onClear={clear}>
        <FilterSelect label={en ? 'Status' : 'Κατάσταση'} value={status} onChange={setStatus}><option value="all">{en ? 'All' : 'Όλες'}</option><option value="open">{en ? 'Open (in progress)' : 'Ανοιχτές (σε εξέλιξη)'}</option>{statusOptions(language).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</FilterSelect>
        <FilterSelect label={en ? 'Position' : 'Θέση'} value={position} onChange={setPosition}><option value="all">{en ? 'All positions' : 'Όλες οι θέσεις'}</option>{positions.map(item => <option key={item} value={item}>{item}</option>)}</FilterSelect>
      </FilterBar>
      <div className="scroll-table" ref={registry.scrollRef}>
        <RegistryTable bare rows={rows.slice((safePage - 1) * pageSize, safePage * pageSize)} rowKey={item => item.id}
          columns={[{ key: 'code', label: en ? 'Code' : 'Κωδικός' }, { key: 'name', label: en ? 'Candidate' : 'Υποψήφιος' }, { key: 'position', label: en ? 'Position' : 'Θέση' }, { key: 'applied', label: en ? 'Applied' : 'Αίτηση' }, { key: 'interview', label: en ? 'Interview' : 'Συνέντευξη' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }]}
          rowProps={item => ({ ...registry.rowProps(item.id), onClick: () => open(item), onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(item) } } })}
          empty={!rows.length} emptyFiltered={candidates.length > 0} onClearFilters={clear} emptyIcon={Inbox}
          emptyTitle={candidates.length ? (en ? 'No application matches' : 'Καμία αίτηση δεν ταιριάζει') : (en ? 'No applications yet' : 'Δεν υπάρχουν αιτήσεις')}
          emptyText={candidates.length ? '' : (en ? 'Enter the first application; the FileMaker ones are brought over by the migration.' : 'Καταχωρίστε την πρώτη αίτηση· όσες υπήρχαν στο FileMaker μεταφέρονται με τη μετάπτωση.')}
          emptyAction={access.canManage && !candidates.length ? { label: en ? 'New application' : 'Νέα αίτηση', icon: Plus, onClick: () => setDialog(newCandidate()) } : null}
          renderRow={item => { const next = nextInterview(item), last = latestEvaluation(item); return <>
            <td className="nowrap-cell"><strong>{item.code}</strong>{item.source === 'filemaker' && <small>FileMaker</small>}{item.source === 'tablet' && <small><StatusBadge tone="info">{en ? 'From tablet' : 'Από tablet'}</StatusBadge></small>}</td>
            <td><strong>{item.fullName}</strong><small>{[item.phoneMobile || item.phoneLandline, item.email].filter(Boolean).join(' · ')}</small></td>
            <td>{item.requestedPosition || '—'}{item.employmentType && <small>{employmentLabel(item.employmentType, language)}</small>}</td>
            <td className="nowrap-cell">{fmtDay(item.appliedOn)}</td>
            <td className="nowrap-cell">{next ? <><CalendarClock size={13} /> {fmtStamp(next.scheduledAt, language)}</> : last ? <StatusBadge tone={ratingTone(last.overallRating)}>{fmtRating(last.overallRating, language)}</StatusBadge> : '—'}</td>
            <td><CandidateStatusBadge status={item.status} language={language} /></td>
          </>}} />
      </div>
      {rows.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
    </section>
    {tablet && <ApplicationLinkDialog organizationId={organizationId} positions={positions} onClose={() => { setTablet(false); void reload() }} />}
    {dialog && <CandidateDialog initial={dialog} organizationId={organizationId} positions={positions} onClose={() => setDialog(null)} onSaved={async id => { await reload(); if (id) navigate(`/interviews/${encodeURIComponent(id)}`) }} />}
  </Page>
}
