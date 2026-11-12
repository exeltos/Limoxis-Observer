import { ChevronRight } from 'lucide-react'
import './Breadcrumbs.css'

// Where a nested view sits inside its record: earlier steps are links back,
// the last one is the current view. Used instead of a second Back button.
export function Breadcrumbs({items=[],ariaLabel,className=''}){
  return <nav className={`lo-breadcrumbs ${className}`.trim()} aria-label={ariaLabel}>
    <ol>
      {items.map((item,index)=>{
        const last=index===items.length-1
        return <li key={`${index}-${item.label}`}>
          {!last&&item.onClick?<button type="button" onClick={item.onClick}>{item.label}</button>:<span aria-current={last?'page':undefined}>{item.label}</span>}
          {!last&&<ChevronRight size={12} aria-hidden="true"/>}
        </li>
      })}
    </ol>
  </nav>
}
