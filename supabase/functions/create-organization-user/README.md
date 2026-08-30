# create-organization-user

Creates a staff account that signs in with an auto-generated **username**
instead of a personal email — used by Management → Users → "Νέος χρήστης".

This must run with the Supabase **service role** key (needed to create Auth
users), so it can't live in the browser — it has to be deployed as a Supabase
Edge Function.

## One-time setup (you run this, not Claude — no network access to your
Supabase project from this sandbox)

1. Install the Supabase CLI if you don't have it:
   ```
   npm install -g supabase
   ```
2. Log in and link this repo's `supabase/` folder to your project (find your
   project ref in the Supabase dashboard URL, `https://supabase.com/dashboard/project/<ref>`):
   ```
   supabase login
   supabase link --project-ref <your-project-ref>
   ```
3. Deploy the function:
   ```
   supabase functions deploy create-organization-user
   ```
   The CLI automatically gives the function access to `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` — you don't need to set
   those secrets yourself.
4. Run the `202608300017_v0274_username_login.sql` migration (Supabase SQL
   editor) before using this — the function calls the `generate_username`
   database function it creates.

After that, "Νέος χρήστης" in Management → Users will call this function
directly; no further setup needed.
