import fs from 'node:fs'
const files=['src/features/laboratory/LaboratoryPage.jsx']
const greek=/[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊΐϋΰ]/
const bad=[]
for(const file of files){fs.readFileSync(file,'utf8').split('\n').forEach((line,i)=>{if(greek.test(line))bad.push(`${file}:${i+1}`)})}
if(bad.length){console.error('Hard-coded Greek found:\n'+bad.join('\n'));process.exit(1)}
console.log(`Laboratory i18n audit passed: ${files.length} UI file(s), 0 hard-coded Greek strings.`)
