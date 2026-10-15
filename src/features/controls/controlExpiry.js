// Expiry tracking for medicines and supplies (controls with the
// 'medication_expiry' list template). Every completed entry adds the items it
// lists; an item stays on the department's list until someone marks it as
// removed or replaced. The control definition sets how many days before expiry
// an item starts to alert, and for how many days after expiry it keeps alerting.

export const DEFAULT_EXPIRY_BEFORE_DAYS=30
export const DEFAULT_EXPIRY_AFTER_DAYS=7
const DAY=86_400_000

export function isExpiryControl(record){
 const response=record?.responseConfig||{}
 return response.mode==='list'&&response.template==='medication_expiry'
}

export function expiryWindow(record){
 const response=record?.responseConfig||{}
 const days=(value,fallback)=>{const n=Number(value);return value!==''&&value!=null&&Number.isFinite(n)&&n>=0?Math.round(n):fallback}
 return {before:days(response.expiryBeforeDays,DEFAULT_EXPIRY_BEFORE_DAYS),after:days(response.expiryAfterDays,DEFAULT_EXPIRY_AFTER_DAYS)}
}

function startOfDay(value){const d=new Date(value);d.setHours(0,0,0,0);return d}
function parseDay(value){
 const text=String(value||'').trim()
 const iso=text.match(/^(\d{4})-(\d{2})-(\d{2})/)
 if(iso)return new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3]))
 const local=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
 if(local)return new Date(Number(local[3]),Number(local[2])-1,Number(local[1]))
 return null
}

// Days from today to the expiry date: negative once the item has expired.
export function daysToExpiry(expiry,now=new Date()){
 const day=parseDay(expiry)
 return day?Math.round((day-startOfDay(now))/DAY):null
}

// 'expired' | 'expiring' | 'ok' | 'unknown', plus whether it alerts today.
export function expiryState(expiry,{before,after},now=new Date()){
 const days=daysToExpiry(expiry,now)
 if(days==null)return {state:'unknown',days:null,alert:false}
 if(days<0)return {state:'expired',days,alert:-days<=after}
 if(days<=before)return {state:'expiring',days,alert:true}
 return {state:'ok',days,alert:false}
}

const hasItem=row=>String(row?.item||'').trim()&&String(row?.expiry||'').trim()

// The items still on each department's list, soonest expiry first. Each item
// carries the entry it came from so it can be marked as removed there.
export function expiryItems(record,departments,now=new Date()){
 const window=expiryWindow(record)
 const items=[]
 for(const department of departments||[]){
  const history=record?.assignments?.[department]?.history||[]
  for(const execution of history){
   if(execution.status==='cancelled')continue
   const rows=execution.structuredData?.rows||[]
   rows.forEach((row,index)=>{
    if(!hasItem(row)||row.removedAt)return
    items.push({key:`${department}|${execution.id}|${index}`,department,execution,index,row,...expiryState(row.expiry,window,now)})
   })
  }
 }
 return items.sort((a,b)=>(a.days??Infinity)-(b.days??Infinity))
}

export function expiryCounts(items){
 return {
  expired:items.filter(item=>item.state==='expired').length,
  expiring:items.filter(item=>item.state==='expiring').length,
  alerting:items.filter(item=>item.alert).length,
 }
}

// The finding an item's expiry date implies, for rows left without one.
export function impliedFinding(row,window,language='el',now=new Date()){
 const {state}=expiryState(row?.expiry,window,now)
 const en=language==='en'
 if(state==='expired')return en?'Expired':'Ληγμένο'
 if(state==='expiring')return en?'Near expiry':'Κοντόληκτο'
 return ''
}

// The entry's structured data with one row marked as removed or replaced.
export function markRowRemoved(execution,index,{actorName='',at=new Date().toISOString()}={}){
 const structured=execution.structuredData||{rows:[]}
 return {...structured,rows:(structured.rows||[]).map((row,i)=>i===index?{...row,removedAt:at,removedBy:actorName}:row)}
}

// One bell item per control and department with items that alert today.
export function expiryAlerts(programme,{canSee=()=>true,language='el',now=new Date()}={}){
 const en=language==='en'
 const alerts=[]
 for(const record of programme||[]){
  if(!isExpiryControl(record))continue
  const visible=(record.departments||[]).filter(dep=>canSee(record,dep))
  for(const department of visible){
   const items=expiryItems(record,[department],now).filter(item=>item.alert)
   if(!items.length)continue
   const {expired,expiring}=expiryCounts(items)
   const parts=[expired?`${expired} ${en?'expired':(expired===1?'ληγμένο':'ληγμένα')}`:'',expiring?`${expiring} ${en?'expiring soon':(expiring===1?'λήγει σύντομα':'λήγουν σύντομα')}`:''].filter(Boolean)
   alerts.push({
    id:`EXPIRY-${record.id}-${department}-${expired}-${expiring}`,
    type:'expiry',
    title:en?'Medicine and supply expiry':'Λήξεις φαρμάκων και υλικών',
    message:`${department} · ${parts.join(' · ')}`,
    to:`/controls/${record.id}?tab=expiry`,
    count:items.length,
   })
  }
 }
 return alerts
}
