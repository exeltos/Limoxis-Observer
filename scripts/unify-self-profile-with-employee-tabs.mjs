import fs from 'node:fs'

const p='src/features/employees/EmployeeRecordPage.jsx'
let s=fs.readFileSync(p,'utf8')

// Keep the canonical employee self-record tabs. Improve the account summary and empty-link state only.
const old=`function SelfAccountSummary({profile,user,role,membership,tenant,language}){
  const en=language==='en'
  const fullName=profile?.fullName||profile?.full_name||user?.user_metadata?.full_name||user?.email||'—'
  const email=profile?.contactEmail||profile?.email||user?.email||'—'
  const username=profile?.username||user?.user_metadata?.username||'—'
  const organization=tenant?.name||tenant?.organization_name||(profile?.isPlatformOwner?(en?'Platform account':'Λογαριασμός πλατφόρμας'):'—')
  const membershipStatus=membership?.status||'active'
  const active=membershipStatus!=='disabled'&&membershipStatus!=='suspended'
  return <section className="my-profile-account-card" aria-label={en?'Account details':'Στοιχεία λογαριασμού'}><div className="my-profile-account-heading"><div><span>{en?'ACCOUNT':'ΛΟΓΑΡΙΑΣΜΟΣ'}</span><strong>{fullName}</strong><small>{email}</small></div><span className={\`status-badge \${active?'active':'danger'}\`}>{active?(en?'Active':'Ενεργός'):(en?'Suspended':'Σε παύση')}</span></div><div className="my-profile-account-grid"><div><span>{en?'Username':'Username'}</span><strong>{username}</strong></div><div><span>{en?'Role':'Ρόλος'}</span><strong>{roleLabel(role,language)}</strong></div><div><span>{en?'Organization':'Οργανισμός'}</span><strong>{organization}</strong></div><div><span>Email</span><strong>{email}</strong></div></div></section>
}`
const replacement=`function SelfAccountSummary({profile,user,role,membership,tenant,language}){
  const en=language==='en'
  const fullName=profile?.fullName||profile?.full_name||user?.user_metadata?.full_name||user?.email||'—'
  const email=profile?.contactEmail||profile?.email||user?.email||'—'
  const username=profile?.username||user?.user_metadata?.username||'—'
  const organization=tenant?.name||tenant?.organization_name||(profile?.isPlatformOwner?(en?'Platform account':'Λογαριασμός πλατφόρμας'):'—')
  const membershipStatus=membership?.status||'active'
  const active=membershipStatus!=='disabled'&&membershipStatus!=='suspended'
  return <section className="my-profile-account-card" aria-label={en?'Account details':'Στοιχεία λογαριασμού'}><div className="my-profile-account-heading"><div className="my-profile-account-identity"><span className="eyebrow">{en?'ACCOUNT':'ΛΟΓΑΡΙΑΣΜΟΣ'}</span><strong>{fullName}</strong><small>{email}</small></div><span className={\`status-badge \${active?'active':'danger'}\`}>{active?(en?'Active':'Ενεργός'):(en?'Suspended':'Σε παύση')}</span></div><div className="my-profile-account-grid"><div><span>Username</span><strong>{username}</strong></div><div><span>{en?'Role':'Ρόλος'}</span><strong>{roleLabel(role,language)}</strong></div><div><span>{en?'Organization':'Οργανισμός'}</span><strong>{organization}</strong></div><div><span>Email</span><strong>{email}</strong></div></div></section>
}`
if(s.includes(old)) s=s.replace(old,replacement)
fs.writeFileSync(p,s)

const css='src/styles/design-system-layouts.css'
let c=fs.readFileSync(css,'utf8')
const marker='/* Canonical self profile */'
const block=`\n${marker}\n.my-profile-account-card{margin:0 0 16px;padding:20px 22px;background:var(--lo-color-surface,#fff);border:1px solid var(--lo-color-border,#dbe3ec);border-radius:var(--lo-radius-card,18px);box-shadow:0 6px 20px rgba(23,32,51,.035)}\n.my-profile-account-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:16px;border-bottom:1px solid var(--lo-color-border,#dbe3ec)}\n.my-profile-account-identity{display:grid;gap:4px;min-width:0}.my-profile-account-identity>strong{font-size:20px;line-height:1.25;color:var(--lo-color-text,#17243a)}.my-profile-account-identity>small{font-size:13px;color:var(--lo-color-text-muted,#6b7f94);overflow-wrap:anywhere}\n.my-profile-account-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin-top:16px;border:1px solid var(--lo-color-border,#dbe3ec);border-radius:14px;overflow:hidden}.my-profile-account-grid>div{display:grid;gap:5px;padding:13px 16px;min-width:0;background:#fff;border-right:1px solid var(--lo-color-border,#dbe3ec)}.my-profile-account-grid>div:last-child{border-right:0}.my-profile-account-grid span{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--lo-color-text-muted,#6b7f94)}.my-profile-account-grid strong{font-size:14px;line-height:1.35;color:var(--lo-color-text,#17243a);overflow-wrap:anywhere}\n.my-profile-employee-card{padding:20px 22px;background:var(--lo-color-surface,#fff);border:1px solid var(--lo-color-border,#dbe3ec);border-radius:var(--lo-radius-card,18px)}.my-profile-employee-card-copy{display:grid;gap:7px}.my-profile-employee-card-copy strong{font-size:16px;color:var(--lo-color-text,#17243a)}.my-profile-employee-card-copy span{max-width:900px;font-size:14px;line-height:1.55;color:var(--lo-color-text-muted,#6b7f94)}\n@media(max-width:1100px){.my-profile-account-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.my-profile-account-grid>div:nth-child(2){border-right:0}.my-profile-account-grid>div:nth-child(-n+2){border-bottom:1px solid var(--lo-color-border,#dbe3ec)}}\n@media(max-width:680px){.my-profile-account-card{padding:16px}.my-profile-account-heading{align-items:flex-start}.my-profile-account-grid{grid-template-columns:1fr}.my-profile-account-grid>div{border-right:0!important;border-bottom:1px solid var(--lo-color-border,#dbe3ec)!important}.my-profile-account-grid>div:last-child{border-bottom:0!important}}\n`
if(!c.includes(marker)) c+=block
fs.writeFileSync(css,c)
