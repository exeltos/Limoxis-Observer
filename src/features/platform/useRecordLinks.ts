import { useCallback,useEffect,useMemo,useState } from 'react'
import { useLocation,useNavigate } from 'react-router-dom'
import { useTenant } from '../../core/tenant/TenantContext'
import { listPlatformUsers } from '../../core/tenant/tenantService'
import { buildUserIndex,findIndexedUser,organizationRecordTarget,userRecordTarget } from './platformOverviewShared'
import type { AnyRecord } from '../../types/featureTypes'

// The platform users, loaded once for a screen that shows people (sign-ins, history); null while loading.
export function usePlatformUsers(){
  const [users,setUsers]=useState<AnyRecord[] | null>(null)
  useEffect(()=>{let active=true;listPlatformUsers().then(rows=>{if(active)setUsers(rows||[])}).catch(()=>{if(active)setUsers([])});return()=>{active=false}},[])
  return users
}

// Links from any owner screen to a user record or an organization record, with Back returning to this screen.
// userOf(ref) is the user a reference ({userId} | {memberId} | {identifier}) names, or null when there is no record to open.
export function useRecordLinks({users,returnTo}: {users?: AnyRecord[] | null,returnTo?: string}={}){
  const navigate=useNavigate(),location=useLocation(),{memberships}=useTenant()
  const back=returnTo||`${location.pathname}${location.search}${location.hash}`
  const organizationIds=useMemo(()=>new Set<string>((memberships||[]).map(item=>item?.organization?.id).filter(Boolean)),[memberships])
  const index=useMemo(()=>buildUserIndex(users||[]),[users])
  const userOf=useCallback((ref: AnyRecord)=>{const user=findIndexedUser(index,ref||{});return user&&userRecordTarget(user,{returnTo:back,organizationIds})?user:null},[index,back,organizationIds])
  const openUser=useCallback((user: AnyRecord)=>{const target=userRecordTarget(user,{returnTo:back,organizationIds});if(target)navigate(target.to,{state:target.state})},[back,organizationIds,navigate])
  const canOpenOrganization=useCallback((id: string)=>Boolean(organizationRecordTarget(id,{returnTo:back,organizationIds})),[back,organizationIds])
  const openOrganization=useCallback((id: string)=>{const target=organizationRecordTarget(id,{returnTo:back,organizationIds});if(target)navigate(target.to,{state:target.state})},[back,organizationIds,navigate])
  return {userOf,openUser,canOpenOrganization,openOrganization}
}
