# HandsUp: setup and running guide

**Know the moment your class gets lost.** Students give anonymous, live feedback from their phones (got it, confused, too fast, too slow, example please), ask and upvote questions, and answer polls. The teacher sees a live Understanding score, smart alerts, grouped questions, and gets an AI-written report after class.

This guide covers running HandsUp on your own computer. Back to the [project overview](../README.md).

- **[KEYS.md](../KEYS.md)**: every key and setting, what it's for, where to get it, and what to bring over from an older HandsUp folder.
- **[DEPLOY.md](../DEPLOY.md)**: putting it online (Vercel + Render + Neon, all free).
- **[loadtest/README.md](../loadtest/README.md)**: the 1,000-student load test.

---

## Quick start (about 10 minutes)

### 1. Install the tools (one time)

| Tool | Version | Check with |
| --- | --- | --- |
| Node.js | 20.11 or newer (22 recommended) | `node -v` |
| pnpm | 10 | `pnpm -v` (if missing: `corepack enable`, then `corepack prepare pnpm@10.28.0 --activate`) |
| Docker Desktop | any recent | `docker -v` (it runs Postgres and Redis for you) |

### 2. Install and configure

```bash
cd handsup
pnpm install
cp .env.example .env
```

**Already ran an earlier HandsUp folder?** Copy your old `.env` over the new one instead (`cp ../old-folder/.env .env`) and add the new lines from KEYS.md. Stop the old folder's database first with `pnpm db:down` inside the old folder.

Otherwise, open `.env` and fill in the two secrets. Run this twice and paste one result into each:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```
AUTH_SECRET=<first value>
REALTIME_SECRET=<second value>
```

That's enough to run everything. Google sign-in and the AI keys are optional for local testing ([KEYS.md](../KEYS.md) has the full list).

### 3. Start the database, then the app

```bash
pnpm db:up          # Postgres (with pgvector) and Redis in Docker
pnpm db:migrate     # creates or updates the tables
pnpm dev            # web, gateway and workers together
```

- **web** at http://localhost:3000 (Next.js: pages, sign-in, dashboard, reports, the student screen)
- **gateway** at http://localhost:4000 (Socket.IO: live taps, questions, polls, counters)
- **workers** (no port: timeline, AI grouping and alerts, reports, demo students, data cleanup)

The first time the workers start they download two small AI models (~90 MB) into `.cache/models`. You'll see `[nlp] local models ready`. If the download fails, grouping still works with a simpler word-based method.

**Try it alone in 5 minutes:**

1. Open http://localhost:3000, press **Sign in**, then **Developer sign-in → Sign in as test teacher** (or Google, once set up).
2. First-time setup: your name, your first course, then **Open the demo lecture**. 25 demo students join and start reacting.
3. Scan the QR (**Show QR**) with your phone or open the join link in a private window, and tap along.
4. After about 2 minutes the demo class gets confused: watch the **AI insights** card, the **Groups** tab in Questions, and the timeline.
5. **Launch** a poll, press **Next slide ▸**, try **Presenter** (a compact view for a second screen).
6. Press **End class**, then **View report**: summary, key moments, most asked, slide by slide, **Download PDF**, **Export CSV**, **Share link**.
7. Your course page now shows the lecture-by-lecture comparison.

For a bigger class: `pnpm simulate YOURCODE 100` (or `pnpm simulate YOURCODE 60 confused`) adds fake students from the terminal, or press **Demo students** on any dashboard.

### 4. Google sign-in (for real teacher accounts)

1. Go to https://console.cloud.google.com/ and create a project (e.g. "HandsUp").
2. **Google Auth Platform** (older consoles: APIs & Services → OAuth consent screen): choose **External**, fill in the app name and your email, then under **Audience → Test users** add your own Gmail. Only the default scopes (email, profile, openid) are needed.
3. **Clients → Create client** (older: Credentials → Create credentials → OAuth client ID):
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
4. Copy the **Client ID** and **Client secret** into `.env`:
   ```
   AUTH_GOOGLE_ID=xxxxxxxx.apps.googleusercontent.com
   AUTH_GOOGLE_SECRET=GOCSPX-xxxxxxxx
   ```
5. Restart `pnpm dev`. The **Continue with Google** button appears on `/login`. Open the app as `http://localhost:3000` (not `0.0.0.0` or your Wi-Fi address) when signing in: Google only accepts the addresses you listed.

When you deploy, add your real domain (see DEPLOY.md) to the same two lists, e.g. `https://handsup.app/api/auth/callback/google`.

### 5. Testing with a real phone

