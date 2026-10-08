// Kiki — public catalog endpoint used by the React Native app's browse/search screen.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  cacheHeaders,
  err,
  ok,
  toPublicWallpaper,
  withDbRetry,
} from "@/lib/kiki"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const query = (url.searchParams.get("query") ?? "").trim().toLowerCase()
  const category = (url.searchParams.get("category") ?? "").trim()
  const featuredOnly = url.searchParams.get("featured") === "1"
  const sort = (url.searchParams.get("sort") ?? "recent") as
    | "recent"
    | "trending"
    | "downloads"
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1))
  const limit = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number(url.searchParams.get("limit") ?? PAGE_SIZE_DEFAULT)),
  )

  // On Postgres, `contains` is case-sensitive by default. Force case-insensitive
  // so the RN search box "tokyo" matches "Tokyo at Night".
  const where: {
    active: boolean
    featured?: boolean
    category?: { equals: string; mode: "insensitive" }
    OR?: Array<Record<string, unknown>>
  } = { active: true }
  if (featuredOnly) where.featured = true
  if (category) {
    where.category = { equals: category, mode: "insensitive" }
  }
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { tags: { contains: query, mode: "insensitive" } },
      { category: { contains: query, mode: "insensitive" } },
    ]
  }

  const orderBy =
    sort === "trending"
      ? [{ downloads: "desc" as const }, { updatedAt: "desc" as const }]
      : sort === "downloads"
      ? { downloads: "desc" as const }
      : { updatedAt: "desc" as const }

  try {
    const [rows, total] = await withDbRetry(() =>
      Promise.all([
        db.wallpaper.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.wallpaper.count({ where }),
      ]),
    )

    return NextResponse.json(
      ok({
        items: rows.map(toPublicWallpaper),
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      }),
      { headers: cacheHeaders(60) },
    )
  } catch (e) {
    console.error("[kiki:wallpapers] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not reach the catalog database. Please retry."),
      { status: 503 },
    )
  }
}
