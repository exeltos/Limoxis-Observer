import {Activity,Brain,Footprints,HeartPulse,Baby,BedDouble,Stethoscope} from 'lucide-react'
const CONFIG={
 fall:{Icon:Footprints,labelEl:'Κίνδυνος πτώσης',labelEn:'Fall risk'},
 pressure:{Icon:BedDouble,labelEl:'Κίνδυνος κατακλίσεων',labelEn:'Pressure injury risk'},
 deterioration:{Icon:Activity,labelEl:'Κλινική επιδείνωση',labelEn:'Clinical deterioration'},
 neuro:{Icon:Brain,labelEl:'Νευρολογική κατάσταση',labelEn:'Neurological status'},
 severity:{Icon:HeartPulse,labelEl:'Βαρύτητα / οργανική δυσλειτουργία',labelEn:'Severity / organ dysfunction'},
 neonatal:{Icon:Baby,labelEl:'Νεογνικός κίνδυνος',labelEn:'Neonatal risk'},
 picu:{Icon:Stethoscope,labelEl:'Παιδιατρική ΜΕΘ',labelEn:'Paediatric ICU'}
}
const kind=row=>['morse','humpty-dumpty'].includes(row.scale_key)?'fall':row.scale_key==='braden'?'pressure':row.scale_key==='news2'?'deterioration':['gcs','pediatric-gcs'].includes(row.scale_key)?'neuro':['crib-ii','snappe-ii','newtt2'].includes(row.scale_key)?'neonatal':['pim3','pelod-2','pews'].includes(row.scale_key)?'picu':'severity'
// Tone from the stored interpretation; Braden has no engine risk level, so use
// its standard cut-offs (<=12 high, 13-18 at risk). Scales without any risk
// level (SOFA, APACHE II) stay neutral instead of showing a reassuring green.
const tone=row=>{const risk=String(row?.interpretation||'').toLowerCase();if(risk){if(['high','severe','critical'].some(x=>risk.includes(x)))return 'danger';if(['medium','moderate'].some(x=>risk.includes(x)))return 'warning';if(['low','baseline','mild','normal'].some(x=>risk.includes(x)))return 'active'}const score=Number(row?.score);if(row?.scale_key==='braden'&&Number.isFinite(score))return score<=12?'danger':score<=18?'warning':'active';return ''}
export function clinicalRiskFlags(rows=[]){const latest=new Map();for(const row of rows){const k=kind(row);if(!latest.has(k))latest.set(k,row)}return [...latest].map(([k,row])=>({kind:k,row,config:CONFIG[k],tone:tone(row)}))}
export function ClinicalRiskFlags({rows=[],language='el',compact=false,onSelect}){const flags=clinicalRiskFlags(rows);if(!flags.length)return null;return <div className={'clinical-risk-flags'+(compact?' compact':'')} aria-label={language==='en'?'Clinical alerts':'Κλινικές επισημάνσεις'}>{flags.map(({kind,row,config,tone})=>{const Icon=config.Icon;const label=language==='en'?config.labelEn:config.labelEl;const title=`${label} · ${row.scale_key?.toUpperCase()} ${row.score??'—'}`;return <button key={kind} type="button" className={`clinical-risk-flag${tone?` risk-tone-${tone}`:""}`} title={title} aria-label={title} onClick={onSelect?()=>onSelect(row):undefined}><Icon size={compact?13:16}/>{!compact&&<span>{label}</span>}<strong>{row.score??'—'}</strong></button>})}</div>}
