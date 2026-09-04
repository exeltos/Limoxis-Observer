import { Activity, BarChart3, Beaker, BookOpenCheck, Building2, ClipboardCheck, FileText, GraduationCap, HeartPulse, Home, LayoutDashboard, Pill, ShieldCheck, Sparkles, Stethoscope, Users } from 'lucide-react'
import { CAPABILITIES, MANAGEMENT_CAPABILITIES, ROLES, can, canAny } from '../core/permissions/roles'

// Canonical destinations. Visibility still comes from capabilities; placement in
// the sidebar is resolved separately per role so changing one role's menu does
// not silently rearrange every other role.
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

const roleMenuPolicy=Object.freeze({
  [ROLES.HOSPITAL_ADMIN]:Object.freeze({
    more:new Set(['platformAnalyticsNav','indicators','training','committees','documents','lira']),
    hidden:new Set(['pharmacy','occupationalHealth']),
  }),
  [ROLES.INFECTION_CONTROL_LEAD]:Object.freeze({
    more:new Set(['platformAnalyticsNav','indicators','training','committees','documents','lira']),
    hidden:new Set(['pharmacy','occupationalHealth']),
  }),
})

function applyRoleMenuPolicy(role,items){
  const policy=roleMenuPolicy[role]
  if(!policy)return items
  return items
    .filter(item=>!policy.hidden.has(item.key))
    .map(item=>policy.more.has(item.key)?{...item,group:'more'}:{...item,group:undefined})
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
