import { useMemo,useState } from 'react'
import { BarChart3,Download,FlaskConical,Printer } from 'lucide-react'
import { useLocation,useNavigate } from 'react-router-dom'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { ROLES } from '../../core/permissions/roles'
import { BackButton } from '../../design-system/BackButton'
import { IconButton } from '../../design-system/IconButton'
import { Page } from '../../design-system/Page'

const TABS=[
  ['overview','Σύνοψη','Overview'],
  ['national','Μικροοργανισμοί / Εθνική Επιτήρηση','Microorganisms / National surveillance'],
  ['surveillance','Επιτήρηση & HAI','Surveillance & HAI'],
  ['laboratory','Μικροβιολογία','Microbiology'],
  ['amr','AMR / MDR-XDR','AMR / MDR-XDR'],
  ['antimicrobials','Αντιμικροβιακά','Antimicrobials'],
  ['prevention','Πρόληψη','Prevention'],
  ['hand','Υγιεινή Χεριών','Hand hygiene'],
  ['controls','Έλεγχοι','Controls'],
  ['occupational','Εργαζόμενοι','Employees'],
  ['quality','Ποιότητα','Quality'],
  ['training','Εκπαίδευση','Training'],
  ['governance','Governance','Governance'],
]

const DEMO_KPI={
  overview:[['HAI / 1.000 κλινοημέρες','3,5'],['MDR/XDR rate','12,4%'],['Υγιεινή χεριών','88%'],['DDD / 1.000 κλινοημέρες','58'],['Bundle compliance','91%'],['Έλεγχοι στην ώρα τους','95%']],
  national:[['Δηλωτέες MDRO βακτηριαιμίες','31'],['Νέα MDR/XDR απομονώματα','42'],['Τμήματα με ≥1 εύρημα','9'],['Κρίσιμες συρροές','2']],
  surveillance:[['HAI prevalence (PPS)','12,1%'],['HAI / 1.000 κλινοημέρες','3,5'],['CLABSI / 1.000 CVC-days','1,7'],['CAUTI / 1.000 catheter-days','2,1']],
  laboratory:[['Θετικές καλλιέργειες','184'],['Critical ≤30′','94%'],['MDR/XDR isolates','42'],['Median TAT','16 h']],
  amr:[['MDR/XDR rate','12,4%'],['Carbapenem resistance','21%'],['MRSA','8,2%'],['VRE','5,6%']],
  antimicrobials:[['DDD / 1.000 κλιν/ρες','58'],['Carbapenem DDD','12'],['Reserve share','7,4%'],['Reviews ≤72h','91%']],
  prevention:[['Bundle compliance','91%'],['Έγκαιρη απομόνωση','96%'],['Waste segregation','93%'],['Antiseptic target','89%']],
  hand:[['Compliance','88%'],['Παρατηρήσεις','1.248'],['Glove misuse','7%'],['Training coverage','94%']],
  controls:[['On-time','95%'],['Open deviations','12'],['Overdue','5'],['Completion','97%']],
  occupational:[['Vaccination coverage','86%'],['Ιατρικές επισκέψεις','312'],['Overdue visits','24'],['Follow-up','98%']],
  quality:[['CAPA ≤30d','89%'],['Open findings','18'],['Audits','31'],['Docs in-date','96%']],
  training:[['Coverage','92%'],['Completions','1.034'],['Overdue','44'],['Pass rate','94%']],
  governance:[['EODY reporting completeness','98%'],['Audit completeness','99%'],['Committees active','94%'],['Policies in-date','96%']],
}

const DEMO_ROWS=[['ΜΕΘ','72','58'],['Παθολογική','54','47'],['Χειρουργική','41','35'],['ΤΕΠ','29','24'],['Αιμοκάθαρση','22','19']]

