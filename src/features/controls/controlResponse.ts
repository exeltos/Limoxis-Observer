// A department's own limits and deviation text. A control that several departments share keeps one
// response_config; an assignment may carry what differs for its department (response_override):
// min and max (an empty one means no limit there) and deviationActions.
const numberText=value=>value===''||value==null?'':String(value).trim()
const KEYS=['min','max','deviationActions']

export function assignmentOverride(record,department){
 return record?.assignments?.[department]?.responseOverride||null
}

// The response settings that apply in a department: the control's, with the department's own on top.
export function assignmentResponse(record,department){
 const base=record?.responseConfig||{}
 const own=assignmentOverride(record,department)
 if(!own)return base
 const merged={...base}
 for(const key of KEYS)if(own[key]!==undefined)merged[key]=own[key]
 return merged
}

// What is saved for a department: only the keys that differ from the control's; null = the control's.
export function cleanDepartmentResponse(own,base){
 if(!own||typeof own!=='object')return null
 const cleaned={}
 for(const key of ['min','max']){
  if(own[key]===undefined)continue
  const value=numberText(own[key])
  if(value!==numberText(base?.[key]))cleaned[key]=value===''?'':Number(value)
 }
 if(own.deviationActions!==undefined){
  const text=String(own.deviationActions||'').trim()
  if(text&&text!==String(base?.deviationActions||'').trim())cleaned.deviationActions=text
 }
 return Object.keys(cleaned).length?cleaned:null
}

// «0–25 °C», «≥ 18 °C», «≤ 25 °C» or an empty text when the department has no limit.
export function limitsText(response){
 const min=numberText(response?.min),max=numberText(response?.max)
 const unit=response?.unit?` ${response.unit}`:''
 if(min!==''&&max!=='')return `${min} – ${max}${unit}`
 if(min!=='')return `≥ ${min}${unit}`
 if(max!=='')return `≤ ${max}${unit}`
 return ''
}

// How many different limit/deviation settings the departments of a control have.
export function responseVariants(record,departments){
 const list=departments?.length?departments:Object.keys(record?.assignments||{})
 return new Set(list.map(department=>{
  const response=assignmentResponse(record,department)
  return JSON.stringify([numberText(response.min),numberText(response.max),String(response.deviationActions||'').trim()])
 })).size
}
