import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLES, isPreviewableRole } from '../permissions/roles'
import { uxPolicyFor, recordWithinRoleScope, canSeeSensitiveEmployeeHealth } from '../permissions/roleUxPolicy'
import { listMemberships, listPlatformOwnerOrganizations } from './tenantService'
import { configureDataEnvironment } from '../data/dataEnvironment'

const TenantContext = createContext(null)
const DEMO_TENANT = Object.freeze({ id: 'demo-hospital', name: 'Demo Hospital', code: 'DEMO', type: 'hospital', mode: 'demo' })
const DEMO_MEMBERSHIP = Object.freeze({ id: 'demo-membership', role: ROLES.DEMO, status: 'active', organization: DEMO_TENANT, departmentIds: [], capabilities: [], customCapabilities: [], assignments: [] })
const HYDRATION_TIMEOUT_MS=12000

function withTimeout(promise,ms=HYDRATION_TIMEOUT_MS){
  let timer
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('TENANT_HYDRATION_TIMEOUT')),ms)}),
  ]).finally(()=>clearTimeout(timer))
}

export function TenantProvider({ children }) {
  const { user, profile, isAuthenticated, isDemoSession, loading: authLoading } = useAuth()
  const canRolePreview = Boolean(profile?.isPlatformOwner || isDemoSession)
  const [memberships, setMemberships] = useState([])
  const [activeMembershipId, setActiveMembershipId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hydratedKey, setHydratedKey] = useState(null)
  const [platformDemoMode, setPlatformDemoMode] = useState(false)
  const hydrationRef=useRef(0)
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
    const request=++hydrationRef.current
    if (authLoading) {
      setLoading(true)
      return []
    }
    setLoading(true)
    try {
      if (!isAuthenticated) {
        if(request!==hydrationRef.current)return []
        setMemberships([])
        setActiveMembershipId(null)
        setHydratedKey(membershipContextKey)
        return []
      }
      if (isDemoSession) {
        if(request!==hydrationRef.current)return [DEMO_MEMBERSHIP]
        setMemberships([DEMO_MEMBERSHIP])
        setActiveMembershipId(DEMO_MEMBERSHIP.id)
        setHydratedKey(membershipContextKey)
        return [DEMO_MEMBERSHIP]
      }
      const fetchMemberships=profile?.isPlatformOwner ? listPlatformOwnerOrganizations() : listMemberships(user?.id)
      const next = await withTimeout(fetchMemberships)
      if(request!==hydrationRef.current)return next
      setMemberships(next)
      setActiveMembershipId((current) => {
        if (profile?.isPlatformOwner) return next.some((item) => item.id === current) ? current : null
        return next.some((item) => item.id === current) ? current : next[0]?.id ?? null
      })
      setHydratedKey(membershipContextKey)
      return next
    } catch(error) {
      if(request===hydrationRef.current){
        setMemberships([])
        setActiveMembershipId(null)
        setHydratedKey(membershipContextKey)
      }
      throw error
    } finally {
      if(request===hydrationRef.current)setLoading(false)
    }
  }, [authLoading, isAuthenticated, isDemoSession, user?.id, profile?.isPlatformOwner, membershipContextKey])

  useEffect(() => {
    reloadMemberships().catch(() => {
      if(!authLoading)setHydratedKey(membershipContextKey)
    })
  }, [reloadMemberships, membershipContextKey, authLoading])

  const storedMembership = memberships.find((item) => item.id === activeMembershipId) ?? null
  const baseMembership = useMemo(() => (
    platformDemoMode && profile?.isPlatformOwner ? {...DEMO_MEMBERSHIP, role: ROLES.PLATFORM_OWNER} : storedMembership
  ), [platformDemoMode, profile?.isPlatformOwner, storedMembership])
  const tenant = baseMembership?.organization ?? null
  const demoMode=Boolean(isDemoSession||platformDemoMode)
  const demoAccountId=isDemoSession?(profile?.id||user?.id||null):(platformDemoMode&&profile?.isPlatformOwner?`owner-preview.${profile?.id||user?.id||'owner'}`:null)
  useLayoutEffect(()=>{
    configureDataEnvironment({mode:demoMode?'demo':'production',organizationId:tenant?.id??(demoMode?DEMO_TENANT.id:null),demoAccountId})
  },[demoMode,tenant?.id,demoAccountId])
  const actualRole = profile?.isPlatformOwner ? ROLES.PLATFORM_OWNER : baseMembership?.role ?? null
  const role = canRolePreview && rolePreview?.role ? rolePreview.role : actualRole
  const membership = useMemo(() => (
    rolePreview?.role && canRolePreview
      ? {...baseMembership, role: rolePreview.role, capabilities: [], customCapabilities: [], assignments: [], previewDepartment: rolePreview.department || null}
      : baseMembership
  ), [baseMembership, rolePreview, canRolePreview])

  const setTenantByMembership = useCallback((membershipId) => {
    if (!memberships.some((item) => item.id === membershipId)) return false
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