function downloadDemoCsv(tab,rows){
  const lines=[['Tab','Department','Current','Previous'],...rows.map(row=>[tab,...row])]
  const csv=lines.map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\n')
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})
  const link=document.createElement('a')
  link.href=URL.createObjectURL(blob)
  link.download=`limoxis-demo-analysis-${tab}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

function hashOrganization(hash=''){
  const query=hash.includes('?')?hash.split('?')[1]:''
  return new URLSearchParams(query).get('organization')||'all'
}

function ProductionEmpty({platform,tenant,language}){
  const en=language==='en'
  return (
    <section className="analysis-production-empty" role="status">
      <div className="analysis-production-empty-icon"><BarChart3 size={24}/></div>
      <strong>{en?'No production analytics data for the selected scope':'Δεν υπάρχουν δεδομένα παραγωγής για το επιλεγμένο εύρος'}</strong>
      <span>{en?'Only records stored for the active organization and permitted scope are shown here. Demo or synthetic values are never used as a fallback.':'Εδώ εμφανίζονται αποκλειστικά πραγματικές εγγραφές του ενεργού οργανισμού και του επιτρεπόμενου scope. Demo ή συνθετικές τιμές δεν χρησιμοποιούνται ποτέ ως εναλλακτικά δεδομένα.'}</span>
      <small>{platform?(en?'Platform scope':'Επίπεδο πλατφόρμας'):(tenant?.name||(en?'Organization':'Οργανισμός'))}</small>
    </section>
  )
}

export function AnalysisPage({platform=false,organizations=[]}){
  const {tenant,role,isDemo}=useTenant()
  const {language}=useLanguage()
  const location=useLocation()
  const nav=useNavigate()
  const en=language==='en'
  const tx=(elText,enText)=>en?enText:elText
  const initialOrg=platform?hashOrganization(location.hash):'all'
  const [tab,setTab]=useState('overview')
  const [period,setPeriod]=useState('year')
  const [org,setOrg]=useState(initialOrg)
  const [department,setDepartment]=useState('all')
  const allowed=[ROLES.PLATFORM_OWNER,ROLES.HOSPITAL_ADMIN,ROLES.INFECTION_CONTROL_LEAD,ROLES.DEMO].includes(role)
  const demoRows=useMemo(()=>DEMO_KPI[tab]||DEMO_KPI.overview,[tab])
  const returnTo=location.state?.returnTo

  if(!allowed){
    return <div className="empty-state"><strong>{tx('Δεν υπάρχει πρόσβαση στην Ανάλυση.','Analytics access is not available.')}</strong></div>
  }

  return (
    <Page
      fill
      className={`analysis-page ${platform?'platform-analysis-page':''}`.trim()}
      navigation={returnTo?<BackButton onClick={()=>nav(returnTo)} label={tx('Πίσω','Back')}/>:null}
      title={tx('Ανάλυση','Analytics')}
      subtitle={platform?tx('Συγκεντρωτική και συγκριτική εικόνα πλατφόρμας.','Platform-wide reporting and comparison.'):tenant?.name||tx('Οργανισμός','Organization')}
      actions={
        <>
          <IconButton label={tx('Εκτύπωση','Print')} onClick={()=>window.print()}><Printer size={16}/></IconButton>
          <IconButton label={tx('Εξαγωγή CSV','Export CSV')} disabled={!isDemo} onClick={()=>downloadDemoCsv(tab,DEMO_ROWS)}><Download size={16}/></IconButton>
        </>
      }
    >
      <div className="analysis-workspace analysis-safe-workspace">
        <div className="analysis-sticky">
          <div className="analysis-filters">
            {platform&&(
              <label>
                <span>{tx('Νοσοκομείο','Hospital')}</span>
                <select value={org} onChange={event=>setOrg(event.target.value)}>
                  <option value="all">{tx('Όλα τα νοσοκομεία','All hospitals')}</option>
                  {organizations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            )}
            <label>
              <span>{tx('Τμήμα','Department')}</span>
              <select value={department} onChange={event=>setDepartment(event.target.value)}>
                <option value="all">{tx('Όλα τα τμήματα','All departments')}</option>
                {isDemo&&DEMO_ROWS.map(row=><option key={row[0]} value={row[0]}>{row[0]}</option>)}
              </select>
            </label>
            <label>
              <span>{tx('Περίοδος','Period')}</span>
              <select value={period} onChange={event=>setPeriod(event.target.value)}>
                <option value="month">{tx('Μήνας','Month')}</option>
                <option value="quarter">{tx('Τρίμηνο','Quarter')}</option>
                <option value="half">{tx('Εξάμηνο','Half-year')}</option>
                <option value="year">{tx('Έτος','Year')}</option>
              </select>
            </label>
          </div>
          <div className="analysis-tabs">
            {TABS.map(([id,elLabel,enLabel])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{en?enLabel:elLabel}</button>)}
          </div>
        </div>

        <div className="analysis-scroll">
          <section className="analysis-report">
            <div className="analysis-section-title">
              <div>
                <h2>{TABS.find(item=>item[0]===tab)?.[en?2:1]}</h2>
                <p>{isDemo?tx('Αποκλειστικά συνθετικό dataset του Demo environment.','Synthetic dataset from the isolated Demo environment only.'):tx('Production δεδομένα μόνο — χωρίς fallback σε demo τιμές.','Production records only — no fallback to demo values.')}</p>
              </div>
              {isDemo&&<span className="status-badge temporary"><FlaskConical size={12}/> DEMO DATA</span>}
            </div>
            {!isDemo?(
              <ProductionEmpty platform={platform} tenant={tenant} language={language}/>
            ):(
              <>
                <div className="analysis-kpis">
                  {demoRows.map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{tx('Συνθετικό demo δεδομένο','Synthetic demo value')}</small></article>)}
                </div>
                <article className="analysis-compare-card">
                  <header>
                    <div><strong>{tx('Κατανομή ανά τμήμα','Distribution by department')}</strong><span>{tx('Τρέχουσα έναντι προηγούμενης περιόδου','Current versus previous period')}</span></div>
                  </header>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>{tx('Τμήμα','Department')}</th><th>{tx('Τρέχουσα περίοδος','Current period')}</th><th>{tx('Προηγούμενη περίοδος','Previous period')}</th></tr></thead>
                      <tbody>{DEMO_ROWS.filter(row=>department==='all'||row[0]===department).map(row=><tr key={row[0]}><td><strong>{row[0]}</strong></td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody>
                    </table>
                  </div>
                </article>
              </>
            )}
          </section>
        </div>
      </div>
    </Page>
  )
}
