# Keys and settings

Everything HandsUp reads from `.env` (on your computer) or from the hosting dashboards (when deployed).
**Never paste keys into chat, GitHub issues or screenshots.** If one leaks, create a new one and delete the old.

## Coming from an older HandsUp folder (Week 1 or 2)

Bring over **only your `.env`**:

```bash
cp ~/path/to/old/handsup/.env .env
```

It already has `AUTH_SECRET`, `REALTIME_SECRET`, the database and Redis addresses, and your Google keys if you added them. Then add these new lines at the bottom (all optional):

```
GROQ_MODEL=llama-3.1-8b-instant
GEMINI_MODEL=gemini-2.5-flash
LOCAL_MODELS=on
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

and put your Groq and Gemini keys into the existing `GROQ_API_KEY=` and `GEMINI_API_KEY=` lines. Then run `pnpm install`, `pnpm db:down` in the **old** folder, and `pnpm db:up`, `pnpm db:migrate`, `pnpm dev` in the new one.

Your old courses and lectures carry over only if both folders are named `handsup`. If they aren't, the new folder starts with an empty database, which is fine: sign in again and the setup guides you.

## What you need

| Key | Needed? | What it does | Where to get it |
| --- | --- | --- | --- |
| `AUTH_SECRET` | **Yes** | Signs teacher sign-in sessions | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `REALTIME_SECRET` | **Yes** | Lets the web app and the gateway trust each other | Generate the same way (a different value) |
| `DATABASE_URL` | **Yes** | Postgres | Local: already set for Docker. Online: Neon (see DEPLOY.md) |
| `REDIS_URL` | **Yes** | Redis | Local: already set for Docker. Online: Render Key Value, set on the live server only (not on Vercel) |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | For real teachers | "Continue with Google" | Google Cloud Console, steps in docs/SETUP.md section 4 |
| `GROQ_API_KEY` | Optional | Live AI insights and names for question groups | https://console.groq.com → **API Keys** → **Create API Key** (starts with `gsk_`). Free. |
| `GEMINI_API_KEY` | Optional | AI-written summary in the after-class report | https://aistudio.google.com/apikey → **Create API key**. Free. |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Optional | Error tracking | https://sentry.io → create a **Next.js** project → **Settings → Client Keys (DSN)**. Same DSN in both. Free. |

Without the optional keys the app still works fully: alerts, groups and reports are written by rules instead of AI, and there's no error tracking.

## All settings

| Setting | Default | Notes |
| --- | --- | --- |
| `AUTH_TRUST_HOST` | `true` | Keep it. |
| `ALLOW_DEV_LOGIN` | `true` | The "test teacher" button. It never works in production, whatever this says. |
| `GATEWAY_PORT` | `4000` | Local only. Hosting sets `PORT` itself. |
| `CORS_ORIGINS` | empty | Online: your website address, e.g. `https://handsup.vercel.app`. Empty allows all (fine locally). |
| `NEXT_PUBLIC_GATEWAY_URL` | empty | Online: the gateway's public address, e.g. `https://handsup-realtime.onrender.com`. Empty locally. |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | The address in QR codes and share links. |
| `AUTH_URL` | empty (uses `NEXT_PUBLIC_APP_URL`) | Where teachers sign in. Set it to `http://localhost:3000` if you point `NEXT_PUBLIC_APP_URL` at your Wi-Fi address for phone testing, because Google only accepts the addresses listed in your OAuth client. |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Any Groq chat model. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Any Gemini Flash model. |
| `LOCAL_MODELS` | `on` | `off` skips the ~90 MB model download and uses word-based grouping. |
| `MODELS_CACHE_DIR` | `.cache/models` | Where the models are stored. |
| `GATEWAY_INTERNAL_URL` | `http://localhost:4000` | Where the workers' demo students connect. Online: the gateway's address. |
| `WORKER_NAME` | `w-<pid>` | Only matters if you run several worker copies. |
| `DB_POOL_MAX` | `10` | Database connections per process. |

## Free-tier limits (as of late 2026, check the sites for current numbers)

- **Groq**: HandsUp makes at most one small call per live lecture per minute, and only when something changed. A 1-hour lecture uses about 60 calls.
- **Gemini**: one call per ended lecture (plus one per "Rewrite the report").
- **Local models**: no limits, they run on your own machine or server.
