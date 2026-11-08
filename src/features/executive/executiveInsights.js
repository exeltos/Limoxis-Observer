// «Εικόνα νοσοκομείου» · Σύνοψη (owner, 7/11/2026): what goes well, what gets worse and where to look.
// Pure helpers over the Analysis snapshot ({domains, microbiology}): the same period a year before, the monthly
// line of a measure, the sentences of «Τι άλλαξε» and the departments at a glance.
import { pct, shiftMonths } from './executiveModel'

// The same calendar span a year before (the default comparison: «πέρσι»).
export function yearAgoRange(range){
 if(!range?.from||!range?.to)return null
 return {from:shiftMonths(range.from,12),to:shiftMonths(range.to,12)}
}

const num=value=>(value==null||value===''||!Number.isFinite(Number(value))?null:Number(value))
const round1=value=>(value==null?null:Math.round(value*10)/10)

// The monthly line of a measure, as values by calendar month (1–12), so this year and the last overlay.
// null where the snapshot carries no monthly figures for that measure.
export function monthlySeries(id,snapshot={}){
 const d=snapshot?.domains||{}
 const byMonth=rows=>{const out=new Map();for(const row of rows||[]){const month=Number(String(row[0]||'').slice(5,7));if(month)out.set(month,row)}return out.size?out:null}
 if(id==='handHygiene'){const rows=byMonth(d.handHygiene?.monthly);return rows&&new Map([...rows].map(([month,[,total,part]])=>[month,num(total)?round1(pct(part,total)):null]))}
 if(id==='hai'){const rows=byMonth(d.surveillance?.monthly);return rows&&new Map([...rows].map(([month,[,count]])=>[month,num(count)]))}
 if(id==='incidents'){const rows=byMonth(d.quality?.monthly);return rows&&new Map([...rows].map(([month,[,count]])=>[month,num(count)]))}
 return null
}

// The points of a sparkline: [{month, now, before}] over the months of the period (at most 12).
export function sparkPoints(id,snapshot,previousSnapshot,range){
 const now=monthlySeries(id,snapshot),before=previousSnapshot?monthlySeries(id,previousSnapshot):null
 if(!now&&!before)return null
 const from=Number(String(range?.from||'').slice(5,7))||1,to=Number(String(range?.to||'').slice(5,7))||12
 const sameYear=String(range?.from||'').slice(0,4)===String(range?.to||'').slice(0,4)
 const months=sameYear?Array.from({length:to-from+1},(_,i)=>from+i):Array.from({length:12},(_,i)=>((from-1+i)%12)+1)
 if(months.length<2)return null
 return months.map(month=>({month,now:now?.get(month)??null,before:before?.get(month)??null}))
}

const fmt=(value,unit,en)=>value==null?'—':`${new Intl.NumberFormat(en?'en-GB':'el-GR',{maximumFractionDigits:1}).format(value)}${unit||''}`

// The department that pulls a measure down the most (lowest rate, or most cases).
export function worstDepartment(id,snapshot={}){
 const d=snapshot?.domains||{}
 if(id==='handHygiene'){const rows=(d.handHygiene?.byDepartment||[]).filter(([,total])=>num(total)>=10).map(([name,total,part])=>[name,pct(part,total)]).sort((a,b)=>a[1]-b[1]);return rows[0]?{name:rows[0][0],value:`${fmt(rows[0][1],'%')}`}:null}
 if(id==='bundles'){const rows=(d.bundles?.byDepartment||[]).filter(([,count,score])=>num(count)>=3&&num(score)!=null).sort((a,b)=>a[2]-b[2]);return rows[0]?{name:rows[0][0],value:fmt(rows[0][2],'%')}:null}
 if(id==='hai'){const counts=new Map();for(const [name,,n] of d.surveillance?.haiByDepartment||[])counts.set(name,(counts.get(name)||0)+(Number(n)||0));const top=[...counts].sort((a,b)=>b[1]-a[1])[0];return top&&top[1]>1?{name:top[0],value:String(top[1])}:null}
 return null
}

