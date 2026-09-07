const DATE_ONLY_TIME='T12:00:00'

export function formatDate(value,{locale='el-GR',empty='—'}={}){
  if(!value)return empty
  const date=new Date(`${String(value).slice(0,10)}${DATE_ONLY_TIME}`)
  if(Number.isNaN(date.getTime()))return empty
  return date.toLocaleDateString(locale,{day:'2-digit',month:'2-digit',year:'numeric'})
}

export function todayIsoDate(){
  return new Date().toISOString().slice(0,10)
}
