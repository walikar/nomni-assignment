# Deploying the demo

Neon (Postgres) → Render (API) → Vercel (admin). All three have free tiers and can sign in with GitHub. Allow about 20 minutes.

## 0. Push to GitHub

Create an **empty** public repository on github.com (no README, no .gitignore), then from the repo root:

```bash
git remote add origin https://github.com/<you>/marketplace-orders.git
git push -u origin main
```

## 1. Database — Neon

1. neon.tech → **New project**. Name `marketplace-orders`, Postgres 16, region **AWS US East (Ohio)** (close to Render's default Oregon/Ohio regions).
2. On the project dashboard, **Connect** → copy the connection string. It looks like
   `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`.

No schema setup needed: the API runs its migrations on start.

## 2. API — Render

1. render.com → **New** → **Blueprint** → connect the GitHub repo. Render reads `render.yaml` and proposes the `marketplace-orders-api` web service (free plan).
2. It asks for the two values marked `sync: false`:
   - `DATABASE_URL` — the Neon connection string.
   - `ADMIN_ORIGIN` — put `http://localhost:3000` for now; you'll replace it in step 4.
3. **Apply**. The first build takes a few minutes.
4. Open `https://<service>.onrender.com/health` → `{"ok":true}`. The service URL is the **API_URL**.

## 3. Admin — Vercel

1. vercel.com → **Add New** → **Project** → import the GitHub repo.
2. **Root Directory**: `admin` (framework is detected as Next.js; keep the default build settings).
3. **Environment Variables**: `NEXT_PUBLIC_API_URL` = the Render URL, no trailing slash.
4. **Deploy**. The production URL (e.g. `https://marketplace-orders.vercel.app`) is the **ADMIN_URL**.

## 4. Allow the admin to call the API

Render → the service → **Environment** → set `ADMIN_ORIGIN` to the Vercel production URL (no trailing slash; separate several with commas) → **Save**. Render redeploys.

## 5. Check it

- Open the admin. The list loads (slowly the first time: the free API sleeps after ~15 minutes idle).
- **Try it** → *Send DoorDash order* with *Deliver twice* ticked → "delivered twice → 200, 200 · stored as 1 order".
- Open an order, move its status forward, open the debug section.
- Run the "Against the live demo" curls from the README.

## 6. Finish the README

Replace `ADMIN_URL` and `API_URL` in README.md with the real URLs, commit, push.

## Before sending the link

Open the admin a minute beforehand so the API is awake. To keep it awake during a review window, point a free uptime monitor (e.g. UptimeRobot) at `API_URL/health` every 10 minutes; one always-on free Render service fits within the monthly free hours.

## Changing the code later

One repo, two deployments. Each one only rebuilds when its own files change:

| You change | Redeploys |
|---|---|
| `admin/**` | Vercel only (`admin/vercel.json` → `ignoreCommand` skips other commits) |
| `api/**`, `fixtures/**` | Render only (`render.yaml` → `buildFilter`) |
| `package.json`, `package-lock.json` | both |
| `README.md`, `DEPLOY.md`, `docs/**` | neither |

Settings that are not code live in each dashboard, not in Git:

| Where | Setting | Value |
|---|---|---|
| Render → Environment | `DATABASE_URL` | Neon connection string |
| Render → Environment | `ADMIN_ORIGIN` | Vercel URL |
| Vercel → Settings → Environment Variables | `NEXT_PUBLIC_API_URL` | Render URL (changing it needs a Vercel redeploy, as it's baked in at build time) |

Database schema changes: add a new numbered file in `api/src/db/migrations/` (e.g. `002_add_notes.sql`). The API applies it on its next start. Never edit a migration that has already run.
