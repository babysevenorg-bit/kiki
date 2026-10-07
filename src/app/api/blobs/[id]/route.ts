// Kiki — public binary blob serving. Cached aggressively because blobs are
// immutable (a new upload creates a new blob). The catalog API points
// wallpaper.imageUrl and thumbUrl at /api/blobs/[id], so the RN app and the
// admin dashboard can lazy-load the bytes only when actually rendering.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withDbRetry } from "@/lib/kiki"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const blob = await withDbRetry(() => db.blob.findUnique({ where: { id } }))
    if (!blob) {
      return new Response("not found", { status: 404 })
    }
    // 30 days immutable cache — blobs never change after creation
    return new Response(blob.data, {
      status: 200,
      headers: {
        "Content-Type": blob.mime,
        "Content-Length": String(blob.size),
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    })
  } catch (e) {
    console.error("[kiki:blob] error:", (e as Error)?.message)
    return NextResponse.json(
      { ok: false, error: "Could not fetch blob" },
      { status: 503 },
    )
  }
}
