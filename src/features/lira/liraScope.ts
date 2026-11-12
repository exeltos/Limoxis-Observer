import { filterLiraData } from './liraAnalysis'
import { filterLiraDataByWindow,inferLiraTimeWindow,type LiraComparisonSpec,type LiraTimeWindow } from './liraTime'
import { hospitalToday } from '../../core/dates/hospitalDate'
import type { AnyRecord } from '../../types/featureTypes'

export function resolveLiraTimeScope(question: string,{data,plan,language='el',today=hospitalToday(),previousTimeWindow=null}: AnyRecord={}){
 const explicit=inferLiraTimeWindow(question,{today})
 const short=String(question||'').trim().split(/\s+/).filter(Boolean).length<=8
 const timeWindow=explicit||(short?previousTimeWindow:null)
 let scoped: AnyRecord=filterLiraData(data,{department:plan?.department||'all',periodDays:timeWindow?0:(plan?.periodDays||0),language,today})
 if(timeWindow)scoped=filterLiraDataByWindow(scoped,timeWindow)
 return {data:scoped,timeWindow,explicit:Boolean(explicit)}
}


const iso=(date: Date)=>date.toISOString().slice(0,10)
const utc=(value: string)=>new Date(`${value}T12:00:00Z`)
export function buildMatchedComparisonSpec(timeWindow: LiraTimeWindow|null,{today=hospitalToday(),language='el'}: AnyRecord={}): LiraComparisonSpec|null{
 const en=language==='en'
 const current=timeWindow||{start:today,end:today,label:en?'today':'σήμερα'}
 const start=utc(current.start),end=utc(current.end)
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))return null
 const days=Math.round((end.getTime()-start.getTime())/86400000)+1
 const referenceEnd=new Date(start);referenceEnd.setUTCDate(referenceEnd.getUTCDate()-1)
 const referenceStart=new Date(referenceEnd);referenceStart.setUTCDate(referenceStart.getUTCDate()-(days-1))
 return {current:{...current,label:current.label||`${current.start} – ${current.end}`},reference:{start:iso(referenceStart),end:iso(referenceEnd),label:`${iso(referenceStart)} – ${iso(referenceEnd)}`}}
}
