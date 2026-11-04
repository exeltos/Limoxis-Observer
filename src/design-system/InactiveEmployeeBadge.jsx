import { StatusBadge } from './StatusBadge'
import { useLanguage } from '../core/i18n/LanguageContext'
import './InactiveEmployeeBadge.css'

// An employee who has left stays in the history (trainings, committees, records): the red «Inactive» label
// next to the name says so, and the row is dimmed with `inactive-employee-row`.
export function InactiveEmployeeBadge({ inactive = true }) {
  const { language } = useLanguage()
  if (!inactive) return null
  return (
    <StatusBadge tone="danger" className="inactive-employee-badge">
      {language === 'en' ? 'Inactive' : 'Ανενεργός'}
    </StatusBadge>
  )
}

// The employment status of an employee: anything but active (and on leave) is inactive.
export const isInactiveEmployee = employee => String(employee?.employmentStatus || '').toLowerCase() === 'inactive'

// The codes of the inactive employees, to mark them in lists that only carry the employee code.
export const inactiveEmployeeCodes = (employees = []) =>
  new Set(employees.filter(isInactiveEmployee).map(employee => String(employee.id || employee.employeeCode || '')))
