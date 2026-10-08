# kiki

**A little corner for your phone.**

Kiki is a phone wallpapers + lockscreen app built in React Native. This repo is the **backend server** — a Next.js 16 + TypeScript app that powers the catalog, downloads, rotation sync, and real-time updates. It connects to Neon Postgres and deploys on Vercel.

## What this backend does

- HD wallpaper catalog with full-text search, category filter, sort, pagination
- Featured rail for the RN home hero
- Per-device wallpaper rotation config sync (up to 8 wallpapers, any interval ≥1s)
- Download tracking (per device, anonymous)
- Real-time catalog updates via Server-Sent Events (`/api/events`)
- AI wallpaper generator (z-ai-web-dev-sdk) with admin dashboard
- Admin dashboard UI at `/`

## Stack

- Next.js 16 (App Router) + TypeScript 5
- Prisma ORM (SQLite in dev, Neon Postgres in prod)
- Tailwind CSS 4 + shadcn/ui (New York style)
- z-ai-web-dev-sdk for AI image generation
- SSE for real-time updates (Upstash Redis pub/sub on prod for multi-instance fan-out)

## API contract

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
| GET | `/api/events` | SSE stream: `wallpaper.created/updated/deleted`, `download.counted`, `category.changed`, `rotation.changed` |
| POST | `/api/admin/wallpapers` | Create a wallpaper |
| PATCH | `/api/admin/wallpapers` | Update fields on a wallpaper |
| POST | `/api/admin/categories` | Create/update/delete a category |
| POST | `/api/admin/generate` | Generate an HD wallpaper with AI. Body: `{ prompt, size }` |

## Local dev

The schema is configured for **Neon Postgres**. You need a Neon project (free tier is fine).

1. Create a Neon project at [neon.tech](https://neon.tech), copy both connection strings (pooled + direct).
2. Copy `.env.example` to `.env` and fill in the real values:
   - `DATABASE_URL` — Neon pooled URL with `&pgbouncer=true&connect_timeout=15`
   - `DATABASE_URL_UNPOOLED` — Neon direct URL (for migrations)
3. Inspect the Neon DB first (don't blindly push tables over existing data):
   ```bash
   bun run scripts/inspect-neon.ts
   ```
4. Push the schema (creates the 7 Kiki tables — `Wallpaper`, `Category`, `DownloadEvent`, `RotationConfig`, `AiPrompt`, plus legacy `User`/`Post`):
   ```bash
   bun run db:push
   ```
5. Seed the catalog — INSERT-ONLY, never overwrites existing rows:
   ```bash
   bun run scripts/seed.ts
   ```
6. Start the dev server:
   ```bash
   bun run dev
   ```
7. Verify against Neon:
   ```bash
   curl http://localhost:3000/api/health
   # → db.status: "ok", db.provider: "postgresql", db.host: "your-pooler.neon.tech"
   ```

> **Note on shell env inheritance**: If you have an old `DATABASE_URL` set in your shell session, Bun's `.env` loader will NOT override it. Run `unset DATABASE_URL` first, or use `env -u DATABASE_URL bun run dev`.

## Production deploy (Vercel + Neon)

See [DEPLOY.md](./DEPLOY.md) for the full guide. Short version:

1. Push the repo to GitHub.
2. Import it on [vercel.com](https://vercel.com).
3. Set env vars on Vercel:
   - `DATABASE_URL` — Neon pooled connection string with `&pgbouncer=true&connect_timeout=15`
   - `DATABASE_URL_UNPOOLED` — Neon direct connection string (for `prisma migrate`)
4. Set the build command to skip migrations (you've already pushed them locally): `next build`
5. Deploy. Verify `/api/health` returns `db.status: "ok"`.

## Roadmap

- Real auth on `/api/admin/*` (NextAuth + Vercel KV)
- Soft-delete + undo for wallpapers
- "Trending now" rail (24-hour rolling download count)
- Server-side image resizing via Vercel Edge Functions
- User accounts for cross-device sync of favorites + rotation configs
- AI lockscreen buddy — text-to-prompt wallpaper generation, stored in the `AiPrompt` table
