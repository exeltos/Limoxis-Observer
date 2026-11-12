import { useEffect, useMemo, useState } from 'react'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import { employeeName, employeeOptions } from '../employees/peopleOptions'
import { useDepartments } from '../management/useLibraries'
import { useTenant } from '../../core/tenant/TenantContext'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadAcknowledgementMembers } from '../documents/acknowledgementLog'
import { recordOwners } from './qualityRecordRules'
import type { AnyRecord } from '../../types/featureTypes'

// The fields every Quality form shares: the department (from the central
// departments) and the responsible people (employees, so the first one with an
// account becomes the record's owner and sees it in its own lists).

const selectText = (en: boolean) => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })

// A record points at its department by id in the cloud and by name in the demo.
export const departmentRef = (record: AnyRecord) => record?.departmentId || record?.department || ''

export function QualityDepartmentField({ value, onChange, label, required = false }: { value: string, onChange: (department: { departmentId: string, department: string, departmentEn: string }) => void, label?: string, required?: boolean }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { departments, loading }: { departments: AnyRecord[], loading: boolean } = useDepartments()
  const options = useMemo(() => departments.map(dep => ({ value: dep.id || dep.name, label: en ? dep.nameEn || dep.name : dep.name, keywords: `${dep.name} ${dep.nameEn}` })), [departments, en])
  const choose = (id: string) => {
    const dep = departments.find(item => (item.id || item.name) === id)
    onChange?.(dep ? { departmentId: dep.id || dep.name, department: dep.name, departmentEn: dep.nameEn || dep.name } : { departmentId: '', department: '', departmentEn: '' })
  }
  return <SearchableSelect label={`${label || (en ? 'Department' : 'Τμήμα')}${required ? ' *' : ''}`} value={value || ''} options={options} onChange={choose} placeholder={loading ? (en ? 'Loading departments…' : 'Φόρτωση τμημάτων…') : en ? 'Search department…' : 'Αναζήτηση τμήματος…'} {...selectText(en)} />
}

// Employees as options, plus the names already on the record that are not an
// employee (positions written in earlier records), so nothing disappears.
function usePeople(extraNames: string[] = [], departments: string[] = []) {
  const { language } = useLanguage()
  const { data: staff = [] }: { data?: AnyRecord[] } = useEmployeesData()
  const members = useMemberDirectory()
  // A role that reads only its own staff row (the quality manager) still picks
  // anyone with an account, from the organization's member directory.
  const employees = useMemo(() => {
    const linked = new Set(staff.map(employee => employee.userId).filter(Boolean))
    return [...staff, ...members.filter(member => member.userId && !linked.has(member.userId)).map(member => ({ id: `user:${member.userId}`, dbId: `user:${member.userId}`, userId: member.userId, firstName: member.name, lastName: '', firstNameEn: member.name, lastNameEn: '', position: member.profession, positionEn: member.professionEn, department: member.department, employmentStatus: 'active' }))]
  }, [staff, members])
  return useMemo(() => {
    const { options, near } = employeeOptions(employees as never[], language, departments as never[])
    const byName = new Map<string, AnyRecord>()
    for (const employee of employees) for (const name of [employeeName(employee as never), employeeName(employee as never, 'en')]) if (name) byName.set(name, employee)
    const known = new Set(options.map(option => option.label))
    const custom = extraNames.filter(name => name && !byName.has(name) && !known.has(name)).map(name => ({ value: `name:${name}`, label: name }))
    return { options: [...options, ...custom], near, employees, byName }
  }, [employees, language, extraNames, departments])
}

const idOf = (employee: AnyRecord) => String(employee.dbId || employee.id)

// The organization's active members with an account (cloud only; the demo has
// its full staff list). Empty when the directory function is not available.
function useMemberDirectory() {
  const { tenant, isDemo } = useTenant()
  const organizationId = tenant?.id || ''
  const [members, setMembers] = useState<AnyRecord[]>([])
  useEffect(() => {
    let active = true
    if (isDemo || isDemoDataEnvironment() || !organizationId) { setMembers([]); return () => { active = false } }
    loadAcknowledgementMembers(organizationId).then(rows => { if (active) setMembers(rows) }).catch(() => { if (active) setMembers([]) })
    return () => { active = false }
  }, [organizationId, isDemo])
  return members
}

