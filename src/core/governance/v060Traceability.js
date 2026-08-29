export const v060Traceability = [
  {control:'LAB-01',area:'Specimen lifecycle',evidence:'laboratory_samples timestamps/status/priority/rejection metadata',frameworks:['WHO HAI surveillance','ISO 7101','JCI']},
  {control:'LAB-02',area:'AST interpretation',evidence:'Structured S/I/R plus breakpoint standard/version and method',frameworks:['EUCAST','WHO GLASS']},
  {control:'LAB-03',area:'AMR classification',evidence:'Versioned classification source, calculation snapshot and human review status',frameworks:['ECDC/CDC MDR-XDR-PDR','WHO GLASS']},
  {control:'LAB-04',area:'Critical result communication',evidence:'Append-only communication records with actor, recipient, method and time',frameworks:['JCI','ISO 7101']},
  {control:'LAB-05',area:'Least privilege',evidence:'Laboratory write policies separated from surveillance consumers',frameworks:['ISO 7101','JCI']},
]
