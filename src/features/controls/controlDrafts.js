import { loadSnapshot, saveSnapshot } from '../../core/data/repository'

const table='control_drafts'
export const controlDraftKey=(controlId,department)=>`${controlId}.${department}`

function rows(){const value=loadSnapshot(table,[]);return Array.isArray(value)?value:[]}
export function getControlDraft(controlId,department){return rows().find(x=>x.recordKey===controlDraftKey(controlId,department))||null}
export function saveControlDraft(controlId,department,payload){
 const recordKey=controlDraftKey(controlId,department)
 const draft={...payload,recordKey,controlId,department,savedAt:new Date().toISOString(),status:'temporary'}
 saveSnapshot(table,[...rows().filter(x=>x.recordKey!==recordKey),draft])
 return draft
}
export function removeControlDraft(controlId,department){
 const recordKey=controlDraftKey(controlId,department)
 saveSnapshot(table,rows().filter(x=>x.recordKey!==recordKey))
}
export function hasControlDraft(controlId,department){return Boolean(getControlDraft(controlId,department))}
