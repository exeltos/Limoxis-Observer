# create-organization-user

Creates a staff account that signs in with an auto-generated **username**
instead of a personal email — used by Management → Users → "Νέος χρήστης".

This must run with the Supabase **service role** key (needed to create Auth
users), so it can't live in the browser — it has to be deployed as a Supabase
Edge Function.

## One-time setup (you run this, not Claude — no network access to your
Supabase project from this sandbox)

First, run the `202608300017_v0274_username_login.sql` migration (Supabase
SQL editor) — the function calls the `generate_username` database function
it creates.

### Option A — Supabase Dashboard, no terminal (recommended if you don't use
the command line)

1. Open your project at supabase.com/dashboard, go to **Edge Functions** in
   the left sidebar.
2. Click **Deploy a new function**, then choose the option to write the code
   directly in the browser (not "via CLI").
3. Name it exactly `create-organization-user` (must match this folder name —
   the app calls it by this name).
4. Delete whatever placeholder code is in the editor and paste the full
   contents of `index.ts` from this folder instead.
5. Click **Deploy**. Supabase automatically gives the function access to
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` — you
   don't set those yourself.

### Option B — Supabase CLI (if you're comfortable with a terminal)

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

After either option, "Νέος χρήστης" in Management → Users will call this
function directly; no further setup needed.
