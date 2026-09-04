import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLES, isPreviewableRole } from '../permissions/roles'
import { uxPolicyFor, recordWithinRoleScope, canSeeSensitiveEmployeeHealth } from '../permissions/roleUxPolicy'
import { listMemberships, listPlatformOwnerOrganizations } from './tenantService'
import { configureDataEnvironment } from '../data/dataEnvironment'

const TenantContext = createContext(null)
const DEMO_TENANT = Object.freeze({ id: 'demo-hospital', name: 'Demo Hospital', code: 'DEMO', type: 'hospital', mode: 'demo' })
const DEMO_MEMBERSHIP = Object.freeze({ id: 'demo-membership', role: ROLES.DEMO, status: 'active', organization: DEMO_TENANT, departmentIds: [], capabilities: [], customCapabilities: [], assignments: [] })

export function TenantProvider({ children }) {
  const { user, profile, isAuthenticated, isDemoSession, loading: authLoading } = useAuth()
  const canRolePreview = Boolean(profile?.isPlatformOwner || isDemoSession)
  const [memberships, setMemberships] = useState([])
  const [activeMembershipId, setActiveMembershipId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hydratedKey, setHydratedKey] = useState(null)
  const [platformDemoMode, setPlatformDemoMode] = useState(false)
  const [rolePreview, setRolePreview] = useState(()=>{
    if(typeof window==='undefined')return null
    const params=new URLSearchParams(window.location.search)
    const requested=params.get('helpRole')
    return params.get('helpPreview')==='1'&&isPreviewableRole(requested)?{role:requested,department:''}:null
  })

  const membershipContextKey = authLoading
    ? 'auth-loading'
    : !isAuthenticated
      ? 'anonymous'
      : `${user?.id||'user'}:${profile?.isPlatformOwner?'owner':'member'}:${isDemoSession?'demo':'production'}`

  const reloadMemberships = useCallback(async () => {
    if (authLoading) {
      setLoading(true)
      return []
    }
    setLoading(true)
    try {
      if (!isAuthenticated) {
        setMemberships([])
        setActiveMembershipId(null)
        setHydratedKey(membershipContextKey)
        return []
      }
      if (isDemoSession) {
        setMemberships([DEMO_MEMBERSHIP])
        setActiveMembershipId(DEMO_MEMBERSHIP.id)
        setHydratedKey(membershipContextKey)
        return [DEMO_MEMBERSHIP]
      }
      const next = await (profile?.isPlatformOwner ? listPlatformOwnerOrganizations() : listMemberships(user?.id))
      setMemberships(next)
      setActiveMembershipId((current) => {
        if (profile?.isPlatformOwner) return next.some((item) => item.id === current) ? current : null
        return next.some((item) => item.id === current) ? current : next[0]?.id ?? null
      })
      setHydratedKey(membershipContextKey)
      return next
    } finally {
      setLoading(false)
    }
  }, [authLoading, isAuthenticated, isDemoSession, user?.id, profile?.isPlatformOwner, membershipContextKey])

  useEffect(() => {
    reloadMemberships().catch(() => setHydratedKey(membershipContextKey))
  }, [reloadMemberships, membershipContextKey])

  const storedMembership = memberships.find((item) => item.id === activeMembershipId) ?? null
  const baseMembership = useMemo(() => (
    platformDemoMode && profile?.isPlatformOwner ? {...DEMO_MEMBERSHIP, role: ROLES.PLATFORM_OWNER} : storedMembership
  ), [platformDemoMode, profile?.isPlatformOwner, storedMembership])
  const tenant = baseMembership?.organization ?? null
  const demoMode=Boolean(isDemoSession||platformDemoMode)
  const demoAccountId=isDemoSession?(profile?.id||user?.id||null):(platformDemoMode&&profile?.isPlatformOwner?`owner-preview.${profile?.id||user?.id||'owner'}`:null)
  configureDataEnvironment({mode:demoMode?'demo':'production',organizationId:tenant?.id??(demoMode?DEMO_TENANT.id:null),demoAccountId})
  const actualRole = profile?.isPlatformOwner ? ROLES.PLATFORM_OWNER : baseMembership?.role ?? null
  const role = canRolePreview && rolePreview?.role ? rolePreview.role : actualRole
  const membership = useMemo(() => (
    rolePreview?.role && canRolePreview
      ? {...baseMembership, role: rolePreview.role, capabilities: [], customCapabilities: [], assignments: [], previewDepartment: rolePreview.department || null}
      : baseMembership
  ), [baseMembership, rolePreview, canRolePreview])

  const setTenantByMembership = useCallback((membershipId) => {
    if (!memberships.some((item) => item.id === membershipId)) return false
    // PlatformCenter navigates immediately after this call. Force the organization
    // switch to commit first so AppShell/route guards never render one frame with
    // the old platform context and the new organization route.
    flushSync(() => {
      setPlatformDemoMode(false)
      setActiveMembershipId(membershipId)
      setRolePreview(null)
    })
    return true
  }, [memberships])

  const enterPlatformDemo = useCallback(() => {
    if (profile?.isPlatformOwner) { setPlatformDemoMode(true); setActiveMembershipId(null); setRolePreview(null) }
  }, [profile?.isPlatformOwner])
  const returnToPlatform = useCallback(() => {
    if (profile?.isPlatformOwner) { setPlatformDemoMode(false); setActiveMembershipId(null); setRolePreview(null) }
  }, [profile?.isPlatformOwner])

  const tenantLoading = Boolean(authLoading || loading || hydratedKey !== membershipContextKey)

  const value = useMemo(() => ({
    tenant,
    membership,
    memberships,
    activeMembershipId,
    role,
    loading: tenantLoading,
    isDemo: Boolean(isDemoSession || platformDemoMode || tenant?.mode === 'demo'),
    setTenantByMembership,
    enterPlatformDemo,
    returnToPlatform,
    reloadMemberships,
    actualRole,
    rolePreview,
    canRolePreview,
    isRolePreview: Boolean(canRolePreview && rolePreview?.role),
    startRolePreview: (previewRole, department='') => {
      if (!canRolePreview || !isPreviewableRole(previewRole)) return false
      setRolePreview({role:previewRole,department})
      return true
    },
    updateRolePreviewDepartment: (department='') => canRolePreview && setRolePreview(current=>current?{...current,department}:current),
    stopRolePreview: () => setRolePreview(null),
    uxPolicy: uxPolicyFor(role),
    canAccessRecord: (record) => recordWithinRoleScope({role, membership, userId:user?.id, record}),
    canSeeSensitiveEmployeeHealth: canSeeSensitiveEmployeeHealth(role,membership?.capabilities,membership?.customCapabilities),
  }), [tenant, membership, memberships, activeMembershipId, role, actualRole, rolePreview, tenantLoading, canRolePreview, setTenantByMembership, enterPlatformDemo, returnToPlatform, reloadMemberships, user?.id, isDemoSession, platformDemoMode])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) throw new Error('useTenant must be used inside TenantProvider')
  return context
}
