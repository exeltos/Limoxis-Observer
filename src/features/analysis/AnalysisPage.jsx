import { useEffect, useMemo, useState } from 'react'
import { Download, Printer, TrendingDown, TrendingUp, GitCompareArrows, MapPin, Microscope, ShieldAlert } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { ROLES } from '../../core/permissions/roles'
import { BackButton } from '../../design-system/BackButton'
import { loadGlobalReportSummary, loadPlatformAnalyticsDetails } from '../platform/platformService'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { surveillanceDemoData } from '../surveillance/surveillanceDemoData'

const TABS=[['overview','Σύνοψη','Overview'],['national','Μικροοργανισμοί / Εθνική Επιτήρηση','Microorganisms / National surveillance'],['surveillance','Επιτήρηση & HAI','Surveillance & HAI'],['laboratory','Μικροβιολογία','Microbiology'],['amr','AMR / MDR-XDR','AMR / MDR-XDR'],['antimicrobials','Αντιμικροβιακά','Antimicrobials'],['prevention','Πρόληψη','Prevention'],['hand','Υγιεινή Χεριών','Hand hygiene'],['controls','Έλεγχοι','Controls'],['occupational','Εργαζόμενοι','Employees'],['quality','Ποιότητα','Quality'],['training','Εκπαίδευση','Training'],['governance','Governance','Governance']]
const COLORS=['#2878d0','#28a36a','#7a56c2','#e58a2b','#d95757','#1b9aaa','#d16ba5','#6f8f3d','#c26c2c','#4d7ca8']
const MONTHS=['Ιαν','Φεβ','Μαρ','Απρ','Μάι','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ']
const DEPARTMENTS=['Όλα τα τμήματα','ΜΕΘ','Παθολογική','Χειρουργική','ΤΕΠ','Αιμοκάθαρση']

const MANDATORY_BSI=[
  {id:'acinetobacter',label:'Acinetobacter spp.',tone:COLORS[4]},
  {id:'pseudomonas',label:'Pseudomonas spp.',tone:COLORS[0]},
  {id:'klebsiella',label:'Klebsiella spp.',tone:COLORS[3]},
  {id:'mrsa',label:'MRSA',tone:COLORS[6]},
  {id:'vre',label:'VRE',tone:COLORS[2]},
]

