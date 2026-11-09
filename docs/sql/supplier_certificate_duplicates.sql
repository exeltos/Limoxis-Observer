-- ΙΑΣΩ Θεσσαλίας: δύο διπλά πιστοποιητικά προμηθευτών που δημιουργήθηκαν στις 6/11/2026 από τον συγχρονισμό
-- (ο τίτλος στο FileMaker τελείωνε με κρυφό κενό). Το αρχικό πιστοποιητικό του καθενός μένει.
--   SUP-337 «CERTIFICATE BIORAD» (λήξη 21/6/2026)
--   SUP-280 «ISO 9001:2015 ΥΠΟΥΡΓΙΚΗ ΑΠΟΦΑΣΗ ΔΥ8δ//Γ.Π. οικ/1348/2004» (λήξη 23/10/2023)
-- Τρέξτε το στο SQL Editor του Supabase.
delete from public.quality_supplier_certifications
where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
  and id in ('a2f69635-2995-41d6-b9a4-eeef398eb77e', '6c73afe3-c181-43e8-a3c9-9b7896d4ce6c')
  and title like '% ';
