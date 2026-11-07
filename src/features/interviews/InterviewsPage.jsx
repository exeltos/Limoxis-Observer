import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, FilePlus2, Inbox, Plus, Tablet } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { StatusBadge } from '../../design-system/StatusBadge'
import { ExportMenu } from '../../design-system/ExportMenu'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { CandidateStatusBadge, useInterviews, useInterviewsAccess } from './InterviewsShared'
import { CandidateDialog } from './InterviewsDialogs'
import { ApplicationLinkDialog } from './ApplicationLinkDialog'
import { employmentLabel, filterCandidates, fmtDay, newCandidate, pipelineCounts, positionsOf, statusOptions, categoryLabel } from './interviewsModel'
import { candidatesExport } from './interviewsReports'
import { registryMenu } from '../../core/export/registryExports'
import { DivisionInterviewsPage, DivisionsPanel } from './InterviewDivisions'

// Συνεντεύξεις: the applications, the pipeline at the top, the interviews to come.
export function InterviewsPage() {
  const access = useInterviewsAccess()
  return access.divisionOnly ? <DivisionInterviewsPage /> : <InterviewsListPage />
}

function InterviewsListPage() {
  const { language } = useLanguage()
  const { notify } = useFeedback()
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
  const [divisionsView, setDivisionsView] = useState(false)
  const candidates = useMemo(() => state?.candidates || [], [state])
  const counts = useMemo(() => pipelineCounts(candidates), [candidates])
  const positions = useMemo(() => positionsOf(candidates), [candidates])
  const rows = useMemo(() => filterCandidates(candidates, { query, status, position }).sort((a, b) => String(b.appliedOn || '').localeCompare(String(a.appliedOn || '')) || String(b.code).localeCompare(String(a.code))), [candidates, query, status, position])
  useEffect(() => setPage(1), [query, status, position, pageSize])

  if (!state) return <Page fill title={en ? 'Interviews' : 'Συνεντεύξεις'}><div className="inline-empty">{loading ? (en ? 'Loading…' : 'Φόρτωση…') : (en ? 'The applications could not be loaded.' : 'Δεν ήταν δυνατή η φόρτωση των αιτήσεων.')}</div></Page>

  if (divisionsView) return <Page fill className="interviews-page" title={en ? 'Interviews' : 'Συνεντεύξεις'}><section className="surface registry-workspace workspace-column workspace-fill"><DivisionsPanel organizationId={organizationId} onBack={() => setDivisionsView(false)} /></section></Page>
  if (dialog) return <CandidateDialog initial={dialog} organizationId={organizationId} positions={positions} onClose={() => setDialog(null)} onSaved={async id => { await reload(); if (id) navigate(`/interviews/${encodeURIComponent(id)}`) }} />
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  const open = item => { registry.saveViewState({ query, status, position }); registry.openRecord(navigate, `/interviews/${encodeURIComponent(item.id)}`, item.id, rows.map(row => row.id)) }
  const clear = () => { setQuery(''); setStatus('all'); setPosition('all') }
  const actions = <div className="row-actions">
    <ExportMenu {...registryMenu(() => candidatesExport(rows, language), { language, kind: en ? 'Interviews · candidates' : 'Συνεντεύξεις · υποψήφιοι', onBlocked: () => notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error') })} disabled={!rows.length} />
    {/* «New application ▾»: typed here, or filled in by the candidate on a tablet. */}
    {access.canManage && <OverflowMenu label={en ? 'More' : 'Περισσότερα'} items={[{ id: 'divisions', label: en ? 'Divisions' : 'Διευθύνσεις', icon: Building2, onClick: () => setDivisionsView(true) }]} />}
    {access.canManage && <OverflowMenu label={en ? 'New application' : 'Νέα αίτηση'} triggerTone="primary" width={240} trigger={<><FilePlus2 size={15} aria-hidden="true" />{en ? 'New application' : 'Νέα αίτηση'}</>} items={[
      { id: 'new', label: en ? 'New application' : 'Νέα αίτηση', icon: FilePlus2, onClick: () => setDialog(newCandidate()) },
      { id: 'tablet', label: en ? 'Application from a tablet' : 'Αίτηση από tablet', icon: Tablet, onClick: () => setTablet(true) },
    ]} />}
  </div>
  return <Page fill className="registry-fill-page interviews-page" title={en ? 'Interviews' : 'Συνεντεύξεις'} subtitle={en ? 'Candidate applications, interviews with their evaluation, the decision and the hiring.' : 'Αιτήσεις υποψηφίων, συνεντεύξεις με την αξιολόγησή τους, απόφαση και πρόσληψη.'} actions={actions}>
    <section className="surface registry-workspace workspace-column workspace-fill">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={en ? 'Search name, code, phone, email, position…' : 'Αναζήτηση ονόματος, κωδικού, τηλεφώνου, email, θέσης…'} activeAdvancedCount={(status !== 'all' ? 1 : 0) + (position !== 'all' ? 1 : 0)} onClear={clear}>
        <FilterSelect label={en ? 'Status' : 'Κατάσταση'} value={status} onChange={setStatus}><option value="all">{en ? 'All' : 'Όλες'}</option><option value="open">{en ? 'Open (in progress)' : 'Ανοιχτές (σε εξέλιξη)'}</option>{statusOptions(language).map(item => <option key={item.value} value={item.value}>{item.label}{['new', 'interview_scheduled', 'offer', 'hired'].includes(item.value) ? ` (${counts[item.value] || 0})` : ''}</option>)}</FilterSelect>
        <FilterSelect label={en ? 'Position' : 'Θέση'} value={position} onChange={setPosition}><option value="all">{en ? 'All positions' : 'Όλες οι θέσεις'}</option>{positions.map(item => <option key={item} value={item}>{item}</option>)}</FilterSelect>
      </FilterBar>
      <div className="scroll-table" ref={registry.scrollRef}>
        <RegistryTable sortable={false} bare rows={rows.slice((safePage - 1) * pageSize, safePage * pageSize)} rowKey={item => item.id}
          columns={[{ key: 'name', label: en ? 'Candidate' : 'Υποψήφιος' }, { key: 'code', label: en ? 'Code' : 'Κωδικός' }, { key: 'position', label: en ? 'Position' : 'Θέση' }, { key: 'applied', label: en ? 'Applied' : 'Αίτηση' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }]}
          rowProps={item => ({ ...registry.rowProps(item.id), onClick: () => open(item), onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(item) } } })}
          empty={!rows.length} emptyFiltered={candidates.length > 0} onClearFilters={clear} emptyIcon={Inbox}
          emptyTitle={candidates.length ? (en ? 'No application matches' : 'Καμία αίτηση δεν ταιριάζει') : (en ? 'No applications yet' : 'Δεν υπάρχουν αιτήσεις')}
          emptyText={candidates.length ? '' : (en ? 'Enter the first application.' : 'Καταχωρίστε την πρώτη αίτηση.')}
          emptyAction={access.canManage && !candidates.length ? { label: en ? 'New application' : 'Νέα αίτηση', icon: Plus, onClick: () => setDialog(newCandidate()) } : null}
          renderRow={item => <>
            <td><strong>{item.fullName}</strong><small>{[item.phoneMobile || item.phoneLandline, item.email].filter(Boolean).join(' · ')}{item.source === 'tablet' && <> <StatusBadge tone="info">{en ? 'From tablet' : 'Από tablet'}</StatusBadge></>}</small></td>
            <td className="nowrap-cell"><strong>{item.code}</strong></td>
            <td>{item.requestedPosition || '—'}{(item.professionalCategory || item.employmentType) && <small>{[categoryLabel(item.professionalCategory, language), employmentLabel(item.employmentType, language)].filter(Boolean).join(' · ')}</small>}</td>
            <td className="nowrap-cell">{fmtDay(item.appliedOn)}</td>
            <td><CandidateStatusBadge status={item.status} language={language} /></td>
          </>} />
      </div>
      {rows.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
    </section>
    {tablet && <ApplicationLinkDialog organizationId={organizationId} positions={positions} onClose={() => { setTablet(false); void reload() }} />}
  </Page>
}
