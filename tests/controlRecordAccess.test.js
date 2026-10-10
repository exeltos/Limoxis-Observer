import { describe, it, expect } from 'vitest'
import { ROLES } from '../src/core/permissions/roles'
import { controlOverallStatus, controlRecordPermissions, pickControlDepartment } from '../src/features/controls/controlRecordAccess'

const past = '2020-01-01T09:00:00Z'
const future = '2999-01-01T09:00:00Z'
const control = (assignments, extra = {}) => ({ status: 'active', createdByScope: 'quality', assignments, ...extra })
const permissions = (role, record, actorId = 'me', membership = {}) => controlRecordPermissions({ role, membership, record, actorId })

describe('pickControlDepartment', () => {
  const visible = ['ICU', 'Surgery']
  it('opens the requested department, then the user\'s own, then the first visible one', () => {
    expect(pickControlDepartment(visible, 'Surgery', 'ICU')).toBe('Surgery')
    expect(pickControlDepartment(visible, 'Cardiology', 'Surgery')).toBe('Surgery')
    expect(pickControlDepartment(visible, '', 'Cardiology')).toBe('ICU')
    expect(pickControlDepartment([], 'ICU', 'ICU')).toBe('')
  })
})

describe('controlOverallStatus', () => {
  it('is overdue if any department is overdue, then due soon, else scheduled', () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    expect(controlOverallStatus(control({ A: { nextDueAt: future }, B: { nextDueAt: past } }), ['A', 'B'])).toBe('overdue')
    expect(controlOverallStatus(control({ A: { nextDueAt: future }, B: { nextDueAt: soon } }), ['A', 'B'])).toBe('dueSoon')
    expect(controlOverallStatus(control({ A: { nextDueAt: future } }), ['A'])).toBe('scheduled')
    expect(controlOverallStatus(control({}), [])).toBe('scheduled')
  })
})

describe('controlRecordPermissions: execution', () => {
  const record = control({ ICU: { nextDueAt: past }, Surgery: { nextDueAt: future }, Ward: { nextDueAt: future, hasDraft: true } })

  it('a department user executes only a due control or a waiting draft', () => {
    const { canExecuteDepartment } = permissions(ROLES.DEPARTMENT_USER, record)
    expect(canExecuteDepartment('ICU')).toBe(true)
    expect(canExecuteDepartment('Surgery')).toBe(false)
    expect(canExecuteDepartment('Ward')).toBe(true)
  })

  it('a control manager may execute before the due date', () => {
    expect(permissions(ROLES.QUALITY_MANAGER, record).canExecuteDepartment('Surgery')).toBe(true)
  })

  it('nobody executes without the execute capability or an assignment', () => {
    expect(permissions(ROLES.HR_OFFICE, record).canExecuteDepartment('ICU')).toBe(false)
    expect(permissions(ROLES.QUALITY_MANAGER, control({})).canExecuteDepartment('ICU')).toBe(false)
  })
})

describe('controlRecordPermissions: definition', () => {
  it('control managers modify and remove the definition; a department manager does not touch central controls', () => {
    const record = control({ ICU: {} })
    expect(permissions(ROLES.QUALITY_MANAGER, record)).toMatchObject({ canModifyDefinition: true, canRemoveDefinition: true, canDeleteDraft: false, editsOwnDepartmentOnly: false })
    expect(controlRecordPermissions({ role: ROLES.DEPARTMENT_MANAGER, record, actorId: 'me', allDepartmentsVisible: true })).toMatchObject({ canModifyDefinition: false, canRemoveDefinition: false })
  })

  it('a department manager edits and archives their own department\'s controls, in their department only', () => {
    const own = control({ ICU: {} }, { createdByScope: 'department', createdForDepartment: 'ICU' })
    const manager = visible => controlRecordPermissions({ role: ROLES.DEPARTMENT_MANAGER, record: own, actorId: 'me', allDepartmentsVisible: visible })
    expect(manager(true)).toMatchObject({ canModifyDefinition: true, canRemoveDefinition: true, editsOwnDepartmentOnly: true, canDeleteDraft: false })
    // Also assigned to a department the manager cannot see: hands off.
    expect(manager(false)).toMatchObject({ canModifyDefinition: false, canRemoveDefinition: false, editsOwnDepartmentOnly: false })
    // A department user of the same department does not edit definitions.
    expect(controlRecordPermissions({ role: ROLES.DEPARTMENT_USER, record: own, actorId: 'me', allDepartmentsVisible: true }).canModifyDefinition).toBe(false)
  })

  it('only a draft can be deleted, by a role allowed to delete drafts', () => {
    const draft = control({ ICU: {} }, { status: 'draft' })
    expect(permissions(ROLES.QUALITY_MANAGER, draft).canDeleteDraft).toBe(true)
    expect(permissions(ROLES.DEPARTMENT_USER, draft)).toMatchObject({ canDeleteDraft: false, canRemoveDefinition: false })
  })
})

describe('controlRecordPermissions: execution history', () => {
  const record = control({ ICU: {} })
  const mine = { status: 'completed', actorId: 'me' }
  const theirs = { status: 'completed', actorId: 'someone-else' }

  it('only completed executions can be voided, by roles allowed to void', () => {
    const manager = permissions(ROLES.DEPARTMENT_MANAGER, record)
    expect(manager.canCancelHistory(theirs)).toBe(true)
    expect(manager.canDeleteHistory({ ...theirs, status: 'cancelled' })).toBe(false)
    expect(permissions(ROLES.DEPARTMENT_USER, record).canCancelHistory(mine)).toBe(false)
  })

  it('an execution is corrected by its author, or by a control manager', () => {
    const user = permissions(ROLES.DEPARTMENT_USER, record)
    expect(user.canEditHistory(mine)).toBe(true)
    expect(user.canEditHistory(theirs)).toBe(false)
    expect(permissions(ROLES.QUALITY_MANAGER, record).canEditHistory(theirs)).toBe(true)
  })
})
