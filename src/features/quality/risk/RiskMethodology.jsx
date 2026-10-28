import { ArrowRight } from 'lucide-react'
import { CONSEQUENCE,JCI_CHAPTERS,LEVELS,LIKELIHOOD,levelForScore,scored } from './riskModel'
import { L,defaultFrame } from './riskUi'

const FLOW=[
 ['inherent','Εγγενής','Inherent','Ο κίνδυνος όπως είναι, αν δεν υπήρχε κανένα μέτρο.','The risk as it is, with no control at all.'],
 ['existing','υφιστάμενα μέτρα','controls in place'],
 ['residual','Υπολειπόμενος','Residual','Ο κίνδυνος με τα μέτρα που ήδη λαμβάνονται. Δεν υπερβαίνει τον εγγενή· τα μέτρα μειώνουν κυρίως την πιθανότητα, κι αν αλλάξει η συνέπεια σημειώνεται η αιτία.','The risk with the controls already in place. It never exceeds the inherent risk; controls mostly lower the likelihood, and a change in consequence is explained.'],
 ['additional','πρόσθετα μέτρα (σχέδιο δράσης)','additional measures (action plan)'],
 ['target','Στόχος','Target','Πού πρέπει να φτάσει ο κίνδυνος. Ορίζεται για κάθε υψηλό ή πολύ υψηλό υπολειπόμενο· στην επόμενη εκτίμηση επιβεβαιώνεται ως νέος υπολειπόμενος.','Where the risk must get to. Set for every high or very high residual risk; confirmed as the new residual at the next assessment.'],
]

