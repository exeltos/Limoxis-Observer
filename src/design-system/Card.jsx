export function Card({children,className='',size='standard',tone='default',as:Tag='section',...props}){
  return <Tag className={`lo-card lo-card-${size} ${tone!=='default'?`lo-card-${tone}`:''} ${className}`.trim()} {...props}>{children}</Tag>
}

export function CardHeader({title,subtitle,actions,icon:Icon,className=''}) {
  return <header className={`lo-card-header ${className}`.trim()}>
    {Icon&&<span className="lo-card-icon"><Icon size={17}/></span>}
    <div className="lo-card-heading"><strong>{title}</strong>{subtitle&&<small>{subtitle}</small>}</div>
    {actions&&<div className="lo-card-actions">{actions}</div>}
  </header>
}
