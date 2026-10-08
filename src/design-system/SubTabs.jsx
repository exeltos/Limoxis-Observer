import './SubTabs.css'

// Second-level tabs inside a section (a section's sub-sections), drawn as
// folder tabs under the section's own ModuleTabs. Same API as ModuleTabs.
export function SubTabs({tabs=[],activeId,onChange,className='',ariaLabel}){
  return <div className={`lo-subtabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
    {tabs.map(tab=>{
      const Icon=tab.icon
      const active=tab.id===activeId
      return <button key={tab.id} type="button" role="tab" aria-selected={active} className={active?'active':''} disabled={tab.disabled} onClick={()=>onChange?.(tab.id)}>
        {Icon&&<Icon size={14} aria-hidden="true"/>}
        <span>{tab.label}</span>
        {tab.count!=null&&<span className="lo-subtabs-count">{tab.count}</span>}
      </button>
    })}
  </div>
}
