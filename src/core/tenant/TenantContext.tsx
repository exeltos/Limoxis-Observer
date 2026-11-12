import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useEffect, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLES, configureProfileAccess, isPreviewableRole } from '../permissions/roles'
import { disabledCapabilitiesFor, moduleEnabled as organizationModuleEnabled, normalizeProfile } from '../organization/operatingProfile'
import { uxPolicyFor, recordWithinRoleScope, canSeeSensitiveEmployeeHealth } from '../permissions/roleUxPolicy'
import { SCOPES } from '../permissions/accessModel'
import { getPlatformOwnerDemoMembership, listMemberships, listPlatformOwnerOrganizations, openPlatformOwnerDemo } from './tenantService'
import { isOwnerPreview } from '../preview/ownerPreview'
import { configureDataEnvironment } from '../data/dataEnvironment'
import { readSessionJson, removeSessionValue, writeSessionJson } from '../storage/browserStorage'

import { SAMPLE_DEFAULT_DEPARTMENT, SAMPLE_DEFAULT_DIVISION, SAMPLE_DIVISION_DEPARTMENTS } from './sampleDepartments'
import type { Membership, RolePreview, Tenant, TenantContextValue } from './tenantTypes'

export const TenantContext = createContext<TenantContextValue | null>(null)
const DEMO_TENANT: Readonly<Tenant> = Object.freeze({ id: 'demo-hospital', name: 'Demo Hospital', code: 'DEMO', type: 'hospital', mode: 'demo' })
const DEMO_MEMBERSHIP: Readonly<Membership> = Object.freeze({ id: 'demo-membership', role: ROLES.DEMO, status: 'active', organization: DEMO_TENANT, departmentIds: [], capabilities: [], customCapabilities: [], assignments: [] })
const HYDRATION_TIMEOUT_MS=12000
// The organization, Platform Owner demo mode and role preview chosen in this tab
// survive a page refresh (sessionStorage: per tab, gone when the tab closes, and
// cleared on sign-out) so a refresh keeps the user where they were.
const SELECTION_KEY='limoxis.tenant-selection'
const helpPreviewFrame=()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('helpPreview')==='1'&&window.self!==window.top
// Η θέση της καρτέλας που αποθηκεύεται (sessionStorage) για μια ανανέωση της σελίδας.
interface SavedSelection {
  userId: string
  membershipId: string | null
  platformDemo: boolean
  rolePreview: Partial<RolePreview> | null
}

function savedSelection(userId: string | null | undefined): SavedSelection | null{
  if(!userId||helpPreviewFrame())return null
  const saved=readSessionJson(SELECTION_KEY) as SavedSelection | null
  return saved&&saved.userId===userId?saved:null
}

// A saved role preview: the department (department roles) or the division and its departments (Division Director).
const restoredPreview=(saved: Partial<RolePreview>): RolePreview=>({role:saved.role as string,department:saved.department||'',departmentName:saved.departmentName||'',division:saved.division||'',divisionName:saved.divisionName||'',departmentIds:Array.isArray(saved.departmentIds)?saved.departmentIds:[]})

function withTimeout<T>(promise: Promise<T>,ms=HYDRATION_TIMEOUT_MS): Promise<T>{
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('TENANT_HYDRATION_TIMEOUT')),ms)}),
  ]).finally(()=>clearTimeout(timer))
}

