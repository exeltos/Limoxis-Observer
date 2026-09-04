import { Activity, BarChart3, Beaker, BookOpenCheck, Building2, ClipboardCheck, FileText, GraduationCap, HeartPulse, Home, LayoutDashboard, Pill, ShieldCheck, Sparkles, Stethoscope, Users } from 'lucide-react'
import { CAPABILITIES, MANAGEMENT_CAPABILITIES, ROLES, can, canAny } from '../core/permissions/roles'

// Canonical destinations. Visibility comes from capabilities; sidebar placement
// and ordering are resolved separately per role so each workspace reflects the
// user's actual operational priorities without duplicating feature code.
export const navigation=[
  {to:'/',key:'dashboard',icon:LayoutDashboard,capability:CAPABILITIES.VIEW_DASHBOARD,excludeRoles:[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE]},
  {to:'/my-department',key:'myDepartment',icon:Home,capability:CAPABILITIES.VIEW_MY_DEPARTMENT,roles:[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE]},
  {to:'/surveillance',key:'surveillance',icon:Activity,capability:CAPABILITIES.VIEW_SURVEILLANCE},
  {to:'/patients',key:'patients',icon:HeartPulse,capability:CAPABILITIES.VIEW_PATIENTS},
  {to:'/laboratory',key:'laboratory',icon:Beaker,capability:CAPABILITIES.VIEW_LAB},
  {to:'/prevention',key:'prevention',icon:ShieldCheck,capability:CAPABILITIES.VIEW_PREVENTION},
  {to:'/controls',key:'controls',icon:ClipboardCheck,capability:CAPABILITIES.VIEW_CONTROLS},
  {to:'/quality',key:'quality',icon:HeartPulse,capability:CAPABILITIES.VIEW_QUALITY},
  {to:'/employees',key:'employees',icon:Users,capability:CAPABILITIES.VIEW_STAFF},
  {to:'/analysis',key:'platformAnalyticsNav',icon:BarChart3,capability:CAPABILITIES.VIEW_ANALYSIS},
  {to:'/indicators',key:'indicators',icon:BarChart3,capability:CAPABILITIES.VIEW_INDICATORS},
  {to:'/training',key:'training',icon:GraduationCap,capability:CAPABILITIES.VIEW_TRAINING},
  {to:'/committees',key:'committees',icon:BookOpenCheck,capability:CAPABILITIES.VIEW_COMMITTEES},
  {to:'/documents',key:'documents',icon:FileText,capability:CAPABILITIES.VIEW_DOCUMENTS},
  {to:'/pharmacy',key:'pharmacy',icon:Pill,capability:CAPABILITIES.VIEW_PHARMACY},
  {to:'/occupational-health',key:'occupationalHealth',icon:Stethoscope,capability:CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH},
  {to:'/lira',key:'lira',icon:Sparkles,capability:CAPABILITIES.VIEW_LIRA},
  {to:'/management',key:'management',icon:Building2,capability:CAPABILITIES.MANAGE_ORGANIZATION,anyCapabilities:MANAGEMENT_CAPABILITIES},
]

const policy=(primaryOrder=[],moreOrder=[],hidden=[])=>Object.freeze({
  primaryOrder,
  moreOrder,
  more:new Set(moreOrder),
  hidden:new Set(hidden),
})

