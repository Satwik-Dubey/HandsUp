# Putting HandsUp online (free)

| Piece | Where | Free plan notes |
| --- | --- | --- |
| Website (`apps/web`) | **Vercel** | Hobby plan |
| Database | **Neon** Postgres (pgvector included) | Sleeps after 5 idle minutes, wakes in about a second |
| Live server: gateway + workers in one service | **Render** web service | Sleeps after 15 idle minutes, takes up to a minute to wake |
| Redis | **Render Key Value** | 25 MB, no command limit |

```
phones & teachers ──► Vercel (website) ──────────────► Neon Postgres
        │                    │                              ▲
        │                    └─► Render Redis ◄──┐          │
        └── websocket ──► Render: gateway + workers ────────┘
```

Total time: about 45 minutes the first time. Do every step in your own accounts. Keep the connection strings and secrets in a safe place, such as Notes, and never put them in GitHub or a chat.

## 0. Before you start

- The code is on GitHub (`main` branch).
- Make two new secrets, different from the ones on your computer. Run this twice and keep both results:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
  The first is your **AUTH_SECRET** (Vercel only). The second is your **REALTIME_SECRET** (the same value on Vercel *and* Render).

## 1. Database: Neon

1. Sign up at https://neon.tech with GitHub and create a project: name **handsup**, **Postgres 16**, region **AWS Asia Pacific (Singapore)** (or the one closest to your students). When asked what else the app needs, pick **Just Postgres for now**.
2. Press **Connect** and copy the connection string (`postgresql://…?sslmode=require`). This is your **DATABASE_URL**.
3. Create the tables. In your project folder, run:
   ```bash
   DATABASE_URL='postgresql://…your Neon string…' pnpm db:migrate
   ```
   The first migration turns on `pgvector`, which Neon supports.

## 2. Live server and Redis: Render

The file `render.yaml` in the repo describes both, so Render sets them up together.

1. Sign up at https://render.com with GitHub.
2. **New → Blueprint**. Connect your GitHub repo when asked, then pick the **HandsUp** repo. Render reads `render.yaml` and shows two things to create: **handsup-realtime** (web service) and **handsup-redis** (Key Value).
3. It asks for the values marked "sync: false":
   - `DATABASE_URL`: your Neon string.
   - `REALTIME_SECRET`: the second secret from step 0.
   - `CORS_ORIGINS`: for now, type `https://handsup.vercel.app`. You'll fix it in step 4, once you know your real Vercel address.
   - `GROQ_API_KEY`, `GEMINI_API_KEY`: your keys, or leave them empty (alerts and reports still work with built-in wording).
4. Press **Apply**. The first build takes about 5 minutes.
5. When the service shows **Live**, copy its address from the top of the page, e.g. `https://handsup-realtime.onrender.com`. This is your **gateway URL**. Open `<gateway URL>/health` in the browser: it should say `{"ok":true,"redis":"ready"}`.
6. Open **handsup-redis → Connect → External**, and copy the **External Key Value URL** (it starts with `rediss://`). This is the **REDIS_URL for Vercel**. The live server uses the internal one automatically.

## 3. Website: Vercel

1. Sign up at https://vercel.com with GitHub. **Add New → Project**, then import the **HandsUp** repo.
2. **Root Directory**: press **Edit** and choose `apps/web`. The framework (Next.js) and pnpm are detected automatically; leave the build settings as they are.
3. **Environment Variables**, one per line:
   ```
   DATABASE_URL=<your Neon string>
   REDIS_URL=<the rediss:// External URL from step 2.6>
   AUTH_SECRET=<first secret from step 0>
   REALTIME_SECRET=<second secret from step 0, same as on Render>
   AUTH_GOOGLE_ID=<from Google Cloud, same as in your .env>
   AUTH_GOOGLE_SECRET=<from Google Cloud, same as in your .env>
   AUTH_TRUST_HOST=true
   NEXT_PUBLIC_GATEWAY_URL=<your gateway URL from step 2.5>
   NEXT_PUBLIC_APP_URL=https://<your-project>.vercel.app
   ```
   Don't add `ALLOW_DEV_LOGIN`. The test-teacher login is always off on a live site.
   For `NEXT_PUBLIC_APP_URL`, use the address Vercel shows under the project name (you can edit it after the first deploy and redeploy).
