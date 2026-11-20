// Οι δείκτες που υπολογίζονται μόνο από την ενότητα Επιτήρηση (επεισόδια επιτήρησης, απομονώσεις MDR,
// ημέρες συσκευών, CLABSI/CAUTI/VAP/SSI). Σε νοσοκομείο χωρίς την ενότητα Επιτήρηση κρύβονται από τις
// λίστες δεικτών αντί να φαίνονται με 0. Οι δείκτες του εργαστηρίου (βακτηριαιμίες, MDRO-BSI, αντοχή)
// και όσοι δεν αφορούν λοιμώξεις μένουν.

export const SURVEILLANCE_INDICATOR_KEYS: readonly string[]=Object.freeze([
 'hai-per-1000','mdr-active-share','active-surveillance','amr-rate',
 'mdr-isolation-new-cases','mdr-isolation-acinetobacter','mdr-isolation-ecoli','mdr-isolation-enterobacter','mdr-isolation-enterococcus','mdr-isolation-klebsiella','mdr-isolation-proteus','mdr-isolation-pseudomonas','mdr-isolation-saureus',
 'clabsi-per-1000-cvc-days','cauti-per-1000-catheter-days','vap-per-1000-ventilator-days','ssi-rate',
 'clabsi-rate','cauti-rate','vap-rate',
 'clabsi-rate-le750','clabsi-rate-bw751-1000','clabsi-rate-bw1001-1500','clabsi-rate-bw1501-2500','clabsi-rate-gt2500',
])

// Τα μεγέθη (numerator/denominator metric) που έρχονται μόνο από την Επιτήρηση: πιάνουν και τους δείκτες
// που όρισε το νοσοκομείο με αυτά.
export const SURVEILLANCE_INDICATOR_METRICS: readonly string[]=Object.freeze([
 'active_surveillance','resistant_active_surveillance',
 'mdr_isolation_total','mdr_isolation_ecoli','mdr_isolation_proteus','mdr_isolation_acinetobacter','mdr_isolation_klebsiella','mdr_isolation_enterobacter','mdr_isolation_pseudomonas','mdr_isolation_saureus','mdr_isolation_enterococcus',
 'clabsi_events','central_line_days','cauti_events','urinary_catheter_days','vap_events','ventilator_days','ssi_episodes',
 'clabsi_events_le750','central_line_days_le750','clabsi_events_bw751_1000','central_line_days_bw751_1000','clabsi_events_bw1001_1500','central_line_days_bw1001_1500','clabsi_events_bw1501_2500','central_line_days_bw1501_2500','clabsi_events_gt2500','central_line_days_gt2500',
])

// Ένας δείκτης όπως τον κρατά κάθε οθόνη: γραμμή της βάσης (indicator_key), ορισμός της Διαχείρισης (key)
// ή υπολογισμένος δείκτης (id = κλειδί, numerator/denominator).
export interface IndicatorModuleSource {
 key?: string|null
 indicator_key?: string|null
 id?: string|null
 numerator?: string|null
 denominator?: string|null
 numeratorMetric?: string|null
 denominatorMetric?: string|null
 numerator_metric?: string|null
 denominator_metric?: string|null
}

const keyOf=(item: string|IndicatorModuleSource)=>typeof item==='string'?item:String(item.key||item.indicator_key||item.id||'')

export function indicatorNeedsSurveillance(item: string|IndicatorModuleSource|null|undefined): boolean{
 if(!item)return false
 const key=keyOf(item)
 if(SURVEILLANCE_INDICATOR_KEYS.includes(key)||key.startsWith('mdr-isolation-'))return true
 if(typeof item==='string')return false
 return [item.numerator,item.denominator,item.numeratorMetric,item.denominatorMetric,item.numerator_metric,item.denominator_metric].some(metric=>Boolean(metric)&&SURVEILLANCE_INDICATOR_METRICS.includes(String(metric)))
}

// moduleEnabled: του useTenant() (ή του operatingProfile με τον οργανισμό). Με την Επιτήρηση ενεργή η λίστα μένει ίδια.
export function indicatorsForModules<T extends string|IndicatorModuleSource>(items: readonly T[]|null|undefined,moduleEnabled: (module: string)=>boolean=()=>true): T[]{
 const list=[...(items||[])]
 return moduleEnabled('surveillance')?list:list.filter(item=>!indicatorNeedsSurveillance(item))
}
