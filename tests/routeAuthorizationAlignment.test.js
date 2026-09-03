import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const app=fs.readFileSync(new URL('../src/app/App.jsx',import.meta.url),'utf8')
const qualityCreate=fs.readFileSync(new URL('../src/features/quality/QualityCreatePage.jsx',import.meta.url),'utf8')
const committeeRoute=fs.readFileSync(new URL('../src/features/committees/CommitteeRecordPageRoute.jsx',import.meta.url),'utf8')
const tenantContext=fs.readFileSync(new URL('../src/core/tenant/TenantContext.jsx',import.meta.url),'utf8')
const capabilityGuard=fs.readFileSync(new URL('../src/core/permissions/RequireCapability.jsx',import.meta.url),'utf8')
const protectedRoute=fs.readFileSync(new URL('../src/core/auth/ProtectedRoute.jsx',import.meta.url),'utf8')

describe('route authorization alignment',()=>{
 it('protects Platform Center with VIEW_PLATFORM',()=>{
  expect(app).toContain('gate(CAPABILITIES.VIEW_PLATFORM, <PlatformCenterPage />)')
 })
 it('protects self profile with VIEW_MY_PROFILE rather than VIEW_STAFF',()=>{
  expect(app).toContain('gate(CAPABILITIES.VIEW_MY_PROFILE, <EmployeeRecordPage selfMode />)')
  expect(app).not.toContain('gate(CAPABILITIES.VIEW_STAFF, <EmployeeRecordPage selfMode />)')
 })
 it('prevents incident reporters from creating non-incident quality records by direct URL',()=>{
  expect(qualityCreate).toContain("const canCreate=canManage||(recordType==='incidents'&&canReportIncident)")
  expect(qualityCreate).toContain('if(!canCreate)return <Navigate to="/quality" replace/>')
  expect(qualityCreate).toContain('if(!canCreate)return')
 })
 it('keeps committee approval deep links usable without granting general committee access',()=>{
  expect(app).toContain('<CommitteeRecordPageRoute />')
  expect(committeeRoute).toContain('if(!canViewCommittee&&!approvalId)return <Navigate to="/" replace/>')
  expect(committeeRoute).toContain('loadCommitteeApprovalDeepLinkAsync')
 })
 it('exposes active membership state used by the tenant-aware HomeRoute',()=>{
  expect(app).toContain('const { activeMembershipId, isDemo, loading } = useTenant()')
  expect(tenantContext).toContain('activeMembershipId,')
 })
 it('guards organization analysis with its dedicated capability',()=>{
  expect(app).toContain('gate(CAPABILITIES.VIEW_ANALYSIS, <AnalysisPage />)')
 })
 it('waits for tenant resolution and uses a stable denied destination',()=>{
  expect(capabilityGuard).toContain('if (loading) return <RouteLoading />')
  expect(capabilityGuard).toContain('to="/access-denied"')
  expect(app).toContain('path="access-denied"')
 })
 it('preserves an internal deep link across authentication',()=>{
  expect(protectedRoute).toContain('state={{ from:')
  expect(protectedRoute).toContain('location.pathname')
 })
 it('does not grant role preview merely because the app is a development build',()=>{
  expect(tenantContext).toContain('profile?.isPlatformOwner || isDemoSession')
  expect(tenantContext).not.toContain('import.meta.env.DEV && isAuthenticated')
 })
})