4. **Deploy**. When it's done, open the site. The home page should load.

`apps/web/vercel.json` runs the website in Singapore (`sin1`), next to the database. If your Neon region is different, change it to the nearest [Vercel region](https://vercel.com/docs/edge-network/regions).

## 4. Connect them

1. **Render → handsup-realtime → Environment**: set `CORS_ORIGINS` to your exact Vercel address, e.g. `https://handsup-abc.vercel.app` (no slash at the end). **Save**, and Render restarts the service.
2. If your Vercel address differs from what you put in `NEXT_PUBLIC_APP_URL`, fix it in **Vercel → Settings → Environment Variables** and **Redeploy** (`NEXT_PUBLIC_` values are baked in at build time).

## 5. Google sign-in for the live site

In Google Cloud Console, open your OAuth client (Google Auth Platform → **Clients**):

- **Authorized JavaScript origins**: add `https://<your vercel address>`
- **Authorized redirect URIs**: add `https://<your vercel address>/api/auth/callback/google`

Keep the localhost entries so local development still works.

While the app is in **Testing**, only the test users you listed can sign in. When other teachers should use it: **Audience → Publish app**. With only the basic scopes (email, profile), Google doesn't need to review it.

## 6. Check it

1. Open your site, sign in with Google, and open a lecture. The first time in a while, the dashboard may say **"Waking up the live server…"** for up to a minute (free plan). Teacher pages ping the server as soon as you open them, so it's usually awake by the time you press **Go live**.
2. Scan the QR with your phone **on mobile data**, so you know it works off campus Wi-Fi. Tap a few reactions and ask a question.
3. Press **End class** and open the report.

## Free plan: what to expect

- **Waking up:** the live server sleeps after 15 minutes with no visitors. Open your course page a minute before class and it will be ready.
- **One live server:** fine for a class of a few hundred. For bigger classes, or for no wake-up delay, switch the Render service to a paid plan (Starter); nothing else changes.
- **Local AI models are off** to fit in 512 MB. Questions are grouped with the word-based method. Add `GROQ_API_KEY` for AI-written insights and `GEMINI_API_KEY` for AI report summaries.
- **Redis keeps only live data.** Everything that matters (questions, timelines, reports) is saved in Neon, so a Redis restart between classes loses nothing.

## Updating later

Push to GitHub's `main` branch: Vercel and Render redeploy by themselves. When an update includes a database migration (a new file in `packages/db/migrations`), run `DATABASE_URL='<neon>' pnpm db:migrate` from your computer **before** pushing.

## If something's wrong

- **Dashboard says "Waking up the live server…" for over 2 minutes:** open `<gateway URL>/health`. If it doesn't load, open Render → handsup-realtime → **Logs**. A `Missing DATABASE_URL` or `Missing REALTIME_SECRET` line means an empty variable.
- **Dashboard can't connect, but `/health` works:** `CORS_ORIGINS` on Render doesn't exactly match your site's address, or `NEXT_PUBLIC_GATEWAY_URL` on Vercel is wrong (after fixing it, **Redeploy**).
- **"Sign-in expired" on the dashboard right away:** `REALTIME_SECRET` differs between Vercel and Render.
- **Students can't join ("something went wrong") or Go live does nothing:** Vercel can't reach Redis. Check that `REDIS_URL` on Vercel is the **External** `rediss://` URL.
- **Report never appears:** check Render's logs for `[report]` lines. The workers run inside the same service.
- **Google error `redirect_uri_mismatch`:** step 5.
- **Vercel build fails:** check that **Root Directory** is `apps/web`. The error log on Vercel shows which file failed.
