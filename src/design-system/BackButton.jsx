import { ArrowLeft } from 'lucide-react'

export function BackButton({onClick,label='Back',className=''}){
  return <button type="button" className={`entity-record-icon-button back lo-back-button ${className}`.trim()} onClick={onClick} title={label} aria-label={label}><ArrowLeft size={16}/></button>
}
