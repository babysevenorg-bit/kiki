// Kiki — single wallpaper detail.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { cacheHeaders, err, ok, toPublicWallpaper } from "@/lib/kiki"
import { broadcast } from "@/lib/broadcaster"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const wallpaper = await db.wallpaper.findUnique({ where: { id } })
  if (!wallpaper || !wallpaper.active) {
    return NextResponse.json(err("not_found", "Wallpaper not found"), {
      status: 404,
    })
  }
  return NextResponse.json(
    ok(toPublicWallpaper(wallpaper)),
    { headers: cacheHeaders(120) },
  )
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const deleted = await db.wallpaper.delete({ where: { id } })
    await db.category
      .update({
        where: { slug: deleted.category },
        data: {
          count: await db.wallpaper.count({
            where: { category: deleted.category, active: true },
          }),
        },
      })
      .catch(() => undefined)
    broadcast({ type: "wallpaper.deleted", id, ts: Date.now() })
    return NextResponse.json(ok({ id: deleted.id, deleted: true }))
  } catch {
    return NextResponse.json(err("not_found", "Wallpaper not found"), {
      status: 404,
    })
  }
}
