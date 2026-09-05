const PAGE_SIZE_OPTIONS=[15,25,50]

export function RegistryPagination({language='el',page,totalPages,totalItems,pageSize,onPageChange,onPageSizeChange}){
  const en=language==='en'
  const start=totalItems?((page-1)*pageSize)+1:0
  const end=Math.min(page*pageSize,totalItems)
  return <div className="registry-pagination">
    <div>{totalItems?`${start}–${end} ${en?'of':'από'} ${totalItems}`:(en?'0 records':'0 εγγραφές')}</div>
    <div className="registry-pagination-controls">
      <label><span>{en?'Rows':'Γραμμές'}</span><select value={pageSize} onChange={e=>onPageSizeChange(Number(e.target.value))}>{PAGE_SIZE_OPTIONS.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
      <button type="button" disabled={page<=1} onClick={()=>onPageChange(page-1)}>‹</button>
      <span>{en?'Page':'Σελίδα'} {page} / {totalPages}</span>
      <button type="button" disabled={page>=totalPages} onClick={()=>onPageChange(page+1)}>›</button>
    </div>
  </div>
}
