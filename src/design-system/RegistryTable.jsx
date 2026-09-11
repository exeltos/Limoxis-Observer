export function RegistryTable({
  columns=[],
  rows=[],
  rowKey=(row,index)=>row?.id??index,
  renderRow,
  rowProps,
  className='',
  wrapperClassName='scroll-table',
  wrapperRef,
  tableProps={},
  empty=false,
  emptyTitle,
  emptyText,
}){
  const tableClass=`data-table sticky-table ${className}`.trim()
  const hasRows=Array.isArray(rows)&&rows.length>0
  return <div ref={wrapperRef} className={wrapperClassName} data-ui="registry-table">
    <table className={tableClass} {...tableProps}>
      <thead><tr>{columns.map((column,index)=><th key={column.key??index} className={column.className} style={column.style}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row,index)=>{
        const supplied=typeof rowProps==='function'?(rowProps(row,index)||{}):{}
        const rendered=renderRow?.(row,index)
        if(rendered?.type==='tr'){
          const mergedClass=[rendered.props.className,supplied.className].filter(Boolean).join(' ')
          return {...rendered,key:rowKey(row,index),props:{...rendered.props,...supplied,className:mergedClass||undefined}}
        }
        return <tr key={rowKey(row,index)} {...supplied}>{rendered}</tr>
      })}</tbody>
    </table>
    {(!hasRows||empty)&&<div className="inline-empty" role="status"><strong>{emptyTitle}</strong>{emptyText&&<span>{emptyText}</span>}</div>}
  </div>
}
