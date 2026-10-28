import { AlertOctagon, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Minus } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { Meter, Sparkline } from './MiniCharts'
import './KpiCard.css'

// The one key-figure card of every screen (role homes, Indicators, Pharmacy,
// Kitchen, Quality): a label with its period, the value with its unit, how it
// stands against its target and how it moved since the previous period.
// The counts above a list that filter it stay on MetricCard / StatusCards.
//
// status: 'good' | 'warning' | 'danger' (against the target) · target: «στόχος ≥ 80%»
// delta: { text, trend: 'up'|'down'|'flat', good: true|false|null, title }
// meter: 0–100 (a thin bar, `meterTarget` marks the target) · trend: numbers for a sparkline
// loading: the value is not known yet · error: it could not be read (never shown as «—»)
const STATUS={good:[CheckCircle2,'Εντός στόχου','On target','success'],warning:[AlertTriangle,'Προσοχή','Watch','warning'],danger:[AlertOctagon,'Εκτός στόχου','Off target','danger']}
const TRENDS={up:ArrowUpRight,down:ArrowDownRight,flat:Minus}

export function KpiCard({icon:Icon,label,value,unit='',period,status,statusLabel,target,delta,hint,meter,meterTarget,trend,loading=false,error=false,onOpen,className=''}){
  const {language}=useLanguage()
  const en=language==='en'
  const [StatusIcon,el,enLabel,meterTone]=STATUS[status]||[]
  const tone=loading||error?'neutral':status||'neutral'
  const shown=value==null||value===''?'—':value
  const DeltaIcon=TRENDS[delta?.trend]||Minus
  const body=<>
    <span className="lo-kpi-head">{Icon&&<span className="lo-kpi-icon" aria-hidden="true"><Icon/></span>}<span className="lo-kpi-label" title={typeof label==='string'?label:undefined}>{label}</span>{period&&<em className="lo-kpi-period">{period}</em>}</span>
    {loading?<span className="lo-kpi-skeleton" aria-hidden="true"><i/><i/></span>
      :error?<small className="lo-kpi-error">{typeof error==='string'?error:en?'Not loaded':'Δεν φορτώθηκε'}</small>
      :<>
        {/* Compact: the value with its bar on one row, then one row for status, target, note and change. */}
        <span className="lo-kpi-main">
          <strong className="lo-kpi-value">{shown}{unit&&shown!=='—'&&<small>{unit}</small>}</strong>
          {meter!=null&&<span className="lo-kpi-meter"><Meter value={meter} tone={meterTone||'neutral'} label={`${label}: ${Math.round(meter)}%`}/>{meterTarget!=null&&<b style={{left:`${Math.max(0,Math.min(100,meterTarget))}%`}} aria-hidden="true"/>}</span>}
          {trend&&<span className="lo-kpi-trend"><Sparkline points={trend} label={label} width={88} height={26}/></span>}
        </span>
        {(StatusIcon&&shown!=='—'||target||hint||delta)&&<span className="lo-kpi-line">
          {StatusIcon&&shown!=='—'&&<span className={`lo-kpi-status is-${status}`}><StatusIcon aria-hidden="true"/>{statusLabel||(en?enLabel:el)}</span>}
          {target&&<span className="lo-kpi-target">{target}</span>}
          {delta&&<span className={`lo-kpi-delta ${delta.good==null?'is-flat':delta.good?'is-better':'is-worse'}`} title={delta.title||delta.text}><DeltaIcon aria-hidden="true"/>{delta.text}</span>}
          {hint&&<small className="lo-kpi-hint" title={typeof hint==='string'?hint:undefined}>{hint}</small>}
        </span>}
      </>}
  </>
  const classes=`lo-kpi tone-${tone} ${className}`.trim()
  return onOpen
    ?<button type="button" className={classes} onClick={onOpen} aria-busy={loading||undefined}>{body}</button>
    :<article className={classes} aria-busy={loading||undefined}>{body}</article>
}

// A row of key-figure cards: `columns` (default 4) across on a wide screen, at most 3 on a small
// laptop, 2 on a tablet, 1 on a phone.
export function KpiStrip({children,label,className='',columns}){
  return <div className={`lo-kpi-strip ${className}`.trim()} role="group" aria-label={label} style={columns?{'--kpi-columns':columns,'--kpi-columns-md':Math.min(columns,3)}:undefined}>{children}</div>
}

// The figures above a list that filter it, on the same card: at most four, each a
// button that filters (`active` while its filter is on). A count that needs attention
// takes its tone (`tone`: 'danger' | 'warning') once it is above 0.
// figure: { key, icon, value, unit, label, tone, status, statusLabel, target, hint, period, active, go }
export function KpiFigures({figures,label,loading=false,className=''}){
  const shown=figures.filter(Boolean).slice(0,4)
  if(!shown.length)return null
  return <KpiStrip label={label} columns={shown.length} className={`lo-kpi-figures ${className}`.trim()}>
    {shown.map(figure=>{const count=Number(figure.value);const status=figure.status!==undefined?figure.status:figure.tone&&count>0?figure.tone:null
      return <KpiCard key={figure.key} loading={loading||figure.loading} icon={figure.icon} label={figure.label} value={figure.value} unit={figure.unit} period={figure.period} status={status} statusLabel={figure.statusLabel} target={figure.target} hint={figure.hint} className={figure.active?'is-active':''} onOpen={figure.go}/>})}
  </KpiStrip>
}