// Several people: pick an employee or type a name (the staff list a role may
// read can be short, e.g. only its own row), shown as removable chips.
export function QualityOwnerField({ record, onChange, label }: { record: AnyRecord | null, onChange: (patch: AnyRecord) => void, label?: string }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const names: string[] = recordOwners(record || {})
  const people = usePeople(names, [record?.department].filter(Boolean))
  const text = label || (en ? 'Responsible person(s)' : 'Υπεύθυνος / Υπεύθυνοι')
  function commit(next: string[]) {
    const userId = next.map((name: string) => people.byName.get(name)?.userId).find(Boolean)
    // Keep the account already on the record when its person is not in the readable staff list.
    const kept = names[0] && next.includes(names[0]) ? record?.ownerId || null : null
    onChange?.({ owners: next, owner: '', ownerId: userId || kept })
  }
  function add(id: string) {
    if (!id) return
    const employee = people.employees.find(item => idOf(item) === id)
    const name = employee ? employeeName(employee as never) : id.startsWith('name:') ? id.slice(5) : String(id).trim()
    if (name && !names.includes(name)) commit([...names, name])
  }
  return <div className="field quality-owner-field">
    <SearchableSelect label={text} value="" options={people.options.filter(option => !names.includes(option.label))} recentValues={people.near} recentLabel={record?.department || ''} onChange={add} allowCustom customLabel={value => (en ? `Add «${value}»` : `Προσθήκη «${value}»`)} placeholder={en ? 'Search staff or type a name' : 'Αναζήτηση προσωπικού ή όνομα'} {...selectText(en)} />
    {names.length > 0 && <div className="quality-owner-chips">{names.map((name: string) => <span key={name}>{name}<button type="button" onClick={() => commit(names.filter((item: string) => item !== name))} aria-label={`${en ? 'Remove' : 'Αφαίρεση'} ${name}`}>×</button></span>)}</div>}
  </div>
}

// One person with an account who may see a private report (their user id, not a name).
export function QualityVisiblePersonField({ value, onChange, label }: { value: string, onChange: (userId: string) => void, label: string }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const people = usePeople()
  const withAccount = people.employees.filter(employee => employee.userId)
  const options = people.options.filter(option => withAccount.some(employee => idOf(employee) === option.value))
  const selected = withAccount.find(employee => employee.userId === value)
  return <SearchableSelect label={label} value={selected ? idOf(selected) : ''} options={options} onChange={id => onChange?.(withAccount.find(employee => idOf(employee) === id)?.userId || '')} placeholder={en ? 'Search staff…' : 'Αναζήτηση προσωπικού…'} {...selectText(en)} />
}

// One person (the lead auditor): an employee or a typed name.
export function QualityPersonField({ name, onChange, label, department }: { name: string, onChange: (person: AnyRecord) => void, label: string, department?: string }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const extra = useMemo(() => [name].filter(Boolean), [name])
  const people = usePeople(extra, [department].filter(Boolean))
  const value = name ? (people.byName.has(name) ? idOf(people.byName.get(name) as AnyRecord) : `name:${name}`) : ''
  function change(id: string) {
    if (!id) return onChange?.({ name: '', userId: null })
    if (id.startsWith('name:')) return onChange?.({ name: id.slice(5), userId: null })
    const employee = people.employees.find(item => idOf(item) === id)
    onChange?.(employee ? { name: employeeName(employee as never), userId: employee.userId || null } : { name: id, userId: null })
  }
  return <SearchableSelect label={label} value={value} options={people.options} recentValues={people.near} recentLabel={department || ''} onChange={change} allowCustom customLabel={text => (en ? `Use «${text}»` : `Χρήση «${text}»`)} placeholder={en ? 'Search staff or type a name' : 'Αναζήτηση προσωπικού ή όνομα'} {...selectText(en)} />
}
