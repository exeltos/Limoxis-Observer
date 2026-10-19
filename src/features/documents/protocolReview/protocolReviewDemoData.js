// Two suggestions on the demo protocols (documentStore seed), so the screens
// can be seen: one with a drafted paragraph, one without.
import { emptyInPreview } from '../../../core/preview/emptyPreview'
export const DEMO_PROTOCOL_SUGGESTIONS=[
 {
  id:'PSUG-DEMO-1',organization_id:null,document_id:'DOC-008',reason:'source_changed',source_kind:'clinical_source',source_ref:'clinical:who-pph',
  source_label:'WHO · Postpartum haemorrhage recommendations',source_url:'https://www.who.int/publications',
  what_changed:'Η πηγή «WHO · Postpartum haemorrhage recommendations» άλλαξε στις 02/09/2026: νέα σύσταση για αντικειμενική μέτρηση της απώλειας αίματος και έγκαιρη δέσμη θεραπείας.',
  affected_sections:['instructions','dosages','references'],details:{},
  draft_text:'Η απώλεια αίματος μετά τον τοκετό μετράται αντικειμενικά (συλλογή σε βαθμονομημένο σάκο) σε κάθε τοκετό. Όταν η απώλεια φτάνει τα 300 ml με παθολογικά ζωτικά σημεία ή τα 500 ml, εφαρμόζεται αμέσως η δέσμη θεραπείας (μάλαξη μήτρας, ωκυτοκίνη, τρανεξαμικό οξύ, ενδοφλέβια υγρά, εκτίμηση αιτίας).',
  draft_citation:'WHO · Postpartum haemorrhage recommendations, 2026',
  status:'open',created_at:'2026-10-18T03:13:00.000Z',
 },
 {
  id:'PSUG-DEMO-2',organization_id:null,document_id:'DOC-003',reason:'source_changed',source_kind:'legislation',source_ref:'legislation:demo-ecdc',
  source_label:'ECDC · Carbapenem-resistant Enterobacterales guidance',source_url:'https://www.ecdc.europa.eu',
  what_changed:'Νέα έκδοση της καθοδήγησης ECDC για τα CRE: ενημερωμένα κριτήρια ενεργητικής επιτήρησης κατά την εισαγωγή.',
  affected_sections:['instructions','references'],details:{},draft_text:null,draft_citation:null,
  status:'open',created_at:'2026-10-17T03:13:00.000Z',
 },
]
// Empty-hospital preview (?helpEmpty=1): no sample records.
emptyInPreview(DEMO_PROTOCOL_SUGGESTIONS)
