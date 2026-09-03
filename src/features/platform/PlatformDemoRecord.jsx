import { ArrowLeft, FlaskConical, LogIn, MoveRight } from 'lucide-react'
import { Button } from '../../design-system/Button'

function daysBetween(a,b){return Math.max(0,Math.ceil((new Date(b)-new Date(a))/86400000))}

function InfoSection({title,children}){
  return <section className="platform-info-section"><h3>{title}</h3><dl>{children}</dl></section>
}

function InfoRow({label,value,status}){
  return <div className="platform-info-row"><dt>{label}</dt><dd>{status?<span className={`status-badge ${status==='active'?'active':'danger'}`}>{value||'—'}</span>:(value??'—')}</dd></div>
}

export function PlatformDemoRecord({demo,language='el',onBack,onOpenDemo,onConvert}){
  if(!demo)return null
  const en=language==='en'
  const tx=(elText,enText)=>en?enText:elText
  const today=new Date().toISOString().slice(0,10)
  const remaining=daysBetween(today,demo.valid_until)
  const status=demo.status==='active'&&remaining>0?'active':'expired'
  const statusLabel=status==='active'?tx('Ενεργό','Active'):tx('Ληγμένο / ανενεργό','Expired / inactive')
  const org=demo.organization||null

  return <div className="platform-demo-record-shell">
    <div className="platform-workspace-toolbar"><button className="platform-back-button" onClick={onBack}><ArrowLeft size={16}/>{tx('Πίσω','Back')}</button></div>
    <section className="platform-center-section platform-owner-record-workspace platform-demo-record-workspace">
      <div className="platform-owner-details">
        <div className="platform-record-intro">
          <div>
            <span className="eyebrow">{tx('ΚΑΡΤΕΛΑ DEMO','DEMO RECORD')}</span>
            <h2>{org?.name||demo.label}</h2>
            <p>{tx('Χρονικά περιορισμένο και πλήρως απομονωμένο περιβάλλον επίδειξης.','Time-limited, fully isolated demonstration environment.')}</p>
          </div>
          <div className="platform-demo-record-actions">
            <Button onClick={onOpenDemo}><LogIn size={15}/>{tx('Είσοδος στο Demo','Open Demo')}</Button>
            {!demo.organization_id&&onConvert&&<Button variant="secondary" onClick={onConvert}><MoveRight size={15}/>{tx('Μετατροπή σε οργανισμό','Convert to organization')}</Button>}
          </div>
        </div>

        <div className="platform-demo-record-status">
          <span className="platform-demo-icon"><FlaskConical size={20}/></span>
          <div><strong>{statusLabel}</strong><span>{status==='active'?`${remaining} ${tx('ημέρες υπόλοιπο','days remaining')}`:tx('Η πρόσβαση δεν είναι ενεργή.','Access is not active.')}</span></div>
        </div>

        <div className="platform-info-sections platform-demo-info-sections">
          <InfoSection title={tx('Demo οργανισμός','Demo organization')}>
            <InfoRow label={tx('Επωνυμία','Name')} value={org?.name||demo.label}/>
            <InfoRow label={tx('Κωδικός','Code')} value={org?.code||'—'}/>
            <InfoRow label={tx('Τύπος','Type')} value={tx('Demo / Prospect','Demo / Prospect')}/>
            <InfoRow label={tx('Κατάσταση','Status')} value={statusLabel} status={status}/>
          </InfoSection>
          <InfoSection title={tx('Επικοινωνία','Contact')}>
            <InfoRow label={tx('Υπεύθυνος','Contact person')} value={demo.contact_name||'—'}/>
            <InfoRow label="Email" value={demo.contact_email||'—'}/>
            <InfoRow label={tx('Demo User ID','Demo User ID')} value={demo.demo_user_id||'—'}/>
          </InfoSection>
          <InfoSection title={tx('Διάρκεια πρόσβασης','Access period')}>
            <InfoRow label={tx('Έναρξη','Start')} value={demo.valid_from}/>
            <InfoRow label={tx('Λήξη','End')} value={demo.valid_until}/>
            <InfoRow label={tx('Υπόλοιπο','Remaining')} value={`${remaining} ${tx('ημέρες','days')}`}/>
            <InfoRow label={tx('Απομόνωση δεδομένων','Data isolation')} value={tx('Μόνο Demo δεδομένα','Demo data only')}/>
          </InfoSection>
        </div>
      </div>
    </section>
  </div>
}
