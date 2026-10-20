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
// Short name of a scale as clinicians write it (NEWS2 8, Braden 10, GCS 13).
const SCALE_SHORT={news2:'NEWS2',braden:'Braden',gcs:'GCS','pediatric-gcs':'pGCS',morse:'Morse','humpty-dumpty':'Humpty Dumpty',sofa:'SOFA',qsofa:'qSOFA','apache-ii':'APACHE II','crib-ii':'CRIB II','snappe-ii':'SNAPPE II',newtt2:'NEWTT2',pim3:'PIM3','pelod-2':'PELOD-2',pews:'PEWS'}
export const scaleShortName=key=>SCALE_SHORT[key]||String(key||'').toUpperCase()
// `named` shows the scale's short name beside the score, where the icon alone would not say which scale it is.
export function ClinicalRiskFlags({rows=[],language='el',compact=false,named=false,onSelect}){const flags=clinicalRiskFlags(rows);if(!flags.length)return null;return <div className={'clinical-risk-flags'+(compact?' compact':'')} aria-label={language==='en'?'Clinical alerts':'Κλινικές επισημάνσεις'}>{flags.map(({kind,row,config,tone})=>{const Icon=config.Icon;const label=language==='en'?config.labelEn:config.labelEl;const title=`${label} · ${scaleShortName(row.scale_key)} ${row.score??'—'}`;return <button key={kind} type="button" className={`clinical-risk-flag${tone?` risk-tone-${tone}`:""}`} title={title} aria-label={title} onClick={onSelect?()=>onSelect(row):undefined}><Icon size={compact?13:16}/>{!compact&&<span>{label}</span>}{named&&<span className="clinical-risk-flag-scale">{scaleShortName(row.scale_key)}</span>}<strong>{row.score??'—'}</strong></button>})}</div>}

// Legend for the patient registry: icon + name of each alert kind that appears on the page.
export function ClinicalRiskLegendItems({kinds=Object.keys(CONFIG),language='el'}){return kinds.filter(k=>CONFIG[k]).map(k=>{const {Icon,labelEl,labelEn}=CONFIG[k];return <span key={k} className="patient-legend-item"><Icon size={12} aria-hidden="true"/>{language==='en'?labelEn:labelEl}</span>})}
export const clinicalRiskKinds=rows=>clinicalRiskFlags(rows).map(f=>f.kind)
