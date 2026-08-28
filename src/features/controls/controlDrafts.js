const PREFIX='limoxis.control.execution.'
export const controlDraftKey=(controlId,department)=>`${PREFIX}${controlId}.${department}`

export function getControlDraft(controlId,department){
 try{return JSON.parse(localStorage.getItem(controlDraftKey(controlId,department))||'null')}catch{return null}
}
export function saveControlDraft(controlId,department,payload){
 const draft={...payload,savedAt:new Date().toISOString(),status:'temporary'}
 localStorage.setItem(controlDraftKey(controlId,department),JSON.stringify(draft))
 return draft
}
export function removeControlDraft(controlId,department){
 localStorage.removeItem(controlDraftKey(controlId,department))
}
export function hasControlDraft(controlId,department){
 return Boolean(getControlDraft(controlId,department))
}
