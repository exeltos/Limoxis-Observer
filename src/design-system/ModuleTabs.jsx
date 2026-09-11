export function ModuleTabs({
  tabs=[],
  activeId,
  onChange,
  className='',
  ariaLabel,
}){
  return <nav className={`tabs canonical-module-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
    {tabs.map(tab=>{
      const Icon=tab.icon
      const active=tab.id===activeId
      return <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={active}
        className={`tab ${active?'active':''}`.trim()}
        disabled={tab.disabled}
        onClick={()=>onChange?.(tab.id)}
      >
        {Icon&&<Icon size={15} aria-hidden="true"/>}
        <span>{tab.label}</span>
        {tab.count!=null&&<span className="tab-count" aria-label={`${tab.count}`}>{tab.count}</span>}
      </button>
    })}
  </nav>
}
