// Reads the first sheet of an .xlsx file, or a .csv file, as rows of text
// cells. No dependency: an .xlsx file is a zip of XML parts, read with the
// browser's DecompressionStream and DOMParser.

// CSV as Excel writes it: optional BOM, ';' or ',' (whichever the header row
// uses more), quoted cells with "" escapes and line breaks inside quotes.
export function parseCsv(text){
 const source=String(text||'').replace(/^\ufeff/,'')
 const firstLine=source.split(/\r?\n/,1)[0]||''
 const delimiter=(firstLine.match(/;/g)||[]).length>=(firstLine.match(/,/g)||[]).length?';':','
 const rows=[];let row=[];let cell='';let quoted=false
 for(let i=0;i<source.length;i+=1){
  const ch=source[i]
  if(quoted){
   if(ch==='"'&&source[i+1]==='"'){cell+='"';i+=1}
   else if(ch==='"')quoted=false
   else cell+=ch
   continue
  }
  if(ch==='"'&&cell==='')quoted=true
  else if(ch===delimiter){row.push(cell);cell=''}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&source[i+1]==='\n')i+=1;row.push(cell);rows.push(row);row=[];cell=''}
  else cell+=ch
 }
 if(cell!==''||row.length){row.push(cell);rows.push(row)}
 return rows.filter(cells=>cells.some(value=>String(value).trim()!==''))
}

// Zip entries by name (only the central directory is trusted for sizes).
async function unzip(buffer){
 const view=new DataView(buffer)
 let end=buffer.byteLength-22
 while(end>=0&&view.getUint32(end,true)!==0x06054b50)end-=1
 if(end<0)throw new Error('SPREADSHEET_NOT_XLSX')
 const count=view.getUint16(end+10,true)
 let offset=view.getUint32(end+16,true)
 const entries=new Map()
 const decoder=new TextDecoder()
 for(let n=0;n<count;n+=1){
  if(view.getUint32(offset,true)!==0x02014b50)throw new Error('SPREADSHEET_NOT_XLSX')
  const method=view.getUint16(offset+10,true)
  const size=view.getUint32(offset+20,true)
  const nameLength=view.getUint16(offset+28,true),extraLength=view.getUint16(offset+30,true),commentLength=view.getUint16(offset+32,true)
  const local=view.getUint32(offset+42,true)
  const name=decoder.decode(new Uint8Array(buffer,offset+46,nameLength))
  entries.set(name,{method,size,local})
  offset+=46+nameLength+extraLength+commentLength
 }
 return async name=>{
  const entry=entries.get(name)
  if(!entry)return null
  const start=entry.local+30+view.getUint16(entry.local+26,true)+view.getUint16(entry.local+28,true)
  const data=new Uint8Array(buffer,start,entry.size)
  if(entry.method===0)return decoder.decode(data)
  if(entry.method!==8)throw new Error('SPREADSHEET_UNSUPPORTED_COMPRESSION')
  const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
 }
}

const columnIndex=ref=>{let n=0;for(const ch of String(ref).replace(/\d+$/,''))n=n*26+(ch.charCodeAt(0)-64);return n-1}
const xml=text=>new DOMParser().parseFromString(text,'application/xml')
const byTag=(node,tag)=>[...node.getElementsByTagName(tag)]

export async function parseXlsx(buffer){
 const read=await unzip(buffer)
 const shared=[]
 const sharedXml=await read('xl/sharedStrings.xml')
 if(sharedXml)for(const si of byTag(xml(sharedXml),'si'))shared.push(byTag(si,'t').map(t=>t.textContent).join(''))
 // The first sheet in workbook order, through its relationship id.
 let sheetPath='xl/worksheets/sheet1.xml'
 const workbook=await read('xl/workbook.xml'),rels=await read('xl/_rels/workbook.xml.rels')
 if(workbook&&rels){
  const first=byTag(xml(workbook),'sheet')[0]
  const rid=first?.getAttribute('r:id')||first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')
  const target=byTag(xml(rels),'Relationship').find(rel=>rel.getAttribute('Id')===rid)?.getAttribute('Target')
  if(target)sheetPath=target.startsWith('/')?target.slice(1):`xl/${target.replace(/^\.\//,'')}`
 }
 const sheet=await read(sheetPath)
 if(!sheet)throw new Error('SPREADSHEET_EMPTY')
 const rows=[]
 for(const rowNode of byTag(xml(sheet),'row')){
  const row=[]
  for(const c of byTag(rowNode,'c')){
   const type=c.getAttribute('t')
   const value=byTag(c,'v')[0]?.textContent??''
   const text=type==='s'?shared[Number(value)]??'':type==='inlineStr'?byTag(c,'t').map(t=>t.textContent).join(''):value
   row[columnIndex(c.getAttribute('r'))]=text
  }
  rows.push(Array.from(row,value=>value??''))
 }
 return rows.filter(cells=>cells.some(value=>String(value).trim()!==''))
}

export async function readSpreadsheet(file){
 const name=String(file?.name||'').toLowerCase()
 if(name.endsWith('.csv')||name.endsWith('.txt'))return parseCsv(await file.text())
 if(name.endsWith('.xlsx'))return parseXlsx(await file.arrayBuffer())
 throw new Error('SPREADSHEET_UNSUPPORTED_TYPE')
}
