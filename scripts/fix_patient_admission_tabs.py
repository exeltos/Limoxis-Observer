from pathlib import Path
import re
p=Path('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
s=p.read_text(encoding='utf-8')
old="    ...(record?[{id:'clinicalData',label:t('clinicalRecords.clinicalData'),icon:Activity},{id:'documents',label:t('documents'),icon:FolderOpen},{id:'history',label:t('history'),icon:FileClock}]:[]),"
new="    {id:'clinicalData',label:t('clinicalRecords.clinicalData'),icon:Activity},\n    {id:'documents',label:t('documents'),icon:FolderOpen},\n    {id:'history',label:t('history'),icon:FileClock},"
if old not in s: raise SystemExit('tabs pattern not found')
s=s.replace(old,new,1)
clinical="    {activeTab==='clinicalData'&&record&&<ClinicalSnapshot record={record} t={t} language={language} fmtDate={fmtDate}/>}"
if clinical not in s: raise SystemExit('clinical pattern not found')
s=s.replace(clinical,clinical+"\n    {activeTab==='clinicalData'&&!record&&<EmptyState title={language==='el'?'Δεν υπάρχει ακόμη κλινική καταγραφή':'No clinical record yet'} description={language==='el'?'Η νοσηλεία δεν έχει ακόμη ενεργή επιτήρηση. Δημιουργήστε επιτήρηση από την καρτέλα «Επιτήρηση & Δείγματα».':'This admission has no active surveillance yet. Create one from Surveillance & Samples.'}/>}",1)
for tab in ('documents','history'):
    pattern=rf"^    \{{activeTab==='{tab}'&&record&&.*$"
    m=re.search(pattern,s,re.M)
    if not m: raise SystemExit(f'{tab} pattern not found')
    if tab=='documents':
        el,en='Δεν υπάρχουν ακόμη έγγραφα','No documents yet'; de,dee='Τα έγγραφα της επιτήρησης θα εμφανιστούν εδώ μόλις δημιουργηθεί επιτήρηση για τη νοσηλεία.','Surveillance documents will appear here after surveillance is created for this admission.'
    else:
        el,en='Δεν υπάρχει ακόμη ιστορικό επιτήρησης','No surveillance history yet'; de,dee='Το ιστορικό ενεργειών θα εμφανιστεί εδώ μόλις δημιουργηθεί επιτήρηση για τη νοσηλεία.','The activity history will appear here after surveillance is created for this admission.'
    extra=f"\n    {{activeTab==='{tab}'&&!record&&<EmptyState title={{language==='el'?'{el}':'{en}'}} description={{language==='el'?'{de}':'{dee}'}}/>}}"
    s=s[:m.end()]+extra+s[m.end():]
p.write_text(s,encoding='utf-8')
