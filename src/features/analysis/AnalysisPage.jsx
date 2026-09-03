import { useEffect,useMemo,useState } from 'react'
import { Activity,BarChart3,Download,FlaskConical,GitCompareArrows,Microscope,Printer,ShieldAlert,TrendingUp } from 'lucide-react'
import { useLocation,useNavigate } from 'react-router-dom'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { ROLES } from '../../core/permissions/roles'
import { BackButton } from '../../design-system/BackButton'
import { IconButton } from '../../design-system/IconButton'
import { Page } from '../../design-system/Page'
import { loadGlobalReportSummary,loadPlatformAnalyticsDetails } from '../platform/platformService'

const TABS=[
  ['overview','Σύνοψη','Overview'],
  ['national','Μικροοργανισμοί','Microorganisms'],
  ['surveillance','Επιτήρηση & HAI','Surveillance & HAI'],
  ['laboratory','Μικροβιολογία','Microbiology'],
  ['amr','AMR / MDR-XDR','AMR / MDR-XDR'],
  ['antimicrobials','Αντιμικροβιακά','Antimicrobials'],
  ['prevention','Πρόληψη','Prevention'],
  ['hand','Υγιεινή Χεριών','Hand hygiene'],
  ['controls','Έλεγχοι','Controls'],
  ['occupational','Εργαζόμενοι','Employees'],
  ['quality','Ποιότητα','Quality'],
  ['training','Εκπαίδευση','Training'],
  ['governance','Governance','Governance'],
]

const DOMAIN_META={
  surveillance:['surveillance','Επιτήρηση','Surveillance'],
  laboratory:['laboratory','Εργαστήριο','Laboratory'],
  antimicrobials:['antimicrobial','Αντιμικροβιακά','Antimicrobials'],
  prevention:['prevention','Πρόληψη','Prevention'],
  hand:['handHygiene','Υγιεινή χεριών','Hand hygiene'],
  controls:['controls','Έλεγχοι','Controls'],
  occupational:['occupationalHealth','Εργαζόμενοι','Employees'],
  quality:['quality','Ποιότητα','Quality'],
  training:['training','Εκπαίδευση','Training'],
  governance:['documents','Έγγραφα / Governance','Documents / Governance'],
}

const DEMO_KPI={
  overview:[['HAI / 1.000 κλινοημέρες','3,5'],['MDR/XDR rate','12,4%'],['Υγιεινή χεριών','88%'],['DDD / 1.000 κλινοημέρες','58'],['Bundle compliance','91%'],['Έλεγχοι στην ώρα τους','95%']],
  surveillance:[['HAI prevalence (PPS)','12,1%'],['HAI / 1.000 κλινοημέρες','3,5'],['CLABSI / 1.000 CVC-days','1,7'],['CAUTI / 1.000 catheter-days','2,1']],
  laboratory:[['Θετικές καλλιέργειες','184'],['Critical ≤30′','94%'],['MDR/XDR isolates','42'],['Median TAT','16 h']],
  amr:[['MDR/XDR rate','12,4%'],['Carbapenem resistance','21%'],['MRSA','8,2%'],['VRE','5,6%']],
  antimicrobials:[['DDD / 1.000 κλιν/ρες','58'],['Carbapenem DDD','12'],['Reserve share','7,4%'],['Reviews ≤72h','91%']],
  prevention:[['Bundle compliance','91%'],['Έγκαιρη απομόνωση','96%'],['Waste segregation','93%'],['Antiseptic target','89%']],
  hand:[['Compliance','88%'],['Παρατηρήσεις','1.248'],['Glove misuse','7%'],['Training coverage','94%']],
  controls:[['On-time','95%'],['Open deviations','12'],['Overdue','5'],['Completion','97%']],
  occupational:[['Vaccination coverage','86%'],['Ιατρικές επισκέψεις','312'],['Overdue visits','24'],['Follow-up','98%']],
  quality:[['CAPA ≤30d','89%'],['Open findings','18'],['Audits','31'],['Docs in-date','96%']],
  training:[['Coverage','92%'],['Completions','1.034'],['Overdue','44'],['Pass rate','94%']],
  governance:[['Audit completeness','99%'],['Committees active','94%'],['Policies in-date','96%'],['Documents','18']],
}

