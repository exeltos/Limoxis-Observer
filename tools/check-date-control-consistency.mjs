import fs from 'node:fs'
import path from 'node:path'
const root='src/features'
const offenders=[]
function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(/\.jsx$/.test(name)){const text=fs.readFileSync(p,'utf8');if(/type=["'](?:date|time)["']/.test(text))offenders.push(p)}}}
walk(root)
if(offenders.length){console.error('Native date/time controls remain:\n'+offenders.join('\n'));process.exit(1)}
console.log('Date/time control consistency passed: 0 native feature controls')