// «Χρειάζονται προσοχή» / «Βελτιώθηκαν» (owner, 8/11/2026): the measures that got worse or better against the
// comparison, with both values, and the measures off target. A change counts only against a real figure of the
// comparison: a count that was 0 there says nothing («19 από 0»). A rate counts in points, a count by its relative change.
const realChange=item=>item.value!=null&&item.delta&&item.delta.good!=null&&item.delta.previous!=null&&(item.unit==='%'||item.delta.previous!==0)
export function summaryHighlights(kpis=[],snapshot={},{limit=5,en=false,against=''}={}){
 const tx=(el,english)=>(en?english:el)
 const weight=item=>item.unit==='%'?Math.abs(item.delta.diff):Math.min(100,Math.abs(item.delta.change??item.delta.diff*10))
 const versus=item=>` (${against?`${against}: `:''}${fmt(item.delta.previous,item.unit,en)})`
 const line=(item,good)=>{
  const where=good?null:worstDepartment(item.id,snapshot)
  const whereText=where?tx(` — κυρίως ${where.name} (${where.value})`,` — mostly ${where.name} (${where.value})`):''
  return {id:item.id,good,up:item.delta.diff>0,tab:item.tab,text:`${tx(...item.label)}: ${fmt(item.value,item.unit,en)}${versus(item)}${whereText}`}
 }
 const changed=kpis.filter(realChange)
 const worse=changed.filter(item=>item.delta.good===false).sort((a,b)=>weight(b)-weight(a))
 const offTarget=kpis.filter(item=>item.value!=null&&item.status==='judged'&&item.tone==='danger'&&!worse.includes(item))
  .map(item=>({id:item.id,good:false,up:null,tab:item.tab,text:tx(`${item.label[0]}: ${fmt(item.value,item.unit,en)} — εκτός στόχου (${item.target})`,`${item.label[1]}: ${fmt(item.value,item.unit,en)} — off target (${item.target})`)}))
 const better=changed.filter(item=>item.delta.good===true).sort((a,b)=>weight(b)-weight(a))
 return {attention:[...worse.map(item=>line(item,false)),...offTarget].slice(0,limit),improved:better.map(item=>line(item,true)).slice(0,limit)}
}
// The assessment of a measure: against its target where it has one, else against the comparison.
export function assessmentOf(item,en=false){
 const tx=(el,english)=>(en?english:el)
 if(item.value==null)return {tone:'none',text:tx('Δεν έχει ξεκινήσει','Not started')}
 if(item.status==='judged')return item.tone==='good'?{tone:'good',text:tx('Εντός στόχου','On target')}:item.tone==='warning'?{tone:'warning',text:tx('Κοντά στον στόχο','Near target')}:{tone:'danger',text:tx('Εκτός στόχου','Off target')}
 if(realChange(item))return item.delta.good?{tone:'good',text:tx('Καλύτερα','Better')}:{tone:'danger',text:tx('Χειρότερα','Worse')}
 if(item.delta&&item.delta.trend==='flat')return {tone:'none',text:tx('Σταθερό','Unchanged')}
 return {tone:'none',text:tx('Χωρίς στόχο','No target')}
}
// The change of a measure as text: points for a rate; nothing without a real figure of the comparison.
export function changeText(item,en=false){
 if(!realChange(item))return item.delta&&item.delta.trend==='flat'&&item.delta.previous!=null?{text:'0',good:null}:{text:'—',good:null}
 const d=item.delta
 return {text:`${d.diff>0?'+':'−'}${fmt(Math.abs(d.diff),'',en)}${item.unit==='%'?(en?' pts':' μον.'):''}`,good:d.good}
}
// Why a measure is not calculated yet (owner, 8/11/2026: never «no data», say that the calculation has not started).
export function notStartedReason(item,en=false){
 const tx=(el,english)=>(en?english:el)
 if(item.missing)return tx(...item.missing)
 if(item.id==='haiRate'||item.id==='mdroRate')return tx('λείπουν οι κλινοημέρες της περιόδου','the patient days of the period are missing')
 return tx('δεν υπάρχουν ακόμη καταγραφές στην περίοδο','no records in the period yet')
}

