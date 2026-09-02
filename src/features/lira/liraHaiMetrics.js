const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const dayMs=86400000
const utcDay=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())):null}
const rangeDay=value=>utcDay(`${value}T00:00:00Z`)

export const HAI_DEVICE_RULES=Object.freeze({
 clabsi:{hai:['clabsi','central line-associated bloodstream infection'],device:['central line','central_line','cvc','central venous catheter'],denominator:'central-line days'},
 cauti:{hai:['cauti','catheter-associated urinary tract infection'],device:['urinary catheter','urinary_catheter','foley','indwelling urinary catheter'],denominator:'urinary-catheter days'},
 vap:{hai:['vap','ventilator-associated pneumonia'],device:['ventilator','mechanical ventilation','mechanical_ventilation'],denominator:'ventilator days'},
 vae:{hai:['vae','ventilator-associated event'],device:['ventilator','mechanical ventilation','mechanical_ventilation'],denominator:'ventilator days'},
})

export function inferHaiType(question){const text=normalize(question);for(const [key,rule] of Object.entries(HAI_DEVICE_RULES))if(rule.hai.some(term=>text.includes(normalize(term))))return key;return null}
const matchesHai=(value,type)=>HAI_DEVICE_RULES[type]?.hai.some(term=>normalize(value).includes(normalize(term)))
const matchesDevice=(value,type)=>HAI_DEVICE_RULES[type]?.device.some(term=>normalize(value).includes(normalize(term)))
const inWindow=(value,window)=>{if(!window)return true;const date=utcDay(value);return date&&date>=rangeDay(window.start)&&date<=rangeDay(window.end)}

export function calculateDeviceDays(devices,type,{window=null,department='all',today=new Date().toISOString().slice(0,10)}={}){
 const rule=HAI_DEVICE_RULES[type];if(!rule)return 0
 const windowStart=window?rangeDay(window.start):null;const windowEnd=window?rangeDay(window.end):rangeDay(today);let total=0
 for(const row of devices||[]){if(department!=='all'&&row.department!==department)continue;if(!matchesDevice(row.deviceType,type))continue
  const inserted=utcDay(row.insertedAt);if(!inserted)continue;const removed=utcDay(row.removedAt)||rangeDay(today);const start=windowStart&&inserted<windowStart?windowStart:inserted;const end=windowEnd&&removed>windowEnd?windowEnd:removed;if(end<start)continue
  total+=Math.floor((end-start)/dayMs)+1
 }
 return total
}

export function calculateHaiRate(data,type,{window=null,department='all',today=new Date().toISOString().slice(0,10)}={}){
 const rule=HAI_DEVICE_RULES[type];if(!rule)return null
 const events=(data?.haiClassifications||[]).filter(row=>(department==='all'||row.department===department)&&matchesHai(row.haiType,type)&&row.criteriaMet!==false&&inWindow(row.classifiedAt,window))
 const deviceDays=calculateDeviceDays(data?.devices,type,{window,department,today});const rate=deviceDays>0?Math.round(events.length/deviceDays*1000*100)/100:null
 return {type,events:events.length,deviceDays,rate,unit:` / 1,000 ${rule.denominator}`,denominatorLabel:rule.denominator,normalized:deviceDays>0}
}

export function compareHaiRates(data,type,current,reference,{department='all',today=new Date().toISOString().slice(0,10),language='el'}={}){
 const en=language==='en';const a=calculateHaiRate(data,type,{window:current,department,today});const b=calculateHaiRate(data,type,{window:reference,department,today});const points=[]
 points.push(`${current.label}: ${a.rate??'—'}${a.unit} (${a.events}/${a.deviceDays}) · ${reference.label}: ${b.rate??'—'}${b.unit} (${b.events}/${b.deviceDays}).`)
 if(a.rate!=null&&b.rate!=null){const delta=Math.round((a.rate-b.rate)*100)/100;points.push(en?`Rate difference: ${delta>0?'+':''}${delta} per 1,000 ${a.denominatorLabel}.`:`Διαφορά δείκτη: ${delta>0?'+':''}${delta} ανά 1.000 ${a.denominatorLabel}.`)}
 else points.push(en?'A device-associated incidence comparison cannot be calculated unless device-days are available for both periods.':'Δεν μπορεί να υπολογιστεί συγκρίσιμος device-associated δείκτης χωρίς device-days και για τις δύο περιόδους.')
 points.push(en?'Device-days are calculated from authorized device exposure records. This is descriptive surveillance support and does not replace formal HAI case validation.':'Τα device-days υπολογίζονται από τις εξουσιοδοτημένες καταγραφές έκθεσης σε συσκευές. Η ανάλυση είναι υποστήριξη επιτήρησης και δεν αντικαθιστά την επίσημη επικύρωση HAI περιστατικού.')
 return {title:en?`${type.toUpperCase()} comparison`:`Σύγκριση ${type.toUpperCase()}`,subtitle:en?`Incidence per 1,000 ${a.denominatorLabel}.`:`Επίπτωση ανά 1.000 ${a.denominatorLabel}.`,points}
}
