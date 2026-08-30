import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ROLES } from '../permissions/roles'
import { uxPolicyFor, recordWithinRoleScope, canSeeSensitiveEmployeeHealth } from '../permissions/roleUxPolicy'
import { listMemberships } from './tenantService'
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
  const [rolePreview, setRolePreview] = useState(()=>{
    if(typeof window==='undefined')return null
    const params=new URLSearchParams(window.location.search)
    const requested=params.get('helpRole')
    return params.get('helpPreview')==='1'&&Object.values(ROLES).includes(requested)?{role:requested,department:''}:null
  })

  useEffect(() => {
    if (!isAuthenticated) {
      setMemberships([])
      setActiveMembershipId(null)
      return
    }
    if (isDemoSession) {
      setMemberships([DEMO_MEMBERSHIP])
      setActiveMembershipId(DEMO_MEMBERSHIP.id)
      return
    }
    let cancelled = false
    setLoading(true)
    listMemberships(user?.id)
      .then((next) => {
        if (cancelled) return
        setMemberships(next)
        setActiveMembershipId((current) => next.some((item) => item.id === current) ? current : next[0]?.id ?? null)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isAuthenticated, isDemoSession, user?.id])

  const baseMembership = memberships.find((item) => item.id === activeMembershipId) ?? null
  const tenant = baseMembership?.organization ?? null
  configureDataEnvironment({mode:isDemoSession?'demo':'production',organizationId:tenant?.id??(isDemoSession?DEMO_TENANT.id:null)})
  const actualRole = profile?.isPlatformOwner ? ROLES.PLATFORM_OWNER : baseMembership?.role ?? null
  const role = canRolePreview && rolePreview?.role ? rolePreview.role : actualRole
  const membership = useMemo(() => (
    rolePreview?.role && canRolePreview
      ? {...baseMembership, role: rolePreview.role, capabilities: [], customCapabilities: [], assignments: [], previewDepartment: rolePreview.department || null}
      : baseMembership
  ), [baseMembership, rolePreview, canRolePreview])
  const setTenantByMembership = useCallback((membershipId) => {
    setMemberships((current) => {
      if (current.some((item) => item.id === membershipId)) setActiveMembershipId(membershipId)
      return current
    })
  }, [])

  const value = useMemo(() => ({
    tenant,
    membership,
    memberships,
    role,
    loading,
    isDemo: tenant?.mode === 'demo',
    setTenantByMembership,
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
  }), [tenant, membership, memberships, role, actualRole, rolePreview, loading, canRolePreview, setTenantByMembership, user?.id])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) throw new Error('useTenant must be used inside TenantProvider')
  return context
}
