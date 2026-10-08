// Kiki admin — approve or reject a pending user upload.
// Auth required (admin only). Body: { action: "approve" | "reject" }
//   - approve: status="published", active=true (visible in catalog)
//   - reject:  status="rejected",  active=false (hidden forever)
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { broadcast } from "@/lib/broadcaster"
import { err, ok, withDbRetry } from "@/lib/kiki"
import { requireAdmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401
    return NextResponse.json(
      err(status === 403 ? "forbidden" : "unauthorized", "Admin access required"),
      { status },
    )
  }

  const { id } = await params
  let body: { action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(err("bad_json", "Invalid JSON"), { status: 400 })
  }

  const action = body.action
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      err("bad_request", 'action must be "approve" or "reject"'),
      { status: 400 },
    )
  }

  try {
    const existing = await withDbRetry(() =>
      db.wallpaper.findUnique({ where: { id } }),
    )
    if (!existing) {
      return NextResponse.json(err("not_found", "Wallpaper not found"), {
        status: 404,
      })
    }

    const updated = await withDbRetry(() =>
      db.wallpaper.update({
        where: { id },
        data:
          action === "approve"
            ? { status: "published", active: true }
            : { status: "rejected", active: false },
      }),
    )

    // On approve: ensure the category row exists + recompute count
    if (action === "approve") {
      const slug = updated.category.toLowerCase().replace(/\s+/g, "-")
      await withDbRetry(async () => {
        const count = await db.wallpaper.count({
          where: { category: updated.category, active: true },
        })
        await db.category
          .upsert({
            where: { slug },
            create: { name: updated.category, slug, count, active: true },
            update: { count },
          })
          .catch(() => undefined)
      })
    }

    broadcast({
      type: action === "approve" ? "wallpaper.created" : "wallpaper.updated",
      id,
      ts: Date.now(),
    })

    return NextResponse.json(
      ok({
        id,
        status: updated.status,
        active: updated.active,
      }),
    )
  } catch (e) {
    console.error("[kiki:admin:pending:id] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not moderate upload. Please retry."),
      { status: 503 },
    )
  }
}
