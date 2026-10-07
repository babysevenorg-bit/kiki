// Kiki admin — list pending wallpapers (uploads awaiting approval).
// Auth required (admin only).
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { err, ok, toPublicWallpaper, withDbRetry } from "@/lib/kiki"
import { requireAdmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401
    return NextResponse.json(
      err(status === 403 ? "forbidden" : "unauthorized", "Admin access required"),
      { status },
    )
  }

  try {
    const pending = await withDbRetry(() =>
      db.wallpaper.findMany({
        where: { status: "pending" },
        orderBy: [{ createdAt: "asc" }], // oldest first
        include: {
          uploadedBy: {
            select: { id: true, email: true, displayName: true },
          },
        },
      }),
    )

    return NextResponse.json(
      ok({
        items: pending.map((w) => ({
          ...toPublicWallpaper(w),
          uploader: w.uploadedBy
            ? {
                userId: w.uploadedBy.id,
                email: w.uploadedBy.email,
                displayName: w.uploadedBy.displayName,
              }
            : null,
        })),
      }),
    )
  } catch (e) {
    console.error("[kiki:admin:pending] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not fetch pending uploads."),
      { status: 503 },
    )
  }
}
