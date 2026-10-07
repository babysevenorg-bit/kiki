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

```bash
bun install
bun run db:push              # creates SQLite tables
bun run scripts/seed.ts      # seeds 18 HD wallpapers + 8 categories
bun run dev                  # http://localhost:3000
```

## Production deploy (Vercel + Neon)

See [DEPLOY.md](./DEPLOY.md) for the full guide. Short version:

1. Create a Neon Postgres project, copy the pooled + direct connection strings.
2. In `prisma/schema.prisma`, change `provider = "sqlite"` to `"postgresql"`.
3. Push to GitHub, import on Vercel.
4. Set env vars on Vercel:
   - `DATABASE_URL` — Neon pooled connection string
   - `DATABASE_URL_UNPOOLED` — Neon direct connection string (for Prisma migrations)
5. Run `bun run db:push` once locally against your Neon DB to create tables.
6. Deploy. Verify `/api/health` returns `db.status: "ok"`.

## Roadmap

- Real auth on `/api/admin/*` (NextAuth + Vercel KV)
- Soft-delete + undo for wallpapers
- "Trending now" rail (24-hour rolling download count)
- Server-side image resizing via Vercel Edge Functions
- User accounts for cross-device sync of favorites + rotation configs
- AI lockscreen buddy — text-to-prompt wallpaper generation, stored in the `AiPrompt` table
