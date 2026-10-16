export const environmentalSubjectCatalog=[
  {id:'surface',defaultSource:'surfaceSwab'},
  {id:'room',defaultSource:'roomSampling'},
  {id:'air',defaultSource:'airSampling'},
  {id:'water',defaultSource:'waterSampling'},
]

// The canonical environmental sample types (the four cards of a new sampling).
export const ENVIRONMENTAL_TYPES=environmentalSubjectCatalog.map(item=>item.id)
// Older laboratory rows carry a free-text type; these words also mark a row as environmental.
const LEGACY_ENVIRONMENTAL_TYPES=['environment','environmental','νερό','επιφάνεια','επιφανεια']
export const isEnvironmentalSample=row=>row?.subjectType==='environment'||[...ENVIRONMENTAL_TYPES,...LEGACY_ENVIRONMENTAL_TYPES].some(type=>String(row?.type||'').toLowerCase().includes(type))
