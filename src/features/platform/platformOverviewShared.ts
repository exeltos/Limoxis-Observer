import type { Translate } from '../../types/featureTypes'
import type { OrganizationState, PlatformUserRef, SessionStart, UserIndex, UserRef } from './platformTypes'

// Οι χρήστες της πλατφόρμας ανά χρήστη, γραμμή μέλους και όνομα σύνδεσης (buildUserIndex).
export type { UserIndex }
type RecordTargetOptions = { returnTo?: string, organizationIds?: Set<string> | null }
// Shared by the Overview, the Organizations list and the organization record (Platform Owner):
// the initials avatar, «πριν από …» times, the one status of an organization and the latest sign-in per user.

// Two letters per organization: an abbreviation (Γ.Ν.) counts as one word, so «Γ.Ν. Κομοτηνής» is ΓΚ.
export const initialsOf=(name: string | null | undefined)=>String(name||'').split(/\s+/).map(word=>word.replace(/[^\p{L}]/gu,'')).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toLocaleUpperCase('el-GR')||'—'

export const sinceText=(value: string | null | undefined,tx: Translate)=>{if(!value)return tx('Καμία καταγραφή','No activity recorded');const minutes=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/60000));if(minutes<1)return tx('μόλις τώρα','just now');if(minutes<60)return tx(`πριν από ${minutes} λεπτά`,`${minutes} min ago`);const hours=Math.round(minutes/60);if(hours<24)return tx(`πριν από ${hours} ώρες`,`${hours} h ago`);const days=Math.round(hours/24);if(days===1)return tx('χθες','yesterday');return tx(`πριν από ${days} ημέρες`,`${days} days ago`)}

// [tone, label, key]: one status per organization (deletion, pause, inactive, admin pending, active).
export function statusOf(tx: Translate,organization: OrganizationState,adminStatus?: string | null): [string,string,string]{
  if(organization.deletion_scheduled_at)return ['danger',tx('Προς διαγραφή','Deletion scheduled'),'deletion']
  if(organization.status==='suspended'||organization.paused_at)return ['danger',tx('Σε παύση','Paused'),'paused']
  if(organization.status!=='active')return ['neutral',tx('Ανενεργός','Inactive'),'inactive']
  if(adminStatus==='invited')return ['warning',tx('Εκκρεμεί διαχειριστής','Admin pending'),'pending']
  return ['success',tx('Ενεργός','Active'),'active']
}

// The latest sign-in (session start) of each user, from listLoginSessions.
export function latestSessionByUser<S extends SessionStart>(sessions: S[]=[]){
  const latest=new Map<string, S>()
  for(const row of sessions){if(!row?.userId)continue;const current=latest.get(row.userId);if(!current||String(row.startedAt||'')>String(current.startedAt||''))latest.set(row.userId,row)}
  return latest
}

// One date format on every Platform Owner list: dd/mm/yyyy, hh:mm in Athens time (not the browser's time zone).
const ATHENS_PARTS=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
const athensParts=(value: unknown)=>{const date=new Date(value as string);if(!value||Number.isNaN(date.getTime()))return null;return Object.fromEntries(ATHENS_PARTS.formatToParts(date).map(part=>[part.type,part.value]))}
export const athensDateTime=(value: unknown)=>{const p=athensParts(value);return p?`${p.day}/${p.month}/${p.year}, ${p.hour}:${p.minute}`:'—'}
export const athensTime=(value: unknown)=>{const p=athensParts(value);return p?`${p.hour}:${p.minute}`:'—'}

// Where a person or an organization shown on any owner screen leads. A user opens the record under the organization
// the user belongs to (a Demo user: the Demo record, because a Demo is not in the organizations list); the Platform Owner
// has no record. «returnTo» is the screen to come back to with Back (userReturnTo is the user record's own Back).
export const userRecordPath=({organizationId,userId}: {organizationId?: string | null,userId?: string | null})=>organizationId&&userId?`/platform#organizations?organization=${organizationId}&tab=users&user=${userId}`:''
export const organizationRecordPath=(organizationId: string | null | undefined)=>organizationId?`/platform#organizations?organization=${organizationId}&tab=details`:''

export function userRecordTarget(user: PlatformUserRef | null | undefined,{returnTo='/platform#users',organizationIds=null}: RecordTargetOptions={}){
  const organizationId=user?.organization?.id
  if(!user?.userId||!organizationId||user.kind==='platform'||user.role==='platform_owner')return null
  const state={returnTo,userReturnTo:returnTo,fromUsers:true}
  if(!organizationIds||organizationIds.has(organizationId))return {to:userRecordPath({organizationId,userId:user.userId}),state}
  return user.demoId?{to:`/platform#demo?demo=${user.demoId}`,state:{returnTo}}:null
}

export function organizationRecordTarget(organizationId: string | null | undefined,{returnTo='/platform#organizations',organizationIds=null}: RecordTargetOptions={}){
  if(!organizationId||(organizationIds&&!organizationIds.has(organizationId)))return null
  return {to:organizationRecordPath(organizationId),state:{returnTo}}
}

// The platform users (listPlatformUsers) by user, by membership row and by username / e-mail, without the Platform Owner.
export function buildUserIndex<U extends PlatformUserRef>(users: (U | null | undefined)[]=[]): UserIndex<U>{
  const byUserId=new Map<string, U>(),byMemberId=new Map<string, U>(),byLogin=new Map<string, U>()
  for(const user of users){
    if(!user||user.kind==='platform'||user.role==='platform_owner'||!user.userId||!user.organization?.id)continue
    const current=byUserId.get(user.userId)
    if(!current||(current.kind==='demo'&&user.kind!=='demo'))byUserId.set(user.userId,user)
    if(user.id!=null)byMemberId.set(String(user.id),user)
    for(const key of [user.username,user.email]){const login=String(key||'').trim().toLowerCase();if(login&&!byLogin.has(login))byLogin.set(login,user)}
  }
  return {byUserId,byMemberId,byLogin}
}

// {userId} | {memberId} | {identifier: username or e-mail} → the user with a record, or null (plain text then).
export function findIndexedUser<U extends PlatformUserRef>(index: UserIndex<U>,{userId,memberId,identifier}: UserRef={}){
  if(userId&&index.byUserId.has(userId))return index.byUserId.get(userId)
  if(memberId&&index.byMemberId.has(String(memberId)))return index.byMemberId.get(String(memberId))
  const login=String(identifier||'').trim().toLowerCase()
  return login&&index.byLogin.get(login)||null
}
