import { useEffect, useRef, useState } from 'react'
import { ExcelFieldsDialog, pickColumns, tableFields } from '../../design-system/ExcelFieldsDialog'
import { printReport } from '../../core/export/reportDocument'
import { exportRegistry } from '../../core/export/registryExports'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import type { ExportItem } from '../../design-system/ExportMenu'
import type { ReportCell, ReportDoc, ReportFact } from '../../core/export/reportDocument'
import type { Employee } from './employeeTypes'

// What a tab hands to its print and Excel: the table it lists, or (doc) a printout of its own.
interface RecordTabExport {
  onExportItems?: (items: ExportItem[]) => void
  id: string
  label: { el: string, en: string }
  employee: Employee
  language: string
  table: () => { headers: string[], rows: ReportCell[][] }
  doc?: () => ReportDoc | null | undefined
  count?: number
  excel?: boolean
}

const employeeName = (employee: Employee, en: boolean) =>
  (en
    ? [employee.firstNameEn || employee.firstName, employee.lastNameEn || employee.lastName]
    : [employee.lastName, employee.firstName]
  ).filter(Boolean).join(' ') || employee.id

// The heading of every printout of the record: who, code, department, profession.
export function employeeReportHead(employee: Employee, language: string) {
  const en = language === 'en'
  return {
    language,
    kind: en ? 'Employee record' : 'Καρτέλα εργαζομένου',
    code: employee.id,
    name: employeeName(employee, en),
    meta: ([
      [en ? 'Code' : 'Κωδικός', employee.id || ''],
      [en ? 'Department' : 'Τμήμα', (en ? employee.departmentEn : '') || employee.department || ''],
      [en ? 'Profession' : 'Ιδιότητα', (en ? employee.professionEn : '') || employee.profession || ''],
    ] as ReportFact[]).filter(([, value]) => value),
  }
}

// What every tab of the employee record gets: the employee, the language and where its export items go.
export interface RecordTabProps {
  employee: Employee
  language: string
  onExportItems?: (items: ExportItem[]) => void
}

// A tab's print and Excel, handed to the record's single «Εξαγωγή» (header) instead of a second menu in the tab.
// table(): { headers, rows } of what the tab lists; doc() (optional) a printout of its own instead of that table.
// Returns the Excel field dialog to render in the tab.
export function useRecordTabExport({ onExportItems, id, label, employee, language, table, doc, count = 0, excel = true }: RecordTabExport) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const [excelOpen, setExcelOpen] = useState(false)
  const text = en ? label.en : label.el
  const print = () => {
    const head = employeeReportHead(employee, language)
    const own = doc?.()
    const data = own ? null : table()
    const ok = printReport(own || {
      language,
      kind: head.kind,
      code: head.code,
      title: `${text} · ${head.name}`,
      filename: `${id}-${employee.id}`,
      meta: head.meta,
      sections: [{ title: '', table: { columns: data?.headers, rows: data?.rows } }],
    })
    if (!ok) notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  }
  const items = [
    { id: `${id}-print`, kind: 'print', disabled: !count, label: `${en ? 'Print' : 'Εκτύπωση'}: ${text.toLocaleLowerCase(en ? 'en' : 'el')}`, onClick: print },
    ...(excel ? [{ id: `${id}-excel`, kind: 'excel', disabled: !count, label: `Excel: ${text.toLocaleLowerCase(en ? 'en' : 'el')}`, onClick: () => setExcelOpen(true) }] : []),
  ]
  const ref = useRef(items)
  ref.current = items
  useEffect(() => {
    if (!onExportItems) return undefined
    onExportItems(ref.current.map(item => ({ ...item, onClick: () => ref.current.find(current => current.id === item.id)?.onClick() })))
    return () => onExportItems([])
  }, [onExportItems, count, language, excel])
  const named = () => ({ ...table(), name: `${id}-${employee.id}` })
  return excelOpen ? (
    <ExcelFieldsDialog
      storageKey={`limoxis.employee.${id}.excel`}
      fields={tableFields(named())}
      onClose={() => setExcelOpen(false)}
      onConfirm={keys => { exportRegistry(pickColumns(named(), keys)); setExcelOpen(false) }}
    />
  ) : null
}