function hashOrganization(hash=''){
  const query=hash.includes('?')?hash.split('?')[1]:''
  return new URLSearchParams(query).get('organization')||'all'
}

function periodRange(period){
  const end=new Date()
  const start=new Date(end)
  if(period==='month')start.setDate(start.getDate()-30)
  else if(period==='quarter')start.setDate(start.getDate()-90)
  else if(period==='half')start.setMonth(start.getMonth()-6)
  else start.setFullYear(start.getFullYear()-1)
  return {from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)}
}

function exportCsv(filename,rows){
  const csv=rows.map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\n')
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})
  const link=document.createElement('a')
  link.href=URL.createObjectURL(blob)
  link.download=filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function TrendChart({rows,emptyLabel}){
  if(!rows?.length)return <div className="analytics-chart-empty">{emptyLabel}</div>
  const values=rows.map(([,value])=>Number(value)||0)
  const max=Math.max(...values,1)
  const w=760,h=220,p=28
  const points=values.map((value,index)=>`${p+index*((w-p*2)/Math.max(values.length-1,1))},${h-p-(value/max)*(h-p*2)}`).join(' ')
  return <div className="analytics-trend-chart"><svg viewBox={`0 0 ${w} ${h}`} role="img">{[0,1,2,3].map(index=><line key={index} x1={p} x2={w-p} y1={p+index*(h-p*2)/3} y2={p+index*(h-p*2)/3}/>) }<polyline points={points}/>{points.split(' ').map((point,index)=>{const [x,y]=point.split(',');return <circle key={index} cx={x} cy={y} r="4"/>})}</svg><div className="analytics-trend-labels">{rows.map(([label])=><span key={label}>{label.slice(5)}</span>)}</div></div>
}

function HorizontalBars({rows,emptyLabel,valueSuffix=''}){
  if(!rows?.length)return <div className="analytics-chart-empty">{emptyLabel}</div>
  const max=Math.max(...rows.map(([,value])=>Number(value)||0),1)
  return <div className="analytics-bars">{rows.map(([label,value],index)=><div className="analytics-bar-row" key={`${label}-${index}`}><span title={label}>{label}</span><div><i style={{width:`${Math.max(4,(Number(value)||0)/max*100)}%`}}/></div><strong>{value}{valueSuffix}</strong></div>)}</div>
}

function OrganizationComparison({rows,tx}){
  if(!rows?.length)return <div className="analytics-chart-empty">{tx('Δεν υπάρχουν συγκρίσιμα δεδομένα οργανισμών.','No comparable organization data.')}</div>
  return <div className="analytics-org-comparison"><div className="analytics-org-head"><span>{tx('Οργανισμός','Organization')}</span><span>{tx('Θετικά','Positive')}</span><span>MDR/XDR/PDR</span><span>{tx('Αντοχή','Resistance')}</span></div>{rows.map(([name,total,resistant])=>{const rate=total?Math.round(resistant/total*100):0;return <div className="analytics-org-row" key={name}><strong>{name}</strong><span>{total}</span><span>{resistant}</span><div className="analytics-rate"><i style={{width:`${rate}%`}}/><b>{rate}%</b></div></div>})}</div>
}

function MetricCards({rows,subtitle}){
  return <div className="analytics-kpi-grid">{rows.map(([label,value])=><article className="analytics-kpi" key={label}><span>{label}</span><strong>{value}</strong><small>{subtitle}</small></article>)}</div>
}

