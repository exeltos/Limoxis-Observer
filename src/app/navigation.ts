import { Activity, Award, CalendarClock, Target, Truck, BarChart3, Beaker, BookOpenCheck, Building2, CalendarCheck, CalendarDays, CalendarRange, ChefHat, ClipboardCheck, ClipboardList, FileText, ListChecks, Gauge, GraduationCap, Home, LayoutDashboard, LibraryBig, LineChart, MessagesSquare, Network, Pill, ShieldCheck, Stethoscope, UserSearch, Users } from 'lucide-react'
import { CAPABILITIES, MANAGEMENT_CAPABILITIES, ROLES, can, canAny, isProfileDisabled } from '../core/permissions/roles'
import { sectionTabsFor } from '../core/navigation/sectionTabs'

const preventionAccessCapabilities=[
  CAPABILITIES.VIEW_PREVENTION,
  CAPABILITIES.RECORD_HAND_HYGIENE,
  CAPABILITIES.RECORD_WASTE,
  CAPABILITIES.RECORD_ANTISEPTIC,
  CAPABILITIES.RECORD_PREVENTION_BUNDLE,
]

const calendarCapabilities=[
  CAPABILITIES.VIEW_CONTROLS,
  CAPABILITIES.VIEW_QUALITY,
  CAPABILITIES.VIEW_TRAINING,
  CAPABILITIES.VIEW_DOCUMENTS,
  CAPABILITIES.VIEW_COMMITTEES,
  CAPABILITIES.VIEW_KITCHEN,
]

const kitchenCapabilities=[CAPABILITIES.VIEW_KITCHEN,CAPABILITIES.RECORD_KITCHEN,CAPABILITIES.MANAGE_KITCHEN]

