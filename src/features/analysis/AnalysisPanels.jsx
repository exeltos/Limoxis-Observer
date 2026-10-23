// Presentational pieces of the Analysis page: filters, KPI strip, charts,
// the microbiology line list and cluster alerts.
import { ExportMenu } from '../../design-system/ExportMenu'
import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'

import { RegistryTable } from '../../design-system/RegistryTable'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { downloadCsv } from '../../core/export/csvExport'
import { BarList,ChartCard,DonutChart,MatrixTable,Scoreboard,TrendChart,numericRows } from './AnalysisCharts'
import { CLINICAL_SITES,siteLabel,fmtDate,numberValue,continuousMonths,chartLanguage } from './analysisPageModel'
import { signalDemoScenario } from '../demo/demoScenarioSignals'
import { FINDING_CATEGORIES,categoryCounts,findingCategory,isIdentified,organismLabel,resistanceLabel,specimenLabel,specimenRows } from './microbiologyLabels'

export function AnalysisSelect({label,value,onChange,children}){return <label className="analysis-filter-field"><span>{label}</span><select value={value} onChange={onChange}>{children}</select></label>}
// KPI tile: [label, value, hint, tone] — tone is good / warning / danger.
const KPI_TONES=new Set(['good','warning','danger'])
// period: the short period next to each measure («2026 · έτος»).
export function KpiStrip({rows,period=''}){return <div className="analysis-kpis">{rows.map(([label,value,hint,tone])=><article key={label} className={KPI_TONES.has(tone)?`kpi-${tone}`:''}><span>{label}{period&&<em className="analysis-kpi-period">{period}</em>}</span><strong>{value}</strong>{hint&&hint!=='—'&&<small>{hint}</small>}</article>)}</div>}
// A cross-tabulation or trend the data source does not provide is left out.
export function SectionCharts({charts,en}){return <div className="analysis-chart-grid">{charts.filter(chart=>chart.type==='matrix'?Array.isArray(chart.cells):chart.type==='trend'?Array.isArray(chart.points):true).map(chart=><ChartCard key={chart.title} wide={chart.wide} title={chart.title} subtitle={chart.subtitle}>{chart.type==='trend'?<TrendChart points={chart.sparse?chart.points:continuousMonths(chart.points)} en={en} label={chart.title}/>:chart.type==='donut'?<DonutChart rows={chart.rows} en={en} centerLabel={chart.center}/>:chart.type==='rate'?<BarList rows={chart.rows} en={en} scale={100} suffix="%" max={12}/>:chart.type==='matrix'?<MatrixTable cells={chart.cells} rowLabel={chart.rowLabel} en={en}/>:chart.type==='scoreboard'?<Scoreboard rows={chart.rows} columns={chart.columns} rowLabel={chart.rowLabel} en={en}/>:<BarList rows={chart.rows} en={en} max={12}/>}</ChartCard>)}</div>}
export function MetricBars({rows,tx}){return <BarList rows={rows} en={chartLanguage(tx)} max={12}/>}
export function MicrobiologyDistribution({details,tx}){const en=chartLanguage(tx);return <div className="analysis-chart-grid"><ChartCard wide title={tx('Τάση θετικών αποτελεσμάτων','Positive-results trend')} subtitle={tx('Θετικά μικροβιολογικά αποτελέσματα ανά μήνα · περάστε το ποντίκι για τιμές.','Positive microbiology results by month · hover for values.')}><TrendChart points={details?.monthly||[]} en={en} label={tx('Τάση θετικών αποτελεσμάτων','Positive-results trend')}/></ChartCard></div>}
// The detailed line list every other microbiology chart on this page only
// summarizes: one row per distinct (organism, resistance, department,
// exact specimen-library type, technical category) combination actually seen.
// The library specimen is what users see; the technical category remains only
// for clinical/environment/staff filtering and indicator compatibility.
export function NationalRowsTable({rows,tx,emptyText}){
  const columns=[
    {key:'organism',label:tx('Μικροοργανισμός','Organism')},
    {key:'resistance',label:tx('Ανθεκτικότητα','Resistance')},
    {key:'department',label:tx('Τμήμα','Department')},
    {key:'source',label:tx('Είδος δείγματος','Specimen type')},
    {key:'category',label:tx('Κατηγορία δείγματος','Specimen category')},
    {key:'count',label:tx('Πλήθος','Count')},
    {key:'lastDate',label:tx('Τελευταία καταγραφή','Last recorded')},
  ]
  return <RegistryTable columns={columns} rows={rows||[]} rowKey={(row,index)=>row.join('|')||index} emptyTitle={emptyText} renderRow={([organism,resistanceClass,department,source,count,lastDate,sampleType])=><>
    <td>{organismLabel(organism,tx)}</td>
    <td>{resistanceClass&&resistanceClass!=='—'?<span className="status-badge danger">{resistanceClass}</span>:resistanceLabel(resistanceClass,organism,tx)}</td>
    <td>{department}</td>
    <td>{specimenLabel(source,tx)}</td>
    <td>{siteLabel(sampleType,tx)}</td>
    <td>{count}</td>
    <td>{fmtDate(lastDate)}</td>
  </>}/>
}
export function exportNationalRowsCsv(rows,tx,filename){
  const headers=[tx('Μικροοργανισμός','Organism'),tx('Ανθεκτικότητα','Resistance'),tx('Τμήμα','Department'),tx('Είδος δείγματος','Specimen type'),tx('Κατηγορία δείγματος','Specimen category'),tx('Πλήθος','Count'),tx('Τελευταία καταγραφή','Last recorded')]
  const csvRows=(rows||[]).map(([organism,resistanceClass,department,source,count,lastDate,sampleType])=>[organismLabel(organism,tx),resistanceLabel(resistanceClass,organism,tx),department,specimenLabel(source,tx),siteLabel(sampleType,tx),count,fmtDate(lastDate)])
  downloadCsv(`${filename}.csv`,headers,csvRows)
  signalDemoScenario('analysis_export')
}
export function ExportCsvButton({rows,tx,filename}){return <ExportMenu compact disabled={!rows?.length} onExcel={()=>exportNationalRowsCsv(rows,tx,filename)}/>}
// Outbreak/cluster early-warning signal (platform review roadmap, P2):
// same organism, same department, within a rolling window — reuses the
// analysis-signal-card/analysis-signal-grid styling the load-error card
// already established for this page, so a cluster reads as an alert
// rather than another neutral chart.
export function ClusterAlerts({clusters,tx}){
  if(!clusters?.length)return null
  return <article className="analysis-signal-card"><header><div><ShieldAlert size={18}/><div><strong>{tx('Πιθανές συρροές λοιμώξεων','Possible infection clusters')}</strong><span>{tx('Ίδιος μικροοργανισμός στο ίδιο τμήμα μέσα σε στενό χρονικό διάστημα — ενδεικτικό σήμα επιτήρησης, δεν αποτελεί επιβεβαιωμένη επιδημική έξαρση.','Same organism in the same department within a short time span — a surveillance signal, not a confirmed outbreak.')}</span></div></div></header><div className="analysis-signal-grid">{clusters.slice(0,6).map((cluster,index)=><div key={index} className={cluster.resistanceLabels?.length?'critical':'warning'}><strong>{cluster.organism}</strong><span>{cluster.department} · {cluster.count} {tx('περιστατικά σε','cases in')} {cluster.windowDays} {tx('ημέρες','days')}{cluster.resistanceLabels?.length?` · ${cluster.resistanceLabels.join(', ')}`:''}</span><small>{fmtDate(cluster.firstDate)} → {fmtDate(cluster.lastDate)}</small></div>)}</div></article>
}
// Microbiology & AMR tab: cluster alerts, the positives trend and distributions,
// resistance per organism, and one line list that can narrow to MDR/XDR/PDR.
export function NationalSurveillance({details,clusters,amr=[],tx}){const [resistantOnly,setResistantOnly]=useState(false);const [category,setCategory]=useState('clinical');const nationalRows=details?.nationalRows||[];const counts=categoryCounts(nationalRows);const inCategory=row=>findingCategory(row[6])===category;const listRows=(resistantOnly?nationalRows.filter(([,resistanceClass])=>['MDR','XDR','PDR'].includes(resistanceClass)):nationalRows).filter(inCategory);const organismRows=nationalRows.filter(([organism,,,,,,site])=>isIdentified(organism)&&findingCategory(site)==='clinical');const amrRows=(amr||[]).filter(([,tested])=>Number(tested)>0).map(([organism,tested,resistant])=>[`${organism} (${resistant}/${tested})`,Math.round(Number(resistant)/Number(tested)*1000)/10]);return <><ClusterAlerts clusters={clusters} tx={tx}/><MicrobiologyDistribution details={details} tx={tx}/><div className="analysis-chart-grid"><article className="analysis-chart-card"><header><div><strong>{tx('Κατηγορίες αντοχής','Resistance classes')}</strong><span>{tx('Μερίδιο MDR / XDR / PDR στα θετικά αποτελέσματα.','Share of MDR / XDR / PDR among positive results.')}</span></div></header><DonutChart rows={details?.resistance||[]} en={chartLanguage(tx)} centerLabel={tx('στελέχη','isolates')}/></article><article className="analysis-chart-card"><header><div><strong>{tx('Αντοχή ανά μικροοργανισμό (%)','Resistance by organism (%)')}</strong><span>{tx('Ανθεκτικά προς ελεγμένα απομονώματα.','Resistant over tested isolates.')}</span></div></header><BarList rows={amrRows} en={chartLanguage(tx)} scale={100} suffix="%" max={12}/></article></div><div className="analysis-chart-grid"><article className="analysis-chart-card"><header><div><strong>{tx('Κατηγορία κλινικού δείγματος','Clinical specimen category')}</strong><span>{tx('Γενική κατηγορία που χρησιμοποιείται στους δείκτες.','Broad category used by indicator calculations.')}</span></div></header><DonutChart rows={(details?.bySite||[]).filter(([value])=>CLINICAL_SITES.includes(value)).map(([value,count])=>[siteLabel(value,tx),count])} en={chartLanguage(tx)} centerLabel={tx('δείγματα','samples')}/></article><article className="analysis-chart-card"><header><div><strong>{tx('Είδος δείγματος','Specimen type')}</strong><span>{tx('Κατανομή των θετικών ευρημάτων με βάση τη Βιβλιοθήκη Ειδών Δείγματος.','Distribution of positive findings by the central specimen-type library.')}</span></div></header><MetricBars rows={specimenRows(details?.bySource,tx)} tx={tx}/></article></div><article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Μικροοργανισμοί ανά είδος δείγματος','Organisms by specimen type')}</strong><span>{tx('Θετικά ευρήματα κάθε ταυτοποιημένου μικροοργανισμού ανά πραγματικό είδος δείγματος της Βιβλιοθήκης.','Positive findings of each identified organism by the exact specimen type from the central library.')}</span></div></header><MatrixTable cells={organismRows.map(([organism,,,source,count])=>[organism,specimenLabel(source,tx),count])} rowLabel={tx('Μικροοργανισμός','Organism')} en={chartLanguage(tx)}/></article><article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Μικροοργανισμοί ανά τμήμα','Organisms by department')}</strong><span>{tx('Σε ποια τμήματα απομονώνεται κάθε μικροοργανισμός από κλινικά δείγματα (χωρίς περιβαλλοντικά, προσωπικό και ευρήματα χωρίς ταυτοποίηση).','Which departments each organism is isolated in from clinical specimens (excluding environmental, staff and unidentified findings).')}</span></div></header><MatrixTable cells={organismRows.map(([organism,,department,,count])=>[organism,department,count])} rowLabel={tx('Μικροοργανισμός','Organism')} en={chartLanguage(tx)}/></article><article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Ανθεκτικότητα ανά τμήμα','Resistance by department')}</strong><span>{tx('Κατηγορίες αντοχής των θετικών ευρημάτων κάθε τμήματος.','Resistance classes of each department\'s positive findings.')}</span></div></header><MatrixTable cells={nationalRows.filter(([,resistance])=>resistance&&resistance!=='—').map(([,resistance,department,,count])=>[department,resistance,count])} rowLabel={tx('Τμήμα','Department')} en={chartLanguage(tx)}/></article><article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Μικροοργανισμοί ανά τμήμα και είδος δείγματος','Organisms by department and specimen type')}</strong><span>{tx('Αναλυτική καταγραφή ανά μικροοργανισμό, τμήμα, είδος δείγματος και κατηγορία.','Detailed line list by organism, department, specimen type and category.')}</span></div><div className="row-actions"><label className="analysis-resistant-toggle"><input type="checkbox" checked={resistantOnly} onChange={e=>setResistantOnly(e.target.checked)}/>{tx('Μόνο MDR/XDR/PDR','MDR/XDR/PDR only')}</label><ExportCsvButton rows={listRows} tx={tx} filename={resistantOnly?tx('ανθεκτικά_ευρήματα_amr','amr_resistant_findings'):tx('μικροοργανισμοί_εθνική_επιτήρηση','organisms_national_surveillance')}/></div></header><ModeSwitch ariaLabel={tx('Είδος ευρημάτων','Kind of findings')} value={category} onChange={setCategory} options={FINDING_CATEGORIES.map(([value,el,en])=>({value,label:`${tx(el,en)} · ${counts[value].toLocaleString(tx("el-GR","en-GB"))}`}))}/><NationalRowsTable rows={listRows} tx={tx} emptyText={resistantOnly?tx('Δεν υπάρχουν ανθεκτικά ευρήματα για το ενεργό εύρος.','No resistant findings for the active scope.'):tx('Δεν υπάρχουν καταγραφές για το ενεργό εύρος.','No records for the active scope.')}/></article></>}
export function DomainView({rows,micro,tab,tx,en}){
 const share=numericRows(rows).filter(([,value])=>value>0)
 const monthly=micro?.monthly||[]
 return <div className="analysis-chart-grid">
  {tab==='overview'&&monthly.length>1&&<ChartCard wide title={tx('Θετικές καλλιέργειες ανά μήνα','Positive cultures by month')} subtitle={tx('Επικυρωμένα θετικά αποτελέσματα του ενεργού εύρους · περάστε το ποντίκι πάνω από το γράφημα για τιμές.','Validated positive results in the active scope · hover the chart for values.')}><TrendChart points={monthly} en={en} label={tx('Θετικές καλλιέργειες ανά μήνα','Positive cultures by month')}/></ChartCard>}
  <ChartCard title={tx('Κατανομή τρέχουσας περιόδου','Current-period distribution')} subtitle={tx('Καταγραφές της επιλεγμένης ενότητας.','Records from the selected area.')}><BarList rows={rows} en={en}/></ChartCard>
  {share.length>1&&<ChartCard title={tx('Μερίδιο επί του συνόλου','Share of total')} subtitle={tx('Πώς μοιράζονται οι καταγραφές της ενότητας.','How the section’s records are split.')}><DonutChart rows={share} en={en} centerLabel={tx('σύνολο','total')}/></ChartCard>}
 </div>}
export function ScopeComparison({title,subtitle,currentRows,compareRows,currentLabel,compareLabel,tx}){if(!compareRows?.length)return null;const comparison=new Map(compareRows.map(row=>[row[0],row[1]]));return <article className="analysis-chart-card analysis-wide-card"><header><div><strong>{title}</strong><span>{subtitle}</span></div></header><div className="analysis-comparison-table"><div className="head"><span>{tx('Δείκτης','Indicator')}</span><span>{currentLabel}</span><span>{compareLabel}</span><span>{tx('Διαφορά','Difference')}</span></div>{currentRows.map(([label,current])=>{const previous=comparison.get(label)??0;const diff=current==='—'||previous==='—'?'—':numberValue(current)-numberValue(previous);return <div key={label}><span>{label}</span><span>{current}</span><span>{previous}</span><span>{typeof diff==='number'&&diff>0?'+':''}{diff}</span></div>})}</div></article>}