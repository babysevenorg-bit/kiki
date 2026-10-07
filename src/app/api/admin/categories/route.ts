// Kiki admin — category CRUD (single endpoint, all ops via POST body).
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { broadcast } from "@/lib/broadcaster"
import { err, ok } from "@/lib/kiki"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let body: { op?: "create" | "update" | "delete"; id?: string; name?: string; icon?: string; accent?: string; active?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(err("bad_json", "Invalid JSON"), { status: 400 })
  }
  const op = body.op ?? "create"
  const slug = (body.name ?? "").toLowerCase().replace(/\s+/g, "-")

  if (op === "create") {
    if (!body.name) {
      return NextResponse.json(err("bad_request", "name is required"), {
        status: 400,
      })
    }
    const category = await db.category.create({
      data: {
        name: body.name,
        slug,
        icon: body.icon ?? "✨",
        accent: body.accent ?? "#ec4899",
        active: body.active ?? true,
        count: await db.wallpaper.count({ where: { category: body.name, active: true } }),
      },
    })
    broadcast({ type: "category.changed", ts: Date.now() })
    return NextResponse.json(ok(category))
  }
  if (op === "update") {
    if (!body.id) {
      return NextResponse.json(err("bad_request", "id is required"), {
        status: 400,
      })
    }
    const updated = await db.category.update({
      where: { id: body.id },
      data: {
        ...(body.name ? { name: body.name, slug } : {}),
        ...(body.icon ? { icon: body.icon } : {}),
        ...(body.accent ? { accent: body.accent } : {}),
        ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      },
    })
    broadcast({ type: "category.changed", ts: Date.now() })
    return NextResponse.json(ok(updated))
  }
  if (op === "delete") {
    if (!body.id) {
      return NextResponse.json(err("bad_request", "id is required"), {
        status: 400,
      })
    }
    await db.category.delete({ where: { id: body.id } }).catch(() => undefined)
    broadcast({ type: "category.changed", ts: Date.now() })
    return NextResponse.json(ok({ id: body.id, deleted: true }))
  }
  return NextResponse.json(err("bad_op", "Unknown op"), { status: 400 })
}
