import { ArrowLeft } from 'lucide-react'
import type { MouseEventHandler } from 'react'
import { IconButton } from './IconButton'

interface BackButtonProps { onClick?: MouseEventHandler<HTMLButtonElement>; label?: string; className?: string }

export function BackButton({onClick,label='Back',className=''}: BackButtonProps){
  return <IconButton label={label} tone="neutral" className={`entity-record-icon-button back lo-back-button ${className}`.trim()} onClick={onClick}><ArrowLeft size={16}/></IconButton>
}
