import { ArrowLeft } from 'lucide-react'
import { IconButton } from './IconButton'

export function BackButton({onClick,label='Back',className=''}){
  return <IconButton label={label} tone="neutral" className={`entity-record-icon-button back lo-back-button ${className}`.trim()} onClick={onClick}><ArrowLeft size={16}/></IconButton>
}
