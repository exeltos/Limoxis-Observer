import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ROLES } from '../permissions/roles'
import { uxPolicyFor, recordWithinRoleScope, canSeeSensitiveEmployeeHealth } from '../permissions/roleUxPolicy'
import { listMemberships, listPlatformOwnerOrganizations } from './tenantService'
import { configureDataEnvironment } from '../data/dataEnvironment'

const TenantContext = createContext(null)
const DEMO_TENANT = Object.freeze({ id: 'demo-hospital', name: 'Demo Hospital', code: 'DEMO', type: 'hospital', mode: 'demo' })
const DEMO_MEMBERSHIP = Object.freeze({ id: 'demo-membership', role: ROLES.DEMO, status: 'active', organization: DEMO_TENANT, departmentIds: [], capabilities: [], customCapabilities: [], assignments: [] })

export function TenantProvider({ children }) {
  const { user, profile, isAuthenticated, isDemoSession } = useAuth()
  const canRolePreview = Boolean(profile?.isPlatformOwner || isDemoSession || (import.meta.env.DEV && isAuthenticated))
  const [memberships, setMemberships] = useState([])
  const [activeMembershipId, setActiveMembershipId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [platformDemoMode, setPlatformDemoMode] = useState(false)
  const [rolePreview, setRolePreview] = useState(()=>{
    if(typeof window==='undefined')return null
    const params=new URLSearchParams(window.location.search)
    const requested=params.get('helpRole')
    return params.get('helpPreview')==='1'&&Object.values(ROLES).includes(requested)?{role:requested,department:''}:null
  })

  const reloadMemberships = useCallback(async () => {
    if (!isAuthenticated) {
      setMemberships([])
      setActiveMembershipId(null)
      return []
    }
    if (isDemoSession) {
      setMemberships([DEMO_MEMBERSHIP])
      setActiveMembershipId(DEMO_MEMBERSHIP.id)
      return [DEMO_MEMBERSHIP]
    }
    setLoading(true)
    try {
      const next = await (profile?.isPlatformOwner ? listPlatformOwnerOrganizations() : listMemberships(user?.id))
      setMemberships(next)
      setActiveMembershipId((current) => {
        if (profile?.isPlatformOwner) return next.some((item) => item.id === current) ? current : null
        return next.some((item) => item.id === current) ? current : next[0]?.id ?? null
      })
      return next
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isDemoSession, user?.id, profile?.isPlatformOwner])

  useEffect(() => {
    reloadMemberships().catch(() => {})
  }, [reloadMemberships])

  const storedMembership = memberships.find((item) => item.id === activeMembershipId) ?? null
  const baseMembership = platformDemoMode && profile?.isPlatformOwner ? {...DEMO_MEMBERSHIP, role: ROLES.PLATFORM_OWNER} : storedMembership
  const tenant = baseMembership?.organization ?? null
  configureDataEnvironment({mode:(isDemoSession||platformDemoMode)?'demo':'production',organizationId:tenant?.id??((isDemoSession||platformDemoMode)?DEMO_TENANT.id:null)})
  const actualRole = profile?.isPlatformOwner ? ROLES.PLATFORM_OWNER : baseMembership?.role ?? null
  const role = canRolePreview && rolePreview?.role ? rolePreview.role : actualRole
  const membership = useMemo(() => (
    rolePreview?.role && canRolePreview
      ? {...baseMembership, role: rolePreview.role, capabilities: [], customCapabilities: [], assignments: [], previewDepartment: rolePreview.department || null}
      : baseMembership
  ), [baseMembership, rolePreview, canRolePreview])
  const setTenantByMembership = useCallback((membershipId) => {
    setPlatformDemoMode(false)
    setMemberships((current) => {
      if (current.some((item) => item.id === membershipId)) setActiveMembershipId(membershipId)
      return current
    })
  }, [])
  const enterPlatformDemo = useCallback(() => {
    if (profile?.isPlatformOwner) { setPlatformDemoMode(true); setActiveMembershipId(null); setRolePreview(null) }
  }, [profile?.isPlatformOwner])
  const returnToPlatform = useCallback(() => {
    if (profile?.isPlatformOwner) { setPlatformDemoMode(false); setActiveMembershipId(null); setRolePreview(null) }
  }, [profile?.isPlatformOwner])

  const value = useMemo(() => ({
    tenant,
    membership,
    memberships,
    role,
    loading,
    isDemo: Boolean(isDemoSession || platformDemoMode || tenant?.mode === 'demo'),
    setTenantByMembership,
    enterPlatformDemo,
    returnToPlatform,
    reloadMemberships,
    actualRole,
    rolePreview,
    canRolePreview,
    isRolePreview: Boolean(canRolePreview && rolePreview?.role),
    startRolePreview: (previewRole, department='') => canRolePreview && setRolePreview({role:previewRole,department}),
    updateRolePreviewDepartment: (department='') => canRolePreview && setRolePreview(current=>current?{...current,department}:current),
    stopRolePreview: () => setRolePreview(null),
    uxPolicy: uxPolicyFor(role),
    canAccessRecord: (record) => recordWithinRoleScope({role, membership, userId:user?.id, record}),
    canSeeSensitiveEmployeeHealth: canSeeSensitiveEmployeeHealth(role,membership?.capabilities,membership?.customCapabilities),
  }), [tenant, membership, memberships, role, actualRole, rolePreview, loading, canRolePreview, setTenantByMembership, enterPlatformDemo, returnToPlatform, reloadMemberships, user?.id, isDemoSession, platformDemoMode])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) throw new Error('useTenant must be used inside TenantProvider')
  return context
}
