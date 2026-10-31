import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('the cultures on the department home', () => {
  it('shows only the department\'s own culture controls, with the last and the next sampling', () => {
    const card = source('src/features/workspaces/DepartmentCultureCard.jsx')
    expect(card).toContain("controlTypeCode(item.category) === 'CTRL-ENV'")
    expect(card).toContain('canAccessRecord')
    expect(card).toContain('lastCompletedAt')
    expect(card).toContain('nextDueAt')
    expect(source('src/features/workspaces/MyDepartmentPage.jsx')).toContain('extra={<DepartmentCultureCard/>}')
    expect(source('src/features/dashboard/DashboardPage.jsx')).toContain('{extra}')
  })
})
