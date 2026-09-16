export function CanonicalTabs({items,value,onChange,ariaLabel,className=''}){
  return <nav className={`canonical-tabs ${className}`.trim()} aria-label={ariaLabel}>
    {items.map(item=>{const Icon=item.icon;return <button key={item.value} type="button" className={`canonical-tab ${value===item.value?'active':''}`} aria-selected={value===item.value} onClick={()=>onChange(item.value)}>{Icon&&<Icon aria-hidden="true"/>}<span>{item.label}</span></button>})}
  </nav>
}
