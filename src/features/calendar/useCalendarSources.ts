import { useEffect,useState } from 'react'
import { CAPABILITIES } from '../../core/permissions/roles'
import { loadControlProgramme } from '../controls/controlCloudService'
import { loadQualityRecords } from '../quality/qualityService'
import { loadTrainingCalendarAsync } from '../training/trainingService'
import { groupDocumentFamilies,loadDocumentsAsync } from '../documents/documentService'
import { loadCommitteesAsync } from '../committees/committeeService'
import { loadMeetingGroups, loadMeetings } from '../quality/meetings/meetingService'
import { groupStatus } from '../quality/meetings/meetingModel'
import { loadProtocolSuggestionsAsync } from '../documents/protocolReview/protocolReviewService'
import { loadSupplierSchedule } from '../quality/resources/resourceService'
import { withSupplierStatus } from '../quality/resources/resourceModel'
import { loadKitchen } from '../kitchen/kitchenService'
import { addDays, kitchenCalendarItems, todayKey } from '../kitchen/kitchenModel'
import { CALENDAR_KINDS, type CalendarSources } from './calendarEvents'
import type { AnyRecord } from '../../types/featureTypes'

// What the calendar reads, for the Calendar and for the home's «Next 7 days»: each source only when the user may see it.
export const KIND_CAPABILITY: Record<string, string>={controls:CAPABILITIES.VIEW_CONTROLS,cultures:CAPABILITIES.VIEW_CONTROLS,capa:CAPABILITIES.VIEW_QUALITY,audits:CAPABILITIES.VIEW_QUALITY,training:CAPABILITIES.VIEW_TRAINING,documents:CAPABILITIES.VIEW_DOCUMENTS,committees:CAPABILITIES.VIEW_COMMITTEES,suppliers:CAPABILITIES.VIEW_QUALITY,kitchen:CAPABILITIES.VIEW_KITCHEN}
// The culture calendar is for whoever sees the Quality Center (or the controls): it shows that one source only.
export const calendarKindsFor=(mayDo: (capability: string) => boolean)=>CALENDAR_KINDS.filter(kind=>mayDo(KIND_CAPABILITY[kind])||(kind==='committees'&&mayDo(CAPABILITIES.VIEW_MY_DEPARTMENT)))

export function useCalendarSources(organizationId: string | null | undefined,allowedKinds: readonly string[],language: string,{enabled=true}={}){
 const [sources,setSources]=useState<CalendarSources|null>(null)
 useEffect(()=>{
  if(!enabled)return undefined
  let active=true
  const allowed=new Set(allowedKinds)
  const safe=<T,>(kind: string,load: () => Promise<T>,fallback: T): Promise<T>=>allowed.has(kind)?load().catch(()=>fallback):Promise.resolve(fallback)
  Promise.all([
   (allowed.has('controls')||allowed.has('cultures'))?loadControlProgramme(organizationId).catch(()=>[]):Promise.resolve([]),
   safe('capa',()=>loadQualityRecords('capas',organizationId),[]),
   safe('audits',()=>loadQualityRecords('audits',organizationId),[]),
   safe('training',()=>loadTrainingCalendarAsync(organizationId),null),
   safe('documents',()=>loadDocumentsAsync(organizationId),[]),
   safe('committees',()=>loadCommitteesAsync(organizationId),[]),
   // The department meeting groups: when each department's next meeting is due.
   safe('committees',()=>Promise.all([loadMeetingGroups(organizationId),loadMeetings(organizationId)]).then(([groups,meetings])=>groups.map((group: AnyRecord)=>{const status=groupStatus(group,meetings,todayKey());return {group,nextDue:status.nextDue,upcoming:status.meetings.filter(meeting=>meeting.status==='draft'&&String(meeting.meetingDate)>=todayKey())}})),[]),
   safe('documents',()=>loadProtocolSuggestionsAsync(organizationId),[]),
   safe('suppliers',()=>loadSupplierSchedule(organizationId).then(({suppliers,templates})=>withSupplierStatus(suppliers,[],undefined,templates)),[]),
   // The kitchen's calendar items reach back 30 days (verification, out of limits) and forward (plan, expiry): only that window is read.
   safe('kitchen',()=>loadKitchen(organizationId,{since:addDays(todayKey(),-30)}).then(state=>kitchenCalendarItems(state,{language})),[]),
  ]).then(([controls,capas,audits,training,documents,committees,meetingGroups,protocolSuggestions,suppliers,kitchen])=>{
   if(active)setSources({controls:controls||[],capas,audits,training,documentFamilies:groupDocumentFamilies(documents),committees,meetingGroups,protocolSuggestions,suppliers,kitchen})
  })
  return()=>{active=false}
 },[organizationId,allowedKinds,language,enabled])
 return sources
}
