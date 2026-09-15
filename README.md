# Resourcing Dashboard

Skill matrix, current utilisation, and forward capacity, in one page, with data
shared live across everyone who opens the URL (via Supabase).

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

-- No auth in this app: anyone with the anon key can read and write.
-- That is required for a link leadership can open with no login.
-- If that is not acceptable, add Supabase Auth and tighten these policies.
create policy "public read" on resourcing_data
  for select using (true);

create policy "public write" on resourcing_data
  for insert with check (true);

create policy "public update" on resourcing_data
  for update using (true);
```

3. In Project Settings -> API, copy the **Project URL** and the **anon public key**.
4. Also in Project Settings -> API, make sure Realtime is enabled for the
   `resourcing_data` table (Database -> Replication -> toggle it on) so edits
   show up live for everyone without a page refresh.

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

- This is a public, no-login tool. Anyone with the URL can view **and edit**.
  Fine for an internal team link, not fine if this URL ever leaves the
  organisation.
- Placeholder people, skills, and projects are seeded once, the first time the
  app runs against an empty table. Edit or delete rows from the app itself, or
  directly in the Supabase Table Editor.
- The ranking shown under Forward Capacity is a simple weighted score (70%
  average skill match on the project's required skills, 30% free capacity). It
  is a starting point, adjust the weights in `src/App.jsx` (`ForwardCapacity`
  function, the `rank` function) to match how your leadership actually
  prioritises.
