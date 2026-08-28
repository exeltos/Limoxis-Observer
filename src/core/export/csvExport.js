function csvCell(value){
 const text=String(value??'')
 return `"${text.replaceAll('"','""')}"`
}
export function downloadCsv(filename,headers,rows){
 const csv='\ufeff'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'})
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a')
 a.href=url;a.download=filename
 document.body.appendChild(a);a.click();a.remove()
 URL.revokeObjectURL(url)
}
