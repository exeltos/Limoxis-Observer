export function Card({title,children,className=''}) { return <section className={`card ${className}`}><div className="card-title">{title}</div>{children}</section> }
