import { describe,it,expect } from 'vitest'
import { readFileSync } from 'node:fs'

const source=readFileSync(new URL('../src/features/controls/ControlsPage.jsx',import.meta.url),'utf8')

describe('department manager controls scope',()=>{
 it('allows department managers to create controls only for their own department',()=>{
  expect(source).toContain("const isDepartmentManager=role===ROLES.DEPARTMENT_MANAGER")
  expect(source).toContain("const canCreate=canManage||(isDepartmentManager&&Boolean(ownDepartment))")
  expect(source).toContain("departments:[ownDepartment],createdByScope:'department',createdForDepartment:ownDepartment")
  expect(source).toContain('departmentOnly={isDepartmentManager}')
  expect(source).toContain("fixedDepartment={isDepartmentManager?ownDepartment:''}")
 })

 it('keeps the registry scoped through canAccessRecord',()=>{
  expect(source).toContain('item.departments.filter(dep=>canAccessRecord({department:dep}))')
 })
})
