// Kiki backend — health check + fingerprint endpoint.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  let dbStatus: "ok" | "fail" = "fail"
  let wallpaperCount = 0
  let categoryCount = 0
  try {
    const [w, c] = await Promise.all([
      db.wallpaper.count(),
      db.category.count(),
    ])
    wallpaperCount = w
    categoryCount = c
    dbStatus = "ok"
  } catch {
    // surfaced in the response
  }

  return NextResponse.json({
    ok: true,
    service: "kiki-backend",
    version: "1.0.0",
    time: new Date().toISOString(),
    db: { status: dbStatus, wallpapers: wallpaperCount, categories: categoryCount },
    endpoints: [
      "GET  /api/health",
      "GET  /api/wallpapers?query=&category=&featured=&page=&limit=",
      "GET  /api/wallpapers/[id]",
      "GET  /api/categories",
      "GET  /api/featured",
      "POST /api/downloads",
      "GET  /api/rotation/[deviceId]",
      "PUT  /api/rotation/[deviceId]",
      "GET  /api/events  (SSE)",
    ],
  })
}
