from pathlib import Path

p=Path('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
s=p.read_text()

old="function timelineLabel(type,language,t){"
helper="""function clinicalValueLabel(value,language,t){
  if(value===null||value===undefined||value==='')return '—'
  const labels={
    undetermined:['Δεν έχει ακόμη καθοριστεί','Not yet determined'],
    created:['Δημιουργήθηκε','Created'],
    no:['Όχι','No'],
    yes:['Ναι','Yes'],
    pending:['Εκκρεμεί','Pending'],
    infection:['Λοίμωξη','Infection'],
    colonization:['Αποικισμός','Colonization'],
    no_infection:['Δεν τεκμηριώνεται λοίμωξη','No evidence of infection'],
    under_investigation:['Υπό διερεύνηση','Under investigation'],
    probable_infection:['Πιθανή λοίμωξη','Probable infection'],
    confirmed_infection:['Επιβεβαιωμένη λοίμωξη','Confirmed infection'],
  }
  const mapped=labels[String(value)]
  if(mapped)return mapped[language==='el'?0:1]
  const translated=t(String(value))
  return translated===String(value)?String(value).replaceAll('_',' '):translated
}
function timelineLabel(type,language,t){"""
if old not in s:
  raise SystemExit('timelineLabel anchor missing')
s=s.replace(old,helper,1)

old="value={assessment?.classification?t(assessment.classification):'—'}"
new="value={clinicalValueLabel(assessment?.classification,language,t)}"
if old not in s:
  raise SystemExit('classification anchor missing')
s=s.replace(old,new,1)

old="{x.detail&&<p>{x.detail}</p>}"
new="{x.detail&&<p>{clinicalValueLabel(x.detail,language,t)}</p>}"
if old not in s:
  raise SystemExit('timeline detail anchor missing')
s=s.replace(old,new,1)

p.write_text('\n'.join(line.rstrip() for line in s.splitlines())+'\n')
