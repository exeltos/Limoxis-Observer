export function Page({navigation,title,subtitle,actions,children,fill=false,className=''}) {
  return (
    <section className={`page ${fill?'page-fill':''} ${className}`.trim()}>
      <header className="page-header">
        <div className="page-heading-group">
          {navigation&&<div className="page-navigation">{navigation}</div>}
          <div className="page-heading-copy">
            <h1>{title}</h1>
            {subtitle&&<p>{subtitle}</p>}
          </div>
        </div>
        {actions&&<div className="page-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}
