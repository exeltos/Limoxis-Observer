import { useTabStrip } from './useTabStrip'

// item.count: an optional number that needs attention, shown next to the label.
export function CanonicalTabs({items,value,onChange,ariaLabel,className=''}){
  const stripRef=useTabStrip(value)
  return <nav ref={stripRef} className={`canonical-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
    {items.map(item=>{const Icon=item.icon;return <button key={item.value} type="button" role="tab" className={`canonical-tab ${value===item.value?'active':''}`} aria-selected={value===item.value} onClick={()=>onChange(item.value)}>{Icon&&<Icon aria-hidden="true"/>}<span>{item.label}</span>{item.count>0&&<b className="canonical-tab-count">{item.count}</b>}</button>})}
  </nav>
}
