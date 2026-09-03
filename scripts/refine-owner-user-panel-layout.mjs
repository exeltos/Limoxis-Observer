import fs from 'node:fs'
const path='src/styles/design-system-layouts.css'
let s=fs.readFileSync(path,'utf8')
const old=`/* Platform Owner · user management record panel */
.platform-owner-users .platform-owner-clickable-row.is-selected{background:var(--lo-color-surface-soft,#f6f8fb)}
.platform-user-management-panel{margin-top:14px;border:1px solid var(--lo-color-border);border-radius:var(--lo-radius-card);background:var(--lo-color-surface);overflow:hidden}
.platform-user-management-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid var(--lo-color-border)}
.platform-user-management-heading>div{display:flex;flex-direction:column;gap:3px}.platform-user-management-heading span{font-size:12px;color:var(--lo-color-text-muted)}
.platform-user-detail-table{margin:0}.platform-user-detail-table th{width:150px;white-space:nowrap;background:var(--lo-color-surface-soft,#f6f8fb)}
.platform-user-detail-table td{vertical-align:middle}.platform-user-detail-table .platform-role-select{width:min(100%,360px)}
.platform-user-panel-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.platform-user-actions-row td{padding-top:12px;padding-bottom:12px}
@media(max-width:760px){.platform-user-management-heading{align-items:flex-start;flex-direction:column}.platform-user-detail-table th{width:auto}.platform-user-panel-actions{align-items:stretch;flex-direction:column}.platform-user-panel-actions .button{width:100%}}
`
const next=`/* Platform Owner · user management record panel */
.platform-owner-users .platform-owner-clickable-row.is-selected{background:var(--lo-color-surface-soft,#f6f8fb)}
.platform-user-management-panel{
  width:min(100%,1080px);
  margin:16px auto 0;
  border:1px solid var(--lo-color-border);
  border-radius:var(--lo-radius-card);
  background:var(--lo-color-surface);
  overflow:hidden;
  box-shadow:0 8px 24px rgba(23,32,51,.04)
}
.platform-user-management-heading{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  min-height:70px;
  padding:14px 18px;
  border-bottom:1px solid var(--lo-color-border)
}
.platform-user-management-heading>div{display:flex;min-width:0;flex-direction:column;gap:4px}
.platform-user-management-heading strong{font-size:15px;color:var(--lo-color-text)}
.platform-user-management-heading span{overflow:hidden;text-overflow:ellipsis;font-size:11.5px;color:var(--lo-color-text-muted)}
.platform-user-management-panel .scroll-table{overflow-x:auto}
.platform-user-detail-table{width:100%;min-width:760px;margin:0;table-layout:fixed}
.platform-user-detail-table th{
  width:132px;
  padding:13px 14px;
  white-space:nowrap;
  background:var(--lo-color-surface-soft,#f6f8fb);
  color:var(--lo-color-muted);
  font-size:10px;
  font-weight:800;
  letter-spacing:.025em
}
.platform-user-detail-table td{
  padding:13px 16px;
  vertical-align:middle;
  color:var(--lo-color-text);
  font-size:12px;
  overflow-wrap:anywhere
}
.platform-user-detail-table tr>th:nth-child(3){width:132px}
.platform-user-detail-table tr>td:nth-child(2),
.platform-user-detail-table tr>td:nth-child(4){width:auto}
.platform-user-detail-table .platform-role-select{width:min(100%,420px);min-height:40px}
.platform-user-panel-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.platform-user-panel-actions .button{min-height:40px}
.platform-user-actions-row th,.platform-user-actions-row td{padding-top:14px;padding-bottom:14px}
@media(max-width:900px){
  .platform-user-management-panel{width:100%;margin-top:14px}
}
@media(max-width:760px){
  .platform-user-management-heading{min-height:auto;align-items:flex-start;flex-direction:column}
  .platform-user-detail-table{min-width:680px}
  .platform-user-detail-table th{width:118px}
  .platform-user-panel-actions{align-items:stretch;flex-direction:column}
  .platform-user-panel-actions .button{width:100%}
}
`
if(!s.includes(old)) throw new Error('user panel css block not found')
s=s.replace(old,next)
fs.writeFileSync(path,s)