// Canonical destinations. Visibility comes from capabilities; sidebar placement
// and ordering are resolved separately per role so each workspace reflects the
// user's actual operational priorities without duplicating feature code.
export const navigation=[
  // «Δείκτες» (Indicators) is the executive dashboard for whoever may open it; «Αρχική» (Home) is the dashboard.
  {to:'/executive',key:'executiveDashboard',label:'sidebarNav.indicators',icon:Gauge,capability:CAPABILITIES.VIEW_EXECUTIVE_DASHBOARD},
  {to:'/',key:'dashboard',label:'sidebarNav.home',icon:LayoutDashboard,capability:CAPABILITIES.VIEW_DASHBOARD,excludeRoles:[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE]},
  {to:'/my-department',key:'myDepartment',icon:Home,capability:CAPABILITIES.VIEW_MY_DEPARTMENT,roles:[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE]},
  // «Τμήματα Διεύθυνσης»: the Division Director's departments, one row each (read only).
  {to:'/division',key:'divisionDepartments',label:'sidebarNav.divisionDepartments',icon:Network,capability:CAPABILITIES.VIEW_MY_DEPARTMENT,roles:[ROLES.DIVISION_DIRECTOR]},
  // «Επιτήρηση» (Surveillance): the patient registry, the surveillance episodes and the outbreak investigations, one section with tabs.
  {to:'/surveillance',key:'surveillance',label:'sidebarNav.surveillanceSection',icon:Activity,capability:CAPABILITIES.VIEW_SURVEILLANCE,section:'surveillance'},
  {to:'/laboratory',key:'laboratory',icon:Beaker,capability:CAPABILITIES.VIEW_LAB},
  {to:'/prevention',key:'prevention',icon:ShieldCheck,capability:CAPABILITIES.VIEW_PREVENTION,anyCapabilities:preventionAccessCapabilities},
  {to:'/controls',key:'controls',icon:ClipboardCheck,capability:CAPABILITIES.VIEW_CONTROLS},
  // «Καλλιέργειες» (Culture programme): an entry of its own under «Controls» (indented), for the infection control lead and the administrator.
  {to:'/controls/cultures',key:'cultureProgramme',label:'sidebarNav.culturesShort',icon:CalendarRange,capability:CAPABILITIES.VIEW_CONTROLS,roles:[ROLES.PLATFORM_OWNER,ROLES.HOSPITAL_ADMIN,ROLES.DEMO,ROLES.INFECTION_CONTROL_LEAD],parent:'controls'},
  {to:'/quality',key:'quality',icon:Award,capability:CAPABILITIES.VIEW_QUALITY},
  // «Indicators & objectives» of the Quality Center on its own page: indicators, registers, objectives, surveys.
  {to:'/quality/measures',key:'qualityMeasures',label:'sidebarNav.qualityMeasures',icon:Target,capability:CAPABILITIES.VIEW_QUALITY},
  // No «Incident reports» entry: the report form and «My reports» open from the button at the foot of the sidebar (route /quality/my-reports).
  // Department staff record their registers (NICU cases, monthly sheets) here; Quality opens them from its Center.
  // The Division Director reads the registers of the division's departments here, not in the Quality Center.
  {to:'/registers',key:'departmentRegisters',label:'sidebarNav.departmentRegisters',icon:ClipboardList,capability:CAPABILITIES.VIEW_MY_DEPARTMENT,roles:[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE,ROLES.DIVISION_DIRECTOR],unlessCapability:CAPABILITIES.VIEW_QUALITY,keepForRoles:[ROLES.DIVISION_DIRECTOR]},
  // The suppliers the Quality team assigned to the department (read only).
  {to:'/my-department/suppliers',key:'departmentSuppliers',label:'sidebarNav.departmentSuppliers',icon:Truck,capability:CAPABILITIES.VIEW_MY_DEPARTMENT,roles:[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE],unlessCapability:CAPABILITIES.VIEW_QUALITY},
  // The self-assessments the Quality team released to the department (a preparation for the audit).
  // The department's own calendar: what concerns the department (the culture sampling first), month by month.
  {to:'/my-department/calendar',key:'departmentCalendar',label:'sidebarNav.departmentCalendar',icon:CalendarCheck,capability:CAPABILITIES.VIEW_MY_DEPARTMENT,roles:[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE],unlessCapability:CAPABILITIES.VIEW_QUALITY},
  // The department's meetings: topics discussed, decisions and the training that came up.
  {to:'/my-department/meetings',key:'departmentMeetings',label:'sidebarNav.departmentMeetings',icon:MessagesSquare,capability:CAPABILITIES.VIEW_MY_DEPARTMENT,roles:[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE],unlessCapability:CAPABILITIES.VIEW_QUALITY},
  {to:'/my-department/self-assessment',key:'departmentSelfAssessment',label:'sidebarNav.departmentSelfAssessment',icon:ListChecks,capability:CAPABILITIES.VIEW_MY_DEPARTMENT,roles:[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE],unlessCapability:CAPABILITIES.VIEW_QUALITY},
  {to:'/employees',key:'employees',icon:Users,capability:CAPABILITIES.VIEW_STAFF},
  // The department's monthly shift roster (owner, 8/11/2026): the manager makes it, the department reads it.
  // The shift roster (owner, 8/11/2026): its own entry for the department manager (who makes it) and the department's
  // people (the published roster and their requests), inside «Staff» for the administrator.
  // The Division Director reads the rosters and requests of the division's departments («Προγράμματα βαρδιών»).
  {to:'/rosters',key:'rosters',label:'sidebarNav.rosters',roleLabels:{[ROLES.DIVISION_DIRECTOR]:'sidebarNav.divisionRosters'},icon:CalendarClock,anyCapabilities:[CAPABILITIES.VIEW_MY_DEPARTMENT,CAPABILITIES.VIEW_STAFF],roles:[ROLES.PLATFORM_OWNER,ROLES.HOSPITAL_ADMIN,ROLES.DEMO,ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.LINK_NURSE,ROLES.DIVISION_DIRECTOR]},
  {to:'/interviews',key:'interviews',icon:UserSearch,capability:CAPABILITIES.VIEW_INTERVIEWS,anyCapabilities:[CAPABILITIES.VIEW_INTERVIEWS,CAPABILITIES.VIEW_DIVISION_INTERVIEWS]},
  // The analysis is a set of tabs of «Δείκτες» for whoever has it; the others keep «Ανάλυση».
  {to:'/analysis',key:'platformAnalyticsNav',icon:BarChart3,capability:CAPABILITIES.VIEW_ANALYSIS,unlessCapability:CAPABILITIES.VIEW_EXECUTIVE_DASHBOARD},
  // Roles without the executive dashboard keep the indicators list as «Δείκτες»; for the others it is Management › Indicator definitions.
  {to:'/indicators',key:'indicators',icon:LineChart,capability:CAPABILITIES.VIEW_INDICATORS,unlessCapability:CAPABILITIES.VIEW_EXECUTIVE_DASHBOARD},
  {to:'/training',key:'training',icon:GraduationCap,capability:CAPABILITIES.VIEW_TRAINING},
  // «Συνεδριάσεις & αποφάσεις»: committees, department meetings and the management review.
  {to:'/meetings',key:'meetings',label:'sidebarNav.meetingsShort',icon:BookOpenCheck,capability:CAPABILITIES.VIEW_COMMITTEES,section:'meetings'},
  // «Έγγραφα & Κανονισμοί»: documents, regulations and legislation.
  {to:'/documents',key:'documents',label:'sidebarNav.documentsShort',icon:FileText,capability:CAPABILITIES.VIEW_DOCUMENTS,section:'documents'},
  // «Βιβλιοθήκη»: trusted sources (links, guidelines, clinical guides, news) for every role, staff users included.
  {to:'/library',key:'library',label:'libraryNav.menu',icon:LibraryBig,everyone:true},
  {to:'/kitchen',key:'kitchen',icon:ChefHat,capability:CAPABILITIES.VIEW_KITCHEN,anyCapabilities:kitchenCapabilities},
  {to:'/pharmacy',key:'pharmacy',icon:Pill,capability:CAPABILITIES.VIEW_PHARMACY},
  {to:'/occupational-health',key:'occupationalHealth',icon:Stethoscope,capability:CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH},
  {to:'/calendar',key:'calendar',icon:CalendarDays,capability:CAPABILITIES.VIEW_DOCUMENTS,anyCapabilities:calendarCapabilities},
  {to:'/management',key:'management',label:'sidebarNav.managementShort',icon:Building2,capability:CAPABILITIES.MANAGE_ORGANIZATION,anyCapabilities:MANAGEMENT_CAPABILITIES},
]

