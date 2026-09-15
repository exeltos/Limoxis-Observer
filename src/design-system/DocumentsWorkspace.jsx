import { AttachmentField } from './AttachmentField'
import './DocumentsWorkspace.css'

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
  return <section className="documents-workspace">
    {(title||subtitle)&&<header className="documents-workspace-header">
      {title&&<h3>{title}</h3>}
      {subtitle&&<p>{subtitle}</p>}
    </header>}
    <AttachmentField
      disabled={disabled}
      value={value}
      onChange={onChange}
      categories={categories}
      organizationId={organizationId}
      entityType={entityType}
      entityId={entityId}
    />
  </section>
}
