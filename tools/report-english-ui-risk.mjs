import fs from 'node:fs'
import path from 'node:path'

const roots=['src']
const migrated=new Set([
 'src/app/AppShell.jsx','src/core/help/HelpCenter.jsx','src/core/help/helpContent.js',
 'src/core/notifications/NotificationCenter.jsx','src/core/notifications/NotificationContext.jsx',
 'src/features/auth/LoginPage.jsx','src/features/dashboard/DashboardPage.jsx',
 'src/features/about/AboutPage.jsx','src/features/workspaces/workspaceConfig.js'
])
const exclude=['demodata','data.js','catalog.js','definitions.js','engine.js','store.js','helpmanual.js','helpmanualen.js','helpextras.js','languagecontext.jsx']
const greek=/[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊϋΐΰ]/
const results=[]
function walk(dir){
 for(const name of fs.readdirSync(dir)){
  const full=path.join(dir,name),stat=fs.statSync(full)
  if(stat.isDirectory())walk(full)
  else if(/\.(jsx|js)$/.test(name)){
   const rel=full.replaceAll('\\','/')
   if(migrated.has(rel)||exclude.some(x=>rel.toLowerCase().includes(x)))continue
   const lines=fs.readFileSync(full,'utf8').split(/\r?\n/)
   const count=lines.filter(line=>greek.test(line)).length
   if(count)results.push([count,rel])
  }
 }
}
roots.forEach(walk)
results.sort((a,b)=>b[0]-a[0])
console.log(`English UI risk report: ${results.length} interactive files, ${results.reduce((s,[c])=>s+c,0)} Greek-containing source lines.`)
for(const [count,file] of results)console.log(`${String(count).padStart(3)}  ${file}`)
