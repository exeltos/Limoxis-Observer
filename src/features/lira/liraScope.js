import { filterLiraData } from './liraAnalysis'
import { filterLiraDataByWindow,inferLiraTimeWindow } from './liraTime'

export function resolveLiraTimeScope(question,{data,plan,language='el',today=new Date().toISOString().slice(0,10),previousTimeWindow=null}={}){
 const explicit=inferLiraTimeWindow(question,{today})
 const short=String(question||'').trim().split(/\s+/).filter(Boolean).length<=8
 const timeWindow=explicit||(short?previousTimeWindow:null)
 let scoped=filterLiraData(data,{department:plan?.department||'all',periodDays:timeWindow?0:(plan?.periodDays||0),language,today})
 if(timeWindow)scoped=filterLiraDataByWindow(scoped,timeWindow,language)
 return {data:scoped,timeWindow,explicit:Boolean(explicit)}
}
