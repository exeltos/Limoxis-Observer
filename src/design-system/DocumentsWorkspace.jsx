import { AttachmentField } from './AttachmentField'
import { EmployeeCertificatesTab } from '../features/employees/EmployeeCertificatesTab'
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
  if(entityType==='employee-certificate'){
    return <EmployeeCertificatesTab
      employee={{id:entityId,dbId:entityId}}
      language={document.documentElement.lang==='en'?'en':'el'}
      organizationId={organizationId}
      canEdit={!disabled}
    />
  }
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
