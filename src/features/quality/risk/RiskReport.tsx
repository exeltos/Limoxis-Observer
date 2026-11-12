import { forwardRef } from 'react'
import { EFFECTIVENESS,LEVELS,OPPORTUNITY_RATINGS,compareAssessments,jciLabel,levelForScore,normalizeOpportunity,opportunityCode,scored,sectionLabel } from './riskModel'
import { L,LevelChip,LevelLegend,RiskHeatMap,fmtDate,statusLabel,txt } from './riskUi'
import { LevelDistribution,RiskKpis } from './RiskAnalysis'

// The printed assessment (A4 landscape): header of the form, summary, heat
// maps, comparison with the previous period, the full register in colour,
// opportunities, method and signatures. Printed alone through printElement.
export const RiskReport=forwardRef(function RiskReport({assessment,summary,previous,organizationName,en,locale},ref){
 const risks=assessment.risks||[]
 const comparison=previous?compareAssessments(risks,previous.risks||[]):null
 const sections=['clinical','general'].map(id=>({id,risks:risks.filter(r=>(r.section||'clinical')===id)})).filter(s=>s.risks.length)
 const opportunities=assessment.opportunities||[]
 // Sections are numbered in print order; the optional ones take no number when absent.
 let n=0;const no=()=>`${++n}. `
 // Every page carries the form and its page number (CSS page margin boxes).
 // A CSS string; «<» is escaped too, so no text (form code, title, period) can close the <style> it sits in.
 const css=v=>`"${String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/</g,'\\3c ').replace(/[\r\n]/g,' ')}"`
 const pageCss=`@page{size:A4 landscape;margin:9mm 9mm 13mm;@bottom-left{content:${css([assessment.formCode,txt(assessment,'title',en),assessment.periodLabel].filter(Boolean).join(' · '))};font:8px Arial,sans-serif;color:#5d7083}@bottom-right{content:${css(L(en,'Σελίδα ','Page '))} counter(page) " / " counter(pages);font:8px Arial,sans-serif;color:#5d7083}}`
 return <div ref={ref} className="risk-report">
  <style>{pageCss}</style>
  <header className="risk-report-header">
   <div><span className="risk-report-form">{assessment.formCode||'—'}</span><h1>{txt(assessment,'title',en)}</h1><p>{organizationName}</p></div>
   <dl>
    <div><dt>{L(en,'Περίοδος','Period')}</dt><dd>{assessment.periodLabel}</dd></div>
    <div><dt>{L(en,'Ημερομηνία αξιολόγησης','Assessment date')}</dt><dd>{fmtDate(assessment.assessedOn,locale)}</dd></div>
    <div><dt>{L(en,'Επόμενη αξιολόγηση','Next assessment')}</dt><dd>{fmtDate(assessment.nextReviewOn,locale)}</dd></div>
    <div><dt>{L(en,'Υπεύθυνος αξιολόγησης','Assessed by')}</dt><dd>{assessment.assessorLabel||'—'}</dd></div>
    <div><dt>{L(en,'Κατάσταση','Status')}</dt><dd>{statusLabel(assessment.status,en)}{assessment.approvedByLabel?` · ${assessment.approvedByLabel} ${fmtDate(assessment.approvedOn,locale)}`:''}</dd></div>
   </dl>
  </header>
  <section className="risk-report-section"><h2>{no()}{L(en,'Σύνοψη','Summary')}</h2><RiskKpis summary={summary} en={en}/>
   <div className="risk-report-grid"><LevelDistribution summary={summary} en={en}/><div className="risk-heatmaps"><RiskHeatMap heat={summary.heat.inherent} en={en} title={L(en,'Εγγενής','Inherent')}/><RiskHeatMap heat={summary.heat.residual} en={en} title={L(en,'Υπολειπόμενος','Residual')}/><RiskHeatMap heat={summary.heat.target} en={en} title={L(en,'Στόχος','Target')}/></div></div>
  </section>
  {summary.priorities.length>0&&<section className="risk-report-section"><h2>{no()}{L(en,'Κίνδυνοι προτεραιότητας','Priority risks')}</h2>
   <table className="risk-report-table"><thead><tr><th>{L(en,'Κωδ.','Code')}</th><th>{L(en,'Κίνδυνος','Risk')}</th><th>{L(en,'Υπολ.','Residual')}</th><th>{L(en,'Πρόσθετα μέτρα','Additional measures')}</th><th>{L(en,'Υπεύθυνος','Owner')}</th><th>{L(en,'Προθεσμία','Due')}</th><th>{L(en,'Στόχος','Target')}</th></tr></thead><tbody>
    {summary.priorities.map(r=>{const s=scored(r);return <tr key={r.lineageKey}><td>{r.lineageKey}</td><td>{txt(r,'hazard',en)}<small>{[txt(r,'process',en),txt(r,'scope',en)].filter(Boolean).join(' · ')}</small></td><td><LevelChip score={s.residual.score} en={en}/></td><td className="risk-pre">{txt(r,'additionalMeasures',en)||'—'}</td><td>{txt(r,'owner',en)||'—'}</td><td>{fmtDate(r.dueDate,locale)}</td><td><LevelChip score={s.target.score} en={en} compact/></td></tr>})}
   </tbody></table></section>}
  {comparison&&<section className="risk-report-section"><h2>{no()}{L(en,`Σύγκριση με ${previous.periodLabel}`,`Comparison with ${previous.periodLabel}`)}</h2>
   <table className="risk-report-table risk-report-compact"><thead><tr><th>{L(en,'Υπολειπόμενος κίνδυνος','Residual risk')}</th><th>{previous.periodLabel}</th><th>{assessment.periodLabel}</th></tr></thead><tbody>
    {[...LEVELS].reverse().map(level=><tr key={level.id}><td><span className={`risk-swatch risk-cell-${level.id}`}/>{en?level.en:level.el}</td><td>{comparison.previous.levels.residual[level.id]}</td><td>{comparison.current.levels.residual[level.id]}</td></tr>)}
    <tr><td>{L(en,'Μέσος υπολειπόμενος βαθμός','Average residual score')}</td><td>{comparison.previous.averages.residual??'—'}</td><td>{comparison.current.averages.residual??'—'}</td></tr>
   </tbody></table>
   <p>{L(en,`Βελτιώθηκαν ${comparison.counts.improved} · χειροτέρεψαν ${comparison.counts.worsened} · αμετάβλητοι ${comparison.counts.unchanged} · νέοι ${comparison.counts.new} · αφαιρέθηκαν ${comparison.counts.removed}.`,`Improved ${comparison.counts.improved} · worsened ${comparison.counts.worsened} · unchanged ${comparison.counts.unchanged} · new ${comparison.counts.new} · removed ${comparison.counts.removed}.`)}</p>
  </section>}
  {sections.map(section=><section key={section.id} className="risk-report-section risk-report-register"><h2>{no()}{L(en,'Μητρώο κινδύνων','Risk register')} · {sectionLabel(section.id,en)}</h2>
   <table className="risk-report-table"><thead>
    <tr><th rowSpan={2}>{L(en,'Κωδ.','Code')}</th><th rowSpan={2}>{L(en,'Διεργασία','Process')}</th><th rowSpan={2}>{L(en,'Τμήμα / αφορά','Applies to')}</th><th rowSpan={2}>{L(en,'Πιθανό ρίσκο / κίνδυνος','Risk')}</th><th colSpan={3}>{L(en,'Εγγενής','Inherent')}</th><th rowSpan={2}>{L(en,'Προληπτικά μέτρα','Existing controls')}</th><th colSpan={3}>{L(en,'Υπολειπόμενος','Residual')}</th><th rowSpan={2}>{L(en,'Πρόσθετα μέτρα','Additional measures')}</th><th rowSpan={2}>{L(en,'Υπεύθυνος','Owner')}</th><th rowSpan={2}>{L(en,'Συχνότητα ελέγχου','Review')}</th><th rowSpan={2}>{L(en,'Δείκτης','Indicator')}</th><th colSpan={3}>{L(en,'Στόχος','Target')}</th><th rowSpan={2}>JCI</th></tr>
    <tr><th>L</th><th>C</th><th>{L(en,'Βαθμ.','Score')}</th><th>L</th><th>C</th><th>{L(en,'Βαθμ.','Score')}</th><th>L</th><th>C</th><th>{L(en,'Βαθμ.','Score')}</th></tr>
   </thead><tbody>
    {section.risks.map(r=>{const s=scored(r);return <tr key={r.lineageKey}><td>{r.lineageKey}</td><td>{txt(r,'process',en)}</td><td>{txt(r,'scope',en)}</td><td>{txt(r,'hazard',en)}</td>
     <td>{s.inherent.l??''}</td><td>{s.inherent.c??''}</td><td className={`risk-cell-${s.inherent.level||'none'}`}>{s.inherent.score??''}</td>
     <td className="risk-pre">{txt(r,'existingControls',en)}</td>
     <td>{s.residual.l??''}</td><td>{s.residual.c??''}</td><td className={`risk-cell-${s.residual.level||'none'}`}>{s.residual.score??''}</td>
     <td className="risk-pre">{txt(r,'additionalMeasures',en)||'—'}</td><td>{txt(r,'owner',en)||'—'}</td><td>{txt(r,'reviewFrequency',en)}</td><td>{r.indicator}</td>
     <td>{s.target.l??''}</td><td>{s.target.c??''}</td><td className={`risk-cell-${s.target.level||'none'}`}>{s.target.score??''}</td>
     <td title={jciLabel(r.jci,en)}>{r.jci}{r.jciReference?` · ${r.jciReference}`:''}</td></tr>})}
   </tbody></table></section>)}
  {opportunities.length>0&&<section className="risk-report-section"><h2>{no()}{L(en,'Ευκαιρίες','Opportunities')}</h2>
   <table className="risk-report-table"><thead><tr><th>{L(en,'Κωδ.','Code')}</th><th>{L(en,'Δραστηριότητα','Activity')}</th><th>{L(en,'Ευκαιρίες','Opportunities')}</th><th>{L(en,'Χαρακτηρισμός','Rating')}</th><th>{L(en,'Σχέδιο δράσης','Action plan')}</th><th>{L(en,'Χρόνος','Timeframe')}</th><th>{L(en,'Υπεύθυνος','Owner')}</th><th>{L(en,'Αποτελεσματικότητα','Effectiveness')}</th></tr></thead><tbody>
    {opportunities.map(normalizeOpportunity).map((o,i)=>{const e=EFFECTIVENESS.find(x=>x.id===o.effectivenessStatus),r=OPPORTUNITY_RATINGS.find(x=>x.id===o.ratingId);return <tr key={o.id}><td>{opportunityCode(i)}</td><td>{o.activity}</td><td>{o.opportunity}</td><td>{r?(en?r.en:r.el):o.rating}</td><td className="risk-pre">{o.actionPlan}</td><td>{o.timeframe}</td><td>{o.owner}</td><td className="risk-pre">{[e&&(en?e.en:e.el),o.effectiveness].filter(Boolean).join('. ')}</td></tr>})}
   </tbody></table></section>}
  {/* The method and the signatures stay together, so the signatures never stand alone on a page. */}
  <div className="risk-report-closing">
  <section className="risk-report-section risk-report-method"><h2>{no()}{L(en,'Μεθοδολογία','Method')}</h2>
   <div className="risk-report-method-body">
    <div><p>{L(en,'Βαθμός = πιθανότητα (L) × συνέπεια (C), 1–5 η καθεμία (μήτρα NHS National Patient Safety Agency, 2008).','Score = likelihood (L) × consequence (C), 1–5 each (NHS National Patient Safety Agency matrix, 2008).')}</p><LevelLegend en={en} showResponse/></div>
    <div className="risk-report-matrix">{[5,4,3,2,1].map(c=><div key={c}>{[1,2,3,4,5].map(l=><span key={l} className={`risk-cell-${levelForScore(l*c)}`}>{l*c}</span>)}</div>)}</div>
   </div>
  </section>
  <section className="risk-report-signatures">{[L(en,'Συντάχθηκε','Prepared by'),L(en,'Ελέγχθηκε','Reviewed by'),L(en,'Εγκρίθηκε','Approved by')].map(role=><div key={role}><strong>{role}</strong><span>{L(en,'Ονοματεπώνυμο','Name')}</span><span>{L(en,'Ημερομηνία','Date')}</span><span>{L(en,'Υπογραφή','Signature')}</span></div>)}</section>
  </div>
 </div>
})