const policy=(primaryOrder=[],moreOrder=[],hidden=[])=>Object.freeze({
  primaryOrder,
  moreOrder,
  more:new Set(moreOrder),
  hidden:new Set(hidden),
})

// A grouped sidebar: headed groups that collapse, in place of «More».
// `groups` is [[groupId, [keys in order]], ...]; a visible entry no group names
// lands in a closing «More» group so nothing the role may open disappears.
const groupedPolicy=(groups,hidden=[])=>Object.freeze({
  groups:groups.map(([id,keys])=>Object.freeze({id,keys})),
  hidden:new Set(hidden),
})

// The headings of the sidebar groups (i18n keys). Any role family can use them.
export const NAV_GROUP_LABELS=Object.freeze({
  overview:'sidebarNav.groupOverview',
  clinical:'sidebarNav.groupClinical',
  operations:'sidebarNav.groupOperations',
  quality:'sidebarNav.groupQuality',
  staff:'sidebarNav.groupStaff',
  management:'sidebarNav.groupManagement',
  more:'sidebarNav.more',
})

// Hospital leadership (Administrator, Platform Owner inside a hospital).
const hospitalLeadershipGroups=[
  ['overview',['dashboard','executiveDashboard','indicators','platformAnalyticsNav','calendar']],
  ['clinical',['surveillance','laboratory','prevention','pharmacy']],
  ['operations',['controls','cultureProgramme','kitchen']],
  ['quality',['quality','qualityMeasures','meetings','documents','library']],
  ['staff',['employees','rosters','training','interviews','occupationalHealth']],
  ['management',['management']],
]

