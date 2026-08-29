import { auditActorFromAuth } from './actor'

export const LIFECYCLE_STATUS={
  ACTIVE:'active',
  FINALIZED:'finalized',
  CORRECTION:'correction',
  VOIDED:'voided',
}

function actorSafe(actor){
  return actor?.name?actor:auditActorFromAuth({})
}

export function lifecycleEvent(action,{actor,reason='',at=new Date().toISOString(),detail=null}={}){
  const a=actorSafe(actor)
  return {at,actor:a.name,actorId:a.id,action,reason,detail}
}

export function openCorrection(record,{actor,reason,historyKey='history',at=new Date().toISOString()}={}){
  const a=actorSafe(actor)
  const event=lifecycleEvent('correctionOpened',{actor:a,reason,at})
  return {
    ...record,
    lifecycleStatus:LIFECYCLE_STATUS.CORRECTION,
    correctionOpenedAt:at,
    correctionOpenedBy:a.name,
    correctionOpenedById:a.id,
    correctionReason:reason,
    updatedAt:at,updatedBy:a.name,updatedById:a.id,
    [historyKey]:[event,...(record?.[historyKey]||[])],
  }
}

export function voidRecord(record,{actor,reason,historyKey='history',at=new Date().toISOString()}={}){
  const a=actorSafe(actor)
  const event=lifecycleEvent('recordVoided',{actor:a,reason,at})
  return {
    ...record,
    lifecycleStatus:LIFECYCLE_STATUS.VOIDED,
    voidedAt:at,voidedBy:a.name,voidedById:a.id,voidReason:reason,
    updatedAt:at,updatedBy:a.name,updatedById:a.id,
    [historyKey]:[event,...(record?.[historyKey]||[])],
  }
}

export function finalizeRecord(record,{actor,historyKey='history',reason='',at=new Date().toISOString()}={}){
  const a=actorSafe(actor)
  const event=lifecycleEvent('recordFinalized',{actor:a,reason,at})
  return {
    ...record,
    lifecycleStatus:LIFECYCLE_STATUS.FINALIZED,
    finalizedAt:at,finalizedBy:a.name,finalizedById:a.id,
    updatedAt:at,updatedBy:a.name,updatedById:a.id,
    [historyKey]:[event,...(record?.[historyKey]||[])],
  }
}
