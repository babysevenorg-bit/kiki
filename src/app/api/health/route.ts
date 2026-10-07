// Kiki backend — health check + fingerprint endpoint.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withDbRetry } from "@/lib/kiki"

export const dynamic = "force-dynamic"

export async function GET() {
  let dbStatus: "ok" | "fail" = "fail"
  let wallpaperCount = 0
  let categoryCount = 0
  try {
    const [w, c] = await withDbRetry(() =>
      Promise.all([db.wallpaper.count(), db.category.count()]),
    )
    wallpaperCount = w
    categoryCount = c
    dbStatus = "ok"
  } catch (e) {
    console.error("[kiki:health] db error:", (e as Error)?.message)
    // surfaced in the response
  }

  return NextResponse.json({
    ok: true,
    service: "kiki-backend",
    version: "1.0.0",
    time: new Date().toISOString(),
    db: {
      status: dbStatus,
      provider: "postgresql",
      // Hint so the dashboard shows whether we hit Neon
      host: process.env.DATABASE_URL
        ? new URL(process.env.DATABASE_URL.replace(/^postgresql:/, "http:")).host
        : "(unset)",
      wallpapers: wallpaperCount,
      categories: categoryCount,
    },
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