const DEMO_KPI={
 overview:[['HAI / 1.000 κλινοημέρες','3,5','-8,2%','down'],['MDR/XDR rate','12,4%','-2,1%','down'],['Υγιεινή χεριών','88%','+4,3%','up'],['DDD / 1.000 κλινοημέρες','58','-5,6%','down'],['Bundle compliance','91%','+3,8%','up'],['Έλεγχοι στην ώρα τους','95%','+2,4%','up']],
 national:[['Δηλωτέες MDRO βακτηριαιμίες','31','-6,1%','down'],['Νέα MDR/XDR απομονώματα','42','-4,5%','down'],['Τμήματα με ≥1 εύρημα','9','+1','up'],['Κρίσιμες συρροές','2','-1','down']],
 surveillance:[['HAI prevalence (PPS)','12,1%','-0,6%','down'],['HAI / 1.000 κλινοημέρες','3,5','-8,2%','down'],['MDR introduction index','8,4%','-1,1%','down'],['Outbreak response','6 h','-4 h','down'],['CLABSI / 1.000 CVC-days','1,7','-12,0%','down'],['CAUTI / 1.000 catheter-days','2,1','-5,1%','down']],
 laboratory:[['Θετικές καλλιέργειες','184','+6,4%','up'],['Critical ≤30′','94%','+3,2%','up'],['MDR/XDR isolates','42','-4,5%','down'],['Median TAT','16 h','-2,0 h','down']],
 amr:[['MDR/XDR rate','12,4%','-2,1%','down'],['Carbapenem resistance','21%','-3,4%','down'],['MRSA','8,2%','-1,2%','down'],['VRE','5,6%','+0,4%','up']],
 antimicrobials:[['DDD / 1.000 κλιν/ρες','58','-5,6%','down'],['Carbapenem DDD','12','-8,3%','down'],['Reserve share','7,4%','-1,1%','down'],['Reviews ≤72h','91%','+4,8%','up']],
 prevention:[['Bundle compliance','91%','+3,8%','up'],['Έγκαιρη απομόνωση','96%','+2,1%','up'],['Waste segregation','93%','+1,7%','up'],['Antiseptic target','89%','+4,0%','up']],
 hand:[['Compliance','88%','+4,3%','up'],['Παρατηρήσεις','1.248','+118','up'],['Glove misuse','7%','-2,0%','down'],['Training coverage','94%','+5,2%','up']],
 controls:[['On-time','95%','+2,4%','up'],['Open deviations','12','-3','down'],['Overdue','5','-4','down'],['Completion','97%','+2,8%','up']],
 occupational:[['Vaccination coverage','86%','+5,1%','up'],['Ιατρικές επισκέψεις','312','+22','up'],['Overdue visits','24','-8','down'],['Follow-up','98%','+1,4%','up']],
 quality:[['CAPA ≤30d','89%','+6,2%','up'],['Open findings','18','-5','down'],['Audits','31','+4','up'],['Docs in-date','96%','+2,2%','up']],
 training:[['Coverage','92%','+7,4%','up'],['Completions','1.034','+126','up'],['Overdue','44','-19','down'],['Pass rate','94%','+3,1%','up']],
 governance:[['EODY reporting completeness','98%','+2,0%','up'],['Audit completeness','99%','+1,0%','up'],['Committees active','94%','+2,0%','up'],['Policies in-date','96%','+1,9%','up']],
}
const DEMO_TRENDS={overview:[4.8,4.6,4.5,4.3,4.2,4.0,4.1,3.9,3.8,3.7,3.6,3.5],national:[14,17,16,21,19,24,20,18,17,15,14,13],surveillance:[4.8,4.2,5.1,4.7,4.4,4.1,3.9,4.0,3.7,3.5,3.4,3.2],laboratory:[48,55,61,58,67,63,70,74,71,78,82,86],amr:[16.8,16.2,15.9,15.4,14.8,14.5,14.2,13.8,13.6,13.1,12.8,12.4],antimicrobials:[68,66,65,63,62,61,60,59,60,58,57,56],prevention:[76,78,79,82,84,85,86,88,89,90,91,93],hand:[71,74,76,79,81,80,83,84,86,85,87,88],controls:[78,82,84,86,85,88,90,91,92,94,95,95],occupational:[70,72,74,76,78,80,82,82,84,84,85,86],quality:[72,75,78,79,81,84,83,87,88,90,91,92],training:[62,65,68,72,75,79,82,84,86,88,90,92],governance:[80,81,82,84,85,86,88,89,90,91,93,94]}
const NATIONAL_DEMO_ROWS=[
 ['Klebsiella pneumoniae','MDR','ΜΕΘ','Αίμα / αιμοκαλλιέργεια',12,'2026-08-27'],['Acinetobacter baumannii','XDR','ΜΕΘ','Αναπνευστικό',10,'2026-08-26'],['Pseudomonas aeruginosa','XDR','ΜΕΘ','Αναπνευστικό',8,'2026-08-26'],['Klebsiella pneumoniae','MDR','Παθολογική','Ούρα',7,'2026-08-25'],['Escherichia coli','MDR','Παθολογική','Ούρα',6,'2026-08-24'],['Staphylococcus aureus','MRSA','Χειρουργική','Χειρουργικό πεδίο',5,'2026-08-22'],['Enterococcus faecium','VRE','Αιμοκάθαρση','Αίμα / αιμοκαλλιέργεια',4,'2026-08-20'],['Proteus mirabilis','MDR','Παθολογική','Ούρα',3,'2026-08-19'],['Enterobacter cloacae','MDR','ΜΕΘ','Αίμα / αιμοκαλλιέργεια',3,'2026-08-18'],['Pseudomonas aeruginosa','MDR','Χειρουργική','Τραύμα / έκκριμα',3,'2026-08-17'],['Acinetobacter baumannii','XDR','ΤΕΠ','Αναπνευστικό',2,'2026-08-15'],['Enterococcus faecalis','VRE','Παθολογική','Αίμα / αιμοκαλλιέργεια',2,'2026-08-14']
]

