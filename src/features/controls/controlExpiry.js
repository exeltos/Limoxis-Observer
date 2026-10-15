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
const itemKey=row=>String(row?.item||'').trim().toLocaleLowerCase('el')

// What a listed item is: tablet, ampoule, vial, … (stored as the key).
export const ITEM_FORMS=[
 ['tablet','Ταμπλέτα','Tablet'],['capsule','Καψάκιο','Capsule'],['ampoule','Φύσιγγα','Ampoule'],['vial','Φιαλίδιο','Vial'],
 ['flacon','Φλακόν','Flacon'],['bottle','Φιάλη','Bottle'],['bag','Ασκός','Bag'],['tube','Σωληνάριο','Tube'],['piece','Τεμάχιο','Piece'],['pack','Συσκευασία','Pack'],['other','Άλλο','Other'],
]
export function formLabel(form,language='el'){
 const match=ITEM_FORMS.find(([key])=>key===form)
 return match?(language==='en'?match[2]:match[1]):String(form||'')
}

// The items on each department's list, soonest expiry first. An item's latest
// entry replaces the earlier ones (a check re-records every item it covers); an
// item stays until someone marks it as removed or replaced. Listed items that no
// entry has recorded yet show with the expiry the list gives them.
export function expiryItems(record,departments,now=new Date()){
 const window=expiryWindow(record)
 const items=[]
 for(const department of departments||[]){
  const history=[...(record?.assignments?.[department]?.history||[])].sort((a,b)=>new Date(b.at||0)-new Date(a.at||0))
  const recorded=new Set()
  for(const execution of history){
   if(execution.status==='cancelled')continue
   const rows=execution.structuredData?.rows||[]
   rows.forEach((row,index)=>{
    if(!hasItem(row)||row.removedAt||recorded.has(itemKey(row)))return
    items.push({key:`${department}|${execution.id}|${index}`,department,execution,index,row,source:'entry',...expiryState(row.expiry,window,now)})
   })
   for(const row of rows)if(itemKey(row))recorded.add(itemKey(row))
  }
  for(const entry of catalogueForDepartment(record,department)){
   if(recorded.has(itemKey(entry))||!hasItem(entry))continue
   items.push({key:`${department}|list|${entry.id}`,department,execution:null,index:-1,row:{item:entry.item,quantity:entry.quantity||'',form:entry.form||'',expiry:entry.expiry,note:entry.note||'',lot:''},source:'list',...expiryState(entry.expiry,window,now)})
  }
 }
 return items.sort((a,b)=>(a.days??Infinity)-(b.days??Infinity))
}

// The control's list of medicines and supplies:
// [{id,item,quantity,form,expiry,note,departments}], where an empty departments
// list means every department of the control.
export function catalogueItem({item='',quantity='',form='',expiry='',note='',departments=[]}={}){
 return {id:`cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,item:String(item).trim(),quantity:String(quantity??'').trim(),form:String(form||''),expiry:String(expiry||''),note:String(note||''),departments:[...departments]}
}
export function expiryCatalogue(record){
 const list=record?.responseConfig?.expiryCatalogue
 return Array.isArray(list)?list.filter(entry=>String(entry?.item||'').trim()).map(entry=>({...entry,form:entry.form||entry.unit||''})):[]
}
export function catalogueForDepartment(record,department){
 return expiryCatalogue(record).filter(entry=>!entry.departments?.length||entry.departments.includes(department))
}

// Lines pasted from a spreadsheet: name, quantity, form, expiry (dd/mm/yyyy or
// yyyy-mm-dd) and note, separated by tabs or semicolons; only the name is needed.
export function parseCatalogueLines(text){
 const toIso=value=>{const v=String(value||'').trim();const local=v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);if(local)return `${local[3]}-${local[2].padStart(2,'0')}-${local[1].padStart(2,'0')}`;return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:''}
 const toForm=value=>{const v=String(value||'').trim().toLocaleLowerCase('el');if(!v)return '';const match=ITEM_FORMS.find(([key,el,en])=>[key,el.toLocaleLowerCase('el'),en.toLowerCase()].includes(v));return match?match[0]:'other'}
 return String(text||'').split(/\r?\n/).map(line=>line.split(/\t|;/).map(cell=>cell.trim())).filter(cells=>cells[0]).map(([item,quantity='',form='',expiry='',note=''])=>({item,quantity,form:toForm(form),expiry:toIso(expiry),note}))
}

// The rows a new entry starts with: every listed item for the department, with
// what its latest entry recorded (or, before any entry, what the list gives).
export function prefilledExpiryRows(record,department){
 const latest=new Map()
 const history=[...(record?.assignments?.[department]?.history||[])].sort((a,b)=>new Date(b.at||0)-new Date(a.at||0))
 for(const execution of history){
  if(execution.status==='cancelled')continue
  for(const row of execution.structuredData?.rows||[]){const key=itemKey(row);if(key&&!latest.has(key))latest.set(key,row)}
 }
 return catalogueForDepartment(record,department).map(entry=>{
  const last=latest.get(itemKey(entry))
  const from=last?(last.removedAt?{}:last):entry
  return {item:entry.item,form:entry.form||'',quantity:String(from.quantity||''),lot:String(from.lot||''),expiry:String(from.expiry||''),note:String(from.note||''),finding:'',findingOther:'',fromCatalogue:true}
 })
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