// Role-specific information architecture. Capabilities remain the source of
// truth for access; these policies only decide prominence, grouping and order.
const roleMenuPolicy=Object.freeze({
  [ROLES.HOSPITAL_ADMIN]:policy(
    ['dashboard','surveillance','patients','laboratory','prevention','controls','quality','employees'],
    ['platformAnalyticsNav','indicators','lira','training','committees','documents'],
    ['pharmacy','occupationalHealth'],
  ),
  [ROLES.INFECTION_CONTROL_LEAD]:policy(
    ['dashboard','surveillance','patients','laboratory','prevention','controls','indicators','committees'],
    ['platformAnalyticsNav','lira','quality','employees','training','documents'],
    ['pharmacy','occupationalHealth'],
  ),
  [ROLES.INFECTION_CONTROL_MEMBER]:policy(
    ['dashboard','surveillance','patients','laboratory','prevention','controls'],
    ['indicators','training','documents'],
    ['pharmacy','occupationalHealth','management'],
  ),
  [ROLES.LABORATORY]:policy(
    ['dashboard','laboratory','employees','controls'],
    ['documents'],
    ['management','pharmacy','occupationalHealth'],
  ),
  [ROLES.DEPARTMENT_MANAGER]:policy(
    ['myDepartment','employees','controls','surveillance','patients'],
    ['indicators','training','documents'],
    ['management','pharmacy','occupationalHealth'],
  ),
  [ROLES.LINK_NURSE]:policy(
    ['myDepartment','surveillance','patients','prevention','controls'],
    ['employees','indicators','training','documents','lira','laboratory','quality','committees'],
    ['management','pharmacy','occupationalHealth'],
  ),
  [ROLES.DEPARTMENT_USER]:policy(
    ['myDepartment','controls'],
    ['training','documents','lira','laboratory','quality','committees'],
    ['management','pharmacy','occupationalHealth'],
  ),
  [ROLES.HR_OFFICE]:policy(
    ['dashboard','employees','training'],
    ['documents'],
    ['management','pharmacy','occupationalHealth'],
  ),
  [ROLES.OCCUPATIONAL_PHYSICIAN]:policy(
    ['dashboard','occupationalHealth','employees'],
    ['documents'],
    ['management','pharmacy'],
  ),
  [ROLES.QUALITY_MANAGER]:policy(
    ['dashboard','quality','controls','indicators','documents'],
    ['committees'],
    ['pharmacy','occupationalHealth'],
  ),
  [ROLES.PHARMACY]:policy(
    ['dashboard','pharmacy','indicators'],
    ['documents'],
    ['management','occupationalHealth'],
  ),
  [ROLES.DOCTOR_REVIEWER]:policy(
    ['dashboard','patients','surveillance','laboratory','indicators'],
    [],
    ['management','pharmacy','occupationalHealth'],
  ),
  [ROLES.COMMITTEE_SECRETARIAT]:policy(
    ['dashboard','committees','documents'],
    [],
    ['management','pharmacy','occupationalHealth'],
  ),
})

function orderByKeys(items,keys=[]){
  if(!keys.length)return items
  const rank=new Map(keys.map((key,index)=>[key,index]))
  return [...items].sort((a,b)=>{
    const aRank=rank.has(a.key)?rank.get(a.key):Number.MAX_SAFE_INTEGER
    const bRank=rank.has(b.key)?rank.get(b.key):Number.MAX_SAFE_INTEGER
    return aRank-bRank
  })
}

function applyRoleMenuPolicy(role,items){
  const currentPolicy=roleMenuPolicy[role]
  if(!currentPolicy)return items
  const visible=items.filter(item=>!currentPolicy.hidden.has(item.key))
  const primary=orderByKeys(
    visible.filter(item=>item.key!=='management'&&!currentPolicy.more.has(item.key)).map(item=>({...item,group:undefined})),
    currentPolicy.primaryOrder,
  )
  const more=orderByKeys(
    visible.filter(item=>currentPolicy.more.has(item.key)).map(item=>({...item,group:'more'})),
    currentPolicy.moreOrder,
  )
  const management=visible.filter(item=>item.key==='management').map(item=>({...item,group:undefined}))
  return [...primary,...more,...management]
}

export function navigationFor({role,addOns=[],customCapabilities=[],hasAssignments=false}={}){
  const allowed=navigation.filter(item=>
    item.excludeRoles&&item.excludeRoles.includes(role)?false:
    item.roles&&!item.roles.includes(role)?false:
    item.key==='controls'&&hasAssignments?true:
    item.anyCapabilities?canAny(role,item.anyCapabilities,addOns,customCapabilities):
    can(role,item.capability,addOns,customCapabilities)
  )
  return applyRoleMenuPolicy(role,allowed)
}
