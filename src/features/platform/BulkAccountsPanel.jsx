import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BriefcaseMedical,
  Building2,
  Check,
  CheckSquare,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleX,
  Hourglass,
  Pencil,
  RotateCw,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button } from '../../design-system/Button'
import { CheckboxField } from '../../design-system/CheckboxField'
import { FilterBar } from '../../design-system/FilterBar'
import { MetricCard } from '../../design-system/MetricCard'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { roleLabel } from '../../core/permissions/roleLabels'
import {
  BULK_ROLES,
  MAX_RUN,
  applyRoleToSelected,
  buildItems,
  bulkRoleTargets,
  chipCounts,
  emailFailureCode,
  filterRows,
  latestBatch,
  needsDepartment,
  reasonText,
  resultStatus,
  resultTotals,
  rowSelectable,
  selectionSummary,
  setRowDepartment,
  setRowRole,
  sortByResult,
} from './bulkAccountsModel'
import { createBulkAccounts, previewBulkAccounts, resendAccountAccess } from './bulkAccountsService'
import { BulkAccountsConfirmDialog } from './BulkAccountsConfirmDialog'
import '../../design-system/ChoiceChips.css'
import './platformDeletion.css'
import './bulkAccounts.css'

const shortDay = (value, language) => (value ? new Date(value).toLocaleDateString(language === 'en' ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit' }) : '')
const fullDay = (value, language) => (value ? new Date(value).toLocaleDateString(language === 'en' ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
const clock = (value, language) => (value ? new Date(value).toLocaleTimeString(language === 'en' ? 'en-GB' : 'el-GR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '')

// N1 · «Εργαζόμενοι χωρίς λογαριασμό» (Platform Owner only), in the hospital's
// record › «Χρήστες & Ρόλοι». The roster with each employee's account state:
// select, give a role (and department), confirm, create and send; then the result
// per person and «Ξαναστείλε» for those who have not activated.
export function BulkAccountsPanel({ organization, language = 'el', roster, loading, onReload, onAccountsChanged, onOpenEmployee }) {
  const en = language === 'en'
  const tx = (el, enText) => (en ? enText : el)
  const { notify, notifyError } = useFeedback()
  const rows = roster.employees
  const departments = roster.departments
  const rowsById = useMemo(() => new Map(rows.map(row => [row.employeeId, row])), [rows])
  const batch = useMemo(() => latestBatch(rows), [rows])
  const [filter, setFilter] = useState('none')
  const [query, setQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [professionFilter, setProfessionFilter] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [drafts, setDrafts] = useState({})
  const [bulkOpen, setBulkOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [confirmedExisting, setConfirmedExisting] = useState(() => new Set())
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [resending, setResending] = useState(false)
  const [lastRunAt, setLastRunAt] = useState(null)

  const counts = useMemo(() => chipCounts(rows), [rows])
  const professions = useMemo(() => [...new Set(rows.map(row => row.profession).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el')), [rows])
  const visible = useMemo(() => {
    const list = filterRows(rows, { filter, batchId: batch?.id, query, departmentId: departmentFilter, profession: professionFilter })
    return filter === 'batch' || filter === 'pending' ? sortByResult(list) : list
  }, [rows, filter, batch, query, departmentFilter, professionFilter])
  const resultView = filter !== 'none'
  const selectableVisible = visible.filter(row => rowSelectable(row, filter))
  const summary = selectionSummary(selected, drafts, rowsById)
  const blockedVisible = visible.filter(row => row.accountState === 'none' && row.blockedReason).length

  // A change of view starts a new selection.
  useEffect(() => setSelected(new Set()), [filter])

  const toggle = row => {
    if (!rowSelectable(row, filter)) return
    setSelected(current => {
      const next = new Set(current)
      if (next.has(row.employeeId)) next.delete(row.employeeId)
      else next.add(row.employeeId)
      return next
    })
  }
  const allChecked = selectableVisible.length > 0 && selectableVisible.every(row => selected.has(row.employeeId))
  const someChecked = selectableVisible.some(row => selected.has(row.employeeId))
  const toggleAll = () =>
    setSelected(current => {
      const next = new Set(current)
      if (allChecked) selectableVisible.forEach(row => next.delete(row.employeeId))
      else selectableVisible.slice(0, MAX_RUN).forEach(row => next.add(row.employeeId))
      return next
    })
  const chooseRole = (row, role) => {
    setDrafts(current => (role ? setRowRole(current, row, role) : { ...current, [row.employeeId]: undefined }))
    if (role && rowSelectable(row, filter)) setSelected(current => new Set(current).add(row.employeeId))
  }

  async function openConfirm() {
    const items = buildItems(selected, drafts)
    setConfirmedExisting(new Set())
    setConfirm({ items, preview: null })
    try {
      const preview = await previewBulkAccounts(organization, items, rows)
      setConfirm({ items, preview })
    } catch (error) {
      setConfirm(null)
      notifyError(error, 'action', { operation: 'platform_bulk_accounts_preview' })
    }
  }

  async function runCreate() {
    if (!confirm?.preview) return
    const skipped = new Set((confirm.preview.skipped || []).map(row => row.employeeId))
    const existing = new Set((confirm.preview.existing || []).map(row => row.employeeId))
    const items = confirm.items.filter(item => !skipped.has(item.employeeId) && (!existing.has(item.employeeId) || confirmedExisting.has(item.employeeId)))
    if (!items.length) return
    setRunning(true)
    try {
      const result = await createBulkAccounts(organization.id, items, { confirmExisting: [...confirmedExisting], onProgress: (done, total) => setProgress({ done, total }) })
      const failed = (result.results || []).filter(row => row.status === 'failed').length
      notify(
        failed
          ? tx(`Δημιουργήθηκαν ${items.length - failed} λογαριασμοί · ${failed} απέτυχαν.`, `${items.length - failed} accounts created · ${failed} failed.`)
          : tx(`Δημιουργήθηκαν ${items.length} λογαριασμοί και στάλθηκαν τα email.`, `${items.length} accounts created and e-mails sent.`),
        failed ? 'warning' : 'success',
        { operation: 'platform_bulk_accounts_create' },
      )
      setConfirm(null)
      setSelected(new Set())
      setDrafts({})
      setLastRunAt(new Date().toISOString())
      await onReload?.()
      onAccountsChanged?.()
      setFilter('batch')
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_bulk_accounts_create' })
      await onReload?.()
    } finally {
      setRunning(false)
    }
  }

  async function resend(ids) {
    if (!ids.length) return
    setResending(true)
    try {
      const { results } = await resendAccountAccess(organization.id, ids)
      const sent = results.filter(row => row.status === 'sent').length
      const refused = results.length - sent
      const reason = results.find(row => row.status !== 'sent')?.code
      notify(
        refused
          ? tx(`Στάλθηκε νέος σύνδεσμος σε ${sent} · ${refused} όχι (${resendReason(reason, en)}).`, `New link sent to ${sent} · ${refused} not (${resendReason(reason, en)}).`)
          : tx(`Στάλθηκε νέος σύνδεσμος σε ${sent}. Ο προηγούμενος δεν ισχύει πλέον.`, `New link sent to ${sent}. The previous one no longer works.`),
        refused ? 'warning' : 'success',
        { operation: 'platform_bulk_accounts_resend' },
      )
      setSelected(new Set())
      await onReload?.()
    } catch (error) {
      notifyError(error, 'action', { operation: 'platform_bulk_accounts_resend' })
    } finally {
      setResending(false)
    }
  }

  const chips = [
    ...(batch ? [{ id: 'batch', label: tx(`Δημιουργία ${fullDay(batch.createdAt, language)}`, `Created ${fullDay(batch.createdAt, language)}`), count: batch.count }] : []),
    { id: 'none', label: tx('Χωρίς λογαριασμό', 'No account'), count: counts.none },
    { id: 'pending', label: tx('Έχει λογαριασμό – δεν ενεργοποίησε', 'Has account – not activated'), count: counts.pending },
    { id: 'active', label: tx('Ενεργός λογαριασμός', 'Active account'), count: counts.active },
    { id: 'all', label: tx('Όλοι οι εργαζόμενοι', 'All employees'), count: counts.all },
  ]
  const batchRows = batch ? rows.filter(row => row.itemBatchId === batch.id) : []
  const totals = resultTotals(batchRows)
  const linkedCount = batchRows.filter(row => row.itemStatus === 'linked_existing').length
  const pendingSelected = [...selected].map(id => rowsById.get(id)).filter(Boolean)
  const pendingExpired = pendingSelected.filter(row => resultStatus(row) === 'expired').length

  return (
    <div className="bulk-accounts workspace-column workspace-fill">
      {filter === 'batch' && batch && (
        <div className="bulk-accounts-summary">
          <MetricCard icon={UserPlus} value={totals.createdOrLinked} label={tx('Δημιουργήθηκαν ή συνδέθηκαν', 'Created or linked')} />
          <MetricCard icon={UserCheck} value={totals.activated} label={tx('Ενεργοποιήθηκαν', 'Activated')} tone="success" />
          <MetricCard icon={Hourglass} value={totals.pending} label={tx('Στάλθηκε – δεν ενεργοποίησε', 'Sent – not activated')} tone="warning" />
          <MetricCard icon={CircleX} value={totals.failed} label={tx('Απέτυχαν', 'Failed')} tone="danger" />
        </div>
      )}
      <section className="surface registry-workspace workspace-column workspace-fill bulk-accounts-surface">
        {filter !== 'batch' && (
          <FilterBar
            query={query}
            onQueryChange={setQuery}
            placeholder={tx('Αναζήτηση εργαζομένου, ειδικότητας ή email…', 'Search employee, profession or e-mail…')}
            end={
          <div className="bulk-accounts-filters">
            <div className="bulk-accounts-filter">
              <Building2 size={15} aria-hidden="true" />
              <small>{tx('Τμήμα', 'Department')}</small>
              <select value={departmentFilter} aria-label={tx('Τμήμα', 'Department')} onChange={event => setDepartmentFilter(event.target.value)}>
                <option value="">{tx('Όλα', 'All')}</option>
                {departments.map(department => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="bulk-accounts-filter">
              <BriefcaseMedical size={15} aria-hidden="true" />
              <small>{tx('Ειδικότητα', 'Profession')}</small>
              <select value={professionFilter} aria-label={tx('Ειδικότητα', 'Profession')} onChange={event => setProfessionFilter(event.target.value)}>
                <option value="">{tx('Όλες', 'All')}</option>
                {professions.map(profession => (
                  <option key={profession} value={profession}>
                    {profession}
                  </option>
                ))}
              </select>
            </div>
          </div>
            }
          />
        )}
        <div className="platform-demo-status-chips bulk-accounts-chips" role="group" aria-label={tx('Λογαριασμός', 'Account')}>
          {chips.map(chip => (
            <button key={chip.id} type="button" className={`platform-demo-status-chip${filter === chip.id ? ' is-active' : ''}`} aria-pressed={filter === chip.id} onClick={() => setFilter(chip.id)}>
              {chip.label}
              <b>{chip.count}</b>
            </button>
          ))}
        </div>
        {filter === 'batch' && batch && (
          <div className="bulk-accounts-callout is-success bulk-accounts-batch-note">
            <CircleCheck size={16} />
            <div>
              <strong>
                {tx('Ολοκληρώθηκε η δημιουργία', 'Creation completed')} · {fullDay(lastRunAt || batch.createdAt, language)} {clock(lastRunAt || batch.createdAt, language)}
              </strong>{' '}
              ·{' '}
              {tx(
                `${totals.createdOrLinked} λογαριασμοί${linkedCount ? ` (${linkedCount} ${linkedCount === 1 ? 'υπάρχων συνδέθηκε' : 'υπάρχοντες συνδέθηκαν'})` : ''}, ${totals.failed} ${totals.failed === 1 ? 'απέτυχε' : 'απέτυχαν'}. Καταγράφηκε στο Ιστορικό ως μία ενέργεια με ${batch.count} εγγραφές.`,
                `${totals.createdOrLinked} accounts${linkedCount ? ` (${linkedCount} existing linked)` : ''}, ${totals.failed} failed. Recorded in the history as one action with ${batch.count} entries.`,
              )}
            </div>
          </div>
        )}
        {filter === 'none' && (
          <BulkRoleBar
            language={language}
            selected={selected}
            drafts={drafts}
            rowsById={rowsById}
            departments={departments}
            open={bulkOpen}
            onOpen={setBulkOpen}
            onApply={options => {
              setDrafts(current => applyRoleToSelected(current, selected, rowsById, options))
              setBulkOpen(false)
            }}
          />
        )}
        {loading && !rows.length ? (
          <div className="inline-empty">{tx('Φόρτωση εργαζομένων…', 'Loading employees…')}</div>
        ) : !visible.length ? (
          <div className="registry-empty-state">
            <strong>{rows.length ? tx('Κανένας εργαζόμενος σε αυτή την προβολή.', 'No employee in this view.') : tx('Δεν υπάρχουν εργαζόμενοι στο μητρώο του νοσοκομείου.', 'There are no employees in the hospital roster.')}</strong>
          </div>
        ) : (
          <div className="scroll-table bulk-accounts-table-wrap">
            <table className="data-table sticky-table bulk-accounts-table">
              <thead>
                <tr>
                  {(filter === 'none' || filter === 'pending') && (
                    <th className="bulk-accounts-cb">
                      <HeaderCheckbox checked={allChecked} mixed={someChecked && !allChecked} disabled={!selectableVisible.length} onChange={toggleAll} label={tx('Επιλογή όλων', 'Select all')} />
                    </th>
                  )}
                  {resultView ? (
                    <>
                      <th>{tx('Εργαζόμενος · ρόλος', 'Employee · role')}</th>
                      <th className="bulk-accounts-hide-narrow">Username</th>
                      <th>{tx('Αποτέλεσμα', 'Result')}</th>
                      <th />
                    </>
                  ) : (
                    <>
                      <th>{tx('Εργαζόμενος', 'Employee')}</th>
                      <th className="bulk-accounts-hide-narrow">{tx('Ειδικότητα', 'Profession')}</th>
                      <th>{tx('Τμήμα', 'Department')}</th>
                      <th>{tx('Ρόλος', 'Role')} *</th>
                      <th className="bulk-accounts-hide-narrow">{tx('Εμβέλεια', 'Scope')}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map(row =>
                  resultView ? (
                    <ResultRow key={row.employeeId} row={row} language={language} checkbox={filter === 'pending'} selected={selected.has(row.employeeId)} onToggle={() => toggle(row)} onResend={() => resend([row.employeeId])} resending={resending} onOpenEmployee={onOpenEmployee} />
                  ) : (
                    <RosterRow key={row.employeeId} row={row} language={language} departments={departments} draft={drafts[row.employeeId]} selected={selected.has(row.employeeId)} onToggle={() => toggle(row)} onRole={role => chooseRole(row, role)} onDepartment={id => setDrafts(current => setRowDepartment(current, row, id))} onOpenEmployee={onOpenEmployee} />
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
        {filter === 'none' && summary.selected > 0 && (
          <div className="bulk-accounts-actionbar">
            <CheckSquare size={18} />
            <strong>{tx(`Επιλεγμένοι: ${summary.selected}`, `Selected: ${summary.selected}`)}</strong>
            <span className="bulk-accounts-sep">·</span>
            <span className={summary.missingRole ? 'bulk-accounts-warnpill' : 'bulk-accounts-sub'}>{tx(`χωρίς ρόλο: ${summary.missingRole}`, `without role: ${summary.missingRole}`)}</span>
            {summary.missingDepartment > 0 && (
              <>
                <span className="bulk-accounts-sep">·</span>
                <span className="bulk-accounts-warnpill">{tx(`χωρίς τμήμα: ${summary.missingDepartment}`, `without department: ${summary.missingDepartment}`)}</span>
              </>
            )}
            {blockedVisible > 0 && (
              <>
                <span className="bulk-accounts-sep">·</span>
                <span className="bulk-accounts-sub">{tx(`${blockedVisible} χωρίς email δεν επιλέγονται`, `${blockedVisible} without e-mail cannot be selected`)}</span>
              </>
            )}
            {summary.selected > MAX_RUN && <span className="bulk-accounts-warnpill">{tx(`έως ${MAX_RUN} ανά δημιουργία`, `up to ${MAX_RUN} per run`)}</span>}
            <span className="bulk-accounts-grow" />
            <Button variant="secondary" onClick={() => setSelected(new Set())}>
              {tx('Καθαρισμός', 'Clear')}
            </Button>
            <Button disabled={!summary.ready} title={summary.ready ? undefined : tx('Ορίστε ρόλο σε όλους τους επιλεγμένους', 'Give every selected person a role')} onClick={openConfirm}>
              <UserPlus size={16} />
              {tx('Δημιουργία λογαριασμών & αποστολή', 'Create accounts & send')}
            </Button>
          </div>
        )}
        {filter === 'pending' && selected.size > 0 && (
          <div className="bulk-accounts-actionbar">
            <CheckSquare size={18} />
            <strong>{tx(`Επιλεγμένοι: ${selected.size}`, `Selected: ${selected.size}`)}</strong>
            <span className="bulk-accounts-sep">·</span>
            <span className="bulk-accounts-sub">{tx(`${selected.size - pendingExpired} σε ισχύ · ${pendingExpired} έληξε`, `${selected.size - pendingExpired} valid · ${pendingExpired} expired`)}</span>
            <span className="bulk-accounts-grow" />
            <Button variant="secondary" onClick={() => setSelected(new Set())}>
              {tx('Καθαρισμός', 'Clear')}
            </Button>
            <Button loading={resending} onClick={() => resend([...selected])}>
              <RotateCw size={16} />
              {tx(`Ξαναστείλε σε ${selected.size}`, `Resend to ${selected.size}`)}
            </Button>
          </div>
        )}
      </section>
      {confirm && (
        <BulkAccountsConfirmDialog
          organization={organization}
          language={language}
          items={confirm.items}
          rowsById={rowsById}
          departments={departments}
          preview={confirm.preview}
          confirmedExisting={confirmedExisting}
          onToggleExisting={id =>
            setConfirmedExisting(current => {
              const next = new Set(current)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          running={running}
          progress={progress}
          onBack={() => setConfirm(null)}
          onConfirm={runCreate}
        />
      )}
    </div>
  )
}

function resendReason(code, en) {
  const map = {
    RESEND_DAILY_LIMIT: ['έως 3 φορές ανά 24 ώρες', 'at most 3 times per 24 hours'],
    RESEND_TOO_SOON: ['τουλάχιστον 10 λεπτά μετά το προηγούμενο', 'at least 10 minutes after the previous one'],
    NOT_PENDING: ['έχει ήδη ενεργοποιήσει', 'already activated'],
    INVALID_EMAIL: ['μη έγκυρο email', 'invalid e-mail'],
  }
  return map[code]?.[en ? 1 : 0] || code || ''
}

function HeaderCheckbox({ checked, mixed, disabled, onChange, label }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed
  }, [mixed])
  return <input ref={ref} type="checkbox" className="bulk-accounts-check" checked={checked} disabled={disabled} aria-label={label} onChange={onChange} />
}

function EmployeeName({ row, onOpenEmployee, title }) {
  return onOpenEmployee ? (
    <button type="button" className="bulk-accounts-link" title={title} onClick={() => onOpenEmployee(row.employeeId)}>
      <strong>{row.name}</strong>
    </button>
  ) : (
    <strong>{row.name}</strong>
  )
}

function RosterRow({ row, language, departments, draft, selected, onToggle, onRole, onDepartment, onOpenEmployee }) {
  const en = language === 'en'
  const tx = (el, enText) => (en ? enText : el)
  const blocked = row.accountState === 'none' && row.blockedReason
  const hasAccount = row.accountState !== 'none'
  const selectable = rowSelectable(row, 'none')
  const role = draft?.role || ''
  const missingRole = selected && !role
  const missingDepartment = selected && role && needsDepartment(role) && !draft?.departmentId
  return (
    <tr className={`${selected ? 'is-selected' : ''} ${blocked ? 'is-blocked' : ''}`.trim() || undefined}>
      <td className="bulk-accounts-cb">
        <input type="checkbox" className="bulk-accounts-check" checked={selected} disabled={!selectable} aria-label={tx(`Επιλογή: ${row.name}`, `Select: ${row.name}`)} onChange={onToggle} />
      </td>
      <td>
        <EmployeeName row={row} onOpenEmployee={onOpenEmployee} title={tx('Καρτέλα εργαζομένου', 'Employee record')} />
        {blocked ? (
          <small className="bulk-accounts-missing">
            <CircleAlert size={12} />
            {reasonText(row.blockedReason, language)}
          </small>
        ) : (
          <small>{row.email}</small>
        )}
        {row.existing && !blocked && <small className="bulk-accounts-existing-note">{tx(`Έχει λογαριασμό στο ${row.existing.organizations.join(', ') || 'άλλο νοσοκομείο'}`, `Has an account at ${row.existing.organizations.join(', ') || 'another hospital'}`)}</small>}
      </td>
      <td className="bulk-accounts-hide-narrow">{row.profession || '—'}</td>
      <td>{row.departmentName || '—'}</td>
      <td>
        {hasAccount ? (
          <span className="bulk-accounts-muted">{roleLabel(row.memberRole, language)}</span>
        ) : blocked ? (
          <span className="bulk-accounts-muted">—</span>
        ) : (
          <>
            <select className={`bulk-accounts-select${role ? ' is-set' : ''}${missingRole ? ' is-missing' : ''}`} value={role} aria-label={tx(`Ρόλος: ${row.name}`, `Role: ${row.name}`)} onChange={event => onRole(event.target.value)}>
              <option value="">{tx('Επιλέξτε ρόλο…', 'Choose role…')}</option>
              {BULK_ROLES.map(value => (
                <option key={value} value={value}>
                  {roleLabel(value, language)}
                </option>
              ))}
            </select>
            {missingRole && <small className="bulk-accounts-missing">{tx('Απαιτείται ρόλος', 'Role required')}</small>}
          </>
        )}
      </td>
      <td className="bulk-accounts-hide-narrow">
        {!role || hasAccount || blocked ? (
          <span className="bulk-accounts-muted">—</span>
        ) : needsDepartment(role) ? (
          <>
            <span className="bulk-accounts-scope">
              <Building2 size={13} aria-hidden="true" />
              <select className={`bulk-accounts-select${draft?.departmentId ? '' : ' is-missing'}`} value={draft?.departmentId || ''} aria-label={tx(`Τμήμα: ${row.name}`, `Department: ${row.name}`)} onChange={event => onDepartment(event.target.value)}>
                <option value="">{tx('Επιλέξτε τμήμα…', 'Choose department…')}</option>
                {departments.map(department => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </span>
            {missingDepartment && <small className="bulk-accounts-missing">{tx('Απαιτείται τμήμα', 'Department required')}</small>}
          </>
        ) : (
          <span className="bulk-accounts-muted">{tx('Όλο το νοσοκομείο', 'Whole hospital')}</span>
        )}
      </td>
    </tr>
  )
}

function ResultRow({ row, language, checkbox, selected, onToggle, onResend, resending, onOpenEmployee }) {
  const en = language === 'en'
  const tx = (el, enText) => (en ? enText : el)
  const status = resultStatus(row)
  const role = row.memberRole || row.itemRole
  const roleText = [role ? roleLabel(role, language) : '', needsDepartment(role) ? row.departmentName : ''].filter(Boolean).join(' · ')
  const badge = {
    activated: ['active', tx('Ενεργοποιήθηκε', 'Activated')],
    linked: ['active', tx('Συνδέθηκε υπάρχων λογαριασμός', 'Existing account linked')],
    sent: ['info', tx('Δημιουργήθηκε · στάλθηκε', 'Created · sent')],
    expired: ['warning', tx('Ο σύνδεσμος έληξε', 'Link expired')],
    failed: ['danger', tx('Απέτυχε', 'Failed')],
    none: ['temporary', tx('Χωρίς λογαριασμό', 'No account')],
  }[status]
  const sentAt = row.invitationCreatedAt || row.lastSentAt
  const note =
    status === 'activated'
      ? row.invitationAcceptedAt
        ? tx(`Ενεργοποιήθηκε ${shortDay(row.invitationAcceptedAt, language)}, ${clock(row.invitationAcceptedAt, language)}`, `Activated ${shortDay(row.invitationAcceptedAt, language)}, ${clock(row.invitationAcceptedAt, language)}`)
        : ''
      : status === 'linked'
        ? tx(`Υπάρχων λογαριασμός · νέος ρόλος εδώ`, 'Existing account · new role here')
        : status === 'sent'
          ? `${tx('Στάλθηκε', 'Sent')} ${shortDay(sentAt, language)} · ${row.invitationOpened ? tx('άνοιξε τον σύνδεσμο', 'opened the link') : tx(`λήγει ${shortDay(row.invitationExpiresAt, language)}`, `expires ${shortDay(row.invitationExpiresAt, language)}`)}`
          : status === 'expired'
            ? `${tx('Στάλθηκε', 'Sent')} ${shortDay(sentAt, language)} · ${tx(`έληξε ${shortDay(row.invitationExpiresAt, language)}`, `expired ${shortDay(row.invitationExpiresAt, language)}`)}`
            : status === 'failed'
              ? `${tx('Απέτυχε', 'Failed')}: ${reasonText(row.accountState === 'invited' ? emailFailureCode(row.emailError) : row.itemError, language)}`
              : row.blockedReason
                ? reasonText(row.blockedReason, language)
                : ''
  const canResend = row.accountState === 'invited' && row.memberRole !== 'hospital_admin'
  return (
    <tr className={selected ? 'is-selected' : undefined}>
      {checkbox && (
        <td className="bulk-accounts-cb">
          <input type="checkbox" className="bulk-accounts-check" checked={selected} disabled={!canResend} aria-label={tx(`Επιλογή: ${row.name}`, `Select: ${row.name}`)} onChange={onToggle} />
        </td>
      )}
      <td>
        <EmployeeName row={row} onOpenEmployee={onOpenEmployee} title={tx('Καρτέλα εργαζομένου', 'Employee record')} />
        <small>{roleText || row.profession || '—'}</small>
      </td>
      <td className="bulk-accounts-hide-narrow">
        <code>{row.username || '—'}</code>
      </td>
      <td className="bulk-accounts-result">
        <span className={`status-badge ${badge[0]}`}>{badge[1]}</span>
        {note && <small>{note}</small>}
      </td>
      <td className="bulk-accounts-row-action">
        {canResend ? (
          <button type="button" className="bulk-accounts-inline-action" disabled={resending} onClick={onResend}>
            <RotateCw size={13} />
            {tx('Ξαναστείλε', 'Resend')}
          </button>
        ) : status === 'failed' && onOpenEmployee ? (
          <button type="button" className="bulk-accounts-inline-action" onClick={() => onOpenEmployee(row.employeeId)}>
            <Pencil size={13} />
            {tx('Καρτέλα εργαζομένου', 'Employee record')}
          </button>
        ) : (
          <span className="bulk-accounts-muted">—</span>
        )}
      </td>
    </tr>
  )
}

// «Ορισμός ρόλου σε όλους τους επιλεγμένους» (n1-2).
function BulkRoleBar({ language, selected, drafts, rowsById, departments, open, onOpen, onApply }) {
  const en = language === 'en'
  const tx = (el, enText) => (en ? enText : el)
  const [role, setRole] = useState('')
  const [scope, setScope] = useState('own')
  const [departmentId, setDepartmentId] = useState('')
  const [replace, setReplace] = useState(false)
  const wrap = useRef(null)
  const popoverRef = useRef(null)
  const [placement, setPlacement] = useState(null)
  // Fixed under the trigger (a portal, so the table's scroll box does not clip it),
  // scrolling inside when the window is short.
  useLayoutEffect(() => {
    if (!open || !wrap.current) return
    const trigger = wrap.current.querySelector('.bulk-accounts-trigger')
    const rect = (trigger || wrap.current).getBoundingClientRect()
    const width = Math.min(720, window.innerWidth - 24)
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
    const below = window.innerHeight - rect.bottom - 18
    const above = rect.top - 18
    // Above the trigger when the room below is short and there is more above.
    setPlacement(below < 460 && above > below ? { bottom: window.innerHeight - rect.top + 6, left, width, maxHeight: above } : { top: rect.bottom + 6, left, width, maxHeight: Math.max(240, below) })
  }, [open])
  useEffect(() => {
    if (!open) return undefined
    const close = event => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !wrap.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) onOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open, onOpen])
  const withRole = [...selected].filter(id => drafts[id]?.role).length
  const targets = bulkRoleTargets(drafts, selected, replace)
  const missing = [...selected].filter(id => !drafts[id]?.role).map(id => rowsById.get(id)?.name.split(/\s+/).slice(-1)[0]).filter(Boolean)
  const ownDepartments = [...new Set(targets.map(id => rowsById.get(id)?.departmentName).filter(Boolean))]
  const valid = role && targets.length && (!needsDepartment(role) || scope === 'own' || departmentId)
  return (
    <div className="bulk-accounts-rolebar" ref={wrap}>
      <span className="bulk-accounts-muted">
        <Users size={14} aria-hidden="true" /> {tx('Για τους επιλεγμένους:', 'For the selected:')}
      </span>
      <button type="button" className={`bulk-accounts-select bulk-accounts-trigger${open ? ' is-set' : ''}`} aria-expanded={open} disabled={!selected.size} onClick={() => onOpen(!open)}>
        <UserCog size={14} aria-hidden="true" />
        {tx('Ορισμός ρόλου σε όλους τους επιλεγμένους', 'Set a role for all selected')}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
        <div ref={popoverRef} className="bulk-accounts-popover" style={placement || undefined} role="dialog" aria-label={tx('Ρόλος για τους επιλεγμένους', 'Role for the selected')}>
          <div className="bulk-accounts-popover-head">
            <strong>{tx(`Ρόλος για ${targets.length} επιλεγμένους`, `Role for ${targets.length} selected`)}</strong>
            {missing.length > 0 && <span className="bulk-accounts-muted">{tx(`χωρίς ρόλο: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}`, `without role: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}`)}</span>}
          </div>
          <div className="bulk-accounts-rolelist" role="radiogroup">
            {BULK_ROLES.map(value => (
              <button key={value} type="button" role="radio" aria-checked={role === value} className={`bulk-accounts-roleopt${role === value ? ' is-on' : ''}`} onClick={() => setRole(value)}>
                <span className="bulk-accounts-radio" aria-hidden="true" />
                {roleLabel(value, language)}
                {needsDepartment(value) && <Building2 size={11} aria-label={tx('ανά τμήμα', 'per department')} />}
              </button>
            ))}
          </div>
          <div className="bulk-accounts-field">
            <span>
              {tx('Εμβέλεια τμήματος', 'Department scope')} <span className="bulk-accounts-muted">{tx('(για τους ρόλους με τμήμα)', '(for the department roles)')}</span>
            </span>
            <div className="lo-choice-chips">
              <div className="lo-choice-chips-list">
                <button type="button" className={scope === 'own' ? 'selected' : ''} aria-pressed={scope === 'own'} onClick={() => setScope('own')}>
                  {scope === 'own' && <Check size={14} aria-hidden="true" />}
                  <span>{tx('Το τμήμα κάθε εργαζομένου', "Each employee's department")}</span>
                </button>
                <button type="button" className={scope === 'one' ? 'selected' : ''} aria-pressed={scope === 'one'} onClick={() => setScope('one')}>
                  {scope === 'one' && <Check size={14} aria-hidden="true" />}
                  <span>{tx('Ένα τμήμα για όλους…', 'One department for all…')}</span>
                </button>
              </div>
            </div>
            {scope === 'one' ? (
              <select className="bulk-accounts-select" value={departmentId} aria-label={tx('Τμήμα για όλους', 'Department for all')} onChange={event => setDepartmentId(event.target.value)}>
                <option value="">{tx('Επιλέξτε τμήμα…', 'Choose department…')}</option>
                {departments.map(department => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            ) : (
              ownDepartments.length > 0 && <small>{tx(`${ownDepartments.join(', ')} (από την καρτέλα εργαζομένου)`, `${ownDepartments.join(', ')} (from the employee record)`)}</small>
            )}
          </div>
          <CheckboxField checked={replace} onChange={setReplace} label={tx(`Αντικατάσταση και όσων έχουν ήδη ρόλο (${withRole})`, `Also replace those who already have a role (${withRole})`)} />
          <div className="bulk-accounts-popover-actions">
            <Button variant="secondary" onClick={() => onOpen(false)}>
              {tx('Ακύρωση', 'Cancel')}
            </Button>
            <Button disabled={!valid} onClick={() => onApply({ role, replace, scope, departmentId: departmentId || null })}>
              <Check size={15} />
              {tx(`Εφαρμογή σε ${targets.length}`, `Apply to ${targets.length}`)}
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
