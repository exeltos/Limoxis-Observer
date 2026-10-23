-- Normalize legacy LIS/PDF spelling and truncation variants at the analytics layer.
-- Validated source results remain unchanged; this helper produces the canonical
-- microorganism name used by analysis and indicator calculations.

create or replace function private.canonical_microbiology_organism(p_value text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when nullif(btrim(p_value), '') is null then null
    when lower(regexp_replace(btrim(p_value), '[[:space:]._-]+', '', 'g')) in ('ecoli','escherichiacoli','εcoli','εscherichiacoli') then 'Escherichia coli'
    when lower(btrim(p_value)) in ('e.coli (1)','e.coli (2)') then 'Escherichia coli'
    when lower(btrim(p_value)) = 'mrsa' or lower(btrim(p_value))='s.aureus' then 'Staphylococcus aureus'
    when lower(btrim(p_value)) like 'coagulase-negative staphylococc%'
      or lower(btrim(p_value)) like 'coagulase negative staphylococc%'
      or lower(btrim(p_value)) like 'coagulase nega%'
      then 'Coagulase-negative staphylococci (CoNS)'
    when lower(btrim(p_value)) in ('candida sp','candida spp','candida spp.')
      or lower(btrim(p_value)) like 'candida spp.%μικρή ανάπτυξη%'
      or lower(btrim(p_value))='candisa spp'
      or lower(btrim(p_value))='ι candida spp'
      then 'Candida spp.'
    when lower(btrim(p_value)) in ('c.auris','cndida auris') then 'Candida auris'
    when lower(btrim(p_value)) in ('enterococcus sp','.enterococcus sp','enterococcus spp','enterococcus spp.') then 'Enterococcus spp.'
    when lower(btrim(p_value))='enterococccus faecalis' then 'Enterococcus faecalis'
    when lower(btrim(p_value)) in ('proteus sp','proteus spp','proteus spp.') then 'Proteus spp.'
    when lower(btrim(p_value)) in ('pseudomonas sp','pseudomonas spp','pseudomonas spp.','αναπτύχθηκε pseudomonas') then 'Pseudomonas spp.'
    when lower(btrim(p_value)) in ('pseudomonas aeroginosa','pseudomonαnas aeruginosa') then 'Pseudomonas aeruginosa'
    when lower(btrim(p_value))='pseudomonas flouorescens' then 'Pseudomonas fluorescens'
    when lower(btrim(p_value)) in ('klebsiella spp','klebsiella spp.','klebsiella spp. (1)','klebsiella spp. (2)') then 'Klebsiella spp.'
    when lower(btrim(p_value)) like 'klebsiella pneumoniae ssp pneu%' or lower(btrim(p_value)) like 'klebsiella pneumoniae ss. pneu%' then 'Klebsiella pneumoniae'
    when lower(btrim(p_value))='κlebsiella aerogenes' then 'Klebsiella aerogenes'
    when lower(btrim(p_value)) in ('enterobacter spp','enterobacter spp.') then 'Enterobacter spp.'
    when lower(btrim(p_value)) in ('serratia sp','serratia spp','serratia spp.') then 'Serratia spp.'
    when lower(btrim(p_value))='acinetobacter baumannii comple' then 'Acinetobacter baumannii complex'
    when lower(btrim(p_value))='staph.epidermidis' or lower(btrim(p_value))='staph.epidermdis'
      or lower(btrim(p_value))='staphylococcus epidermitis'
      or lower(btrim(p_value)) like 'staphylococcus epidermidis-coa%'
      or lower(btrim(p_value)) like 'staphylococcus epidermitis-co%'
      or lower(btrim(p_value)) like 'staphylococcus epidermitis -co%'
      then 'Staphylococcus epidermidis'
    when lower(btrim(p_value))='staphylococcus haemoliticus' or lower(btrim(p_value)) like 'staphylococcus haemolyticus- c%' then 'Staphylococcus haemolyticus'
    when lower(btrim(p_value))='staph.hominis' or lower(btrim(p_value)) like 'staphylococcus hominis ss.%' or lower(btrim(p_value)) like 'staphylococcus hominis ssp%' then 'Staphylococcus hominis'
    when lower(btrim(p_value))='stenotrophonas maltophilia' then 'Stenotrophomonas maltophilia'
    when lower(btrim(p_value)) like 'streptococcus dysgalactiae ss%' then 'Streptococcus dysgalactiae'
    when lower(btrim(p_value))='streptococcus sp' then 'Streptococcus spp.'
    when lower(btrim(p_value)) like 'streptococcus mitis/streptococ%' then 'Streptococcus spp.'
    when lower(btrim(p_value))='trichophyton sp' then 'Trichophyton spp.'
    when lower(btrim(p_value))='aspergillus sp' then 'Aspergillus spp.'
    when lower(btrim(p_value))='salmonella sp' then 'Salmonella spp.'
    when lower(btrim(p_value))='comanomas testosteroni' then 'Comamonas testosteroni'
    when lower(btrim(p_value))='αeromonas sobria' then 'Aeromonas sobria'
    when lower(btrim(p_value))='staphylococcus pseudintermediu' then 'Staphylococcus pseudintermedius'
    when lower(btrim(p_value))='bacteroides spp' then 'Bacteroides spp.'
    else btrim(p_value)
  end
$function$;