Your phone can't open `localhost` on your computer, so:

1. Find your computer's Wi-Fi address: macOS `ipconfig getifaddr en0`, Windows `ipconfig` (look for IPv4 Address), Linux `hostname -I`. Say it's `192.168.1.23`.
2. In `.env` set `NEXT_PUBLIC_APP_URL=http://192.168.1.23:3000` and restart `pnpm dev`. The QR code now points there.
3. Keep using `http://localhost:3000` as the teacher (Google only allows `localhost` for local sign-in).
4. Put the phone on the **same Wi-Fi** and scan the QR. The phone talks to the gateway on port 4000 of the same address automatically.
5. If the phone can't load the page, allow Node through your firewall for ports 3000 and 4000 (Windows will usually pop up a prompt; on macOS check System Settings → Network → Firewall). Campus/office Wi-Fi often blocks phone-to-laptop traffic, so a phone hotspot or home Wi-Fi works best.

---

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run web, gateway and workers together (`pnpm dev:web` / `dev:gateway` / `dev:workers` for one) |
| `pnpm db:up` / `pnpm db:down` | Start / stop Postgres and Redis |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:studio` | Browse the database in your browser (Drizzle Studio) |
| `pnpm simulate CODE [n] [mixed\|happy\|confused\|fast]` | Fake students |
| `k6 run -e CODE=XXXXXX loadtest/students.js` | Load test (see loadtest/README.md) |
| `pnpm typecheck` | Type-check every package |
| `pnpm test` | Unit tests (no database needed, under a second) |
| `pnpm test:e2e` | End-to-end test in a real browser: a teacher runs a lecture, a student joins, reacts and asks, the report appears. Needs `pnpm db:up` and `pnpm db:migrate`; starts `pnpm dev` itself. First time only: `pnpm exec playwright install chromium` |
| `pnpm build` | Production build of everything |
| `docker compose down -v` | Wipe the local database and start fresh (then `pnpm db:migrate`) |

## Troubleshooting

- **Timeline stays empty**: the workers aren't running. Check for `[aggregator] running` in the terminal. The timeline only grows while the lecture is live.
- **"Connecting to the live server…" on the dashboard**: the gateway isn't running or crashed. Check the terminal for `[gateway] listening on :4000`. A missing `REALTIME_SECRET` stops it at startup.
- **`ECONNREFUSED 5432` or `6379`**: Docker isn't running. Start Docker Desktop, then `pnpm db:up`.
- **Port 5432 already in use**: you have another Postgres installed. Stop it, or change the left side of `"5432:5432"` in `docker-compose.yml` (e.g. `"5433:5432"`) and the port in `DATABASE_URL`.
- **Google says "doesn't comply with Google's OAuth 2.0 policy", or Safari says "restricted network port" on `0.0.0.0:3000`**: add `AUTH_URL=http://localhost:3000` to `.env`, restart, and open the app at `http://localhost:3000`.
- **Google says `redirect_uri_mismatch`**: the redirect URI in Google Cloud must be exactly `http://localhost:3000/api/auth/callback/google`.
- **Signed in but bounced back to /login**: you probably wiped the database. Sign in again; your teacher account is recreated.
- **Phone shows "Reconnecting…"**: see [Testing with a real phone](#5-testing-with-a-real-phone); usually a firewall or Wi-Fi that isolates devices.
- **No AI insights card ever appears**: alerts need at least 5 active students and something worth alerting about. Press **Demo students** and wait about 2 minutes. With a `GROQ_API_KEY`, the terminal shows `live AI insights with Groq` at startup.
- **"Writing your report…" never finishes**: the workers aren't running (`pnpm dev` starts them). The terminal shows `[report] ... ready` when it's done.
- **`[nlp] couldn't load local models`**: the model download was blocked (offline or a firewall). Grouping still works, a bit less cleverly. Delete `.cache/models` and restart to retry.
- **`pnpm build` prints "Critical dependency" warnings**: they come from the Sentry library and are harmless.

## Pushing to GitHub

```bash
git init
git add .
git commit -m "HandsUp"
git branch -M main
git remote add origin https://github.com/<you>/handsup.git
git push -u origin main
```

`.env` and `.cache` are in `.gitignore`, so your secrets and the downloaded models stay on your computer.

**Automatic checks:** `.github/workflows/ci.yml` runs on every push: typecheck, unit tests, a production build, and the end-to-end test against a fresh Postgres and Redis. You'll see a green tick (or a red cross with the reason) next to each commit on GitHub, under the **Actions** tab. It needs no secrets.
