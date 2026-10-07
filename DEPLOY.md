# Kiki Backend — Deploy Guide

This is the **Next.js backend server** for the Kiki React Native wallpaper app.
It runs on Vercel and uses Neon Postgres as the database.

## 1. What this backend does

The Kiki backend is the catalog server for the React Native mobile app:

- **HD wallpaper catalog** — list, search (title + tags + category), filter, sort, paginate
- **Featured rail** — the home hero banner in the RN app reads from `/api/featured`
- **Categories** — chip rail on the RN home screen reads from `/api/categories`
- **Download tracking** — every saved-for-offline wallpaper hits `POST /api/downloads`
- **Per-device rotation config** — the wallpaper rotation tool syncs via `/api/rotation/[deviceId]`
- **Real-time catalog updates** — the RN app subscribes to `/api/events` (SSE) and refreshes when wallpapers are created/edited/deleted
- **Admin dashboard** at `/` — add/edit/delete wallpapers, toggle featured, generate AI wallpapers with the `z-ai-web-dev-sdk`

## 2. API contract

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check + endpoint fingerprint |
| GET | `/api/wallpapers` | List + search. Params: `query`, `category`, `featured=1`, `sort=recent\|trending\|downloads`, `page`, `limit` |
| GET | `/api/wallpapers/[id]` | Single wallpaper detail |
| DELETE | `/api/wallpapers/[id]` | Delete (admin) |
| GET | `/api/categories` | Active categories for chip rail |
| GET | `/api/featured` | Featured rail for home hero |
| POST | `/api/downloads` | Record a download. Body: `{ wallpaperId, deviceId }` |
| GET | `/api/rotation/[deviceId]` | Get rotation config (auto-creates default on first read) |
| PUT | `/api/rotation/[deviceId]` | Update rotation. Body: `{ wallpaperIds[], intervalSec, activeFrom, activeTo, shuffle }` |
| GET | `/api/events` | SSE stream (`wallpaper.created/updated/deleted`, `download.counted`, `category.changed`, `rotation.changed`) |
| POST | `/api/admin/wallpapers` | Create a wallpaper |
| PATCH | `/api/admin/wallpapers` | Update fields on a wallpaper |
| POST | `/api/admin/categories` | Create/update/delete a category (`{ op: "create"\|"update"\|"delete", ... }`) |
| POST | `/api/admin/generate` | Generate an HD wallpaper with the AI image service. Body: `{ prompt, size }` |

## 3. Local dev (Neon Postgres)

The schema is already set to `postgresql` in `prisma/schema.prisma`. You need a Neon project.

```bash
bun install
# 1. Copy .env.example to .env and fill in your Neon pooled + direct URLs
# 2. Inspect the Neon DB BEFORE pushing (don't blow away existing data):
bun run scripts/inspect-neon.ts
# 3. Push the schema (creates 7 tables: Wallpaper, Category, DownloadEvent,
#    RotationConfig, AiPrompt, plus legacy User/Post):
bun run db:push
# 4. Seed the catalog (INSERT-ONLY — never overwrites existing rows):
bun run scripts/seed.ts
# 5. Start the dev server. If your shell has DATABASE_URL pre-set, unset it
#    first so Bun's .env loader wins:
unset DATABASE_URL || true
bun run dev   # http://localhost:3000
# 6. Verify against Neon:
curl http://localhost:3000/api/health
# → db.status: "ok", db.provider: "postgresql", db.host: "your-pooler.neon.tech"
```

## 4. Production: Vercel + Neon Postgres

