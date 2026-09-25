import { AttachmentField } from './AttachmentField'
import './DocumentsWorkspace.css'

// Every record's documents tab opens the same way (as in Quality): a
// record-section card with the title and the shared attachment box.
export function DocumentsWorkspace({
  title,
  subtitle,
  disabled=false,
  organizationId=null,
  entityType,
  entityId,
  categories,
  value=[],
  onChange=()=>{},
}){
  return <div className="record-section documents-workspace">
    {(title||subtitle)&&<div className="record-section-header"><div>{title&&<h3>{title}</h3>}{subtitle&&<p>{subtitle}</p>}</div></div>}
    <AttachmentField
      disabled={disabled}
      value={value}
      onChange={onChange}
      categories={categories}
      organizationId={organizationId}
      entityType={entityType}
      entityId={entityId}
    />
  </div>
}
