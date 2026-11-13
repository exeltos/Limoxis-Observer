import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSource } from './readSource'

// Resolved without the global URL, which is jsdom's in jsdom test files.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// The employee record page is split into the page, its «Details» tab and its
// account views; source-level assertions read them as one text.
export const EMPLOYEE_RECORD_PAGE_FILES = [
  'src/features/employees/EmployeeRecordPage.jsx',
  'src/features/employees/EmployeeDetails.jsx',
  'src/features/employees/EmployeeAccountViews.jsx',
]
export function readEmployeeRecordPageSource() {
  return EMPLOYEE_RECORD_PAGE_FILES.map(file => readSource(path.join(root, file))).join('\n')
}
