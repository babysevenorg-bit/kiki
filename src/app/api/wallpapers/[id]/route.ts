// Kiki — single wallpaper detail.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { cacheHeaders, err, ok, toPublicWallpaper, withDbRetry } from "@/lib/kiki"
import { broadcast } from "@/lib/broadcaster"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const wallpaper = await withDbRetry(() =>
      db.wallpaper.findUnique({ where: { id } }),
    )
    if (!wallpaper || !wallpaper.active) {
      return NextResponse.json(err("not_found", "Wallpaper not found"), {
        status: 404,
      })
    }
    return NextResponse.json(
      ok(toPublicWallpaper(wallpaper)),
      { headers: cacheHeaders(120) },
    )
  } catch (e) {
    console.error("[kiki:wallpaper:get] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not reach the catalog database."),
      { status: 503 },
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const deleted = await withDbRetry(() => db.wallpaper.delete({ where: { id } }))
    await db.category
      .update({
        where: { slug: deleted.category.toLowerCase().replace(/\s+/g, "-") },
        data: {
          count: await db.wallpaper.count({
            where: { category: deleted.category, active: true },
          }),
        },
      })
      .catch(() => undefined)
    broadcast({ type: "wallpaper.deleted", id, ts: Date.now() })
    return NextResponse.json(ok({ id: deleted.id, deleted: true }))
  } catch (e) {
    // Prisma throws P2025 when the record doesn't exist
    if (String((e as Error).message).includes("does not exist")) {
      return NextResponse.json(err("not_found", "Wallpaper not found"), {
        status: 404,
      })
    }
    console.error("[kiki:wallpaper:delete] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not delete wallpaper. Please retry."),
      { status: 503 },
    )
  }
}
