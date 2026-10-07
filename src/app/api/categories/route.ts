// Kiki — list active categories for the RN chip rail.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { cacheHeaders, err, ok } from "@/lib/kiki"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const categories = await db.category.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }],
    })
    return NextResponse.json(
      ok({
        items: categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          icon: c.icon,
          accent: c.accent,
          count: c.count,
        })),
      }),
      { headers: cacheHeaders(120) },
    )
  } catch (e) {
    console.error("[kiki:categories] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not reach the catalog database."),
      { status: 503 },
    )
  }
}
