// Kiki — current user's own uploads. Auth required.
// Returns all wallpapers uploaded by the signed-in user (any status).
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { err, ok, toPublicWallpaper, withDbRetry } from "@/lib/kiki"
import { requireUser } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  let session
  try {
    session = await requireUser()
  } catch {
    return NextResponse.json(
      err("unauthorized", "Sign in to view your uploads"),
      { status: 401 },
    )
  }

  try {
    const uploads = await withDbRetry(() =>
      db.wallpaper.findMany({
        where: { uploadedById: session.userId },
        orderBy: [{ createdAt: "desc" }],
      }),
    )
    return NextResponse.json(
      ok({ items: uploads.map(toPublicWallpaper) }),
    )
  } catch (e) {
    console.error("[kiki:users:me:uploads] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not load your uploads."),
      { status: 503 },
    )
  }
}
