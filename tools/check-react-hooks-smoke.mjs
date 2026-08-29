import fs from 'node:fs'
import path from 'node:path'

const root=path.resolve(new URL('..',import.meta.url).pathname)
const files=[]
function walk(dir){
  for(const name of fs.readdirSync(dir)){
    const full=path.join(dir,name)
    const st=fs.statSync(full)
    if(st.isDirectory())walk(full)
    else if(/\.(jsx|js)$/.test(name))files.push(full)
  }
}
walk(path.join(root,'src'))
const hooks=['useState','useEffect','useMemo','useCallback','useRef']
const errors=[]
for(const file of files){
  const text=fs.readFileSync(file,'utf8')
  const importMatch=text.match(/import\s*\{([^}]*)\}\s*from\s*['"]react['"]/)
  const imported=new Set((importMatch?.[1]||'').split(',').map(x=>x.trim()).filter(Boolean))
  for(const hook of hooks){
    const used=new RegExp(`\\b${hook}\\s*\\(`).test(text)
    if(used&&!imported.has(hook))errors.push(`${path.relative(root,file)} uses ${hook} but does not import it from react`)
  }
}
if(errors.length){errors.forEach(x=>console.error('✗',x));process.exit(1)}
console.log(`React hook smoke passed: ${files.length} source files checked`)
