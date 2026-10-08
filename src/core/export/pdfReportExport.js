import { DEMO_REPORT_MARK_EL, getReportBranding } from '../organization/branding'

function safeName(value='report'){
  return String(value||'report').trim().replace(/[^\p{L}\p{N}._-]+/gu,'_').replace(/^_+|_+$/g,'')||'report'
}

// Renders `element` (must already be laid out in the DOM, on- or off-screen)
// to a PNG snapshot via html2canvas, then tiles that image across as many
// A4 pages as needed. This mirrors the platform's existing "print the
// rendered report" approach (see AnalysisPage) instead of redrawing every
// chart/table with PDF primitives, so a report's content is always exactly
// what the active filters produced on screen — nothing to keep in sync.
// Height of the hospital header band on each page, in mm.
const HEADER_MM=16

function imageSize(dataUrl){return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve({width:img.width,height:img.height});img.onerror=()=>resolve(null);img.src=dataUrl})}

// SVG logos are drawn to a PNG first: jsPDF embeds raster images only.
async function rasterLogo(logo){
  if(!logo)return null
  const size=await imageSize(logo)
  if(!size?.width||!size?.height)return null
  if(!logo.startsWith('data:image/svg'))return {data:logo,...size}
  const canvas=document.createElement('canvas');canvas.width=size.width*2;canvas.height=size.height*2
  const ctx=canvas.getContext('2d')
  if(!ctx)return null
  const img=new Image();img.src=logo;await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve})
  ctx.drawImage(img,0,0,canvas.width,canvas.height)
  return {data:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height}
}

// Hospital name, report header line and logo across the top of a page.
async function drawHeader(pdf,branding,logo,pageWidth){
  const margin=8
  let textX=margin
  if(logo){
    const ratio=logo.width/logo.height
    let h=HEADER_MM-6,w=h*ratio
    if(w>48){w=48;h=w/ratio}
    pdf.addImage(logo.data,'PNG',margin,3+(HEADER_MM-6-h)/2,w,h,'hospital-logo','FAST')
    textX=margin+w+4
  }
  // Greek text is not in jsPDF's standard fonts, so the lines are drawn as an image.
  const canvas=document.createElement('canvas');const scale=4
  const widthMm=pageWidth-textX-margin
  canvas.width=Math.round(widthMm*scale*3.78);canvas.height=Math.round((HEADER_MM-4)*scale*3.78)
  const ctx=canvas.getContext('2d')
  if(ctx){ctx.scale(scale*3.78,scale*3.78)
  ctx.fillStyle='#173650';ctx.font='bold 4.2px system-ui, sans-serif';ctx.textBaseline='top'
  ctx.fillText(branding.name||'',0,1)
  if(branding.reportHeader){ctx.fillStyle='#5d7891';ctx.font='3.4px system-ui, sans-serif';ctx.fillText(branding.reportHeader,0,6.2)}
  pdf.addImage(canvas.toDataURL('image/png'),'PNG',textX,2,widthMm,HEADER_MM-4,'hospital-header','FAST')}
  pdf.setDrawColor(207,219,229);pdf.setLineWidth(0.3);pdf.line(margin,HEADER_MM-0.5,pageWidth-margin,HEADER_MM-0.5)
}

// A Demo organization's pages: a light diagonal "DEMO" across the page and a
// line at the bottom saying the data is synthetic (drawn as an image: Greek is
// not in jsPDF's standard fonts).
function drawDemoMark(pdf,pageWidth,pageHeight){
  try{
    if(pdf.GState&&pdf.setGState){pdf.saveGraphicsState?.();pdf.setGState(new pdf.GState({opacity:0.08}))}
    pdf.setTextColor(180,40,40);pdf.setFont('helvetica','bold');pdf.setFontSize(110)
    pdf.text('DEMO',pageWidth/2,pageHeight/2+20,{align:'center',angle:28})
    if(pdf.GState&&pdf.setGState)pdf.restoreGraphicsState?.()
  }catch{/* the bottom line below still marks the page */}
  const canvas=document.createElement('canvas');const ctx=canvas.getContext?.('2d')
  if(!ctx)return
  const widthMm=pageWidth-16,heightMm=6,scale=4*3.78
  canvas.width=Math.round(widthMm*scale);canvas.height=Math.round(heightMm*scale)
  ctx.scale(scale,scale);ctx.fillStyle='#fff3e0';ctx.fillRect(0,0,widthMm,heightMm)
  ctx.fillStyle='#a24d0a';ctx.font='bold 3.2px system-ui, sans-serif';ctx.textBaseline='middle';ctx.textAlign='center'
  ctx.fillText(DEMO_REPORT_MARK_EL,widthMm/2,heightMm/2)
  pdf.addImage(canvas.toDataURL('image/png'),'PNG',8,pageHeight-heightMm-3,widthMm,heightMm,'demo-mark','FAST')
}

export async function exportElementAsPdf({element,filename,orientation='landscape',branding=getReportBranding(),header=true}={}){
  const demo=Boolean(branding?.demo)
  if(demo&&!String(filename||'').startsWith('DEMO_'))filename=`DEMO_${filename||'report'}`
  if(!element)throw new Error('PDF_EXPORT_NO_ELEMENT')
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')])
  // Controls marked data-pdf-ignore (e.g. the download menu) stay out of the file.
  const canvas=await html2canvas(element,{scale:2,backgroundColor:'#ffffff',useCORS:true,ignoreElements:node=>node?.hasAttribute?.('data-pdf-ignore')})
  const pdf=new jsPDF({orientation,unit:'mm',format:'a4'})
  const pageWidth=pdf.internal.pageSize.getWidth()
  const pageHeight=pdf.internal.pageSize.getHeight()
  const withHeader=Boolean(header&&branding&&(branding.name||branding.logo||branding.reportHeader))
  const top=withHeader?HEADER_MM:0
  const logo=withHeader?await rasterLogo(branding.logo):null
  // Each page gets its own slice of the snapshot below the header band, so
  // nothing is hidden behind it.
  const pxPerMm=canvas.width/pageWidth
  const sliceHeight=Math.max(1,Math.floor((pageHeight-top)*pxPerMm))
  const canSlice=Boolean(document.createElement('canvas').getContext?.('2d'))
  if(!canSlice){
    // No 2D canvas (tests, very old browsers): tile the whole image, no header.
    const imgHeight=canvas.height/pxPerMm,imgData=canvas.toDataURL('image/png')
    for(let offset=0;offset<imgHeight;offset+=pageHeight){if(offset)pdf.addPage();pdf.addImage(imgData,'PNG',0,-offset,pageWidth,imgHeight);if(demo)drawDemoMark(pdf,pageWidth,pageHeight)}
    pdf.save(`${safeName(filename)}.pdf`)
    return
  }
  for(let y=0,page=0;y<canvas.height;y+=sliceHeight,page+=1){
    if(page)pdf.addPage()
    const height=Math.min(sliceHeight,canvas.height-y)
    const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=height
    slice.getContext('2d').drawImage(canvas,0,y,canvas.width,height,0,0,canvas.width,height)
    // JPEG keeps a page of tables at a few hundred KB instead of megabytes.
    pdf.addImage(slice.toDataURL('image/jpeg',0.92),'JPEG',0,top,pageWidth,height/pxPerMm)
    if(withHeader)await drawHeader(pdf,branding,logo,pageWidth)
    if(demo)drawDemoMark(pdf,pageWidth,pageHeight)
  }
  pdf.save(`${safeName(filename)}.pdf`)
}