// «Σύγκριση τμημάτων»: per department, hand hygiene and bundles (%), HAI and incidents (counts) and the controls'
// finding rate, with the value of the comparison. Only departments with at least one figure; the worst first.
const sumCells=cells=>{const out=new Map();for(const [name,,n] of cells||[])out.set(name,(out.get(name)||0)+(Number(n)||0));return out}
function departmentFigures(snapshot={}){
 const d=snapshot?.domains||{},out=new Map()
 const put=(name,key,value)=>{if(!name||name==='—'||value==null)return;if(!out.has(name))out.set(name,{});out.get(name)[key]=value}
 for(const [name,total,part] of d.handHygiene?.byDepartment||[])if(num(total))put(name,'handHygiene',round1(pct(part,total)))
 for(const [name,count,score] of d.bundles?.byDepartment||[])if(num(count))put(name,'bundles',num(score))
 for(const [name,n] of sumCells(d.surveillance?.haiByDepartment))put(name,'hai',n)
 for(const [name,n] of d.surveillance?.byDepartment||[])if(num(n)!=null)put(name,'surveillance',num(n))
 for(const [name,n] of sumCells(d.quality?.severityByDepartment))put(name,'incidents',n)
 for(const [name,executions,withFinding] of d.controls?.byDepartment||[])if(typeof name==='string'&&!/^[0-9a-f-]{36}$/i.test(name)&&num(executions))put(name,'controlFindings',round1(pct(withFinding,executions)))
 return out
}
export const GRID_COLUMNS=Object.freeze([
 {key:'handHygiene',label:['Υγιεινή χεριών','Hand hygiene'],unit:'%',better:'up',target:'handHygiene'},
 {key:'bundles',label:['Δέσμες μέτρων','Bundles'],unit:'%',better:'up',target:'bundles'},
 {key:'hai',label:['ΛΣΦΥ','HAI'],better:'down'},
 {key:'surveillance',label:['Περιστατικά επιτήρησης','Surveillance cases'],better:'down'},
 {key:'controlFindings',label:['Έλεγχοι με εύρημα','Controls with a finding'],unit:'%',better:'down'},
 {key:'incidents',label:['Συμβάντα','Incidents'],better:'down'},
])
// tone: against the target where there is one (good / warning / danger), else a count of 0 is good and the most is danger.
// only: the departments to compare (the wards); none given, every department with a figure.
export function departmentGrid(snapshot,previousSnapshot,targets={},only=[]){
 const keep=only?.length?new Set(only):null
 const now=new Map([...departmentFigures(snapshot)].filter(([name])=>!keep||keep.has(name))),before=previousSnapshot?departmentFigures(previousSnapshot):new Map()
 const columns=GRID_COLUMNS.filter(column=>[...now.values()].some(row=>row[column.key]!=null))
 const max=Object.fromEntries(columns.map(column=>[column.key,Math.max(0,...[...now.values()].map(row=>row[column.key]??0))]))
 const tone=(column,value)=>{
  if(value==null)return 'none'
  const target=num(targets[column.target])
  if(target!=null)return value>=target?'good':value>=target-10?'warning':'danger'
  if(column.better==='down')return value===0?'good':value>=max[column.key]*0.7&&max[column.key]>0?'danger':'warning'
  return 'none'
 }
 const rows=[...now].map(([name,figures])=>({name,cells:columns.map(column=>{
  const value=figures[column.key]??null,previous=before.get(name)?.[column.key]??null
  const trend=value==null||previous==null||value===previous?null:value>previous?'up':'down'
  const good=trend==null?null:(trend==='up')===(column.better==='up')
  return {key:column.key,value,previous,unit:column.unit||'',tone:tone(column,value),trend,good}
 })}))
 const badness=row=>row.cells.reduce((sum,cell)=>sum+(cell.tone==='danger'?3:cell.tone==='warning'?1:0),0)
 return {columns,rows:rows.sort((a,b)=>badness(b)-badness(a)||a.name.localeCompare(b.name,'el'))}
}

