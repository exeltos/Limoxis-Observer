import { auditActorFromAuth, type AuditActor } from './actor'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a record of any module
type LifecycleRecord = Record<string, any>

interface LifecycleOptions {
  actor?: Partial<AuditActor> | null
  reason?: string
  historyKey?: string
  at?: string
  detail?: unknown
}

const LIFECYCLE_STATUS={
  ACTIVE:'active',
  FINALIZED:'finalized',
  CORRECTION:'correction',
  VOIDED:'voided',
}

function actorSafe(actor: Partial<AuditActor> | null | undefined): AuditActor{
  return actor?.name?actor as AuditActor:auditActorFromAuth({})
}

function lifecycleEvent(action: string,{actor,reason='',at=new Date().toISOString(),detail=null}: LifecycleOptions={}){
  const a=actorSafe(actor)
  return {at,actor:a.name,actorId:a.id,action,reason,detail}
}

export function openCorrection(record: LifecycleRecord | null | undefined,{actor,reason,historyKey='history',at=new Date().toISOString()}: LifecycleOptions={}): LifecycleRecord{
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

export function voidRecord(record: LifecycleRecord | null | undefined,{actor,reason,historyKey='history',at=new Date().toISOString()}: LifecycleOptions={}): LifecycleRecord{
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

export function finalizeRecord(record: LifecycleRecord | null | undefined,{actor,historyKey='history',reason='',at=new Date().toISOString()}: LifecycleOptions={}): LifecycleRecord{
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
