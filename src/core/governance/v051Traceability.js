export const v051Traceability = [
  { requirement:'Surveillance must reflect real clinical chronology', controls:['surveillance episode lifecycle','parallel active-surveillance domains','repeatable samples/reassessments/isolation episodes'], references:['Limoxis Observer clinical architecture'] },
  { requirement:'HAI classification is explicit evidence', controls:['hai_classifications','definition set/version','criteria evidence','rationale and classifier'], references:['WHO HAI surveillance design alignment'] },
  { requirement:'AMR is evidence-derived, not a mandatory workflow step', controls:['microbiology_results remains canonical','resistance class displayed from validated result','no sequential MDR/XDR gate'], references:['WHO/GLASS design alignment'] },
  { requirement:'Device-associated risk is time-aware', controls:['surveillance_devices','insertion/removal/review timestamps','case linkage'], references:['IPC surveillance design alignment'] },
  { requirement:'Bilingual clinical operation', controls:['central EL/EN dictionary','new surveillance strings in both locales'], references:['Limoxis Observer product requirement'] },
]
