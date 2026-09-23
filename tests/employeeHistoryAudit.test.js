import { readFileSync } from 'node:fs'
import { describe,expect,it } from 'vitest'

const tabs=readFileSync(new URL('../src/features/employees/EmployeeRecordTabs.jsx',import.meta.url),'utf8')
const service=readFileSync(new URL('../src/features/employees/employeeHistoryService.js',import.meta.url),'utf8')
const migration=readFileSync(new URL('../supabase/migrations/20260914010000_employee_administrative_history.sql',import.meta.url),'utf8')

describe('employee administrative history',()=>{
  it('uses the existing employee sub-registry pattern with pagination',()=>{
    expect(tabs).toContain('loadEmployeeHistoryAsync')
    expect(tabs).toContain("language==='en'?'Changes':'Μεταβολές'")
    expect(tabs).toContain("language==='en'?'User':'Χρήστης'")
    expect(tabs).toContain('<Pager paging={paging} total={registry.filtered.length} language={language}/>')
    expect(tabs).toContain('className="scroll-table"')
  })

  it('loads only the selected employee audit trail through the governed RPC',()=>{
    expect(service).toContain("supabase.rpc('employee_admin_history'")
    expect(service).toContain('p_employee_id:employeeDbId')
  })

  it('audits employee administration without storing before/after field values',()=>{
    expect(migration).toContain('create trigger employees_administrative_audit')
    expect(migration).toContain("'changed_fields'")
    expect(migration).toContain('create or replace function public.employee_admin_history')
    expect(migration).not.toContain("'before_data'")
    expect(migration).not.toContain("'after_data'")
  })
})
