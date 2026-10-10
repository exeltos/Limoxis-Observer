import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolved without the global URL, which is jsdom's in jsdom test files.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// The employee record tabs are split across EmployeeRecordTabs.jsx and the
// modules below; source-level assertions read them as one text.
export const EMPLOYEE_RECORD_TABS_FILES = [
  'src/features/employees/employeeRecordShared.jsx',
  'src/features/employees/EmployeeHealthTabs.jsx',
  'src/features/employees/EmployeeTrainingTab.jsx',
  'src/features/employees/EmployeeEvaluationsTab.jsx',
  'src/features/employees/EmployeeRecordTabs.jsx',
]
export function readEmployeeRecordTabsSource() {
  return EMPLOYEE_RECORD_TABS_FILES.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')
}
