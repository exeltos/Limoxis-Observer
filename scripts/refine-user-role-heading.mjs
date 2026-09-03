import fs from 'node:fs'
const p='src/styles/design-system-layouts.css'
let css=fs.readFileSync(p,'utf8')
const marker='/* Platform Owner · canonical user-role section heading */'
if(!css.includes(marker)) css+=`\n\n${marker}\n.platform-user-role-help{\n  display:flex;\n  flex-direction:column;\n  align-items:flex-start;\n  gap:4px;\n  margin:0 0 12px;\n}\n.platform-user-role-help strong{\n  display:block;\n  margin:0;\n  font-size:15px;\n  line-height:1.3;\n  font-weight:700;\n  letter-spacing:-.01em;\n  color:var(--lo-color-text);\n}\n.platform-user-role-help span{\n  display:block;\n  margin:0;\n  max-width:760px;\n  font-size:11.5px;\n  line-height:1.45;\n  font-weight:400;\n  color:var(--lo-color-text-muted);\n}\n`
fs.writeFileSync(p,css)
