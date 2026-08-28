import fs from 'node:fs';import path from 'node:path'
function files(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>['node_modules','dist'].includes(e.name)?[]:e.isDirectory()?files(path.join(d,e.name)):[path.join(d,e.name)])}
const bad=[]
for(const file of files('src').filter(x=>/\.(jsx|js)$/.test(x))){
 const s=fs.readFileSync(file,'utf8')
 if(/\buseAuth\s*\(/.test(s)&&!/import\s*\{[^}]*useAuth[^}]*\}\s*from/.test(s)&&!file.endsWith('AuthContext.jsx'))bad.push(`${file}: useAuth missing import`)
 if(/\bauditActorFromAuth\s*\(/.test(s)&&!/import\s*\{[^}]*auditActorFromAuth[^}]*\}\s*from/.test(s)&&!file.endsWith('/actor.js')&&!file.endsWith('\\actor.js'))bad.push(`${file}: auditActorFromAuth missing import`)
}
if(bad.length){console.error(bad.join('\n'));process.exit(1)}console.log('Audit actor import smoke passed.')
