const AVAILABILITY_ORDER={required:0,recommended:1,available:2}

export function patientAgeYears(dateOfBirth,now=new Date()){
 if(!dateOfBirth)return null
 const birth=new Date(dateOfBirth)
 if(Number.isNaN(birth.getTime()))return null
 let age=now.getFullYear()-birth.getFullYear()
 const beforeBirthday=now.getMonth()<birth.getMonth()||(now.getMonth()===birth.getMonth()&&now.getDate()<birth.getDate())
 if(beforeBirthday)age-=1
 return Math.max(0,age)
}

const normalized=x=>String(x||'').trim().toLowerCase()
const populationForAge=age=>age==null?null:age<1?'neonatal':age<18?'pediatric':'adult'
const settingAliases={
 icu:['icu','intensive care','μεθ'],
 ward:['ward','acute_care','general','clinic','general ward','κλινικη','κλινική','γενικη','γενική'],
 ed:['ed','emergency','τεπ'],
 pediatric_ward:['pediatric_ward','pediatric ward','pediatric','paediatric','picu','παιδιατρικη','παιδιατρική'],
 pediatric_ed:['pediatric_ed','pediatric emergency','παιδιατρικο τεπ','παιδιατρικό τεπ'],
 maternity:['maternity','μαιευτικη','μαιευτική'],
 postnatal:['postnatal','λοχεια','λοχεία'],
 neonatal:['neonatal','nicu','μενν']
}
const matchesSetting=(definition,admission)=>{
 const settings=(definition.settings||[]).map(normalized).filter(Boolean)
 if(!settings.length)return true
 const values=[admission?.care_setting,admission?.setting,admission?.department_type,admission?.department_name,admission?.department?.name,admission?.department?.type].map(normalized).filter(Boolean)
 return !values.length||settings.some(setting=>{const aliases=settingAliases[setting]||[setting];return aliases.some(alias=>values.includes(alias))})
}

export function isClinicalScaleEligible(definition,{age,admission}={}){
 if(!definition||definition.status==='retired')return false
 if(definition.orgSetting?.enabled===false||definition.orgSetting?.availability==='disabled')return false
 const population=populationForAge(age)
 if(population&&(definition.population||[]).length&&!definition.population.map(normalized).includes(population))return false
 if(age!=null&&definition.min_age_years!=null&&age<Number(definition.min_age_years))return false
 if(age!=null&&definition.max_age_years!=null&&age>Number(definition.max_age_years))return false
 return matchesSetting(definition,admission)
}

export function buildClinicalScaleContext(definitions=[],assessments=[],context={},now=new Date()){
 return definitions.filter(definition=>isClinicalScaleEligible(definition,context)).map(definition=>{
  const history=assessments.filter(row=>row.scale_definition_id===definition.id).sort((a,b)=>new Date(b.assessed_at)-new Date(a.assessed_at))
  const latest=history[0]||null,previous=history[1]||null
  const hours=Number(definition.orgSetting?.reassessment_hours)||null
  const dueAt=latest&&hours?new Date(new Date(latest.assessed_at).getTime()+hours*3600000):null
  const availability=definition.orgSetting?.availability||'available'
  const state=!latest?(availability==='required'?'due':'not-recorded'):(dueAt&&dueAt<=now?'overdue':dueAt?'current':'completed')
  const delta=latest&&previous?Number(latest.score)-Number(previous.score):null
  return {...definition,availability,latest,previous,dueAt:dueAt?.toISOString()||null,state,delta:Number.isFinite(delta)?delta:null}
 }).sort((a,b)=>(AVAILABILITY_ORDER[a.availability]??9)-(AVAILABILITY_ORDER[b.availability]??9)||(a.state==='overdue'?-1:0)-(b.state==='overdue'?-1:0)||(a.name_el||'').localeCompare(b.name_el||'','el'))
}
