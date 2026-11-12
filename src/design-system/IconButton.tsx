import type { ButtonHTMLAttributes } from 'react'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // The name of the button: its tooltip and its accessible name.
  label?: string
  tone?: string
  size?: 'sm' | 'md' | string
}

export function IconButton({label,tone='neutral',size='md',className='',children,...props}: IconButtonProps){
  return <button type="button" className={`lo-icon-button lo-icon-button-${tone} lo-icon-button-${size} ${className}`.trim()} title={label} aria-label={label} {...props}>{children}</button>
}
