import { useMemo } from 'react'
import { AlertOctagon,AlertTriangle,CalendarClock,Gauge,ShieldAlert } from 'lucide-react'
import { MetricCard } from '../../../design-system/MetricCard'
import { summarizeRisks } from './riskModel'
import { L,fmtDate } from './riskUi'

// Change against the previous assessment, signed; lower is better for every figure here.
function Delta({value,previous,digits=0}){
 if(previous==null||value==null)return null
 const diff=Number((value-previous).toFixed(digits))
 const text=diff===0?'=':`${diff>0?'+':'−'}${String(Math.abs(diff)).replace('.',',')}`
 return <small className={`risk-kpi-delta ${diff>0?'up':diff<0?'down':'same'}`}>{text}</small>
}

// Quality Center → Risk assessment: the latest assessment at a glance, as in the other tabs.
export function RiskSummaryStrip({items,en,locale}){
 const [latest,previous]=useMemo(()=>[...items].sort((a,b)=>String(b.assessedOn).localeCompare(String(a.assessedOn))),[items])
 const now=useMemo(()=>latest?summarizeRisks(latest.risks||[]):null,[latest])
 const before=useMemo(()=>previous?summarizeRisks(previous.risks||[]):null,[previous])
 if(!latest)return null
 const avg=now.averages.residual,prevAvg=before?.averages.residual
 const label=(text)=>`${text} · ${latest.periodLabel}`
 return <div className="workspace-summary quality-summary"><div className="module-summary-strip risk-kpi-strip">
  <MetricCard icon={ShieldAlert} value={<>{now.total}<Delta value={now.total} previous={before?.total}/></>} label={label(L(en,'Κίνδυνοι','Risks'))}/>
  <MetricCard icon={AlertOctagon} tone="danger" value={<>{now.levels.residual.very_high}<Delta value={now.levels.residual.very_high} previous={before?.levels.residual.very_high}/></>} label={L(en,'Πολύ υψηλοί (υπολειπόμενοι)','Very high (residual)')}/>
  <MetricCard icon={AlertTriangle} tone="warning" value={<>{now.levels.residual.high}<Delta value={now.levels.residual.high} previous={before?.levels.residual.high}/></>} label={L(en,'Υψηλοί (υπολειπόμενοι)','High (residual)')}/>
  <MetricCard icon={Gauge} value={<>{avg==null?'—':String(avg).replace('.',',')}<Delta value={avg} previous={prevAvg} digits={1}/></>} label={L(en,'Μέσος υπολειπόμενος βαθμός','Average residual score')}/>
  <MetricCard icon={CalendarClock} value={fmtDate(latest.nextReviewOn,locale)||'—'} label={L(en,'Επόμενη αξιολόγηση','Next assessment')}/>
 </div></div>
}
