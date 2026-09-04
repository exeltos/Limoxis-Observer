import fs from 'node:fs'

const jsxPath='src/features/platform/PlatformOrganizationRecord.jsx'
const cssPath='src/styles/design-system-layouts.css'
let s=fs.readFileSync(jsxPath,'utf8')

const tbodyStart=s.indexOf('<tbody>{users.map(user=><tr key={user.userId}')
if(tbodyStart<0)throw new Error('users tbody start not found')
const tbodyEnd=s.indexOf('</tbody></table></div>',tbodyStart)
if(tbodyEnd<0)throw new Error('users tbody end not found')
const panelStart=s.indexOf('{selectedUser&&<section className="platform-user-management-panel">',tbodyEnd)
if(panelStart<0)throw new Error('selected user panel start not found')
const panelEnd=s.indexOf('</section>}',panelStart)
if(panelEnd<0)throw new Error('selected user panel end not found')

const mapSource=s.slice(tbodyStart,tbodyEnd)
const panelSource=s.slice(panelStart,panelEnd+'</section>}'.length)
const rowStart=mapSource.indexOf('<tr key={user.userId}')
const rowEnd=mapSource.lastIndexOf('</tr>)}</tbody>')
if(rowStart<0||rowEnd<0)throw new Error('user row source not found')
const row=mapSource.slice(rowStart,rowEnd+'</tr>'.length)

const panelInner=panelSource
  .replace('{selectedUser&&<section className="platform-user-management-panel">','<section className="platform-user-management-panel">')
  .replace('</section>}','</section>')

const replacement=`<tbody>{users.map(user=><>
${row}
{selectedUserId===user.userId&&<tr key={\`${'${user.userId}'}-panel\`} className="platform-owner-user-expanded-row"><td colSpan="4">${panelInner}</td></tr>}
</>)}</tbody>`

s=s.slice(0,tbodyStart)+replacement+s.slice(tbodyEnd+'</tbody>'.length)
const oldTail=s.indexOf(panelSource,tbodyStart)
if(oldTail>=0)s=s.slice(0,oldTail)+s.slice(oldTail+panelSource.length)
fs.writeFileSync(jsxPath,s)

let css=fs.readFileSync(cssPath,'utf8')
const marker='/* Platform Owner · inline expanded user card */'
if(!css.includes(marker))css+=`\n\n${marker}\n.platform-owner-user-expanded-row>td{\n  padding:12px 10px 16px!important;\n  background:var(--lo-color-surface-soft,#f6f8fb)!important;\n  border-bottom:1px solid var(--lo-color-border)!important;\n}\n.platform-owner-users .data-table tbody .platform-owner-user-expanded-row:hover,\n.platform-owner-users .data-table tbody .platform-owner-user-expanded-row:hover>td{\n  background:var(--lo-color-surface-soft,#f6f8fb)!important;\n}\n.platform-owner-user-expanded-row .platform-user-management-panel{\n  margin:0!important;\n  border:1px solid var(--lo-color-border);\n  border-radius:var(--lo-radius-card);\n  background:var(--lo-color-surface);\n  box-shadow:0 10px 28px rgba(23,32,51,.06);\n  overflow:hidden;\n}\n.platform-user-management-panel .platform-user-detail-table tbody tr:hover,\n.platform-user-management-panel .platform-user-detail-table tbody tr:hover>th,\n.platform-user-management-panel .platform-user-detail-table tbody tr:hover>td{\n  background:inherit!important;\n}\n.platform-user-management-panel .platform-user-detail-table tbody tr{cursor:default!important}\n.platform-user-management-panel .platform-user-detail-table th{\n  background:var(--lo-color-surface-soft,#f6f8fb)!important;\n}\n.platform-user-management-panel .platform-user-detail-table td{\n  background:var(--lo-color-surface)!important;\n}\n.platform-user-management-panel .platform-user-actions-row th,\n.platform-user-management-panel .platform-user-actions-row td{\n  border-top:1px solid var(--lo-color-border);\n}\n.platform-owner-clickable-row.is-selected{\n  box-shadow:inset 3px 0 0 var(--lo-color-primary);\n}\n@media(max-width:760px){\n  .platform-owner-user-expanded-row>td{padding:10px 6px 14px!important}\n}\n`
fs.writeFileSync(cssPath,css)
