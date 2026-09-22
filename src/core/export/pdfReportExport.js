function safeName(value='report'){
  return String(value||'report').trim().replace(/[^\p{L}\p{N}._-]+/gu,'_').replace(/^_+|_+$/g,'')||'report'
}

// Renders `element` (must already be laid out in the DOM, on- or off-screen)
// to a PNG snapshot via html2canvas, then tiles that image across as many
// A4 pages as needed. This mirrors the platform's existing "print the
// rendered report" approach (see AnalysisPage) instead of redrawing every
// chart/table with PDF primitives, so a report's content is always exactly
// what the active filters produced on screen — nothing to keep in sync.
export async function exportElementAsPdf({element,filename,orientation='landscape'}={}){
  if(!element)throw new Error('PDF_EXPORT_NO_ELEMENT')
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')])
  const canvas=await html2canvas(element,{scale:2,backgroundColor:'#ffffff',useCORS:true})
  const pdf=new jsPDF({orientation,unit:'mm',format:'a4'})
  const pageWidth=pdf.internal.pageSize.getWidth()
  const pageHeight=pdf.internal.pageSize.getHeight()
  const imgWidth=pageWidth
  const imgHeight=canvas.height*imgWidth/canvas.width
  const imgData=canvas.toDataURL('image/png')
  let heightLeft=imgHeight
  let position=0
  pdf.addImage(imgData,'PNG',0,position,imgWidth,imgHeight)
  heightLeft-=pageHeight
  while(heightLeft>0){
    position=heightLeft-imgHeight
    pdf.addPage()
    pdf.addImage(imgData,'PNG',0,position,imgWidth,imgHeight)
    heightLeft-=pageHeight
  }
  pdf.save(`${safeName(filename)}.pdf`)
}
