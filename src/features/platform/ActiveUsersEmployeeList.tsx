import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { roleLabel } from '../../core/permissions/roleLabels'
import { Button } from '../../design-system/Button'
import { ROLES } from './platformOrganizationShared'
import { LIST_ROLES, errorText, employeeIssue, fold, needsDepartment, planEmployees, suggestRole } from './activeUsersModel'
import type { CheckedPerson, DepartmentChoice, EmployeeChoice, EmployeePick } from './activeUsersModel'

// «Ενεργοί με προσωρινό κωδικό» › «Από τη λίστα εργαζομένων» (Platform Owner): the active
// employees without an account; the owner ticks the people, the role is suggested from the
// profession and can be changed per row. A row that would be refused (an existing user with
// the same name, no mobile when it is the password, no department for a department role, or
// the server's verdict) is greyed and cannot be ticked.
export type EmployeeListState = { people: CheckedPerson[], selectedCount: number }

export function ActiveUsersEmployeeList({ employees, departments, memberNames, passwordMode, sendInvite, serverIssues, disabled, language, onChange }: {
  employees: EmployeeChoice[]
  departments: DepartmentChoice[]
  memberNames: Set<string>
  passwordMode: string
  sendInvite: boolean
  serverIssues: Map<string, string>
  disabled: boolean
  language: string
  onChange: (state: EmployeeListState) => void
}) {
  const en = language === 'en'
  const tx = (el: string, enText: string) => (en ? enText : el)
  const [query, setQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [defaultRole, setDefaultRole] = useState('department_user')
  const [picks, setPicks] = useState<Record<string, EmployeePick>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const roleOf = (row: EmployeeChoice) => picks[row.employeeId]?.role || suggestRole(row.profession, defaultRole)
  const effectivePicks = useMemo(() => Object.fromEntries(employees.map(row => [row.employeeId, { role: picks[row.employeeId]?.role || suggestRole(row.profession, defaultRole), departmentId: picks[row.employeeId]?.departmentId || null }])), [employees, picks, defaultRole])
  // Every row checked as it would be sent, so that the issue is shown before anything is created.
  const checked = useMemo(() => planEmployees(employees, effectivePicks, departments, passwordMode, sendInvite), [employees, effectivePicks, departments, passwordMode, sendInvite])
  const issueOf = useMemo(() => {
    const map = new Map<string, string | null>()
    checked.forEach(person => map.set(person.employeeId as string, serverIssues.get(person.employeeId as string) || employeeIssue(person, memberNames)))
    return map
  }, [checked, memberNames, serverIssues])

  const departmentNames = useMemo(() => [...new Set(employees.map(row => row.departmentName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el')), [employees])
  const visible = useMemo(() => {
    const q = fold(query)
    return employees.filter(row => (!departmentFilter || row.departmentName === departmentFilter) && (!q || fold(`${row.name} ${row.profession} ${row.email}`).includes(q)))
  }, [employees, query, departmentFilter])
  const selectable = visible.filter(row => !issueOf.get(row.employeeId))
  const allChecked = selectable.length > 0 && selectable.every(row => selected.has(row.employeeId))

  // The parent gets the ticked rows that pass the checks (a row with an issue is never sent),
  // again whenever a role, the password, the invitation or the server's verdict changes one.
  const currentPeople = checked.filter(person => selected.has(person.employeeId as string) && !issueOf.get(person.employeeId as string))
  const signature = currentPeople.map(person => `${person.employeeId}:${person.role}:${person.departmentId}:${person.passwordMode}:${person.sendInvite}`).join('|')
  useEffect(() => {
    onChange({ people: currentPeople, selectedCount: currentPeople.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  const toggleAll = () => {
    const next = new Set(selected)
    if (allChecked) selectable.forEach(row => next.delete(row.employeeId))
    else selectable.forEach(row => next.add(row.employeeId))
    setSelected(next)
  }
  const setPick = (id: string, change: Partial<EmployeePick>) => setPicks(current => ({ ...current, [id]: { role: current[id]?.role || effectivePicks[id]?.role || defaultRole, departmentId: current[id]?.departmentId || null, ...change } }))

  if (!employees.length) {
    return <p className="active-users-note">{tx('Όλοι οι ενεργοί εργαζόμενοι έχουν ήδη λογαριασμό, ή η λίστα εργαζομένων του νοσοκομείου είναι κενή.', 'Every active employee already has an account, or the hospital’s employee list is empty.')}</p>
  }

  return (
    <div className="active-users-list">
      <div className="active-users-list-filters">
        <label className="field">
          <span>{tx('Αναζήτηση', 'Search')}</span>
          <input type="search" value={query} placeholder={tx('Όνομα, ειδικότητα ή email…', 'Name, profession or e-mail…')} onChange={event => setQuery(event.target.value)} />
        </label>
        <label className="field">
          <span>{tx('Τμήμα', 'Department')}</span>
          <select value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)}>
            <option value="">{tx('Όλα τα τμήματα', 'All departments')}</option>
            {departmentNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{tx('Ρόλος για όσους επιλέξετε', 'Role for those you select')}</span>
          <select value={defaultRole} disabled={disabled} onChange={event => setDefaultRole(event.target.value)}>
            {LIST_ROLES(ROLES).map(role => <option key={role} value={role}>{roleLabel(role, language)}</option>)}
          </select>
        </label>
        <Button variant="secondary" className="active-users-list-all" disabled={disabled || !selectable.length} onClick={toggleAll}>
          {allChecked ? tx('Καμία επιλογή', 'Select none') : tx(`Επιλογή όλων (${selectable.length})`, `Select all (${selectable.length})`)}
        </Button>
      </div>
      <p className="active-users-list-count">{tx(`${visible.length} από ${employees.length} εργαζόμενους χωρίς λογαριασμό`, `${visible.length} of ${employees.length} employees without an account`)}</p>
      <div className="scroll-table active-users-table">
        <table className="data-table sticky-table">
          <thead>
            <tr>
              <th className="active-users-list-check" aria-label={tx('Επιλογή', 'Select')} />
              <th>{tx('Εργαζόμενος', 'Employee')}</th>
              <th>{tx('Τμήμα', 'Department')}</th>
              <th>{tx('Κινητό', 'Mobile')}</th>
              <th>Email</th>
              <th>{tx('Ρόλος', 'Role')}</th>
              <th>{tx('Έλεγχος', 'Check')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(row => {
              const issue = issueOf.get(row.employeeId) || null
              const isSelected = selected.has(row.employeeId) && !issue
              const role = roleOf(row)
              const missingDepartment = needsDepartment(role) && !(effectivePicks[row.employeeId]?.departmentId || (row.departmentId && departments.some(item => item.id === row.departmentId)))
              return (
                <tr key={row.employeeId} className={issue ? 'active-users-row-blocked' : isSelected ? 'active-users-row-selected' : ''}>
                  <td className="active-users-list-check">
                    <input type="checkbox" checked={isSelected} disabled={disabled || Boolean(issue)} aria-label={tx(`Επιλογή: ${row.name}`, `Select: ${row.name}`)} onChange={() => toggle(row.employeeId)} />
                  </td>
                  <td>
                    <strong>{row.name}</strong>
                    {row.profession && <small>{row.profession}</small>}
                  </td>
                  <td>
                    {missingDepartment ? (
                      <select className="active-users-list-select" value={effectivePicks[row.employeeId]?.departmentId || ''} disabled={disabled} aria-label={tx(`Τμήμα: ${row.name}`, `Department: ${row.name}`)} onChange={event => setPick(row.employeeId, { departmentId: event.target.value || null })}>
                        <option value="">{row.departmentName ? tx(`${row.departmentName} · επιλέξτε`, `${row.departmentName} · choose`) : tx('Επιλέξτε τμήμα', 'Choose a department')}</option>
                        {departments.filter(item => item.is_active !== false).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    ) : (departments.find(item => item.id === (effectivePicks[row.employeeId]?.departmentId || row.departmentId))?.name || row.departmentName || '—')}
                  </td>
                  <td className={passwordMode === 'phone' && !row.phone ? 'active-users-list-missing' : ''}>{row.phone || (passwordMode === 'phone' ? tx('λείπει', 'missing') : '—')}</td>
                  <td>{row.email || '—'}</td>
                  <td>
                    {/* A ticked row keeps its role selector even while it has an issue, so that the owner can correct it. */}
                    {isSelected || (selected.has(row.employeeId) && !serverIssues.get(row.employeeId)) || picks[row.employeeId]?.role ? (
                      <select className="active-users-list-select" value={role} disabled={disabled} aria-label={tx(`Ρόλος: ${row.name}`, `Role: ${row.name}`)} onChange={event => setPick(row.employeeId, { role: event.target.value })}>
                        {LIST_ROLES(ROLES).map(item => <option key={item} value={item}>{roleLabel(item, language)}</option>)}
                      </select>
                    ) : <span className="active-users-list-role">{roleLabel(role, language)}</span>}
                  </td>
                  <td>
                    {issue ? (
                      <span className="active-users-list-issue"><AlertTriangle size={13} aria-hidden="true" />{errorText(issue, en)}</span>
                    ) : isSelected ? (
                      <span className="active-users-list-ok"><CheckCircle2 size={13} aria-hidden="true" />{tx('Έτοιμος', 'Ready')}</span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
