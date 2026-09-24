export const ANTISEPTIC_METHODS=[
 {id:'pharmacy_issue',label:'Χορήγηση / διάθεση από Φαρμακείο',labelEn:'Issue / supply from Pharmacy'},
 {id:'warehouse_issue',label:'Διάθεση από Αποθήκη',labelEn:'Issue from Warehouse'},
 {id:'stock_difference',label:'Διαφορά αποθέματος',labelEn:'Stock difference'},
 {id:'direct_measurement',label:'Άμεση μέτρηση κατανάλωσης',labelEn:'Direct consumption measurement'},
 {id:'other',label:'Άλλη τεκμηριωμένη πηγή',labelEn:'Other documented source'},
]

export function isAbhrProduct(product){
 if(!product)return false
 if(typeof product==='object')return product.indicatorEligible===true||product.metadata?.is_abhr===true||product.code==='ANT-ABHR'||product.productCode==='ANT-ABHR'
 return String(product).trim()==='ANT-ABHR'
}

export function antisepticMethodLabel(id,language='el'){
 const item=ANTISEPTIC_METHODS.find(x=>x.id===id)
 return item?(language==='en'?item.labelEn:item.label):(id||'—')
}
