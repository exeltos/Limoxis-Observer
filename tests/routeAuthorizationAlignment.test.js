import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const app=fs.readFileSync(new URL('../src/app/App.jsx',import.meta.url),'utf8')
const committeeRoute=fs.readFileSync(new URL('../src/features/committees/CommitteeRecordPageRoute.jsx',import.meta.url),'utf8')

describe('route authorization alignment',()=>{
 it('protects Platform Center with VIEW_PLATFORM',()=>{
  expect(app).toContain('gate(CAPABILITIES.VIEW_PLATFORM, <PlatformCenterPage />)')
 })
 it('protects self profile with VIEW_MY_PROFILE rather than VIEW_STAFF',()=>{
  expect(app).toContain('gate(CAPABILITIES.VIEW_MY_PROFILE, <EmployeeRecordPage selfMode />)')
  expect(app).not.toContain('gate(CAPABILITIES.VIEW_STAFF, <EmployeeRecordPage selfMode />)')
 })
 it('keeps committee approval deep links usable without granting general committee access',()=>{
  expect(app).toContain('<CommitteeRecordPageRoute />')
  expect(committeeRoute).toContain('if(!canViewCommittee&&!approvalId)return <Navigate to="/" replace/>')
  expect(committeeRoute).toContain('loadCommitteeApprovalDeepLinkAsync')
 })
})
