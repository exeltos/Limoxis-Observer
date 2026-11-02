-- Δείκτης «Ποσοστό κατανάλωσης αντιμικροβιακών κατηγορίας Access (WHO AWaRe)»: κοινός ορισμός για όλα τα νοσοκομεία
-- (πριν υπήρχε μόνο στο demo). Στόχος ΠΟΥ ≥ 60 %. Ο αριθμητής (aware_access_ddd_total) υπολογίζεται στην εφαρμογή
-- από τις περιόδους χορήγησης και τα DDD αναφοράς· ο παρονομαστής είναι το antibiotic_ddd_total της βάσης.
alter table public.indicator_definitions disable trigger trg_audit_indicator_definitions;

insert into public.indicator_definitions (
  organization_id,indicator_key,version,title_el,title_en,category,numerator_metric,denominator_metric,multiplier,unit,unit_en,source_authority,status,calculation_type,direction,target_value
) select null,'who-aware-access-share','1.0','Ποσοστό κατανάλωσης αντιμικροβιακών κατηγορίας Access (WHO AWaRe)','Share of antimicrobial consumption in the Access category (WHO AWaRe)','pharmacy','aware_access_ddd_total','antibiotic_ddd_total',100,'%','%','Φαρμακείο · WHO AWaRe 2021','active','auto','higher',60
where not exists (select 1 from public.indicator_definitions where organization_id is null and indicator_key = 'who-aware-access-share' and version = '1.0');

alter table public.indicator_definitions enable trigger trg_audit_indicator_definitions;
