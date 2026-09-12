import { RegistryPagination } from './RegistryPagination'

/**
 * Canonical top-level paginated registry.
 * One component owns geometry, body, empty/loading state and pagination.
 * Modules only provide their domain-specific toolbar/table content.
 */
export function PaginatedRegistry({
  language='el',
  header=null,
  toolbar=null,
  children,
  loading=false,
  loadingLabel,
  empty=false,
  emptyTitle,
  emptyText,
  page=1,
  totalPages=1,
  totalItems=0,
  pageSize=15,
  onPageChange,
  onPageSizeChange,
  bodyRef,
  className='',
}){
  const en=language==='en'
  const loadingCopy=loadingLabel || (en?'Loading…':'Φόρτωση…')
  return <section className={`paginated-registry ${className}`.trim()} data-ui="paginated-registry">
    {header&&<div className="paginated-registry__header">{header}</div>}
    {toolbar&&<div className="paginated-registry__toolbar">{toolbar}</div>}
    <div className="paginated-registry__body" ref={bodyRef}>
      {loading
        ? <RegistryMessage title={loadingCopy}/>
        : empty
          ? <RegistryMessage title={emptyTitle} text={emptyText}/>
          : children}
    </div>
    {!loading&&<RegistryPagination
      language={language}
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />}
  </section>
}

export function RegistryMessage({title,text}){
  return <div className="registry-empty-state" role="status">
    <strong>{title}</strong>
    {text&&<span>{text}</span>}
  </div>
}
