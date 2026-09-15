import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const page=read('src/features/employees/EmployeeRecordPage.jsx')
const tabs=read('src/features/employees/EmployeeRecordTabs.jsx')
const service=read('src/features/employees/employeeSubRecordsService.js')
const documents=read('src/design-system/DocumentsWorkspace.jsx')

describe('employee record canonical tabs',()=>{
  it('routes every employee sub-tab through the canonical tab components',()=>{
    for(const component of ['EmployeeOccupationalTab','EmployeeVaccinationsTab','EmployeeSurveillanceTab','EmployeeTrainingTab','EmployeeEvaluationsTab','EmployeeCertificatesTab','EmployeeHistoryTab'])expect(page).toContain(component)
    expect(page).not.toContain('function Occupational(')
    expect(page).not.toContain('function Vaccinations(')
    expect(page).not.toContain('function Certificates(')
  })

  it('uses the same table, pagination and row-open pattern across employee registries',()=>{
    expect(tabs).toContain('RegistryPagination')
    expect(tabs).toContain('sticky-table record-table-clickable')
    expect(tabs).toContain('EmployeeOccupationalTab')
    expect(tabs).toContain('EmployeeVaccinationsTab')
    expect(tabs).toContain('EmployeeTrainingTab')
    expect(tabs).toContain('EmployeeEvaluationsTab')
  })

  it('reads occupational health and vaccination detail fields from their governed tables',()=>{
    expect(service).toContain("visit_type,status,follow_up_date,fitness_status,clinical_notes")
    expect(service).toContain("vaccine_label_snapshot,dose,vaccination_date,lot_number,valid_until,status,clinical_notes")
    expect(tabs).toContain('Σημειώσεις / αντιμετώπιση')
    expect(tabs).toContain('Αριθμός παρτίδας')
  })

  it('keeps training and evaluations tied to their canonical sources',()=>{
    expect(service).toContain("source:'training_records'")
    expect(service).toContain("source:'employee_evaluations'")
    expect(tabs).toContain("returnTo:`/employees/${encodeURIComponent(employee.id)}`")
    expect(tabs).toContain("returnTab:'training'")
    expect(tabs).toContain("selected.source==='training'")
  })

  it('uses the shared governed document attachment workspace',()=>{
    expect(tabs).toContain('DocumentsWorkspace')
    expect(documents).toContain('AttachmentField')
    expect(tabs).toContain('entityType="employee-certificate"')
    expect(tabs).toContain('entityId={employee.dbId||employee.id}')
    expect(tabs).not.toContain('loadCertificatesAsync')
    expect(tabs).not.toContain('createCertificateAsync')
  })

  it('keeps surveillance linked to the canonical employee episodes and laboratory samples',()=>{
    expect(tabs).toContain('loadEmployeeSurveillanceRecords')
    expect(tabs).toContain('loadLaboratorySamples')
    expect(tabs).toContain('employeeSurveillanceId===selected.recordId')
    expect(tabs).toContain('EmployeeSurveillanceRecordDialog')
  })
})
