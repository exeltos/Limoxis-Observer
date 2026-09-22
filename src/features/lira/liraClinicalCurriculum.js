export const LIRA_CURRICULUM_DOMAINS=Object.freeze([
 {id:'hai',label:'HAI surveillance',authorities:['ECDC','CDC/NHSN'],requiresDeterministicEngine:true},
 {id:'amr',label:'AMR & antimicrobial susceptibility',authorities:['EUCAST','ECDC'],requiresDeterministicEngine:true},
 {id:'laboratory',label:'Laboratory interpretation',authorities:['EUCAST'],requiresDeterministicEngine:true},
 {id:'prevention',label:'Infection prevention',authorities:['WHO','ECDC'],requiresDeterministicEngine:false},
 {id:'hand_hygiene',label:'Hand hygiene',authorities:['WHO'],requiresDeterministicEngine:true},
 {id:'stewardship',label:'Antimicrobial stewardship',authorities:['WHO','ECDC'],requiresDeterministicEngine:true},
 {id:'outbreaks',label:'Clusters & outbreak investigation',authorities:['ECDC','CDC/NHSN'],requiresDeterministicEngine:true},
 {id:'indicators',label:'Indicators & denominators',authorities:['ECDC','CDC/NHSN','WHO'],requiresDeterministicEngine:true},
 {id:'quality',label:'Quality & IPC governance',authorities:['WHO'],requiresDeterministicEngine:false},
])

export const LIRA_KNOWLEDGE_SAFETY=Object.freeze({
 approvedSourcesOnly:true,
 citationsRequired:true,
 deterministicCalculations:true,
 noAutonomousOutbreakDeclaration:true,
 noMissingClinicalDataInference:true,
 organizationIsolationRequired:true,
})

export function getLiraCurriculumDomain(id){
 return LIRA_CURRICULUM_DOMAINS.find(domain=>domain.id===id)||null
}
