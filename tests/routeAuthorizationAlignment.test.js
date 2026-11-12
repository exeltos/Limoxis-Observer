import { describe,expect,it } from 'vitest'
import { readSource } from './helpers/readSource'

const app=readSource(new URL('../src/app/App.jsx',import.meta.url))
const qualityCreate=readSource(new URL('../src/features/quality/QualityCreatePage.jsx',import.meta.url))
const committeeRoute=readSource(new URL('../src/features/committees/CommitteeRecordPageRoute.jsx',import.meta.url))
const tenantContext=readSource(new URL('../src/core/tenant/TenantContext.jsx',import.meta.url))
const capabilityGuard=readSource(new URL('../src/core/permissions/RequireCapability.jsx',import.meta.url))
const protectedRoute=readSource(new URL('../src/core/auth/ProtectedRoute.jsx',import.meta.url))

describe('route authorization alignment',()=>{
 it('protects Platform Center with VIEW_PLATFORM',()=>{
  expect(app).toContain('gate(CAPABILITIES.VIEW_PLATFORM,<PlatformCenterPage/>)')
 })
 it('protects self profile with VIEW_MY_PROFILE rather than VIEW_STAFF',()=>{
  expect(app).toContain('gate(CAPABILITIES.VIEW_MY_PROFILE,<EmployeeRecordPage selfMode/>)')
  expect(app).not.toContain('gate(CAPABILITIES.VIEW_STAFF,<EmployeeRecordPage selfMode/>)')
 })
 it('prevents incident reporters from creating non-incident quality records by direct URL',()=>{
  // An incident is the staff report form; every other record needs Quality management.
  expect(qualityCreate).toContain("if(recordType==='incidents')return <IncidentReportPage/>")
  expect(qualityCreate).toContain('if(!canManage)return <Navigate to="/quality" replace/>')
  expect(qualityCreate).toContain('if(!canManage||!valid||saving)return')
 })
 it('keeps committee approval deep links usable without granting general committee access',()=>{
  expect(app).toContain('<CommitteeRecordPageRoute/>')
  expect(committeeRoute).toContain('if(!canViewCommittee&&!approvalId)return <Navigate to="/" replace/>')
  expect(committeeRoute).toContain('loadCommitteeApprovalDeepLinkAsync')
 })
 it('exposes active membership state used by the tenant-aware HomeRoute',()=>{
  expect(app).toContain('const {activeMembershipId,isDemo,loading,role}=useTenant()')
  expect(tenantContext).toContain('activeMembershipId,')
 })
 it('guards organization analysis with its dedicated capability',()=>{
  expect(app).toContain('gate(CAPABILITIES.VIEW_ANALYSIS,<AnalysisPage/>)')
 })
 it('waits for tenant resolution and uses a stable denied destination',()=>{
  expect(capabilityGuard).toContain('if (unresolvedTenantContext({ role, membership, loading })) return <RouteLoading />')
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
