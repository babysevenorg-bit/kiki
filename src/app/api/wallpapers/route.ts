// Kiki — public catalog endpoint used by the React Native app's browse/search screen.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  cacheHeaders,
  ok,
  toPublicWallpaper,
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

  const where: {
    active: boolean
    featured?: boolean
    category?: string
    OR?: Array<Record<string, unknown>>
  } = { active: true }
  if (featuredOnly) where.featured = true
  if (category) where.category = category
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { tags: { contains: query } },
      { category: { contains: query } },
    ]
  }

  const orderBy =
    sort === "trending"
      ? [{ downloads: "desc" as const }, { updatedAt: "desc" as const }]
      : sort === "downloads"
      ? { downloads: "desc" as const }
      : { updatedAt: "desc" as const }

  const [rows, total] = await Promise.all([
    db.wallpaper.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.wallpaper.count({ where }),
  ])

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
}
