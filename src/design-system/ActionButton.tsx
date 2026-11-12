import { Button } from './Button'
import type { ButtonProps } from './Button'
import { IconButton } from './IconButton'

const variantForTone: Record<string, string>={
  primary:'primary',
  neutral:'secondary',
  edit:'secondary',
  danger:'secondary',
  success:'secondary',
}

interface ActionButtonProps extends ButtonProps {
  label?: string
  // primary, neutral, edit, danger or success.
  tone?: string
  iconOnly?: boolean
}

export function ActionButton({label,tone='neutral',iconOnly=false,className='',children,...props}: ActionButtonProps){
  if(iconOnly)return <IconButton label={label} tone={tone} className={className} {...props}>{children}</IconButton>
  return <Button variant={variantForTone[tone]||'secondary'} className={`lo-action-button lo-action-button-${tone} ${className}`.trim()} {...props}>{children}</Button>
}
