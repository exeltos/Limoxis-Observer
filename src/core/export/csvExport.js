import { DEMO_REPORT_MARK_EL, isDemoReport } from '../organization/branding'

function csvCell(value){
 const text=String(value??'')
 return `"${text.replaceAll('"','""')}"`
}
export function downloadCsv(filename,headers,rows){
 // A Demo organization's files start with the DEMO mark and are named DEMO_….
 const demo=isDemoReport()
 if(demo&&!String(filename).startsWith('DEMO_'))filename=`DEMO_${filename}`
 const csv='\ufeff'+[...(demo?[[DEMO_REPORT_MARK_EL]]:[]),headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'})
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a')
 a.href=url;a.download=filename
 document.body.appendChild(a);a.click();a.remove()
 URL.revokeObjectURL(url)
}
