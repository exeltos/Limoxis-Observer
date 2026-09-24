import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

// Employees module review: the redesigned performance-evaluation workflow
// (submit -> employee acknowledgement -> HR approval -> final approval)
// read/wrote employee_evaluations columns that were never added by any
// migration (production create/save/workflow would fail outright), had no
// RLS allowing the evaluated employee or a department manager to write
// (both flows the frontend already exposes), never worked in demo mode
// (called Supabase unconditionally), and the evaluator name blanked out in
// the open dialog right after any workflow action.
describe('the employee performance-evaluation workflow works in both demo and production', () => {
  const migration = fs.readFileSync('supabase/migrations/20260924140000_employee_evaluation_workflow_columns.sql', 'utf8')
  const service = fs.readFileSync('src/features/employees/employeeSubRecordsService.js', 'utf8')
  const recordsService = fs.readFileSync('src/features/employees/employeeRecordsService.js', 'utf8')
  const tabs = fs.readFileSync('src/features/employees/EmployeeRecordTabs.jsx', 'utf8')

  it('the migration adds every workflow column the service reads/writes', () => {
    for (const column of ['evaluation_period', 'status', 'evaluator_user_id', 'criteria', 'overall_score', 'employee_comment', 'employee_agreement', 'employee_acknowledged_at', 'employee_acknowledged_by', 'hr_approved_at', 'hr_approved_by', 'admin_approved_at', 'admin_approved_by', 'finalized_at']) {
      expect(migration).toContain(column)
    }
  })

  it('RLS lets the evaluated employee acknowledge their own submitted evaluation, and a scoped department manager insert one', () => {
    expect(migration).toContain('employee_evaluations_insert_authorized')
    expect(migration).toContain("array['department_manager'::public.app_role]")
    expect(migration).toContain('employee_evaluations_update_authorized')
    expect(migration).toContain("e.user_id = auth.uid()")
  })

  it('create and workflow actions branch to a local demo implementation instead of always calling Supabase', () => {
    expect(service).toContain('export async function createEmployeeEvaluationAsync(organizationId,employeeDbId,draft){\n  if(isDemoDataEnvironment())return createEvaluationLocal(employeeDbId,draft)')
    expect(service).toContain("if(isDemoDataEnvironment())return updateEvaluationWorkflowLocal(evaluationId,{action,comment,agreement})")
    expect(recordsService).toContain('export const saveEvaluations=')
  })

  it('after a workflow action, the open evaluation is re-synced from the reloaded (evaluator-joined) list instead of the raw un-joined mutation response', () => {
    expect(tabs).toContain('const rows=await state.reload();setSelected(rows.find(row=>row.id===selected.id)||null)')
  })

  it('performance-criteria names are translated for English instead of always showing the Greek questionnaire label', () => {
    expect(tabs).toContain('const PERFORMANCE_CRITERIA_LABELS_EN=')
    expect(tabs).toContain('const criterionName=')
  })
})
