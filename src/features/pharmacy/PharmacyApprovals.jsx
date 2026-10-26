import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ShieldCheck, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { StatusBadge } from '../../design-system/StatusBadge'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { decideTherapyApproval, loadTherapyApprovals } from './pharmacyCloudService'

const STATUS = { pending: ['Σε αναμονή', 'Pending', 'warning'], approved: ['Εγκρίθηκε', 'Approved', 'success'], rejected: ['Απορρίφθηκε', 'Rejected', 'danger'] }
const fmtDay = value => { const [y, m, d] = String(value || '').slice(0, 10).split('-'); return y && m && d ? `${Number(d)}/${Number(m)}/${y}` : '—' }

// «Εγκρίσεις αντιβιοτικών»: the restricted antimicrobial therapies waiting for (or given) stewardship approval,
// the same approvals the surveillance record decides. Approve / reject only with the therapy capability.
export function PharmacyApprovals({ organizationId, en, canDecide, canOpenRecord, onCounts }) {
  const navigate = useNavigate()
  const actor = useAuditActor()
  const { notify, notifyError } = useFeedback()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const reload = useCallback(async () => {
    if (!organizationId) { setLoading(false); return }
    setLoading(true)
    try { setRows(await loadTherapyApprovals(organizationId)) } catch (error) { notifyError(error, 'load', { operation: 'antimicrobial_approvals_load' }) } finally { setLoading(false) }
  }, [organizationId, notifyError])
  useEffect(() => { void reload() }, [reload])

  async function decide(row, next) {
    setBusyId(row.id)
    try {
      await decideTherapyApproval(organizationId, row, next, actor)
      notify(next === 'approved' ? (en ? 'Therapy approved.' : 'Η αγωγή εγκρίθηκε.') : (en ? 'Therapy rejected.' : 'Η αγωγή απορρίφθηκε.'), 'success')
      await reload()
    } catch (error) {
      notifyError(error, 'save', { operation: 'antimicrobial_approval_decide' })
    } finally { setBusyId('') }
  }

  const filtered = useMemo(() => rows.filter(row => (status === 'all' || row.approvalStatus === status) && `${row.antimicrobial} ${row.patientCode} ${row.department} ${row.indication}`.toLowerCase().includes(query.trim().toLowerCase())), [rows, status, query])
  useEffect(() => setPage(1), [query, status, pageSize])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)), safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const counts = rows.reduce((acc, row) => ({ ...acc, [row.approvalStatus]: (acc[row.approvalStatus] || 0) + 1 }), {})
  useEffect(() => { onCounts?.({ loading: loading && !rows.length, pending: counts.pending || 0, approved: counts.approved || 0, rejected: counts.rejected || 0 }) }, [onCounts, loading, rows.length, counts.pending, counts.approved, counts.rejected])
  const clear = () => { setQuery(''); setStatus('pending') }

  return <>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={en ? 'Antibiotic, patient, department…' : 'Αντιβιοτικό, ασθενής, τμήμα…'} activeAdvancedCount={status !== 'pending' ? 1 : 0} onClear={clear}>
      <FilterSelect label={en ? 'Status' : 'Κατάσταση'} value={status} onChange={setStatus}>
        <option value="pending">{en ? 'Pending' : 'Σε αναμονή'} ({counts.pending || 0})</option>
        <option value="approved">{en ? 'Approved' : 'Εγκρίθηκαν'} ({counts.approved || 0})</option>
        <option value="rejected">{en ? 'Rejected' : 'Απορρίφθηκαν'} ({counts.rejected || 0})</option>
        <option value="all">{en ? 'All' : 'Όλες'} ({rows.length})</option>
      </FilterSelect>
    </FilterBar>
    {!canDecide && <div className="inline-empty">{en ? 'Read only: approving needs the antimicrobial therapy permission.' : 'Μόνο ανάγνωση: η έγκριση χρειάζεται το δικαίωμα αντιμικροβιακής αγωγής.'}</div>}
    {loading && !rows.length ? <TableSkeleton /> : <div className="scroll-table" tabIndex={0} role="region" aria-label={en ? 'Antibiotic approvals' : 'Εγκρίσεις αντιβιοτικών'}>
      <table className="data-table sticky-table">
        <thead><tr><th>{en ? 'Started' : 'Έναρξη'}</th><th>{en ? 'Antibiotic' : 'Αντιβιοτικό'}</th><th>{en ? 'Dose / route' : 'Δόση / οδός'}</th><th>{en ? 'Indication' : 'Ένδειξη'}</th><th>{en ? 'Patient' : 'Ασθενής'}</th><th>{en ? 'Department' : 'Τμήμα'}</th><th>{en ? 'Approval' : 'Έγκριση'}</th>{canDecide && <th />}</tr></thead>
        <tbody>{paged.map(row => { const badge = STATUS[row.approvalStatus] || STATUS.pending; return <tr key={row.id} className={canOpenRecord && row.caseId ? 'clickable-row' : ''} onClick={canOpenRecord && row.caseId ? () => navigate(`/surveillance/${row.caseId}`) : undefined}>
          <td>{fmtDay(row.startedAt)}</td><td><strong>{row.antimicrobial}</strong></td><td>{[row.dose, row.route].filter(Boolean).join(' · ') || '—'}</td><td>{row.indication || '—'}</td><td style={{ whiteSpace: 'nowrap' }}>{row.patientCode || '—'}</td><td>{(en ? row.departmentEn : row.department) || '—'}</td>
          <td><StatusBadge tone={badge[2]}>{badge[en ? 1 : 0]}</StatusBadge></td>
          {canDecide && <td onClick={event => event.stopPropagation()}>{row.approvalStatus === 'pending' && <div className="row-actions">
            <Button variant="secondary" disabled={busyId === row.id} onClick={() => decide(row, 'approved')}><Check size={15} />{en ? 'Approve' : 'Έγκριση'}</Button>
            <Button variant="secondary" disabled={busyId === row.id} onClick={() => decide(row, 'rejected')}><X size={15} />{en ? 'Reject' : 'Απόρριψη'}</Button>
          </div>}</td>}
        </tr> })}</tbody>
      </table>
      {!loading && !filtered.length && (rows.length ? <RegistryEmptyState filtered onClearFilters={clear} language={en ? 'en' : 'el'} /> : <RegistryEmptyState icon={ShieldCheck} language={en ? 'en' : 'el'} title={en ? 'No antibiotic approvals' : 'Δεν υπάρχουν εγκρίσεις αντιβιοτικών'} text={en ? 'Restricted antibiotics recorded in surveillance appear here for stewardship approval.' : 'Τα προωθημένα αντιβιοτικά που καταγράφονται στην επιτήρηση εμφανίζονται εδώ για έγκριση.'} />)}
    </div>}
    <RegistryPagination language={en ? 'en' : 'el'} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
  </>
}
