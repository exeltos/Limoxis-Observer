select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
-- ΙΑΣΩ: οι στόχοι ικανοποίησης παίρνουν τιμή από τους δείκτες της πλατφόρμας (ερωτηματολόγια τμημάτων).
update quality_objectives set platform_indicator_key = case code when 'QO-2025-107' then 'patient-satisfaction' when 'QO-2025-108' then 'food-satisfaction' end
where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and code in ('QO-2025-107','QO-2025-108') and platform_indicator_key is null;
