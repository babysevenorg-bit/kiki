// Kiki — featured rail for the RN home hero banner.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { cacheHeaders, err, ok, toPublicWallpaper, withDbRetry } from "@/lib/kiki"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const featured = await withDbRetry(() =>
      db.wallpaper.findMany({
        where: { active: true, featured: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 12,
      }),
    )
    return NextResponse.json(
      ok({ items: featured.map(toPublicWallpaper) }),
      { headers: cacheHeaders(60) },
    )
  } catch (e) {
    console.error("[kiki:featured] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not reach the catalog database."),
      { status: 503 },
    )
  }
}
