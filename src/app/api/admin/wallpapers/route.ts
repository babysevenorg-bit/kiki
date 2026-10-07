// Kiki admin — create / update a wallpaper. (Admin UI is the only user of this.)
// In production, protect this route with NextAuth or an API key check.
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { broadcast } from "@/lib/broadcaster"
import { err, ok, parseTags } from "@/lib/kiki"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let body: {
    title?: string
    imageUrl?: string
    thumbUrl?: string
    category?: string
    tags?: unknown
    resolution?: string
    fileSizeKb?: number
    orientation?: string
    featured?: boolean
    active?: boolean
    source?: string
    accentColor?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(err("bad_json", "Invalid JSON"), { status: 400 })
  }

  if (!body.title || !body.imageUrl || !body.thumbUrl) {
    return NextResponse.json(
      err("bad_request", "title, imageUrl and thumbUrl are required"),
      { status: 400 },
    )
  }
  const category = (body.category ?? "uncategorized").toString()

  try {
    const wallpaper = await db.wallpaper.create({
      data: {
        title: body.title,
        imageUrl: body.imageUrl,
        thumbUrl: body.thumbUrl,
        category,
        tags: JSON.stringify(parseTags(body.tags)),
        resolution: body.resolution ?? "1080x1920",
        fileSizeKb: Number(body.fileSizeKb ?? 0),
        orientation: body.orientation ?? "portrait",
        featured: Boolean(body.featured ?? false),
        active: Boolean(body.active ?? true),
        source: body.source ?? "kiki-studio",
        accentColor: body.accentColor ?? "#0f172a",
      },
    })

    // Lazy upsert category row
    const slug = category.toLowerCase().replace(/\s+/g, "-")
    await db.category
      .upsert({
        where: { slug },
        create: {
          name: category,
          slug,
          count: await db.wallpaper.count({ where: { category, active: true } }),
        },
        update: {
          count: await db.wallpaper.count({ where: { category, active: true } }),
        },
      })
      .catch(() => undefined)

    broadcast({ type: "wallpaper.created", id: wallpaper.id, ts: Date.now() })
    return NextResponse.json(ok({ id: wallpaper.id, created: true }))
  } catch (e) {
    console.error("[kiki:admin:wallpapers:post] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not save wallpaper. Please retry."),
      { status: 503 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  let body: {
    id?: string
    title?: string
    imageUrl?: string
    thumbUrl?: string
    category?: string
    tags?: unknown
    resolution?: string
    fileSizeKb?: number
    orientation?: string
    featured?: boolean
    active?: boolean
    source?: string
    accentColor?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(err("bad_json", "Invalid JSON"), { status: 400 })
  }
  if (!body.id) {
    return NextResponse.json(err("bad_request", "id is required"), {
      status: 400,
    })
  }

  try {
    const existing = await db.wallpaper.findUnique({ where: { id: body.id } })
    if (!existing) {
      return NextResponse.json(err("not_found", "Wallpaper not found"), {
        status: 404,
      })
    }

    const data: Record<string, unknown> = {}
    if (typeof body.title === "string") data.title = body.title
    if (typeof body.imageUrl === "string") data.imageUrl = body.imageUrl
    if (typeof body.thumbUrl === "string") data.thumbUrl = body.thumbUrl
    if (typeof body.category === "string") data.category = body.category
    if (body.tags !== undefined) data.tags = JSON.stringify(parseTags(body.tags))
    if (typeof body.resolution === "string") data.resolution = body.resolution
    if (typeof body.fileSizeKb === "number") data.fileSizeKb = body.fileSizeKb
    if (typeof body.orientation === "string") data.orientation = body.orientation
    if (typeof body.featured === "boolean") data.featured = body.featured
    if (typeof body.active === "boolean") data.active = body.active
    if (typeof body.source === "string") data.source = body.source
    if (typeof body.accentColor === "string") data.accentColor = body.accentColor

    const updated = await db.wallpaper.update({ where: { id: body.id }, data })

    if (typeof body.category === "string") {
      const slug = body.category.toLowerCase().replace(/\s+/g, "-")
      await db.category
        .upsert({
          where: { slug },
          create: {
            name: body.category,
            slug,
            count: await db.wallpaper.count({
              where: { category: body.category, active: true },
            }),
          },
          update: {
            count: await db.wallpaper.count({
              where: { category: body.category, active: true },
            }),
          },
        })
        .catch(() => undefined)
    }

    broadcast({ type: "wallpaper.updated", id: updated.id, ts: Date.now() })
    return NextResponse.json(ok({ id: updated.id, updated: true }))
  } catch (e) {
    console.error("[kiki:admin:wallpapers:patch] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not update wallpaper. Please retry."),
      { status: 503 },
    )
  }
}