export function TenantProvider({ children }: { children?: ReactNode }) {
  const { user, profile, isAuthenticated, isDemoSession, loading: authLoading } = useAuth()
  const [memberships, setMemberships] = useState<Membership[]>([])
  // Demo organizations the Platform Owner entered (their own Demo or an
  // evaluator's); kept apart so the organization registry lists hospitals only.
  const [ownerDemoMemberships, setOwnerDemoMemberships] = useState<Membership[]>([])
  const ownerDemoIds=useRef(new Set<string | null>())
  const [activeMembershipId, setActiveMembershipId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hydratedKey, setHydratedKey] = useState<string | null>(null)
  const [platformDemoMode, setPlatformDemoMode] = useState(false)
  const hydrationRef=useRef(0)
  const restoredKeyRef=useRef<string | null>(null)
  // Key of the last hydration that succeeded; the selection is saved only then,
  // so a failed or timed-out request never overwrites the saved place.
  const [persistableKey, setPersistableKey] = useState<string | null>(null)
  // A real Division Director with more than one division: the one the home shows (null: the first).
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [rolePreview, setRolePreview] = useState<RolePreview | null>(()=>{
    if(typeof window==='undefined')return null
    const params=new URLSearchParams(window.location.search)
    const requested=params.get('helpRole')
    return params.get('helpPreview')==='1'&&requested&&isPreviewableRole(requested)?{role:requested,department:params.get('helpDept')||'',division:params.get('helpDivision')||''}:null
  })

  const membershipContextKey = authLoading
    ? 'auth-loading'
    : !isAuthenticated
      ? 'anonymous'
      : `${user?.id||'user'}:${profile?.isPlatformOwner?'owner':'member'}:${isDemoSession?'demo':'production'}`

  const reloadMemberships = useCallback(async (): Promise<Membership[]> => {
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
        const saved=restoredKeyRef.current===membershipContextKey?null:savedSelection(user?.id)
        restoredKeyRef.current=membershipContextKey
        if(saved?.rolePreview?.role&&isPreviewableRole(saved.rolePreview.role))setRolePreview(restoredPreview(saved.rolePreview))
        setMemberships([DEMO_MEMBERSHIP])
        setActiveMembershipId(DEMO_MEMBERSHIP.id)
        setHydratedKey(membershipContextKey)
        setPersistableKey(membershipContextKey)
        return [DEMO_MEMBERSHIP]
      }
      const fetchMemberships=profile?.isPlatformOwner ? listPlatformOwnerOrganizations() : listMemberships(user?.id)
      const next = await withTimeout(fetchMemberships)
      if(request!==hydrationRef.current)return next
      // First hydration for this user in this tab: restore the selection saved before a refresh.
      const saved=restoredKeyRef.current===membershipContextKey?null:savedSelection(user?.id)
      restoredKeyRef.current=membershipContextKey
      // An Owner who was inside a Demo organization goes back into it.
      let restoredDemo: Membership | null=null
      if(profile?.isPlatformOwner&&saved?.membershipId&&!next.some((item)=>item.id===saved.membershipId)&&String(saved.membershipId).startsWith('platform-owner:')){
        restoredDemo=await getPlatformOwnerDemoMembership(String(saved.membershipId).slice('platform-owner:'.length)).catch(()=>null)
        if(request!==hydrationRef.current)return next
      }
      const reachable=restoredDemo?[...next,restoredDemo]:next
      setMemberships(next)
      if(restoredDemo){const demo=restoredDemo;setOwnerDemoMemberships((current)=>[...current.filter((item)=>item.id!==demo.id),demo])}
      setActiveMembershipId((current) => {
        const preferred=current??saved?.membershipId??null
        if (profile?.isPlatformOwner) return reachable.some((item) => item.id === preferred) || ownerDemoIds.current.has(preferred) ? preferred : null
        return next.some((item) => item.id === preferred) ? preferred : next[0]?.id ?? null
      })
      if(saved&&profile?.isPlatformOwner&&!saved.membershipId){setPlatformDemoMode(Boolean(saved.platformDemo))}
      // A role preview needs the tenant it was started in: a still-valid organization or the demo hospital.
      const previewTenantRestored=saved?.membershipId?reachable.some((item)=>item.id===saved.membershipId):Boolean(saved?.platformDemo)
      // Evaluators may preview roles inside their Demo organization, so theirs is restored too.
      const restoredMembership=reachable.find((item)=>item.id===saved?.membershipId)
      const previewAllowed=profile?.isPlatformOwner||Boolean(restoredMembership?.organization?.is_demo)
      if(saved?.rolePreview?.role&&previewAllowed&&previewTenantRestored&&isPreviewableRole(saved.rolePreview.role))setRolePreview(restoredPreview(saved.rolePreview))
      setHydratedKey(membershipContextKey)
      setPersistableKey(membershipContextKey)
      return next
    } catch(error) {
      if(request===hydrationRef.current){
        setPersistableKey(null)
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

  useEffect(() => {
    if (authLoading || helpPreviewFrame()) return
    if (!isAuthenticated) { removeSessionValue(SELECTION_KEY); return }
    if (hydratedKey !== membershipContextKey || persistableKey !== membershipContextKey || !user?.id) return
    writeSessionJson(SELECTION_KEY, { userId: user.id, membershipId: activeMembershipId, platformDemo: platformDemoMode, rolePreview: rolePreview?.role ? rolePreview : null })
  }, [authLoading, isAuthenticated, hydratedKey, persistableKey, membershipContextKey, user?.id, activeMembershipId, platformDemoMode, rolePreview])

  ownerDemoIds.current=new Set(ownerDemoMemberships.map((item)=>item.id))
  const storedMembership = memberships.find((item) => item.id === activeMembershipId) ?? ownerDemoMemberships.find((item) => item.id === activeMembershipId) ?? null
  const baseMembership = useMemo(() => (
    platformDemoMode && profile?.isPlatformOwner ? {...DEMO_MEMBERSHIP, role: ROLES.PLATFORM_OWNER} : storedMembership
  ), [platformDemoMode, profile?.isPlatformOwner, storedMembership])
  const tenant = baseMembership?.organization ?? null
  // The organization's operating profile switches modules off for every role in it.
  // Applied during render, before children evaluate permissions.
  const profileKey=`${tenant?.id||''}|${tenant?.operating_profile||''}|${(tenant?.enabled_addons||['*']).join(',')}|${(tenant?.enabled_modules||['*']).join(',')}`
  const profileDisabled=useMemo(()=>disabledCapabilitiesFor(tenant),[profileKey]) // eslint-disable-line react-hooks/exhaustive-deps
  configureProfileAccess(profileDisabled)
  const demoMode=Boolean(isDemoSession||platformDemoMode)
  const demoAccountId=isDemoSession?(profile?.id||user?.id||null):(platformDemoMode&&profile?.isPlatformOwner?`owner-preview.${profile?.id||user?.id||'owner'}`:null)
  useLayoutEffect(()=>{
    configureDataEnvironment({mode:demoMode?'demo':'production',organizationId:tenant?.id??(demoMode?DEMO_TENANT.id:null),demoAccountId})
  },[demoMode,tenant?.id,demoAccountId])
  // A real Demo organization (the Owner's own or an evaluator's) lets its users
  // look at the application as any role.
  const realDemoTenant = Boolean(tenant?.is_demo && tenant?.mode !== 'demo')
  const canRolePreview = Boolean(profile?.isPlatformOwner || isDemoSession || realDemoTenant)
  const actualRole = profile?.isPlatformOwner ? ROLES.PLATFORM_OWNER : baseMembership?.role ?? null
  const role = canRolePreview && rolePreview?.role ? rolePreview.role : actualRole
  // In a Demo organization Hospital Admin also has Occupational Health (as the
  // database grants it there: every person in a Demo is synthetic).
  const withDemoAdminHealth = (item: Membership | null): Membership | null => realDemoTenant && item?.role === ROLES.HOSPITAL_ADMIN
    ? {...item, customCapabilities: [...new Set([...(item.customCapabilities || []), 'view_occupational_health', 'manage_occupational_health'])]}
    : item
  const membership = useMemo(() => withDemoAdminHealth(previewMembership()), [baseMembership, rolePreview, canRolePreview, tenant?.mode, platformDemoMode, realDemoTenant]) // eslint-disable-line react-hooks/exhaustive-deps
  function previewMembership(): Membership | null {
    if (!(rolePreview?.role && canRolePreview)) return baseMembership
    const preview = {...baseMembership as Membership, role: rolePreview.role, capabilities: [], customCapabilities: [], assignments: []}
    // A Division Director oversees the departments of the chosen division: in a hospital by id, in the
    // sample data by the names its records carry (the first sample division when none is chosen).
    if (rolePreview.role === ROLES.DIVISION_DIRECTOR) {
      const sampleData = tenant?.mode === 'demo' || platformDemoMode
      const division = rolePreview.division || (sampleData ? SAMPLE_DEFAULT_DIVISION : '')
      const departmentIds = rolePreview.departmentIds?.length ? [...rolePreview.departmentIds] : sampleData ? [...(SAMPLE_DIVISION_DEPARTMENTS[division] || [])] : []
      return {...preview, departmentIds, divisionId: division || null, divisionName: rolePreview.divisionName || '', previewDepartment: null, previewDepartments: sampleData ? departmentIds : null}
    }
    // In a real organization the previewed department is a real department:
    // scope by its id (as a member of that department) and show its name.
    if (tenant?.mode !== 'demo' && !platformDemoMode && rolePreview.department) return {...preview, departmentIds: [rolePreview.department], departmentId: rolePreview.department, departmentName: rolePreview.departmentName || '', previewDepartment: null}
    if (tenant?.mode !== 'demo' && !platformDemoMode) return {...preview, departmentIds: [], previewDepartment: null}
    // Sample data: a department-scoped role without a chosen department is in the ICU.
    const ownDepartment = rolePreview.department || (uxPolicyFor(rolePreview.role).scope === SCOPES.DEPARTMENT ? SAMPLE_DEFAULT_DEPARTMENT : null)
    return {...preview, previewDepartment: ownDepartment}
  }

  const setTenantByMembership = useCallback((membershipId: string) => {
    if (!memberships.some((item) => item.id === membershipId) && !ownerDemoMemberships.some((item) => item.id === membershipId)) return false
    flushSync(() => {
      setPlatformDemoMode(false)
      setActiveMembershipId(membershipId)
      setRolePreview(null)
    })
    return true
  }, [memberships, ownerDemoMemberships])

  // The Owner enters a real Demo organization: their own (enterPlatformDemo) or
  // an evaluator's (enterDemoOrganization).
  const enterDemoOrganization = useCallback(async (organizationId: string | null | undefined) => {
    if (!profile?.isPlatformOwner || !organizationId) return false
    const demoMembership = await getPlatformOwnerDemoMembership(organizationId)
    if (!demoMembership) return false
    flushSync(() => {
      setOwnerDemoMemberships((current) => [...current.filter((item) => item.id !== demoMembership.id), demoMembership])
      setPlatformDemoMode(false)
      setActiveMembershipId(demoMembership.id)
      setRolePreview(null)
    })
    return true
  }, [profile?.isPlatformOwner])
  // The browser-only sample hospital (fixtures). The Help Center's owner preview
  // has no database, so it is what "Demo" opens there.
  const enterSampleDemo = useCallback(() => {
    if (!profile?.isPlatformOwner) return false
    setPlatformDemoMode(true); setActiveMembershipId(null); setRolePreview(null)
    return true
  }, [profile?.isPlatformOwner])
  const enterPlatformDemo = useCallback(async () => {
    if (!profile?.isPlatformOwner) return false
    if (isOwnerPreview()) return enterSampleDemo()
    return enterDemoOrganization(await openPlatformOwnerDemo())
  }, [profile?.isPlatformOwner, enterDemoOrganization, enterSampleDemo])
  const returnToPlatform = useCallback(() => {
    if (profile?.isPlatformOwner) { setPlatformDemoMode(false); setActiveMembershipId(null); setRolePreview(null) }
  }, [profile?.isPlatformOwner])

  const tenantLoading = Boolean(authLoading || loading || hydratedKey !== membershipContextKey)

  const value = useMemo<TenantContextValue>(() => ({
    tenant,
    membership,
    memberships,
    activeMembershipId,
    role,
    loading: tenantLoading,
    isDemo: Boolean(isDemoSession || platformDemoMode || tenant?.mode === 'demo'),
    operatingProfile: normalizeProfile(tenant),
    moduleEnabled: (module: string) => !tenant || organizationModuleEnabled(tenant, module),
    setTenantByMembership,
    enterPlatformDemo,
    enterSampleDemo,
    enterDemoOrganization,
    returnToPlatform,
    reloadMemberships,
    actualRole,
    rolePreview,
    canRolePreview,
    isRolePreview: Boolean(canRolePreview && rolePreview?.role),
    startRolePreview: (previewRole: string, department='', departmentName='') => {
      if (!canRolePreview || !isPreviewableRole(previewRole)) return false
      setRolePreview({role:previewRole,department,departmentName,division:'',divisionName:'',departmentIds:[]})
      return true
    },
    // The Division Director's preview: the division and the departments it covers.
    updateRolePreviewDivision: (division='', divisionName='', departmentIds: string[]=[]) => { if (canRolePreview) setRolePreview(current=>current?{...current,division,divisionName,departmentIds:[...departmentIds]}:current) },
    // The division a Division Director looks at (home «Διεύθυνση ▾»); in a preview, the previewed one.
    divisionId: canRolePreview && rolePreview?.role === ROLES.DIVISION_DIRECTOR ? (membership?.divisionId || null) : selectedDivision,
    selectDivision: setSelectedDivision,
    updateRolePreviewDepartment: (department='', departmentName='') => { if (canRolePreview) setRolePreview(current=>current?{...current,department,departmentName}:current) },
    stopRolePreview: () => setRolePreview(null),
    uxPolicy: uxPolicyFor(role),
    canAccessRecord: (record) => recordWithinRoleScope({role, membership, userId:user?.id, record}),
    canSeeSensitiveEmployeeHealth: canSeeSensitiveEmployeeHealth(role,membership?.capabilities,membership?.customCapabilities),
  }), [tenant, membership, memberships, activeMembershipId, role, actualRole, rolePreview, selectedDivision, tenantLoading, canRolePreview, setTenantByMembership, enterPlatformDemo, enterSampleDemo, enterDemoOrganization, returnToPlatform, reloadMemberships, user?.id, isDemoSession, platformDemoMode])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) throw new Error('useTenant must be used inside TenantProvider')
  return context
}
