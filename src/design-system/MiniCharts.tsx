import { useId } from 'react'

// Small charts that sit inside a table cell, a key figure or a card: they say
// one thing at a glance and carry no axes. One magnitude hue (the Analysis
// charts' blue); a state reads from its tone and always has a text next to it.
const MAGNITUDE='#2a78d6'

// A share of a whole (0–100): progress of steps, compliance of an audit,
// how close a value is to its target. `tone` colours the fill by state.
export function Meter({value,tone='neutral',label,className=''}){
  if(value==null||Number.isNaN(Number(value)))return null
  const width=Math.max(0,Math.min(100,Number(value)))
  return <span className={`lo-meter is-${tone} ${className}`.trim()} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(width)} aria-label={label} title={label}><i style={{width:`${width}%`}}/></span>
}

// The tone of a percentage against a pass mark (e.g. compliance ≥ 90 %).
export const meterTone=(value,{good=90,fair=75}={})=>value==null?'neutral':value>=good?'success':value>=fair?'warning':'danger'

// A trend in a few months: a 2px line, the last point marked, an optional
// dashed target. Points are numbers or null (no data that month).
export function Sparkline({points=[],target=null,label,width=132,height=34}){
  const gradient=useId().replace(/:/g,'')
  const known=points.map((value,index)=>({value,index})).filter(point=>point.value!=null&&Number.isFinite(Number(point.value)))
  if(known.length<2)return null
  const values=[...known.map(point=>Number(point.value)),...(target==null?[]:[Number(target)])]
  const min=Math.min(...values),max=Math.max(...values),span=max-min||1
  const pad=4
  const x=index=>pad+index*(width-pad*2)/Math.max(1,points.length-1)
  const y=value=>pad+(1-(Number(value)-min)/span)*(height-pad*2)
  const line=known.map((point,i)=>`${i?'L':'M'}${x(point.index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const last=known.at(-1)
  const area=`${line} L${x(last.index).toFixed(1)},${height} L${x(known[0].index).toFixed(1)},${height} Z`
  return <svg className="lo-sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label}>
    <title>{label}</title>
    <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={MAGNITUDE} stopOpacity=".18"/><stop offset="100%" stopColor={MAGNITUDE} stopOpacity="0"/></linearGradient></defs>
    {target!=null&&<line x1={pad} x2={width-pad} y1={y(target)} y2={y(target)} className="lo-sparkline-target"/>}
    <path d={area} fill={`url(#${gradient})`}/>
    <path d={line} fill="none" stroke={MAGNITUDE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    <circle cx={x(last.index)} cy={y(last.value)} r="3.5" fill="#fff" stroke={MAGNITUDE} strokeWidth="2"/>
  </svg>
}