function periodRange(period){const end=new Date();const start=new Date(end);if(period==='month')start.setDate(start.getDate()-30);else if(period==='quarter')start.setDate(start.getDate()-90);else if(period==='half')start.setMonth(start.getMonth()-6);else start.setFullYear(start.getFullYear()-1);return {from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)}}
function hashOrganization(hash=''){const query=hash.includes('?')?hash.split('?')[1]:'';return new URLSearchParams(query).get('organization')||'all'}
function LineChart({values,color=COLORS[0]}){const safe=values?.length?values:[0,0];const max=Math.max(...safe),min=Math.min(...safe),w=680,h=210,p=24;const pts=safe.map((v,i)=>`${p+i*((w-p*2)/Math.max(safe.length-1,1))},${h-p-(v-min)/(max-min||1)*(h-p*2)}`).join(' ');const gradientId=`analysisFill-${color.replace('#','')}`;return <div className="analysis-line-wrap"><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Τάση περιόδου"><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".24"/><stop offset="1" stopColor={color} stopOpacity=".02"/></linearGradient></defs>{[0,1,2,3].map(i=><line key={i} x1={p} x2={w-p} y1={p+i*(h-p*2)/3} y2={p+i*(h-p*2)/3} className="analysis-grid-line"/>)}<polygon points={`${p},${h-p} ${pts} ${w-p},${h-p}`} fill={`url(#${gradientId})`}/><polyline points={pts} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>{safe.map((v,i)=>{const [x,y]=pts.split(' ')[i].split(',');return <circle key={i} cx={x} cy={y} r="4" fill="#fff" stroke={color} strokeWidth="3"/>})}</svg><div className="analysis-axis-labels">{safe.map((_,i)=><small key={i}>{MONTHS[Math.max(0,MONTHS.length-safe.length+i)]||i+1}</small>)}</div></div>}
function GroupBars({rows,tx}){if(!rows?.length)return <div className="analysis-chart-empty">{tx('Δεν υπάρχουν δεδομένα κατανομής για το ενεργό scope.','No distribution data is available for the active scope.')}</div>;const max=Math.max(1,...rows.flatMap(([,a,b])=>[Number(a)||0,Number(b)||0]));return <div className="analysis-group-bars">{rows.map(([label,a,b])=><div className="analysis-group-row" key={label}><span>{label}</span><div><i style={{width:`${(Number(a)||0)/max*100}%`,background:COLORS[0]}}/><i style={{width:`${(Number(b)||0)/max*100}%`,background:COLORS[1]}}/></div><strong>{a}</strong></div>)}</div>}
function Comparison({rows,tx}){if(!rows?.length)return <div className="analysis-chart-empty">{tx('Δεν υπάρχουν συγκρίσιμα δεδομένα οργανισμών.','No comparable organization data.')}</div>;return <article className="analysis-compare-card"><header><div><strong>{tx('Συγκριτική εικόνα οργανισμών','Organization comparison')}</strong><span>{tx('Θετικά αποτελέσματα · MDR/XDR/PDR · ποσοστό αντοχής','Positive results · MDR/XDR/PDR · resistance rate')}</span></div><span className="analysis-legend"><i style={{background:COLORS[0]}}/>{tx('τρέχουσα περίοδος','current period')}</span></header><div className="analysis-comparison-table"><div className="head"><span>{tx('Οργανισμός','Organization')}</span><span>{tx('Θετικά','Positive')}</span><span>MDR/XDR/PDR</span><span>{tx('Αντοχή','Resistance')}</span><span>{tx('Scope','Scope')}</span></div>{rows.map(([name,total,resistant])=>{const rate=total?Math.round(Number(resistant||0)/Number(total)*100):0;return <div key={name}><strong>{name}</strong><span>{total}</span><span>{resistant}</span><span>{rate}%</span><span>—</span></div>})}</div></article>}
function nationalRowsFromDemo(){const labRows=laboratorySamples.filter(x=>x.result==='positive'&&x.organism).map(x=>[x.organism,x.resistance||'—',x.department||'—',x.source||x.type||'—',1,(x.resultedAt||x.collectedAt||'').slice(0,10)]);const surveillanceRows=surveillanceDemoData.filter(x=>x.organism).map(x=>[x.organism,x.resistance||'—',x.department||'—','Επιτήρηση ασθενούς',1,x.startedAt||'']);return [...NATIONAL_DEMO_ROWS,...labRows,...surveillanceRows]}
function aggregateNational(rows){const map=new Map();for(const row of rows){const [organism,resistance,department,source,count,last]=row;const key=`${organism}|${resistance}|${department}|${source}`;const current=map.get(key)||{organism,resistance,department,source,count:0,last:''};current.count+=Number(count)||0;if(last>current.last)current.last=last;map.set(key,current)}return [...map.values()].sort((a,b)=>b.count-a.count)}
function organismMatches(value,target){const v=String(value||'').toLowerCase();if(target.id==='mrsa')return v.includes('staphylococcus aureus');if(target.id==='vre')return v.includes('enterococcus');return v.includes(target.id)}
function downloadAnalysisCsv(tab,rows){const lines=[['Category','Label','Value'],...rows.map(row=>[tab,...row])];const csv=lines.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`limoxis-analysis-${tab}.csv`;a.click();URL.revokeObjectURL(a.href)}

function DemoNationalSurveillance({platform,organizations,tx}){
  const rows=useMemo(()=>aggregateNational(nationalRowsFromDemo()),[])
  const departments=['ΜΕΘ','Παθολογική','Χειρουργική','ΤΕΠ','Αιμοκάθαρση']
  const maxCell=Math.max(1,...rows.map(x=>x.count))
  const mandatory=MANDATORY_BSI.map(item=>({...item,count:rows.filter(r=>organismMatches(r.organism,item)).reduce((s,r)=>s+r.count,0)}))
  const sourceTotals=[...new Set(rows.map(x=>x.source))].map(source=>[source,rows.filter(x=>x.source===source).reduce((s,x)=>s+x.count,0)]).sort((a,b)=>b[1]-a[1]).slice(0,7)
  const organismTotals=[...new Set(rows.map(x=>x.organism))].map(organism=>[organism,rows.filter(x=>x.organism===organism).reduce((s,x)=>s+x.count,0)]).sort((a,b)=>b[1]-a[1]).slice(0,9)
  return <>
    <div className="national-callout"><div><ShieldAlert size={18}/><div><strong>{tx('Εθνική επιτήρηση μικροβιακής αντοχής','National antimicrobial resistance surveillance')}</strong><span>{tx('Demo παρουσίαση μικροοργανισμών, αντοχής, τμημάτων και εστιών.','Demo view of microorganisms, resistance, departments and sources.')}</span></div></div><span className="status-badge info">DEMO scope</span></div>
    <div className="national-kpi-strip">{mandatory.map(item=><article key={item.id} style={{'--organism-color':item.tone}}><span>{item.label}</span><strong>{item.count}</strong><small>{tx('καταγραφές / ευρήματα','records / findings')}</small></article>)}</div>
    <div className="analysis-chart-grid national-main-grid"><article className="analysis-chart-card"><header><div><strong>{tx('Πού εμφανίστηκαν','Where they occurred')}</strong><span>{tx('Heatmap μικροοργανισμός × τμήμα','Microorganism × department heatmap')}</span></div><MapPin size={17}/></header><div className="organism-heatmap"><div className="heatmap-head"><span>{tx('Μικροοργανισμός','Microorganism')}</span>{departments.map(d=><span key={d}>{d}</span>)}</div>{organismTotals.slice(0,7).map(([organism])=><div className="heatmap-row" key={organism}><strong>{organism}</strong>{departments.map(dept=>{const value=rows.filter(r=>r.organism===organism&&r.department===dept).reduce((s,r)=>s+r.count,0);const alpha=value?Math.max(.12,Math.min(.9,value/maxCell+.12)):0;return <span key={dept} className={value?'filled':''} style={value?{background:`rgba(40,120,208,${alpha})`}:undefined}>{value||'—'}</span>})}</div>)}</div></article><article className="analysis-chart-card"><header><div><strong>{tx('Εστία / σημείο εμφάνισης','Source / site')}</strong><span>{tx('Κατανομή ευρημάτων ανά πηγή','Findings by source')}</span></div><Microscope size={17}/></header><div className="source-distribution">{sourceTotals.map(([label,value],i)=><div key={label}><div><span>{label}</span><strong>{value}</strong></div><i><b style={{width:`${Math.min(100,value/Math.max(1,sourceTotals[0]?.[1])*100)}%`,background:COLORS[i%COLORS.length]}}/></i></div>)}</div></article></div>
    <div className="analysis-chart-grid national-secondary-grid"><article className="analysis-chart-card analysis-trend-card"><header><div><strong>{tx('Τάση δηλωτέων / κρίσιμων ευρημάτων','Trend of reportable / critical findings')}</strong><span>12 {tx('μήνες','months')}</span></div></header><LineChart values={DEMO_TRENDS.national} color={COLORS[4]}/></article><article className="analysis-chart-card"><header><div><strong>Top {tx('μικροοργανισμοί','microorganisms')}</strong></div></header><div className="organism-ranking">{organismTotals.map(([label,value],i)=><div key={label}><em style={{background:COLORS[i%COLORS.length]}}>{i+1}</em><span>{label}</span><strong>{value}</strong></div>)}</div></article></div>
    {platform&&<Comparison rows={(organizations||[]).slice(0,6).map((item,i)=>[item.name,30-i*3,9-i])} tx={tx}/>} 
  </>
}

function ProductionNationalSurveillance({details,platform,tx}){
  const organisms=details?.microorganisms||[]
  const resistance=details?.resistance||[]
  return <>
    <div className="national-callout"><div><ShieldAlert size={18}/><div><strong>{tx('Μικροοργανισμοί & μικροβιακή αντοχή','Microorganisms & antimicrobial resistance')}</strong><span>{tx('Πραγματικά θετικά μικροβιολογικά αποτελέσματα στο ενεργό scope.','Real positive microbiology results in the active scope.')}</span></div></div><span className="status-badge info">LIVE scope</span></div>
    <div className="analysis-chart-grid national-main-grid"><article className="analysis-chart-card"><header><div><strong>{tx('Συχνότεροι μικροοργανισμοί','Most frequent microorganisms')}</strong><span>{tx('Θετικά αποτελέσματα','Positive results')}</span></div><Microscope size={17}/></header><div className="organism-ranking">{organisms.length?organisms.slice(0,9).map(([label,value],i)=><div key={label}><em style={{background:COLORS[i%COLORS.length]}}>{i+1}</em><span>{label}</span><strong>{value}</strong></div>):<div className="analysis-chart-empty">{tx('Δεν υπάρχουν θετικές καλλιέργειες.','No positive cultures.')}</div>}</div></article><article className="analysis-chart-card"><header><div><strong>AMR / MDR-XDR-PDR</strong><span>{tx('Κατανομή ταξινομήσεων αντοχής','Resistance classification distribution')}</span></div><ShieldAlert size={17}/></header><div className="source-distribution">{resistance.length?resistance.map(([label,value],i)=><div key={label}><div><span>{label}</span><strong>{value}</strong></div><i><b style={{width:`${Math.min(100,Number(value||0)/Math.max(1,...resistance.map(x=>Number(x[1]||0)))*100)}%`,background:COLORS[(i+3)%COLORS.length]}}/></i></div>):<div className="analysis-chart-empty">{tx('Δεν υπάρχουν ταξινομήσεις αντοχής.','No resistance classifications.')}</div>}</div></article></div>
    <article className="analysis-chart-card analysis-trend-card"><header><div><strong>{tx('Τάση θετικών μικροβιολογικών αποτελεσμάτων','Positive microbiology trend')}</strong><span>{tx('ανά μήνα','per month')}</span></div></header><LineChart values={(details?.monthly||[]).map(([,value])=>Number(value)||0)} /></article>
    {platform&&<Comparison rows={details?.byOrganization} tx={tx}/>} 
  </>
}

export function AnalysisPage({platform=false,organizations=[]}){
  const {tenant,role,isDemo}=useTenant()
  const {language}=useLanguage()
  const location=useLocation()
  const navigate=useNavigate()
  const en=language==='en'
  const tx=(elText,enText)=>en?enText:elText
  const [tab,setTab]=useState('overview')
  const [period,setPeriod]=useState('year')
  const [org,setOrg]=useState(platform?hashOrganization(location.hash):'all')
  const [department,setDepartment]=useState('all')
  const [comparison,setComparison]=useState(platform?'hospitals':'year')
  const [summary,setSummary]=useState({})
  const [details,setDetails]=useState(null)
  const [loading,setLoading]=useState(false)
  const [loadError,setLoadError]=useState('')
  const allowed=[ROLES.PLATFORM_OWNER,ROLES.HOSPITAL_ADMIN,ROLES.INFECTION_CONTROL_LEAD,ROLES.DEMO].includes(role)
  const range=useMemo(()=>periodRange(period),[period])
  const returnTo=location.state?.returnTo
  const productionScope=!isDemo&&(platform||Boolean(tenant?.id))
  const scopeOrganizationId=platform?(org==='all'?'':org):(tenant?.id||'')

  useEffect(()=>{
    if(!productionScope)return
    let alive=true
    setLoading(true);setLoadError('')
    Promise.all([
      loadGlobalReportSummary({organizationId:scopeOrganizationId,...range}),
      loadPlatformAnalyticsDetails({organizationId:scopeOrganizationId,...range}),
    ]).then(([nextSummary,nextDetails])=>{if(!alive)return;setSummary(nextSummary||{});setDetails(nextDetails||null)}).catch(error=>{if(!alive)return;setSummary({});setDetails(null);setLoadError(error?.message||'ANALYTICS_LOAD_FAILED')}).finally(()=>{if(alive)setLoading(false)})
    return ()=>{alive=false}
  },[productionScope,scopeOrganizationId,range])

  if(!allowed)return <div className="empty-state"><strong>{tx('Δεν υπάρχει πρόσβαση στην Ανάλυση.','Analytics access is not available.')}</strong></div>

  const productionKpi={
    overview:[[tx('Θετικές καλλιέργειες','Positive cultures'),details?.totalPositive??0,'—','up'],[tx('Κρίσιμα αποτελέσματα','Critical results'),details?.totalCritical??0,'—','down'],[tx('Επιτήρηση','Surveillance'),summary.surveillance??0,'—','up'],[tx('Εργαστήριο','Laboratory'),summary.laboratory??0,'—','up'],[tx('Πρόληψη','Prevention'),summary.prevention??0,'—','up'],[tx('Έλεγχοι','Controls'),summary.controls??0,'—','up']],
    national:[[tx('Θετικές καλλιέργειες','Positive cultures'),details?.totalPositive??0,'—','up'],['MDR/XDR/PDR',(details?.resistance||[]).reduce((sum,row)=>sum+Number(row[1]||0),0),'—','down'],[tx('Μικροοργανισμοί','Microorganisms'),details?.microorganisms?.length??0,'—','up'],[tx('Κρίσιμα αποτελέσματα','Critical results'),details?.totalCritical??0,'—','down']],
    laboratory:[[tx('Εργαστηριακές καταγραφές','Laboratory records'),summary.laboratory??0,'—','up'],[tx('Θετικές καλλιέργειες','Positive cultures'),details?.totalPositive??0,'—','up'],[tx('Κρίσιμα αποτελέσματα','Critical results'),details?.totalCritical??0,'—','down']],
    amr:[[tx('Θετικά αποτελέσματα','Positive results'),details?.totalPositive??0,'—','up'],['MDR/XDR/PDR',(details?.resistance||[]).reduce((sum,row)=>sum+Number(row[1]||0),0),'—','down']],
    surveillance:[[tx('Καταγραφές επιτήρησης','Surveillance records'),summary.surveillance??0,'—','up']],
    antimicrobials:[[tx('Αντιμικροβιακά','Antimicrobials'),summary.antimicrobial??0,'—','up']],
    prevention:[[tx('Πρόληψη','Prevention'),summary.prevention??0,'—','up']],
    hand:[[tx('Υγιεινή χεριών','Hand hygiene'),summary.handHygiene??0,'—','up']],
    controls:[[tx('Έλεγχοι','Controls'),summary.controls??0,'—','up']],
    occupational:[[tx('Εργαζόμενοι','Employees'),summary.occupationalHealth??0,'—','up']],
    quality:[[tx('Ποιότητα','Quality'),summary.quality??0,'—','up']],
    training:[[tx('Εκπαίδευση','Training'),summary.training??0,'—','up']],
    governance:[[tx('Έγγραφα / Governance','Documents / Governance'),summary.documents??0,'—','up'],[tx('Επιτροπές','Committees'),summary.committees??0,'—','up']],
  }
  const rows=isDemo?(DEMO_KPI[tab]||DEMO_KPI.overview):(productionKpi[tab]||productionKpi.overview)
  const trend=isDemo?(DEMO_TRENDS[tab]||DEMO_TRENDS.overview):(details?.monthly||[]).map(([,value])=>Number(value)||0)
  const groupRows=isDemo?[['ΜΕΘ',72,58],['Παθολογική',54,47],['Χειρουργική',41,35],['ΤΕΠ',29,24],['Αιμοκάθαρση',22,19]]:(platform&&details?.byOrganization?.length?details.byOrganization.slice(0,5).map(([name,total,resistant])=>[name,total,resistant]):[])
  const currentTitle=TABS.find(x=>x[0]===tab)?.[en?2:1]

  return <div className="analysis-workspace">
    <div className="analysis-header"><div className="analysis-heading-row">{returnTo&&!platform&&<BackButton onClick={()=>navigate(returnTo)} label={tx('Πίσω','Back')}/>}<div><span className="eyebrow">ANALYTICS & REPORTING</span><h1>{tx('Ανάλυση','Analytics')}</h1><p>{platform?tx('Συγκεντρωτική και συγκριτική εικόνα πλατφόρμας','Platform-wide aggregate and comparative view'):(tenant?.name||tx('Οργανισμός','Organization'))} · {tx('δείκτες, τάσεις, μικροοργανισμοί, benchmarks και reports.','indicators, trends, microorganisms, benchmarks and reports.')}</p></div></div><div className="analysis-actions"><button className="icon-button" title={tx('Εκτύπωση','Print')} aria-label={tx('Εκτύπωση','Print')} onClick={()=>window.print()}><Printer size={16}/></button><button className="icon-button" title={tx('Εξαγωγή CSV','Export CSV')} aria-label={tx('Εξαγωγή CSV','Export CSV')} onClick={()=>downloadAnalysisCsv(tab,rows.map(([label,value])=>[label,value]))}><Download size={16}/></button></div></div>
    <div className="analysis-sticky"><div className="analysis-filters">{platform&&<label><span>{tx('Οργανισμός','Organization')}</span><select value={org} onChange={e=>setOrg(e.target.value)}><option value="all">{tx('Όλη η πλατφόρμα','Whole platform')}</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}<label><span>{tx('Τμήμα','Department')}</span><select value={department} onChange={e=>setDepartment(e.target.value)}>{DEPARTMENTS.map((x,i)=><option key={x} value={i?x:'all'}>{x}</option>)}</select></label><label><span>{tx('Περίοδος','Period')}</span><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="month">{tx('Μήνας','Month')}</option><option value="quarter">{tx('Τρίμηνο','Quarter')}</option><option value="half">{tx('Εξάμηνο','Half-year')}</option><option value="year">{tx('Έτος','Year')}</option></select></label>{platform&&<label><span>{tx('Σύγκριση','Comparison')}</span><select value={comparison} onChange={e=>setComparison(e.target.value)}><option value="hospitals">{tx('Οργανισμός ↔ Οργανισμός','Organization ↔ Organization')}</option><option value="platform">{tx('Οργανισμός ↔ Platform benchmark','Organization ↔ Platform benchmark')}</option><option value="year">{tx('Έτος ↔ Έτος','Year ↔ Year')}</option></select></label>}</div><div className="analysis-tabs">{TABS.map(([id,elLabel,enLabel])=><button type="button" key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{en?enLabel:elLabel}</button>)}</div></div>
    <div className="analysis-scroll"><section className="analysis-report"><div className="analysis-section-title"><div><h2>{currentTitle}</h2><p>{isDemo?tx('Πλούσιο demo dataset αποκλειστικά για το Demo environment.','Rich demo dataset only for the Demo environment.'):tx('Πραγματικά δεδομένα αποκλειστικά του ενεργού scope και της επιλεγμένης περιόδου.','Real data only from the active scope and selected period.')}</p></div><div className="analysis-report-badges">{platform&&<span className="status-badge info"><GitCompareArrows size={12}/> PLATFORM SCOPE</span>}{isDemo&&<span className="status-badge temporary">DEMO DATA</span>}</div></div>
      {loading?<div className="analysis-chart-empty">{tx('Φόρτωση ανάλυσης…','Loading analytics…')}</div>:loadError?<div className="analysis-signal-card"><header><div><ShieldAlert size={18}/><div><strong>{tx('Δεν ήταν δυνατή η φόρτωση των analytics.','Analytics could not be loaded.')}</strong><span>{loadError}</span></div></div></header></div>:<>
        <div className="analysis-kpis">{rows.map(([label,value,delta,direction],i)=><article key={label} style={{'--kpi-accent':COLORS[i%COLORS.length]}}><span>{label}</span><strong>{value}</strong><small className={direction==='down'?'good-down':'good-up'}>{direction==='down'?<TrendingDown size={13}/>:<TrendingUp size={13}/>} {delta} <em>{delta==='—'?tx('τρέχον scope','current scope'):tx('vs προηγ. περίοδο','vs previous period')}</em></small></article>)}</div>
        {tab==='national'?(isDemo?<DemoNationalSurveillance platform={platform} organizations={organizations} tx={tx}/>:<ProductionNationalSurveillance details={details} platform={platform} tx={tx}/>):<><div className="analysis-chart-grid"><article className="analysis-chart-card analysis-trend-card"><header><div><strong>{tx('Τάση 12 μηνών','12-month trend')}</strong><span>{tx('Εξέλιξη του βασικού δείκτη της κατηγορίας','Evolution of the category key indicator')}</span></div><span className="analysis-legend"><i style={{background:COLORS[0]}}/>{new Date().getFullYear()}</span></header><LineChart values={trend}/></article><article className="analysis-chart-card"><header><div><strong>{platform?tx('Συγκριτική κατανομή','Comparative distribution'):tx('Κατανομή ανά τμήμα','Distribution by department')}</strong><span>{tx('Τρέχουσα περίοδος έναντι προηγούμενης','Current versus previous period')}</span></div></header><GroupBars rows={groupRows} tx={tx}/><div className="analysis-mini-legend"><span><i style={{background:COLORS[0]}}/>{tx('Τρέχουσα','Current')}</span><span><i style={{background:COLORS[1]}}/>{tx('Σύγκριση','Comparison')}</span></div></article></div>{platform&&<Comparison rows={details?.byOrganization} tx={tx}/>}</>}
        <article className="analysis-chart-card analysis-wide-card"><header><div><strong>Report governance</strong><span>{tx('Το export διατηρεί το ενεργό scope και τα φίλτρα.','Exports preserve the active scope and filters.')}</span></div></header><div className="analysis-summary-grid"><div><span>Scope</span><strong>{platform?(org==='all'?tx('Όλη η πλατφόρμα','Whole platform'):(organizations.find(x=>x.id===org)?.name||tx('Επιλεγμένος οργανισμός','Selected organization'))):(tenant?.name||tx('Οργανισμός','Organization'))}</strong></div><div><span>{tx('Περίοδος','Period')}</span><strong>{range.from} → {range.to}</strong></div><div><span>{tx('Πηγή','Source')}</span><strong>{isDemo?'DEMO DATA':'PRODUCTION'}</strong></div><div><span>{tx('Τελευταία ενημέρωση','Last updated')}</span><strong>{tx('Σήμερα','Today')}</strong></div></div></article>
      </>}
    </section></div>
  </div>
}
