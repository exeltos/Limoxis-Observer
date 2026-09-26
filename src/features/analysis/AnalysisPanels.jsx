// Presentational pieces of the Analysis page: filters, KPI strip, charts,
// the national line list, cluster alerts and the AMR register.
import { Download,ShieldAlert } from 'lucide-react'
import { IconButton } from '../../design-system/IconButton'
import { RegistryTable } from '../../design-system/RegistryTable'
import { downloadCsv } from '../../core/export/csvExport'
import { BarList,ChartCard,DonutChart,TrendChart,numericRows } from './AnalysisCharts'
import { CLINICAL_SITES,siteLabel,organismBySiteRows,fmtDate,numberValue,continuousMonths,chartLanguage } from './analysisPageModel'

export function AnalysisSelect({label,value,onChange,children}){return <label className="analysis-filter-field"><span>{label}</span><select value={value} onChange={onChange}>{children}</select></label>}
// KPI tile: [label, value, hint, tone] — tone is good / warning / danger.
export const KPI_TONES=new Set(['good','warning','danger'])
export function KpiStrip({rows}){return <div className="analysis-kpis">{rows.map(([label,value,hint,tone])=><article key={label} className={KPI_TONES.has(tone)?`kpi-${tone}`:''}><span>{label}</span><strong>{value}</strong>{hint&&hint!=='—'&&<small>{hint}</small>}</article>)}</div>}
export function SectionCharts({charts,en}){return <div className="analysis-chart-grid">{charts.map(chart=><ChartCard key={chart.title} wide={chart.wide} title={chart.title} subtitle={chart.subtitle}>{chart.type==='trend'?<TrendChart points={continuousMonths(chart.points)} en={en} label={chart.title}/>:chart.type==='donut'?<DonutChart rows={chart.rows} en={en} centerLabel={chart.center}/>:chart.type==='rate'?<BarList rows={chart.rows} en={en} scale={100} suffix="%" max={12}/>:<BarList rows={chart.rows} en={en} max={12}/>}</ChartCard>)}</div>}
export function MetricBars({rows,tx}){return <BarList rows={rows} en={chartLanguage(tx)} max={12}/>}
export function MicrobiologyDistribution({details,tx}){const en=chartLanguage(tx);return <div className="analysis-chart-grid"><ChartCard wide title={tx('Τάση θετικών αποτελεσμάτων','Positive-results trend')} subtitle={tx('Θετικά μικροβιολογικά αποτελέσματα ανά μήνα · περάστε το ποντίκι για τιμές.','Positive microbiology results by month · hover for values.')}><TrendChart points={details?.monthly||[]} en={en} label={tx('Τάση θετικών αποτελεσμάτων','Positive-results trend')}/></ChartCard><ChartCard title={tx('Κατανομή ανά τμήμα','Distribution by department')} subtitle={tx('Θετικά μικροβιολογικά αποτελέσματα','Positive microbiology results')}><BarList rows={details?.byDepartment||[]} en={en}/></ChartCard><ChartCard title={tx('Κατηγορίες αντοχής','Resistance classes')} subtitle={tx('Μερίδιο MDR / XDR / PDR στα θετικά αποτελέσματα.','Share of MDR / XDR / PDR among positive results.')}><DonutChart rows={details?.resistance||[]} en={en} centerLabel={tx('στελέχη','isolates')}/></ChartCard></div>}
// The detailed line list every other microbiology chart on this page only
// summarizes: one row per distinct (organism, resistance, department,
// source, infection site) combination actually seen — this is what answers
// "which microbe, in which department, from which specimen and infection
// site" rather than independent one-dimensional breakdowns that can't be
// cross-referenced.
export function NationalRowsTable({rows,tx,emptyText}){
  const columns=[
    {key:'organism',label:tx('Μικροοργανισμός','Organism')},
    {key:'resistance',label:tx('Ανθεκτικότητα','Resistance')},
    {key:'department',label:tx('Τμήμα','Department')},
    {key:'site',label:tx('Σημείο λοίμωξης','Infection site')},
    {key:'source',label:tx('Λεπτομέρεια δείγματος','Specimen detail')},
    {key:'count',label:tx('Πλήθος','Count')},
    {key:'lastDate',label:tx('Τελευταία καταγραφή','Last recorded')},
  ]
  return <RegistryTable columns={columns} rows={rows||[]} rowKey={(row,index)=>row.join('|')||index} emptyTitle={emptyText} renderRow={([organism,resistanceClass,department,source,count,lastDate,sampleType])=><>
    <td>{organism}</td>
    <td>{resistanceClass&&resistanceClass!=='—'?<span className="status-badge danger">{resistanceClass}</span>:'—'}</td>
    <td>{department}</td>
    <td>{siteLabel(sampleType,tx)}</td>
    <td>{source}</td>
    <td>{count}</td>
    <td>{fmtDate(lastDate)}</td>
  </>}/>
}
export function exportNationalRowsCsv(rows,tx,filename){
  const headers=[tx('Μικροοργανισμός','Organism'),tx('Ανθεκτικότητα','Resistance'),tx('Τμήμα','Department'),tx('Σημείο λοίμωξης','Infection site'),tx('Λεπτομέρεια δείγματος','Specimen detail'),tx('Πλήθος','Count'),tx('Τελευταία καταγραφή','Last recorded')]
  const csvRows=(rows||[]).map(([organism,resistanceClass,department,source,count,lastDate,sampleType])=>[organism,resistanceClass,department,siteLabel(sampleType,tx),source,count,fmtDate(lastDate)])
  downloadCsv(`${filename}.csv`,headers,csvRows)
}
export function ExportCsvButton({rows,tx,filename}){return <IconButton size="sm" disabled={!rows?.length} label={tx('Λήψη CSV','Download CSV')} onClick={()=>exportNationalRowsCsv(rows,tx,filename)}><Download size={14}/></IconButton>}
// Outbreak/cluster early-warning signal (platform review roadmap, P2):
// same organism, same department, within a rolling window — reuses the
// analysis-signal-card/analysis-signal-grid styling the load-error card
// already established for this page, so a cluster reads as an alert
// rather than another neutral chart.
export function ClusterAlerts({clusters,tx}){
  if(!clusters?.length)return null
  return <article className="analysis-signal-card"><header><div><ShieldAlert size={18}/><div><strong>{tx('Πιθανές συρροές λοιμώξεων','Possible infection clusters')}</strong><span>{tx('Ίδιος μικροοργανισμός στο ίδιο τμήμα μέσα σε στενό χρονικό διάστημα — ενδεικτικό σήμα επιτήρησης, δεν αποτελεί επιβεβαιωμένη επιδημική έξαρση.','Same organism in the same department within a short time span — a surveillance signal, not a confirmed outbreak.')}</span></div></div></header><div className="analysis-signal-grid">{clusters.slice(0,6).map((cluster,index)=><div key={index} className={cluster.resistanceLabels?.length?'critical':'warning'}><strong>{cluster.organism}</strong><span>{cluster.department} · {cluster.count} {tx('περιστατικά σε','cases in')} {cluster.windowDays} {tx('ημέρες','days')}{cluster.resistanceLabels?.length?` · ${cluster.resistanceLabels.join(', ')}`:''}</span><small>{fmtDate(cluster.firstDate)} → {fmtDate(cluster.lastDate)}</small></div>)}</div></article>
}
export function NationalSurveillance({details,clusters,tx}){const nationalRows=details?.nationalRows||[];return <><ClusterAlerts clusters={clusters} tx={tx}/><MicrobiologyDistribution details={details} tx={tx}/><div className="analysis-chart-grid"><article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Μικροοργανισμοί','Microorganisms')}</strong><span>{tx('Συχνότερα θετικά ευρήματα','Most frequent positive findings')}</span></div></header><MetricBars rows={details?.microorganisms||[]} tx={tx}/></article></div><div className="analysis-chart-grid"><article className="analysis-chart-card"><header><div><strong>{tx('Σημείο λοίμωξης','Infection site')}</strong><span>{tx('Κατανομή ανά τύπο δείγματος','Distribution by specimen type')}</span></div></header><DonutChart rows={(details?.bySite||[]).filter(([value])=>CLINICAL_SITES.includes(value)).map(([value,count])=>[siteLabel(value,tx),count])} en={chartLanguage(tx)} centerLabel={tx('δείγματα','samples')}/></article><article className="analysis-chart-card"><header><div><strong>{tx('Λεπτομέρεια δείγματος','Specimen detail')}</strong><span>{tx('Κατανομή των θετικών ευρημάτων','Distribution of positive findings')}</span></div></header><MetricBars rows={details?.bySource||[]} tx={tx}/></article></div><article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Μικροοργανισμοί ανά σημείο λοίμωξης','Organisms by infection site')}</strong><span>{tx('Ποιος μικροοργανισμός εμφανίζεται σε ποιο σημείο λοίμωξης.','Which organism appears at which infection site.')}</span></div></header><MetricBars rows={organismBySiteRows(nationalRows,tx)} tx={tx}/></article><article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Μικροοργανισμοί ανά τμήμα και σημείο λοίμωξης','Organisms by department and infection site')}</strong><span>{tx('Αναλυτική καταγραφή ανά μικροοργανισμό, τμήμα, σημείο λοίμωξης και δείγμα.','Detailed line list by organism, department, infection site and specimen.')}</span></div><ExportCsvButton rows={nationalRows} tx={tx} filename={tx('μικροοργανισμοί_εθνική_επιτήρηση','organisms_national_surveillance')}/></header><NationalRowsTable rows={nationalRows} tx={tx} emptyText={tx('Δεν υπάρχουν καταγραφές για το ενεργό εύρος.','No records for the active scope.')}/></article></>}
// AMR tab: the resistant subset of the same line list, alongside the
// per-organism tested/resistant KPI rows already shown above it.
export function AmrRegister({details,tx}){const resistantRows=(details?.nationalRows||[]).filter(([,resistanceClass])=>['MDR','XDR','PDR'].includes(resistanceClass));return <article className="analysis-chart-card analysis-wide-card"><header><div><strong>{tx('Ανθεκτικά ευρήματα ανά τμήμα και σημείο λοίμωξης','Resistant findings by department and infection site')}</strong><span>{tx('MDR/XDR/PDR απομονώματα του ενεργού εύρους.','MDR/XDR/PDR isolates in the active scope.')}</span></div><ExportCsvButton rows={resistantRows} tx={tx} filename={tx('ανθεκτικά_ευρήματα_amr','amr_resistant_findings')}/></header><NationalRowsTable rows={resistantRows} tx={tx} emptyText={tx('Δεν υπάρχουν ανθεκτικά ευρήματα για το ενεργό εύρος.','No resistant findings for the active scope.')}/></article>}
export function DomainView({rows,micro,tab,tx,en}){
 const share=numericRows(rows).filter(([,value])=>value>0)
 const monthly=micro?.monthly||[]
 return <div className="analysis-chart-grid">
  {tab==='overview'&&monthly.length>1&&<ChartCard wide title={tx('Θετικές καλλιέργειες ανά μήνα','Positive cultures by month')} subtitle={tx('Επικυρωμένα θετικά αποτελέσματα του ενεργού εύρους · περάστε το ποντίκι πάνω από το γράφημα για τιμές.','Validated positive results in the active scope · hover the chart for values.')}><TrendChart points={monthly} en={en} label={tx('Θετικές καλλιέργειες ανά μήνα','Positive cultures by month')}/></ChartCard>}
  <ChartCard title={tx('Κατανομή τρέχουσας περιόδου','Current-period distribution')} subtitle={tx('Καταγραφές της επιλεγμένης ενότητας.','Records from the selected area.')}><BarList rows={rows} en={en}/></ChartCard>
  {share.length>1&&<ChartCard title={tx('Μερίδιο επί του συνόλου','Share of total')} subtitle={tx('Πώς μοιράζονται οι καταγραφές της ενότητας.','How the section’s records are split.')}><DonutChart rows={share} en={en} centerLabel={tx('σύνολο','total')}/></ChartCard>}
 </div>}
export function ScopeComparison({title,subtitle,currentRows,compareRows,currentLabel,compareLabel,tx}){if(!compareRows?.length)return null;const comparison=new Map(compareRows.map(row=>[row[0],row[1]]));return <article className="analysis-chart-card analysis-wide-card"><header><div><strong>{title}</strong><span>{subtitle}</span></div></header><div className="analysis-comparison-table"><div className="head"><span>{tx('Δείκτης','Indicator')}</span><span>{currentLabel}</span><span>{compareLabel}</span><span>{tx('Διαφορά','Difference')}</span></div>{currentRows.map(([label,current])=>{const previous=comparison.get(label)??0;const diff=current==='—'||previous==='—'?'—':numberValue(current)-numberValue(previous);return <div key={label}><span>{label}</span><span>{current}</span><span>{previous}</span><span>{typeof diff==='number'&&diff>0?'+':''}{diff}</span></div>})}</div></article>}
