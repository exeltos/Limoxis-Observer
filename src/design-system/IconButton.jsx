export function IconButton({label,tone='neutral',size='md',className='',children,...props}){
  return <button type="button" className={`lo-icon-button lo-icon-button-${tone} lo-icon-button-${size} ${className}`.trim()} title={label} aria-label={label} {...props}>{children}</button>
}
