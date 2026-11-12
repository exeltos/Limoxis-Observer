
// The heading of a section inside a record tab: title, optional subtitle,
// actions on the right. One look for every tab (summary, admissions,
// surveillance, assessments, documents, history).
export function SectionHeader({title,subtitle,actions,className=''}){
  // Without a title the header is only its actions, pushed to the right.
  const bare=!title&&!subtitle
  return <div className={`record-section-header lo-section-header${bare?' lo-section-header-bare':''} ${className}`.trim()}>
    {!bare&&<div className="lo-section-header-copy">
      {title&&<h3>{title}</h3>}
      {subtitle&&<p>{subtitle}</p>}
    </div>}
    {actions&&<div className="lo-section-header-actions">{actions}</div>}
  </div>
}