// Role-specific information architecture. Capabilities remain the source of
// truth for access; these policies only decide prominence, grouping and order.
// Each role's daily work comes first; the calendar closes the main list.
const roleMenuPolicy=Object.freeze({
  [ROLES.PLATFORM_OWNER]:groupedPolicy(hospitalLeadershipGroups),
  [ROLES.HOSPITAL_ADMIN]:groupedPolicy(hospitalLeadershipGroups),
  // The demo account sees every module: the same headed groups, so the menu never scrolls.
  [ROLES.DEMO]:groupedPolicy(hospitalLeadershipGroups),
  [ROLES.INFECTION_CONTROL_LEAD]:policy(
    ['dashboard','surveillance','laboratory','prevention','controls','cultureProgramme','indicators','meetings','calendar'],
    ['platformAnalyticsNav','quality','employees','training','documents','library','kitchen'],
    ['pharmacy','occupationalHealth'],
  ),
  [ROLES.INFECTION_CONTROL_MEMBER]:policy(
    ['dashboard','surveillance','laboratory','prevention','controls','calendar'],
    ['indicators','training','documents','library'],
    ['pharmacy','occupationalHealth','management'],
  ),
  [ROLES.LABORATORY]:policy(
    ['dashboard','laboratory','employees','controls','calendar'],
    ['documents','library'],
    ['management','pharmacy','occupationalHealth'],
  ),
  [ROLES.DEPARTMENT_MANAGER]:policy(
    ['myDepartment','departmentCalendar','departmentMeetings','rosters','controls','surveillance','laboratory','departmentRegisters','departmentSuppliers','departmentSelfAssessment','employees','calendar'],
    ['indicators','training','documents','library'],
    ['management','pharmacy','occupationalHealth'],
  ),
  [ROLES.LINK_NURSE]:policy(
    ['myDepartment','departmentCalendar','departmentMeetings','rosters','surveillance','prevention','controls','calendar'],
    ['employees','indicators','training','documents','library','laboratory','quality','meetings'],
    ['management','pharmacy','occupationalHealth'],
  ),
  [ROLES.DEPARTMENT_USER]:policy(
    ['myDepartment','departmentCalendar','departmentMeetings','rosters','controls','calendar'],
    ['training','documents','library','laboratory','quality','meetings'],
    ['management','pharmacy','occupationalHealth'],
  ),
  [ROLES.HR_OFFICE]:policy(
    ['dashboard','employees','interviews','training','calendar'],
    ['documents','library'],
    ['management','pharmacy','occupationalHealth'],
  ),
  [ROLES.OCCUPATIONAL_PHYSICIAN]:policy(
    ['dashboard','occupationalHealth','employees','calendar'],
    ['documents','library'],
    ['management','pharmacy'],
  ),
  [ROLES.QUALITY_MANAGER]:policy(
    ['dashboard','quality','qualityMeasures','controls','kitchen','indicators','documents','library','calendar'],
    ['meetings'],
    ['pharmacy','occupationalHealth'],
  ),
  [ROLES.PHARMACY]:policy(
    ['dashboard','pharmacy','indicators','calendar'],
    ['documents','library'],
    ['management','occupationalHealth'],
  ),
  [ROLES.DOCTOR_REVIEWER]:policy(
    ['dashboard','surveillance','laboratory','indicators','calendar'],
    ['library'],
    ['management','pharmacy','occupationalHealth'],
  ),
  // The Director works from the executive dashboard (it holds the analysis and the incident report).
  [ROLES.HOSPITAL_DIRECTOR]:policy(
    ['executiveDashboard','indicators','documents','library','calendar'],
    [],
    ['dashboard','platformAnalyticsNav','management','pharmacy','occupationalHealth'],
  ),
  // The Division Director: the division's departments, their rosters and staff, read only.
  [ROLES.DIVISION_DIRECTOR]:policy(
    ['dashboard','divisionDepartments','rosters','employees','training','interviews','calendar'],
    ['controls','departmentRegisters','quality','documents','library'],
    ['management','pharmacy','occupationalHealth','qualityMeasures'],
  ),
  [ROLES.COMMITTEE_SECRETARIAT]:policy(
    ['dashboard','meetings','documents','library','calendar'],
    [],
    ['management','pharmacy','occupationalHealth'],
  ),
})

// «Προσωπικό» (Staff): the staff screens stay separate pages but share one
// headed group for every role that sees two or more of them (grouped roles name it themselves).
const STAFF_KEYS=['employees','training','interviews','occupationalHealth']

// Roles whose «More» entries fold under one expandable entry; for the others
// they follow the main list.
const COMPACT_MORE_ROLES=new Set([ROLES.INFECTION_CONTROL_LEAD])

function orderByKeys(items,keys=[]){
  if(!keys.length)return items
  const rank=new Map(keys.map((key,index)=>[key,index]))
  return [...items].sort((a,b)=>{
    const aRank=rank.has(a.key)?rank.get(a.key):Number.MAX_SAFE_INTEGER
    const bRank=rank.has(b.key)?rank.get(b.key):Number.MAX_SAFE_INTEGER
    return aRank-bRank
  })
}

function applyGroupedPolicy(currentPolicy,items){
  const visible=items.filter(item=>!currentPolicy.hidden.has(item.key))
  const named=new Set(currentPolicy.groups.flatMap(group=>group.keys))
  const grouped=currentPolicy.groups.flatMap(group=>orderByKeys(visible.filter(item=>group.keys.includes(item.key)),group.keys).map(item=>({...item,group:group.id})))
  const rest=visible.filter(item=>!named.has(item.key)).map(item=>({...item,group:'more'}))
  // «More» closes the list, before the management group.
  const management=grouped.filter(item=>item.group==='management')
  return [...grouped.filter(item=>item.group!=='management'),...rest,...management]
}

