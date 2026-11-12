import { Button } from './Button'
import { IconButton } from './IconButton'

const variantForTone={
  primary:'primary',
  neutral:'secondary',
  edit:'secondary',
  danger:'secondary',
  success:'secondary',
}

export function ActionButton({label,tone='neutral',iconOnly=false,className='',children,...props}){
  if(iconOnly)return <IconButton label={label} tone={tone} className={className} {...props}>{children}</IconButton>
  return <Button variant={variantForTone[tone]||'secondary'} className={`lo-action-button lo-action-button-${tone} ${className}`.trim()} {...props}>{children}</Button>
}