### Step 1 — Provision a Neon database
1. Sign up at [neon.tech](https://neon.tech) (free tier is enough to start).
2. Create a project, pick a region close to your Vercel deployment region.
3. Copy both connection strings:
   - `DATABASE_URL` — pooled (used by the app at runtime)
   - `DATABASE_URL_UNPOOLED` — direct (used by Prisma migrations)

### Step 2 — Schema is already Postgres-ready

`prisma/schema.prisma` is already configured for Neon Postgres:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")          // Neon pooled (PgBouncer)
  directUrl = env("DATABASE_URL_UNPOOLED") // Neon direct (for migrations)
}
```

No edits needed. The `tags` field is stored as TEXT (JSON string) rather than `String[]` to keep the schema portable, parsed by `parseTags()` in `src/lib/kiki.ts`.

### Step 3 — Push the schema to Neon

```bash
# Set DATABASE_URL and DATABASE_URL_UNPOOLED locally first (via .env)
bun run scripts/inspect-neon.ts   # check for existing tables first
bun run db:push                   # creates the 7 tables
bun run scripts/seed.ts           # INSERT-ONLY seed (safe to re-run)
```

### Step 4 — Deploy on Vercel
1. Push the project to GitHub.
2. On [vercel.com](https://vercel.com), import the repo.
3. Add environment variables:
   - `DATABASE_URL` — Neon pooled
   - `DATABASE_URL_UNPOOLED` — Neon direct
4. Use the default build command (`next build`) — Next.js 16 + App Router is detected automatically.
5. Deploy. Verify `/api/health` returns `db.status: "ok"`.

## 5. Real-time SSE on Vercel

The dev version uses an in-process broadcaster (`src/lib/broadcaster.ts`) which works perfectly when the API is a single process. On Vercel, every serverless instance has its own process, so SSE events would only reach clients connected to that same instance.

To fix this in production, swap the broadcaster to use **Upstash Redis pub/sub**:

1. Create a Redis database at [upstash.com](https://upstash.com) (serverless, HTTP-based).
2. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars on Vercel.
3. Replace `src/lib/broadcaster.ts` with a version that publishes events to a Redis channel and have `/api/events` subscribe to that channel.

A starting sketch is in `src/lib/broadcaster.ts` — the function signatures (`subscribe`, `broadcast`, `KikiEvent`) don't need to change.

## 6. Object storage for HD images

The catalog stores image URLs, not image bytes. For production:

- **Vercel Blob** — easiest, native Vercel integration. Use `put()` from the `@vercel/blob` package to upload wallpapers from the admin dashboard, then save the returned URL.
- **Cloudflare R2 / AWS S3** — also fine. Create a presigned upload URL from the API, the admin dashboard uploads directly, you store the resulting URL.

The `Wallpaper.imageUrl` and `Wallpaper.thumbUrl` columns are agnostic — they just need a public HTTPS URL.

## 7. Wiring the React Native app

In your Kiki React Native app, point at the deployed URL:

```ts
// app/config/api.ts
export const KIKI_API_BASE = __DEV__
  ? "http://localhost:3000"   // or your dev tunnel
  : "https://your-app.vercel.app";

// Search screen
fetch(`${KIKI_API_BASE}/api/wallpapers?query=${q}&page=${page}&limit=24`)
  .then(r => r.json())
  .then(({ data }) => setWallpapers(prev => [...prev, ...data.items]));

// Real-time catalog updates
const es = new EventSource(`${KIKI_API_BASE}/api/events`);
es.addEventListener("wallpaper.created", () => refresh());
es.addEventListener("wallpaper.deleted", () => refresh());

// Download tracking (when user taps Save for offline)
fetch(`${KIKI_API_BASE}/api/downloads`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallpaperId: w.id, deviceId: myDeviceId }),
});

// Rotation tool sync
fetch(`${KIKI_API_BASE}/api/rotation/${deviceId}`, { method: "GET" })
fetch(`${KIKI_API_BASE}/api/rotation/${deviceId}`, {
  method: "PUT",
  body: JSON.stringify({ wallpaperIds, intervalSec: 5, shuffle: true }),
});
```

## 8. Roadmap after launch

- Real auth on `/api/admin/*` (NextAuth + Vercel KV for sessions)
- Soft-delete + undo for wallpapers
- "Trending now" rail (24-hour rolling download count)
- Server-side image resizing via Vercel Edge Functions (resize on the fly)
- User accounts for cross-device sync of favorites + rotation configs
- The "AI lockscreen buddy" — text-to-prompt wallpaper generation, stored in `AiPrompt` table