// One department against the average of the departments and against the comparison (the «Τμήματα» tab and its report).
export function departmentProfile(grid,name){
 const row=grid.rows.find(item=>item.name===name)
 if(!row)return []
 return grid.columns.map((column,index)=>{
  const values=grid.rows.map(item=>item.cells[index].value).filter(value=>value!=null)
  const average=values.length?round1(values.reduce((sum,value)=>sum+value,0)/values.length):null
  const cell=row.cells[index]
  const versus=cell.value==null||average==null||cell.value===average?null:(cell.value>average)===(column.better==='up')
  return {key:column.key,label:column.label,unit:column.unit||'',value:cell.value,average,previous:cell.previous,tone:cell.tone,trend:cell.trend,good:cell.good,versus}
 })
}

// Patient days of the period (patient_day_periods): the hospital's own rows, or with `departmentId` that department's;
// each period counts for the share of its days that falls in the range.
const dayNumber=value=>Math.floor(Date.UTC(Number(String(value).slice(0,4)),Number(String(value).slice(5,7))-1,Number(String(value).slice(8,10)))/86400000)
export function patientDaysIn(periods=[],range,departmentId=''){
 if(!range?.from||!range?.to)return null
 const from=dayNumber(range.from),to=dayNumber(range.to)
 let total=0,any=false
 for(const period of periods||[]){
  if(departmentId?period.departmentId!==departmentId:(period.scope&&period.scope!=='hospital'))continue
  const start=dayNumber(period.from),end=dayNumber(period.to),value=Number(period.value)
  if(!Number.isFinite(value)||end<start)continue
  const overlap=Math.min(end,to)-Math.max(start,from)+1
  if(overlap<=0)continue
  total+=value*overlap/(end-start+1);any=true
 }
 return any?Math.round(total):null
}
// The HAI of the departments counted apart from the hospital's total (Παιδιατρική…), left out of the hospital's rate.
export function separateHai(snapshot={},names=[]){
 if(!names.length)return 0
 const wanted=new Set(names)
 return (snapshot?.domains?.surveillance?.haiByDepartment||[]).reduce((sum,[name,,n])=>sum+(wanted.has(name)?Number(n)||0:0),0)
}
// The rates per 1,000 patient days (owner, 7/11/2026): HAI and patients with a multidrug-resistant isolate. For the hospital,
// the cases of the departments counted apart from its total are left out (`excluded`), so numerator and denominator
// cover the same patients (owner, 8/11/2026).
export function rateMeasures(kpis=[],patientDays,excluded={}){
 const per=(id)=>{const item=kpis.find(row=>row.id===id);if(item?.value==null||!patientDays)return null;const cases=Math.max(0,item.value-(Number(excluded[id])||0));return Math.round(cases/patientDays*1000*100)/100}
 const days=patientDays?new Intl.NumberFormat('el-GR').format(patientDays):'—'
 const apart=excluded.names?.length?[` · χωρίς ${excluded.names.join(', ')}`,` · without ${excluded.names.join(', ')}`]:['','']
 const missing=patientDays?null:['λείπουν οι κλινοημέρες της περιόδου','the patient days of the period are missing']
 return [
  {id:'haiRate',modules:['surveillance'],parts:['domains'],label:['ΛΣΦΥ ανά 1.000 ημέρες νοσηλείας','HAI per 1,000 patient days'],value:per('hai'),missing,hint:[`${days} ημέρες νοσηλείας${apart[0]}`,`${days} patient days${apart[1]}`],tone:'neutral',better:'down',tab:'surveillance'},
  {id:'mdroRate',modules:['laboratory'],parts:['microbiology'],label:['Πολυανθεκτικά ανά 1.000 ημέρες νοσηλείας','Multidrug-resistant per 1,000 patient days'],value:per('mdro'),missing,hint:[`${days} ημέρες νοσηλείας${apart[0]}`,`${days} patient days${apart[1]}`],tone:'neutral',better:'down',tab:'laboratory'},
 ]
}
