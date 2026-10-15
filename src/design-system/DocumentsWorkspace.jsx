import { AttachmentField } from './AttachmentField'
import './DocumentsWorkspace.css'

// Every record's documents tab opens the same way: the shared record tab panel
// (title, «Add» on the right) with the files as a registry table.
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
  return <AttachmentField
    variant="table"
    title={title}
    subtitle={subtitle}
    disabled={disabled}
    value={value}
    onChange={onChange}
    categories={categories}
    organizationId={organizationId}
    entityType={entityType}
    entityId={entityId}
  />
}