function ProductionEmpty({platform,tenant,language}){
  const en=language==='en'
  return <section className="analysis-production-empty" role="status"><div className="analysis-production-empty-icon"><BarChart3 size={24}/></div><strong>{en?'No production analytics data for the selected scope':'Δεν υπάρχουν δεδομένα παραγωγής για το επιλεγμένο εύρος'}</strong><span>{en?'Only records stored for the active organization and permitted scope are shown here. Demo or synthetic values are never used as a fallback.':'Εδώ εμφανίζονται αποκλειστικά πραγματικές εγγραφές του ενεργού οργανισμού και του επιτρεπόμενου scope. Demo ή συνθετικές τιμές δεν χρησιμοποιούνται ποτέ ως εναλλακτικά δεδομένα.'}</span><small>{platform?(en?'Platform scope':'Επίπεδο πλατφόρμας'):(tenant?.name||(en?'Organization':'Οργανισμός'))}</small></section>
}

export function AnalysisPage({platform=false,organizations=[]}){
  const {tenant,role,isDemo}=useTenant()
  const {language}=useLanguage()
  const location=useLocation()
  const nav=useNavigate()
  const en=language==='en'
  const tx=(elText,enText)=>en?enText:elText
  const [tab,setTab]=useState('overview')
  const [period,setPeriod]=useState('year')
  const [org,setOrg]=useState(platform?hashOrganization(location.hash):'all')
  const [summary,setSummary]=useState({})
  const [details,setDetails]=useState(null)
  const [loading,setLoading]=useState(platform)
  const [loadError,setLoadError]=useState('')
  const allowed=[ROLES.PLATFORM_OWNER,ROLES.HOSPITAL_ADMIN,ROLES.INFECTION_CONTROL_LEAD,ROLES.DEMO].includes(role)
  const returnTo=location.state?.returnTo
  const range=useMemo(()=>periodRange(period),[period])

  useEffect(()=>{
    if(!platform)return
    let alive=true
    setLoading(true);setLoadError('')
    Promise.all([
      loadGlobalReportSummary({organizationId:org==='all'?'':org,...range}),
      loadPlatformAnalyticsDetails({organizationId:org==='all'?'':org,...range}),
    ]).then(([nextSummary,nextDetails])=>{if(!alive)return;setSummary(nextSummary||{});setDetails(nextDetails||null)}).catch(error=>{if(!alive)return;setLoadError(error?.message||'ANALYTICS_LOAD_FAILED');setSummary({});setDetails(null)}).finally(()=>{if(alive)setLoading(false)})
    return ()=>{alive=false}
  },[platform,org,range])

  if(!allowed)return <div className="empty-state"><strong>{tx('Δεν υπάρχει πρόσβαση στην Ανάλυση.','Analytics access is not available.')}</strong></div>

  const sourceDemo=details?.source==='local-demo'||(!platform&&isDemo)
  const overviewRows=platform?[
    [tx('Θετικές καλλιέργειες','Positive cultures'),details?.totalPositive??0],
    [tx('Κρίσιμα αποτελέσματα','Critical results'),details?.totalCritical??0],
    [tx('Καταγραφές επιτήρησης','Surveillance records'),summary.surveillance??0],
    [tx('Εργαστηριακές καταγραφές','Laboratory records'),summary.laboratory??0],
    [tx('Πρόληψη','Prevention records'),summary.prevention??0],
    [tx('Έλεγχοι','Control records'),summary.controls??0],
  ]:(DEMO_KPI[tab]||DEMO_KPI.overview)
  const domainMeta=DOMAIN_META[tab]
  const domainRows=domainMeta?[[en?domainMeta[2]:domainMeta[1],summary[domainMeta[0]]??0]]:overviewRows
  const currentTitle=TABS.find(item=>item[0]===tab)?.[en?2:1]

  function exportCurrent(){
    if(platform){
      const rows=[['Section','Label','Value'],...overviewRows.map(row=>['overview',...row]),...(details?.microorganisms||[]).map(row=>['microorganism',...row]),...(details?.resistance||[]).map(row=>['resistance',...row])]
      exportCsv('limoxis-platform-analytics.csv',rows)
      return
    }
    exportCsv(`limoxis-analysis-${tab}.csv`,[['Metric','Value'],...(DEMO_KPI[tab]||DEMO_KPI.overview)])
  }

  return <Page fill className={`analysis-page ${platform?'platform-analysis-page':''}`.trim()} navigation={returnTo?<BackButton onClick={()=>nav(returnTo)} label={tx('Πίσω','Back')}/>:null} title={tx('Ανάλυση','Analytics')} subtitle={platform?tx('Συγκεντρωτική και συγκριτική εικόνα της πλατφόρμας.','Platform-wide analytics and comparative intelligence.'):tenant?.name||tx('Οργανισμός','Organization')} actions={<><IconButton label={tx('Εκτύπωση','Print')} onClick={()=>window.print()}><Printer size={16}/></IconButton><IconButton label={tx('Εξαγωγή CSV','Export CSV')} onClick={exportCurrent}><Download size={16}/></IconButton></>}>
    <div className="analytics-shell">
      <div className="analytics-toolbar">
        {platform&&<label><span>{tx('Νοσοκομείο','Hospital')}</span><select value={org} onChange={event=>setOrg(event.target.value)}><option value="all">{tx('Όλα τα νοσοκομεία','All hospitals')}</option>{organizations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label><span>{tx('Περίοδος','Period')}</span><select value={period} onChange={event=>setPeriod(event.target.value)}><option value="month">30 {tx('ημέρες','days')}</option><option value="quarter">90 {tx('ημέρες','days')}</option><option value="half">6 {tx('μήνες','months')}</option><option value="year">12 {tx('μήνες','months')}</option></select></label>
        <div className="analytics-scope-note"><Activity size={15}/><span>{range.from} → {range.to}</span></div>
      </div>
      <div className="analytics-tabs">{TABS.map(([id,elLabel,enLabel])=><button type="button" key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{en?enLabel:elLabel}</button>)}</div>

      <div className="analytics-content">
        <header className="analytics-section-header"><div><h2>{currentTitle}</h2><p>{sourceDemo?tx('Συνθετικά δεδομένα απομονωμένου Demo περιβάλλοντος.','Synthetic data from the isolated Demo environment.'):tx('Πραγματικά δεδομένα παραγωγής για το επιλεγμένο scope και την επιλεγμένη περίοδο.','Production data for the selected scope and period.')}</p></div>{sourceDemo&&<span className="status-badge temporary"><FlaskConical size={12}/> DEMO DATA</span>}</header>
        {loading?<div className="analytics-loading">{tx('Φόρτωση ανάλυσης…','Loading analytics…')}</div>:loadError?<div className="analytics-error"><ShieldAlert size={18}/>{tx('Δεν ήταν δυνατή η φόρτωση των analytics.','Analytics could not be loaded.')}</div>:platform&&tab==='overview'?<>
          <MetricCards rows={overviewRows} subtitle={tx('επιλεγμένη περίοδος','selected period')}/>
          <div className="analytics-dashboard-grid">
            <article className="analytics-panel analytics-panel-wide"><header><div><TrendingUp size={17}/><strong>{tx('Τάση θετικών μικροβιολογικών αποτελεσμάτων','Positive microbiology trend')}</strong></div><span>{tx('ανά μήνα','per month')}</span></header><TrendChart rows={details?.monthly} emptyLabel={tx('Δεν υπάρχουν μηνιαία δεδομένα.','No monthly data.')}/></article>
            <article className="analytics-panel"><header><div><Microscope size={17}/><strong>{tx('Συχνότεροι μικροοργανισμοί','Most frequent microorganisms')}</strong></div></header><HorizontalBars rows={(details?.microorganisms||[]).slice(0,7)} emptyLabel={tx('Δεν υπάρχουν θετικές καλλιέργειες.','No positive cultures.')}/></article>
          </div>
          <article className="analytics-panel"><header><div><GitCompareArrows size={17}/><strong>{tx('Συγκριτική εικόνα οργανισμών','Organization comparison')}</strong></div><span>{tx('θετικά αποτελέσματα και αντοχή','positive results and resistance')}</span></header><OrganizationComparison rows={details?.byOrganization} tx={tx}/></article>
        </>:platform&&['national','laboratory'].includes(tab)?<div className="analytics-dashboard-grid">
          <article className="analytics-panel analytics-panel-wide"><header><div><Microscope size={17}/><strong>{tx('Κατανομή μικροοργανισμών','Microorganism distribution')}</strong></div><span>{tx('θετικές καλλιέργειες','positive cultures')}</span></header><HorizontalBars rows={details?.microorganisms} emptyLabel={tx('Δεν υπάρχουν μικροβιολογικά δεδομένα.','No microbiology data.')}/></article>
          <article className="analytics-panel"><header><div><ShieldAlert size={17}/><strong>AMR / MDR-XDR-PDR</strong></div></header><HorizontalBars rows={details?.resistance} emptyLabel={tx('Δεν υπάρχουν ταξινομήσεις αντοχής.','No resistance classifications.')}/></article>
          <article className="analytics-panel analytics-panel-full"><header><div><GitCompareArrows size={17}/><strong>{tx('Σύγκριση οργανισμών','Organization comparison')}</strong></div></header><OrganizationComparison rows={details?.byOrganization} tx={tx}/></article>
        </div>:platform&&tab==='amr'?<>
          <MetricCards rows={[[tx('Θετικά αποτελέσματα','Positive results'),details?.totalPositive??0],[tx('Κρίσιμα αποτελέσματα','Critical results'),details?.totalCritical??0],[tx('MDR/XDR/PDR απομονώματα','MDR/XDR/PDR isolates'),(details?.resistance||[]).reduce((sum,row)=>sum+Number(row[1]||0),0)]]} subtitle={tx('επιλεγμένη περίοδος','selected period')}/>
          <div className="analytics-dashboard-grid"><article className="analytics-panel"><header><div><ShieldAlert size={17}/><strong>{tx('Κατανομή αντοχής','Resistance distribution')}</strong></div></header><HorizontalBars rows={details?.resistance} emptyLabel={tx('Δεν υπάρχουν ταξινομήσεις αντοχής.','No resistance classifications.')}/></article><article className="analytics-panel analytics-panel-wide"><header><div><GitCompareArrows size={17}/><strong>{tx('Αντοχή ανά οργανισμό','Resistance by organization')}</strong></div></header><OrganizationComparison rows={details?.byOrganization} tx={tx}/></article></div>
        </>:platform&&domainMeta?<>
          <MetricCards rows={domainRows} subtitle={tx('καταγραφές στην επιλεγμένη περίοδο','records in selected period')}/>
          <div className="analytics-dashboard-grid"><article className="analytics-panel analytics-panel-wide"><header><div><BarChart3 size={17}/><strong>{tx('Δραστηριότητα πλατφόρμας','Platform activity')}</strong></div><span>{tx('συγκριτική συνολική εικόνα','comparative overview')}</span></header><HorizontalBars rows={Object.values(DOMAIN_META).map(([key,elLabel,enLabel])=>[en?enLabel:elLabel,summary[key]??0]).sort((a,b)=>b[1]-a[1])} emptyLabel={tx('Δεν υπάρχουν δεδομένα.','No data.')}/></article><article className="analytics-panel"><header><div><Microscope size={17}/><strong>{tx('Μικροβιολογικό context','Microbiology context')}</strong></div></header><HorizontalBars rows={(details?.microorganisms||[]).slice(0,6)} emptyLabel={tx('Δεν υπάρχουν δεδομένα.','No data.')}/></article></div>
        </>:isDemo?<MetricCards rows={DEMO_KPI[tab]||DEMO_KPI.overview} subtitle={tx('συνθετικό demo δεδομένο','synthetic demo value')}/>:<ProductionEmpty platform={platform} tenant={tenant} language={language}/>} 
      </div>
    </div>
  </Page>
}
