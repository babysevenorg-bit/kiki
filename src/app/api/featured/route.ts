// Kiki — featured rail for the RN home hero banner.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { cacheHeaders, ok, toPublicWallpaper } from "@/lib/kiki"

export const dynamic = "force-dynamic"

export async function GET() {
  const featured = await db.wallpaper.findMany({
    where: { active: true, featured: true },
    orderBy: [{ updatedAt: "desc" }],
    take: 12,
  })
  return NextResponse.json(
    ok({ items: featured.map(toPublicWallpaper) }),
    { headers: cacheHeaders(60) },
  )
}
