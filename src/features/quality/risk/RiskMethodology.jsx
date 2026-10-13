import { CONSEQUENCE,JCI_CHAPTERS,LIKELIHOOD,levelForScore } from './riskModel'
import { L,LevelLegend } from './riskUi'

// The method behind the scores: the 5×5 matrix (NHS National Patient Safety
// Agency, 2008), the two scales and the levels with their required response.
export function RiskMethodology({en}){
 return <div className="risk-methodology">
  <section className="risk-panel"><header><h3>{L(en,'Μήτρα κινδύνου 5×5 (βαθμός = L × C)','5×5 risk matrix (score = L × C)')}</h3><small>A risk matrix for risk managers, NHS National Patient Safety Agency, 2008</small></header>
   <table className="risk-matrix"><thead><tr><th>{L(en,'Συνέπεια ↓ / Πιθανότητα →','Consequence ↓ / Likelihood →')}</th>{LIKELIHOOD.map(x=><th key={x.value}>{x.value} · {en?x.en:x.el}</th>)}</tr></thead><tbody>
    {[...CONSEQUENCE].reverse().map(c=><tr key={c.value}><th scope="row">{c.value} · {en?c.en:c.el}</th>{LIKELIHOOD.map(l=>{const score=l.value*c.value;return <td key={l.value} className={`risk-cell risk-cell-${levelForScore(score)}`}><strong>{score}</strong></td>})}</tr>)}
   </tbody></table>
   <LevelLegend en={en} showResponse/>
  </section>
  <div className="risk-two-columns">
   <section className="risk-panel"><header><h3>{L(en,'Πιθανότητα (L)','Likelihood (L)')}</h3></header><table className="data-table"><thead><tr><th>L</th><th>{L(en,'Περιγραφή','Description')}</th><th>{L(en,'Συχνότητα','Frequency')}</th><th>{L(en,'Ετήσια πιθανότητα','Annual probability')}</th></tr></thead><tbody>{LIKELIHOOD.map(x=><tr key={x.value}><td><strong>{x.value}</strong></td><td>{en?x.en:x.el}</td><td>{en?x.frequencyEn:x.frequencyEl}</td><td>{x.annual}</td></tr>)}</tbody></table></section>
   <section className="risk-panel"><header><h3>{L(en,'Συνέπεια (C)','Consequence (C)')}</h3><small>{L(en,'Επιπτώσεις στην ασφάλεια ασθενών, προσωπικού ή κοινού','Impact on the safety of patients, staff or the public')}</small></header><table className="data-table"><thead><tr><th>C</th><th>{L(en,'Περιγραφή','Description')}</th><th>{L(en,'Παραδείγματα','Examples')}</th></tr></thead><tbody>{CONSEQUENCE.map(x=><tr key={x.value}><td><strong>{x.value}</strong></td><td>{en?x.en:x.el}</td><td>{en?x.exampleEn:x.exampleEl}</td></tr>)}</tbody></table></section>
  </div>
  <section className="risk-panel"><header><h3>{L(en,'Τρία επίπεδα για κάθε κίνδυνο','Three levels for every risk')}</h3></header>
   <ul className="risk-steps">
    <li><strong>{L(en,'Εγγενής','Inherent')}</strong><span>{L(en,'Ο κίνδυνος όπως είναι, αν δεν υπήρχε κανένα μέτρο.','The risk as it is, with no control at all.')}</span></li>
    <li><strong>{L(en,'Υπολειπόμενος','Residual')}</strong><span>{L(en,'Ο κίνδυνος με τα μέτρα που ήδη λαμβάνονται. Δεν μπορεί να υπερβαίνει τον εγγενή. Τα μέτρα μειώνουν κυρίως την πιθανότητα· αν αλλάξει η συνέπεια, σημειώνεται η αιτία.','The risk with the controls already in place. It cannot exceed the inherent risk. Controls mostly lower the likelihood; if the consequence changes, the reason is noted.')}</span></li>
    <li><strong>{L(en,'Στόχος','Target')}</strong><span>{L(en,'Πού πρέπει να φτάσει ο κίνδυνος μετά τα πρόσθετα μέτρα. Ορίζεται για κάθε υψηλό ή πολύ υψηλό υπολειπόμενο κίνδυνο· στην επόμενη εκτίμηση επιβεβαιώνεται ως νέος υπολειπόμενος.','Where the risk must get to after the additional measures. Set for every high or very high residual risk; confirmed as the new residual at the next assessment.')}</span></li>
   </ul>
  </section>
  <section className="risk-panel"><header><h3>JCI</h3><small>{L(en,'Κάθε κίνδυνος αντιστοιχίζεται σε διεθνή στόχο ασφάλειας ασθενών (IPSG) ή κεφάλαιο προτύπων· ο ακριβής κωδικός προτύπου / μετρήσιμου στοιχείου (ME) καταγράφεται όπως στο εγχειρίδιο της έκδοσης που εφαρμόζεται.','Each risk is mapped to an International Patient Safety Goal (IPSG) or chapter; the exact standard / measurable element (ME) is recorded as in the edition of the manual in use.')}</small></header>
   <ul className="risk-jci-list">{JCI_CHAPTERS.map(x=><li key={x.id}><strong>{x.id}</strong><span>{en?x.en:x.el}</span></li>)}</ul>
   <p className="risk-hint">{L(en,'Το JCI ζητά συνεχές πρόγραμμα διαχείρισης κινδύνου με προτεραιοποίηση και τουλάχιστον μία προληπτική ανάλυση (π.χ. FMEA) ανά έτος σε διαδικασία υψηλού κινδύνου· σημειώστε στο μητρώο ποιοι κίνδυνοι επιλέχθηκαν.','JCI expects an ongoing risk management programme with prioritization and at least one proactive analysis (e.g. FMEA) a year on a high-risk process; mark in the register which risks were selected.')}</p>
  </section>
 </div>
}