// The method behind the scores (NHS National Patient Safety Agency, 2008),
// tied to this assessment: how many of its risks sit at each level and in each
// JCI chapter, and whether the year's proactive analysis has been chosen.
export function RiskMethodology({en,risks=[],actions=null,onJci,onPickFmea,returned='',frame=defaultFrame}){
 const residual=risks.map(r=>scored(r).residual.level)
 const perLevel=Object.fromEntries(LEVELS.map(x=>[x.id,residual.filter(l=>l===x.id).length]))
 const perJci=Object.fromEntries(JCI_CHAPTERS.map(x=>[x.id,risks.filter(r=>r.jci===x.id).length]))
 const fmea=risks.filter(r=>r.prioritized).length
 const highCount=perLevel.high+perLevel.very_high
 return frame(null,<div className="risk-methodology">
  <section className="risk-panel"><header><h3>{L(en,'Μήτρα κινδύνου 5×5 (βαθμός = L × C)','5×5 risk matrix (score = L × C)')}</h3><small>A risk matrix for risk managers, NHS National Patient Safety Agency, 2008</small>{actions&&<span className="risk-panel-actions">{actions}</span>}</header>
   <div className="risk-method-matrix">
    <figure className="risk-matrix-figure">
     <span className="risk-heatmap-axis risk-heatmap-axis-c">{L(en,'Συνέπεια (C) ↑','Consequence (C) ↑')}</span>
     <table className="risk-matrix"><tbody>
      {[...CONSEQUENCE].reverse().map(c=><tr key={c.value}><th scope="row"><b>{c.value}</b>{en?c.en:c.el}</th>{LIKELIHOOD.map(l=>{const score=l.value*c.value;return <td key={l.value} className={`risk-cell risk-cell-${levelForScore(score)}`}><strong>{score}</strong></td>})}</tr>)}
      <tr className="risk-matrix-l"><th aria-hidden="true"/>{LIKELIHOOD.map(l=><th key={l.value} scope="col"><b>{l.value}</b>{en?l.en:l.el}</th>)}</tr>
     </tbody></table>
     <span className="risk-heatmap-axis risk-heatmap-axis-l">{L(en,'Πιθανότητα (L) →','Likelihood (L) →')}</span>
    </figure>
    <table className="data-table risk-level-table"><thead><tr><th>{L(en,'Επίπεδο','Level')}</th><th>{L(en,'Βαθμός','Score')}</th><th>{L(en,'Απαιτούμενη ενέργεια','Required response')}</th><th>{L(en,'Κίνδυνοι (μετά τα μέτρα)','Risks (after measures)')}</th></tr></thead><tbody>
     {[...LEVELS].reverse().map(x=><tr key={x.id}><td><span className="risk-level-name"><span className={`risk-swatch risk-cell-${x.id}`}/><strong>{en?x.en:x.el}</strong></span></td><td>{x.range}</td><td>{en?x.responseEn:x.responseEl}</td><td><strong>{perLevel[x.id]}</strong></td></tr>)}
    </tbody></table>
   </div>
  </section>
  <div className="risk-two-columns">
   <section className="risk-panel"><header><h3>{L(en,'Πιθανότητα (L)','Likelihood (L)')}</h3></header><table className="data-table risk-scale-table"><thead><tr><th>L</th><th>{L(en,'Περιγραφή','Description')}</th><th>{L(en,'Συχνότητα','Frequency')}</th><th>{L(en,'Ετήσια πιθανότητα','Annual probability')}</th></tr></thead><tbody>{LIKELIHOOD.map(x=><tr key={x.value}><td><span className="risk-scale-number">{x.value}</span></td><td><strong>{en?x.en:x.el}</strong></td><td>{en?x.frequencyEn:x.frequencyEl}</td><td>{x.annual}</td></tr>)}</tbody></table></section>
   <section className="risk-panel"><header><h3>{L(en,'Συνέπεια (C)','Consequence (C)')}</h3><small>{L(en,'Επιπτώσεις στην ασφάλεια ασθενών, προσωπικού ή κοινού','Impact on the safety of patients, staff or the public')}</small></header><table className="data-table risk-scale-table"><thead><tr><th>C</th><th>{L(en,'Περιγραφή','Description')}</th><th>{L(en,'Παραδείγματα','Examples')}</th></tr></thead><tbody>{CONSEQUENCE.map(x=><tr key={x.value}><td><span className="risk-scale-number">{x.value}</span></td><td><strong>{en?x.en:x.el}</strong></td><td>{en?x.exampleEn:x.exampleEl}</td></tr>)}</tbody></table></section>
  </div>
  <section className="risk-panel"><header><h3>{L(en,'Τρία επίπεδα για κάθε κίνδυνο','Three levels for every risk')}</h3><small>{L(en,'Η ίδια σειρά με τη σελίδα του κινδύνου','The same order as the risk page')}</small></header>
   <ol className="risk-flow">{FLOW.map(([id,el,enLabel,textEl,textEn])=>textEl
    ?<li key={id} className={`risk-flow-card risk-flow-${id}`}><strong>{en?enLabel:el}</strong><span>{en?textEn:textEl}</span></li>
    :<li key={id} className="risk-flow-step" aria-label={en?enLabel:el}><ArrowRight size={16}/><small>{en?enLabel:el}</small></li>)}</ol>
  </section>
  <section className="risk-panel"><header><h3>JCI</h3><small>{L(en,'Κεφάλαια και διεθνείς στόχοι ασφάλειας ασθενών (IPSG), με τους κινδύνους αυτής της εκτίμησης. Ο ακριβής κωδικός (ME) καταγράφεται σε κάθε κίνδυνο.','Chapters and International Patient Safety Goals (IPSG), with this assessment’s risks. The exact measurable element (ME) is recorded on each risk.')}</small></header>
   <ul className="risk-jci-grid">{JCI_CHAPTERS.map(x=>{const n=perJci[x.id];return <li key={x.id}><button type="button" className={`${n?'':'is-empty'}${returned===`jci:${x.id}`?' registry-row-returned':''}`.trim()||undefined} disabled={!n||!onJci} onClick={()=>onJci?.(x.id)} title={n?L(en,'Προβολή στο μητρώο','Show in the register'):undefined}><strong>{x.id}</strong><span>{en?x.en:x.el}</span><b>{n}</b></button></li>})}</ul>
   <div className={`risk-fmea-note${fmea?' is-done':''}`}>
    <span>{L(en,'Το JCI ζητά τουλάχιστον μία προληπτική ανάλυση (π.χ. FMEA) ανά έτος σε διαδικασία υψηλού κινδύνου.','JCI expects at least one proactive analysis (e.g. FMEA) a year on a high-risk process.')}</span>
    <strong>{fmea?fmea===1?L(en,'Επιλέχθηκε 1 κίνδυνος για FMEA.','1 risk selected for FMEA.'):L(en,`Επιλέχθηκαν ${fmea} κίνδυνοι για FMEA.`,`${fmea} risks selected for FMEA.`):L(en,'Δεν έχει επιλεγεί ακόμη κίνδυνος για FMEA.','No risk selected for FMEA yet.')}</strong>
    {onPickFmea&&highCount>0&&<button type="button" className={returned==='fmea'?'is-returned':undefined} onClick={onPickFmea}>{L(en,`Δείτε τους ${highCount} υψηλούς κινδύνους`,`See the ${highCount} high risks`)} →</button>}
   </div>
  </section>
 </div>)
}
