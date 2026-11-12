// Limoxis Observer mark (same drawing as public/favicon.svg).
export function BrandMark({size=40,className='',tone='dark'}){
  const bg=tone==='light'?'#ffffff':'#173a63',fg=tone==='light'?'#173a63':'#ffffff'
  return <svg className={`brand-mark-svg ${className}`.trim()} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Limoxis Observer">
    <rect width="64" height="64" rx="15" fill={bg}/>
    <path d="M18 14h9v27h19v9H18z" fill={fg}/>
    <circle cx="43" cy="21" r="7" fill="#8fc7bd"/>
  </svg>
}
