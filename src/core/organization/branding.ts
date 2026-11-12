// Hospital identity: logo and report header line, per organization
// (organizations.branding). Shown in the top bar and at the top of every PDF
// (see pdfReportExport) and on training certificates. The demo keeps its own
// on this device.
import { useEffect,useState } from 'react'
import { readLocalValue,writeLocalValue } from '../storage/browserStorage'

const LOGO_MAX_BYTES=300*1024
const LOGO_MAX_PX=480
const LOGO_TYPES=['image/png','image/jpeg','image/webp','image/svg+xml']
const DEMO_KEY='limoxis.demoBranding'
const CHANGED_EVENT='limoxis:branding-changed'

export interface Branding {
  logo: string
  reportHeader: string
}

// Ό,τι τυπώνεται στην κορυφή των PDF (setReportBranding).
export interface ReportBranding extends Branding {
  name: string
  demo: boolean
  printedBy: string
}

export function normalizeBranding(value:unknown):Branding{
 const source=(value&&typeof value==='object'?value:{}) as {logo?:unknown,reportHeader?:unknown}
 const logo=typeof source.logo==='string'&&source.logo.startsWith('data:image/')?source.logo:''
 return {logo,reportHeader:String(source.reportHeader||'').slice(0,200)}
}

function brandingFor(tenant:{branding?:unknown}|null|undefined,isDemo:boolean|undefined){
 if(isDemo){try{return normalizeBranding(JSON.parse(readLocalValue(DEMO_KEY,'{}')||'{}'))}catch{return normalizeBranding(null)}}
 return normalizeBranding(tenant?.branding)
}

export function announceBranding(branding:unknown,{isDemo=false}:{isDemo?:boolean}={}):void{
 const value=normalizeBranding(branding)
 if(isDemo)writeLocalValue(DEMO_KEY,JSON.stringify(value))
 window.dispatchEvent(new CustomEvent(CHANGED_EVENT,{detail:value}))
}

export function useOrganizationBranding(tenant:{branding?:unknown}|null|undefined,isDemo?:boolean):Branding{
 const [branding,setBranding]=useState(()=>brandingFor(tenant,isDemo))
 useEffect(()=>{setBranding(brandingFor(tenant,isDemo))},[tenant,isDemo])
 useEffect(()=>{const onChange=(event:Event)=>setBranding(normalizeBranding((event as CustomEvent).detail));window.addEventListener(CHANGED_EVENT,onChange);return()=>window.removeEventListener(CHANGED_EVENT,onChange)},[])
 return branding
}

// What PDFs print at the top. The app shell keeps it current for the open
// organization, so every export gets it without passing it around.
let reportBranding:ReportBranding|null=null
// printedBy: who is signed in, for the «Εκτυπώθηκε από …» line of printed records.
export function setReportBranding(value:{name?:unknown,logo?:string,reportHeader?:string,demo?:unknown,printedBy?:unknown}|null|undefined):void{reportBranding=value?{name:String(value.name||''),logo:value.logo||'',reportHeader:value.reportHeader||'',demo:Boolean(value.demo),printedBy:String(value.printedBy||'')}:null}
export const getReportBranding=()=>reportBranding
// A Demo organization's reports carry a "DEMO" mark (PDF pages, CSV first row,
// print), so a file from a Demo is never taken for a real report.
export const isDemoReport=()=>Boolean(reportBranding?.demo)
export const DEMO_REPORT_MARK_EL='DEMO · Συνθετικά δεδομένα επίδειξης, όχι πραγματικά στοιχεία'
export const DEMO_REPORT_MARK_EN='DEMO · Synthetic demonstration data, not real records'

// A logo file as a data URL, scaled down to LOGO_MAX_PX on its longer side
// (SVG is kept as is). Rejects other types and anything still too large.
export async function readLogoFile(file:File|null|undefined):Promise<string>{
 if(!file||!LOGO_TYPES.includes(file.type))throw new Error('LOGO_TYPE')
 const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('LOGO_READ'));reader.readAsDataURL(file)})
 if(file.type==='image/svg+xml'){if(dataUrl.length>LOGO_MAX_BYTES)throw new Error('LOGO_SIZE');return dataUrl}
 const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('LOGO_READ'));img.src=dataUrl})
 const scale=Math.min(1,LOGO_MAX_PX/Math.max(image.width,image.height))
 const canvas=document.createElement('canvas')
 canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale))
 const context=canvas.getContext('2d') as CanvasRenderingContext2D
 context.drawImage(image,0,0,canvas.width,canvas.height)
 const scaled=canvas.toDataURL('image/png')
 if(scaled.length>LOGO_MAX_BYTES)throw new Error('LOGO_SIZE')
 return scaled
}
