-- Run once in the SQL Editor AFTER the library-news-ingest Edge Function is
-- deployed (supabase functions deploy library-news-ingest --no-verify-jwt).
-- Every 2 hours pg_cron asks the function to check the Library news sources
-- that are due (feeds every 2 h, pages every 6 h or once a day, per source).
-- Uses the same Vault secrets as the legislation watcher
-- (limoxis_functions_url, limoxis_scheduler_secret).
select cron.schedule('limoxis-library-news', '41 */2 * * *', 'select private.platform_dispatch_library_news();');

-- A first check right away (optional):
-- select private.platform_dispatch_library_news();
