export const environmentalSubjectCatalog=[
  {id:'surface',defaultSource:'surfaceSwab'},
  {id:'room',defaultSource:'roomSampling'},
  {id:'air',defaultSource:'airSampling'},
  {id:'water',defaultSource:'waterSampling'},
]

// The canonical environmental sample types (the four cards of a new sampling).
export const ENVIRONMENTAL_TYPES=environmentalSubjectCatalog.map(item=>item.id)
// Every environmental sample type, one list for Surveillance and the
// Laboratory: the four sampling types plus equipment and «other», which the
// laboratory records without a sampling standard. Stored as the id.
export const ENVIRONMENTAL_SAMPLE_TYPES=[
  {id:'surface',el:'Επιφάνεια',en:'Surface'},
  {id:'room',el:'Χώρος',en:'Room'},
  {id:'equipment',el:'Εξοπλισμός',en:'Equipment'},
  {id:'water',el:'Νερό',en:'Water'},
  {id:'air',el:'Αέρας',en:'Air'},
  {id:'other',el:'Άλλο',en:'Other'},
]
// Older laboratory rows carry a free-text type; these words also mark a row as environmental.
const LEGACY_ENVIRONMENTAL_TYPES=['environment','environmental','νερό','επιφάνεια','επιφανεια']
export const isEnvironmentalSample=row=>row?.subjectType==='environment'||[...ENVIRONMENTAL_TYPES,...LEGACY_ENVIRONMENTAL_TYPES].some(type=>String(row?.type||'').toLowerCase().includes(type))