// Two or more staff screens: one «Staff» group where the first of them stood,
// never inside «More» (from `limit`, the end of the main list, it closes the main list).
function groupStaff(ordered,limit){
  const staff=ordered.filter(item=>STAFF_KEYS.includes(item.key))
  if(staff.length<2)return ordered
  const at=Math.min(ordered.findIndex(item=>STAFF_KEYS.includes(item.key)),limit)
  const rest=ordered.filter(item=>!STAFF_KEYS.includes(item.key))
  const before=rest.filter(item=>ordered.indexOf(item)<at)
  const after=rest.filter(item=>ordered.indexOf(item)>=at)
  return [...before,...staff.map(item=>({...item,group:'staff'})),...after]
}

function applyRoleMenuPolicy(role,items){
  const currentPolicy=roleMenuPolicy[role]
  if(!currentPolicy){const management=items.filter(item=>item.key==='management');const rest=items.filter(item=>item.key!=='management');return [...groupStaff(rest,rest.length),...management]}
  if(currentPolicy.groups)return applyGroupedPolicy(currentPolicy,items)
  const visible=items.filter(item=>!currentPolicy.hidden.has(item.key))
  const primary=orderByKeys(
    visible.filter(item=>item.key!=='management'&&!currentPolicy.more.has(item.key)).map(item=>({...item,group:undefined})),
    currentPolicy.primaryOrder,
  )
  // The calendar closes the main list, also after items a policy does not name.
  primary.sort((a,b)=>(a.key==='calendar')-(b.key==='calendar'))
  const more=orderByKeys(
    visible.filter(item=>currentPolicy.more.has(item.key)).map(item=>({...item,group:'more'})),
    currentPolicy.moreOrder,
  )
  const management=visible.filter(item=>item.key==='management').map(item=>({...item,group:undefined}))
  return [...groupStaff([...primary,...more],primary.length),...management]
}

// One entry per destination: the department's calendar replaces the general one, and «Indicators & objectives» holds the indicators.
const SUPERSEDED=[['departmentCalendar','calendar'],['qualityMeasures','indicators']]

/** @param {{role?: string|null, addOns?: string[], customCapabilities?: string[], hasAssignments?: boolean}} [context] */
export function navigationFor({role,addOns=[],customCapabilities=[],hasAssignments=false}={}){
  const permitted=navigation.filter(item=>
    item.excludeRoles&&item.excludeRoles.includes(role)?false:
    item.roles&&!item.roles.includes(role)?false:
    // Open to every member of a hospital, whatever the role (no capability of its own).
    item.everyone?true:
    // A merged section is shown when at least one of its tabs is open to the role.
    item.section?sectionTabsFor(item.section,{role,addOns,customCapabilities}).length>0:
    isProfileDisabled(item.capability)?false:
    item.unlessCapability&&!item.keepForRoles?.includes(role)&&can(role,item.unlessCapability,addOns,customCapabilities)?false:
    item.key==='controls'&&hasAssignments?true:
    item.anyCapabilities?canAny(role,item.anyCapabilities,addOns,customCapabilities):
    can(role,item.capability,addOns,customCapabilities)
  )
  const keys=new Set(permitted.map(item=>item.key))
  const allowed=permitted.filter(item=>!SUPERSEDED.some(([by,gone])=>gone===item.key&&keys.has(by)))
  // An entry may read differently for one role (roleLabels).
  return applyRoleMenuPolicy(role,allowed.map(item=>item.roleLabels?.[role]?{...item,label:item.roleLabels[role]}:item))
}

// How the sidebar lays the menu out: blocks of
//   {kind:'group',id,label,items} — a headed group that collapses (grouped roles);
//   {kind:'list',items} — plain entries; {kind:'more',items} — the «More» entry;
//   {kind:'management',items} — the Management Center under its divider.
export function sidebarLayout(role,items=[]){
  if(roleMenuPolicy[role]?.groups){
    const order=[]
    for(const item of items)if(!order.includes(item.group))order.push(item.group)
    return order.map(id=>({kind:'group',id,label:NAV_GROUP_LABELS[id]||NAV_GROUP_LABELS.more,items:items.filter(item=>item.group===id)}))
  }
  const compact=COMPACT_MORE_ROLES.has(role)
  const blocks=[]
  for(const item of items){
    const kind=item.key==='management'?'management':item.group==='staff'?'group':compact&&item.group==='more'?'more':'list'
    const last=blocks[blocks.length-1]
    if(last&&last.kind===kind)last.items.push(item)
    else blocks.push(kind==='group'?{kind,id:'staff',label:NAV_GROUP_LABELS.staff,items:[item]}:{kind,items:[item]})
  }
  return blocks
}
