import { useEffect,useMemo,useState } from 'react'
import { useTenant } from '../../core/tenant/TenantContext'
import { useOptionalAuth } from '../../core/auth/AuthContext'
import { uxPolicyFor } from '../../core/permissions/roleUxPolicy'
import { SCOPES } from '../../core/permissions/accessModel'
import { loadDepartments } from '../management/departmentsService'
import { DEMO_SELF_EMPLOYEE_ID } from '../employees/employeeIdentity'
import { calendarScopeFor,type CalendarScope } from './calendarView'

// The calendar's scope for the signed-in user (calendarScopeFor): the Calendar, the department's calendar and the homes.
// «Mine» is the user's account in a hospital and the sample data's own employee in the Demo («Η καρτέλα μου»).
// A previewed Division Director of a hospital carries the ids of the division's departments only: their names are read once.
export function useCalendarScope(): CalendarScope{
 const {tenant,role,membership,isDemo}=useTenant()
 // A screen rendered without the sign-in above it has no account: nothing is «mine» then.
 const auth=useOptionalAuth()
 const userId=auth?.profile?.id||auth?.user?.id||null
 const scoped=uxPolicyFor(role).scope===SCOPES.DEPARTMENT
 const sample=Boolean(membership?.previewDepartment||Array.isArray(membership?.previewDepartments))
 const ids=useMemo(()=>(membership?.departmentIds||[]).filter(Boolean),[membership?.departmentIds])
 const known=new Set([...(membership?.departmentNames||[]),membership?.departmentName].filter(Boolean)).size
 const needsNames=scoped&&!sample&&!isDemo&&Boolean(tenant?.id)&&ids.length>known
 const [names,setNames]=useState<string[]>([])
 useEffect(()=>{
  if(!needsNames){setNames([]);return undefined}
  let active=true
  loadDepartments(tenant?.id).then(rows=>{if(active)setNames((rows||[]).filter(row=>ids.includes(row.id)).map(row=>row.name))}).catch(()=>{if(active)setNames([])})
  return()=>{active=false}
 },[needsNames,tenant?.id,ids])
 // The hospital committees: only where the database loaded them for this person (not in a preview, not in the sample data).
 return useMemo(()=>calendarScopeFor({role,membership,userId:isDemo?null:userId,employeeId:isDemo?DEMO_SELF_EMPLOYEE_ID:null,departmentNames:names}),[role,membership,userId,isDemo,names])
}
