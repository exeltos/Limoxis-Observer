import { useEffect,useRef,useState } from 'react'
import './AnalysisCharts.css'

// Validated categorical order (identity) and a single magnitude hue.
// Colour follows the entity's position in the data, never its rank on screen.
export const SERIES_COLORS=['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#4a3aa7','#e34948']
const MAGNITUDE='#2a78d6'
const MONTHS={el:['Ιαν','Φεβ','Μαρ','Απρ','Μάι','Ιούν','Ιούλ','Αύγ','Σεπ','Οκτ','Νοε','Δεκ'],en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']}

const toNumber=value=>{const n=Number(String(value??'').split('/')[0].replace(',','.'));return Number.isFinite(n)?n:0}
export function numericRows(rows){return (rows||[]).filter(([,value])=>value!=='—'&&value!=null).map(([label,value])=>[String(label),toNumber(value)]).filter(([,value])=>value>=0)}
const fmt=(value,en)=>new Intl.NumberFormat(en?'en-GB':'el-GR').format(value)

function monthLabel(key,en){const [y,m]=String(key).split('-');const name=MONTHS[en?'en':'el'][Number(m)-1];return name?`${name} ${String(y).slice(2)}`:String(key)}

export function ChartCard({title,subtitle,wide=false,children}){
 return <article className={`analysis-chart-card analysis-viz-card ${wide?'analysis-wide-card':''}`}><header><div><strong>{title}</strong>{subtitle&&<span>{subtitle}</span>}</div></header>{children}</article>
}

export function EmptyChart({en}){return <div className="analysis-chart-empty">{en?'No data is available for the active scope.':'Δεν υπάρχουν δεδομένα για το ενεργό εύρος.'}</div>}

// Horizontal magnitude bars: one hue, value right-aligned, hover names the mark.
export function BarList({rows,en,max:limit=8}){
 const data=numericRows(rows).slice(0,limit)
 if(!data.length)return <EmptyChart en={en}/>
 const max=Math.max(1,...data.map(([,v])=>v))
 return <div className="viz-bars" role="list">{data.map(([label,value])=><div className="viz-bar-row" role="listitem" key={label} title={`${label}: ${fmt(value,en)}`}>
  <span className="viz-bar-label">{label}</span>
  <span className="viz-bar-track"><i style={{width:`${Math.max(value>0?2:0,value/max*100)}%`,background:MAGNITUDE}}/></span>
  <strong className="viz-bar-value">{fmt(value,en)}</strong>
 </div>)}</div>
}

// Donut for part-to-whole: fixed categorical order, 2px surface gaps, legend
// with value and share; hovering a slice or legend row shows it in the centre.
export function DonutChart({rows,en,centerLabel,max:limit=6}){
 const [active,setActive]=useState(null)
 let data=numericRows(rows).filter(([,v])=>v>0)
 if(data.length>limit){const rest=data.slice(limit-1).reduce((s,[,v])=>s+v,0);data=[...data.slice(0,limit-1),[en?'Other':'Λοιπά',rest]]}
 const total=data.reduce((s,[,v])=>s+v,0)
 if(!total)return <EmptyChart en={en}/>
 const size=180,r=70,stroke=26,c=2*Math.PI*r,gap=data.length>1?2:0
 let offset=0
 const slices=data.map(([label,value],index)=>{const len=value/total*c;const slice={label,value,index,dash:Math.max(0,len-gap),offset};offset+=len;return slice})
 const shown=active==null?null:slices[active]
 return <div className="viz-donut">
  <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
   <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#eef2f5" strokeWidth={stroke}/>
   <g transform={`rotate(-90 ${size/2} ${size/2})`}>{slices.map(s=><circle key={s.label} cx={size/2} cy={size/2} r={r} fill="none" stroke={SERIES_COLORS[s.index%SERIES_COLORS.length]} strokeWidth={active===s.index?stroke+6:stroke} strokeDasharray={`${s.dash} ${c-s.dash}`} strokeDashoffset={-s.offset} opacity={active==null||active===s.index?1:.35} onMouseEnter={()=>setActive(s.index)} onMouseLeave={()=>setActive(null)} style={{cursor:'pointer',transition:'opacity .12s, stroke-width .12s'}}><title>{`${s.label}: ${fmt(s.value,en)} (${Math.round(s.value/total*100)}%)`}</title></circle>)}</g>
   <text x="50%" y="47%" textAnchor="middle" className="viz-donut-value">{fmt(shown?shown.value:total,en)}</text>
   <text x="50%" y="59%" textAnchor="middle" className="viz-donut-caption">{shown?`${Math.round(shown.value/total*100)}%`:centerLabel}</text>
  </svg>
  <ul className="viz-legend">{slices.map(s=><li key={s.label} className={active===s.index?'is-active':''} onMouseEnter={()=>setActive(s.index)} onMouseLeave={()=>setActive(null)}>
   <i style={{background:SERIES_COLORS[s.index%SERIES_COLORS.length]}}/><span>{s.label}</span><strong>{fmt(s.value,en)}</strong><em>{Math.round(s.value/total*100)}%</em>
  </li>)}</ul>
 </div>
}

// Monthly trend: 2px line over a soft area, >=8px markers, recessive grid,
// crosshair + tooltip on hover (the whole column is the hit target).
export function TrendChart({points,en,label}){
 const [hover,setHover]=useState(null)
 const wrapRef=useRef(null),[width,setWidth]=useState(640)
 useEffect(()=>{const el=wrapRef.current;if(!el||typeof ResizeObserver==='undefined')return undefined;const ro=new ResizeObserver(([entry])=>{const next=Math.round(entry.contentRect.width);if(next>0)setWidth(next)});ro.observe(el);return()=>ro.disconnect()},[])
 const data=(points||[]).map(([key,value])=>[key,toNumber(value)])
 if(data.length<2)return <EmptyChart en={en}/>
 const w=Math.max(320,width),h=220,pl=34,pr=26,pt=14,pb=28
 const max=Math.max(1,...data.map(([,v])=>v)),niceMax=Math.ceil(max/4)*4||4
 const x=i=>pl+i*(w-pl-pr)/(data.length-1),y=v=>pt+(1-v/niceMax)*(h-pt-pb)
 const line=data.map(([,v],i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' ')
 const area=`${line} L${x(data.length-1)},${y(0)} L${x(0)},${y(0)} Z`
 const ticks=[0,1,2,3,4].map(k=>niceMax*k/4)
 const step=(w-pl-pr)/(data.length-1)
 const labelEvery=Math.max(1,Math.ceil(data.length/Math.max(2,Math.floor(w/70))))
 return <div className="viz-trend" ref={wrapRef}>
  <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} onMouseLeave={()=>setHover(null)}>
   <defs><linearGradient id="vizTrendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={MAGNITUDE} stopOpacity=".22"/><stop offset="100%" stopColor={MAGNITUDE} stopOpacity="0"/></linearGradient></defs>
   {ticks.map(t=><g key={t}><line x1={pl} x2={w-pr} y1={y(t)} y2={y(t)} className="viz-grid"/><text x={pl-8} y={y(t)+4} textAnchor="end" className="viz-axis">{fmt(t,en)}</text></g>)}
   {data.map(([key],i)=>i%labelEvery===0&&<text key={key} x={x(i)} y={h-8} textAnchor={i===data.length-1?'end':i===0?'start':'middle'} className="viz-axis">{monthLabel(key,en)}</text>)}
   <path d={area} fill="url(#vizTrendFill)"/>
   <path d={line} fill="none" stroke={MAGNITUDE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
   {hover!=null&&<line x1={x(hover)} x2={x(hover)} y1={pt} y2={h-pb} className="viz-crosshair"/>}
   {data.map(([,v],i)=><circle key={i} cx={x(i)} cy={y(v)} r={hover===i?6:4} fill="#fff" stroke={MAGNITUDE} strokeWidth="2"/>)}
   {data.map(([key],i)=><rect key={`hit-${key}`} x={x(i)-step/2} y={pt} width={step} height={h-pt-pb} fill="transparent" onMouseEnter={()=>setHover(i)}/>)}
  </svg>
  {hover!=null&&<div className="viz-tooltip" style={{left:`${x(hover)/w*100}%`}}><span>{monthLabel(data[hover][0],en)}</span><strong>{fmt(data[hover][1],en)}</strong></div>}
 </div>
}
