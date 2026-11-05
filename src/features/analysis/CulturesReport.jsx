import { useEffect,useMemo,useState } from 'react'
import { supabase } from '../../core/supabase/client'
import { FiguresLine } from './AnalysisPanels'
import { BarList,ChartCard,Scoreboard } from './AnalysisCharts'

// Analysis › Microbiology: environmental and staff-check cultures (from analysis_culture_metrics).
// Staff are counted only; the function returns no names.
const empty={rows:[],organisms:[]}
const num=value=>Number(value)||0

async function loadCultures({organizationId,range,departmentId}){
 const {data,error}=await supabase.rpc('analysis_culture_metrics',{p_organization_id:organizationId||null,p_from:range?.from||null,p_to:range?.to||null,p_department_id:departmentId||null})
 if(error)throw error
 return {...empty,...(data||{})}
}

function totals(rows,kind){
 const sum={total:0,negative:0,within:0,positive:0}
 for(const [rowKind,,total,negative,within,positive] of rows){if(rowKind!==kind)continue;sum.total+=num(total);sum.negative+=num(negative);sum.within+=num(within);sum.positive+=num(positive)}
 return sum
}

function Section({kind,title,subtitle,details,tx,en}){
 const sum=useMemo(()=>totals(details.rows,kind),[details.rows,kind])
 const rows=useMemo(()=>details.rows.filter(row=>row[0]===kind).map(([,name,total,negative,within,positive])=>({key:name,name,total:num(total),negative:num(negative),within:num(within),positive:num(positive)})),[details.rows,kind])
 const organisms=useMemo(()=>details.organisms.filter(row=>row[0]===kind).map(([,name,count])=>[name,num(count)]),[details.organisms,kind])
 if(!sum.total)return null
 const figures=[
  [tx('Δείγματα','Samples'),sum.total,tx('με επικυρωμένο αποτέλεσμα','with a validated result')],
  [tx('Αρνητικά','Negative'),sum.negative,'','good'],
  [tx('Εντός αποδεκτών ορίων','Within acceptable limits'),sum.within,''],
  [tx('Θετικά','Positive'),sum.positive,'',sum.positive?'warning':'good'],
 ]
 return <>
  <h3>{title}</h3>
  <FiguresLine rows={figures}/>
  <div className="analysis-chart-grid">
   <ChartCard title={tx('Πιο συχνοί μικροοργανισμοί','Most frequent organisms')} subtitle={subtitle}><BarList rows={organisms} en={en} max={8}/></ChartCard>
   <ChartCard wide title={tx('Ανά τμήμα','By department')} subtitle={tx('Αρνητικά, εντός αποδεκτών ορίων και θετικά δείγματα.','Negative, within acceptable limits and positive samples.')}>
    <Scoreboard rows={rows} rowLabel={tx('Τμήμα','Department')} en={en} columns={[{key:'total',label:tx('Δείγματα','Samples')},{key:'negative',label:tx('Αρνητικά','Negative'),shade:false},{key:'within',label:tx('Εντός ορίων','Within limits'),shade:false},{key:'positive',label:tx('Θετικά','Positive'),tone:'warn'}]}/>
   </ChartCard>
  </div>
 </>
}

export function CulturesReport({organizationId='',range,departmentId='',onLoadingChange,tx,en=false}){
 const [details,setDetails]=useState(empty),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const rangeFrom=range?.from||'',rangeTo=range?.to||''
 useEffect(()=>{
  let live=true
  setLoading(true);setError('')
  loadCultures({organizationId,range:{from:rangeFrom,to:rangeTo},departmentId})
   .then(data=>{if(live)setDetails(data)})
   .catch(failure=>{if(live){setDetails(empty);setError(failure?.message||'CULTURES_LOAD_FAILED')}})
   .finally(()=>{if(live)setLoading(false)})
  return()=>{live=false}
 },[organizationId,rangeFrom,rangeTo,departmentId])
 useEffect(()=>{onLoadingChange?.(loading);return()=>onLoadingChange?.(false)},[loading,onLoadingChange])
 if(loading)return <div className="analysis-chart-empty">{tx('Φόρτωση καλλιεργειών…','Loading cultures…')}</div>
 if(error||(!details.rows.length))return null
 return <section className="analysis-cultures" aria-label={tx('Καλλιέργειες','Cultures')}>
  <Section kind="environment" title={tx('Καλλιέργειες χώρων','Environmental cultures')} subtitle={tx('Θετικά δείγματα χώρων και επιφανειών.','Positive samples from spaces and surfaces.')} details={details} tx={tx} en={en}/>
  <Section kind="staff" title={tx('Καλλιέργειες προσωπικού','Staff cultures')} subtitle={tx('Συγκεντρωτικά, χωρίς ονόματα προσωπικού.','Aggregated, without staff names.')} details={details} tx={tx} en={en}/>
 </section>
}
