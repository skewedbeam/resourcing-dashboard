# Resourcing Dashboard

Skill matrix, current utilisation, and forward capacity, in one page, with data
shared live across everyone who signs in (via Supabase).

## 1. Create the Supabase project

1. Go to https://supabase.com, sign up free, create a new project.
2. In the SQL editor, run:

```sql
create table resourcing_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table resourcing_data enable row level security;

-- Requires a signed-in Supabase Auth session for every read and write.
-- Enforced by the database, so it can't be bypassed by editing the client
-- bundle or calling the REST API directly with just the anon key.
create policy "authenticated read" on resourcing_data
  for select using (auth.role() = 'authenticated');

create policy "authenticated write" on resourcing_data
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated update" on resourcing_data
  for update using (auth.role() = 'authenticated');
```

3. In Project Settings -> API, copy the **Project URL** and the **anon public key**.
4. Also in Project Settings -> API, make sure Realtime is enabled for the
   `resourcing_data` table (Database -> Replication -> toggle it on) so edits
   show up live for everyone without a page refresh.

## 1b. Create the shared login

The app has one login screen shared by the whole team - there's no public
sign-up page, so only accounts you create can get in.

1. In the Supabase dashboard: **Authentication -> Users -> Add user**.
2. Enter an email and password for the team to share, and check
   **Auto Confirm User** (so it doesn't wait on an email that will never be
   read).
3. In **Authentication -> Sign In / Providers -> Email**, turn **off**
   "Allow new users to sign up" so no one else can self-register.
4. Share that email/password with the team. Anyone who needs their own
   account can be added the same way later.

### Already have the table from before auth was added?

RLS policies are additive - the old `public read`/`public write`/`public
update` policies from the original setup will keep allowing anonymous access
even after adding the new ones above, unless dropped first. In the SQL
editor, run:

```sql
drop policy if exists "public read" on resourcing_data;
drop policy if exists "public write" on resourcing_data;
drop policy if exists "public update" on resourcing_data;
```

then run the three `create policy ... auth.role() = 'authenticated'`
statements from step 2 above if you haven't already.

## 2. Run it locally

```bash
cp .env.example .env
# paste your Project URL and anon key into .env
npm install
npm run dev
```

Open the local URL it prints. Edit a cell, it should persist and reflect in the
Supabase table (check Table Editor in Supabase to confirm).

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/resourcing-dashboard.git
git push -u origin main
```

## 4. Deploy to GitHub Pages (automatic, via GitHub Actions)

1. In the repo on GitHub: Settings -> Pages -> Build and deployment -> Source ->
   **GitHub Actions**.
2. In the repo: Settings -> Secrets and variables -> Actions -> New repository
   secret. Add two secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. In `vite.config.js`, set `base` to `/<your-repo-name>/` (already defaulted to
   `/resourcing-dashboard/`, change it if you named the repo differently).
4. Push to `main`. The included workflow (`.github/workflows/deploy.yml`) builds
   and deploys automatically. Check the Actions tab for progress. Your site will
   be at `https://<your-username>.github.io/<your-repo-name>/`.

## Notes

- Viewing and editing both require the shared team login (Supabase Auth,
  enforced by Row Level Security - not just a client-side gate). The
  separate "edit password" in Settings/the sidebar is a secondary,
  softer deterrent on top of that, to distinguish view-only browsing from
  making changes among people who are already signed in.
- Placeholder people, skills, and projects are seeded once, the first time the
  app runs against an empty table. Edit or delete rows from the app itself, or
  directly in the Supabase Table Editor.
- The ranking shown under Forward Capacity is a simple weighted score (70%
  average skill match on the project's required skills, 30% free capacity). It
  is a starting point, adjust the weights in `src/App.jsx` (`ForwardCapacity`
  function, the `rank` function) to match how your leadership actually
  prioritises.
