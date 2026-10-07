// Kiki — user wallpaper upload. Auth required.
// Accepts a base64-encoded image (cap 4MB after decode), stores it as a
// Postgres bytea in the Blob table, and creates a Wallpaper row in status
// "pending". An admin must approve it (PATCH /api/admin/pending/[id]) before
// it appears in the public catalog (status "published" + active=true).
//
// Body: { title, category, imageDataUrl, tags?, resolution?, orientation? }
//   - imageDataUrl: a data URL like "data:image/jpeg;base64,...."
//   - tags: comma-separated string OR array
//   - resolution: "1080x1920" (default)
//   - orientation: "portrait" | "landscape" | "square" (default "portrait")
//
// Returns: { ok, data: { wallpaperId, status: "pending" } }
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { broadcast } from "@/lib/broadcaster"
import { err, ok, parseTags, withDbRetry } from "@/lib/kiki"
import { requireUser } from "@/lib/auth"

export const dynamic = "force-dynamic"

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB after base64 decode

const DATA_URL_RE = /^data:(image\/[a-z]+);base64,(.+)$/i

export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireUser()
  } catch {
    return NextResponse.json(
      err("unauthorized", "Sign in to upload a wallpaper"),
      { status: 401 },
    )
  }

  let body: {
    title?: string
    category?: string
    imageDataUrl?: string
    tags?: unknown
    resolution?: string
    orientation?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(err("bad_json", "Invalid JSON"), { status: 400 })
  }

  const title = (body.title ?? "").trim()
  const category = (body.category ?? "User Upload").trim() || "User Upload"
  if (!title) {
    return NextResponse.json(err("bad_request", "Title is required"), {
      status: 400,
    })
  }
  if (!body.imageDataUrl || typeof body.imageDataUrl !== "string") {
    return NextResponse.json(
      err("bad_request", "imageDataUrl (data URL) is required"),
      { status: 400 },
    )
  }

  const match = DATA_URL_RE.exec(body.imageDataUrl)
  if (!match) {
    return NextResponse.json(
      err("bad_request", "imageDataUrl must be a data:image/...;base64,... URL"),
      { status: 400 },
    )
  }
  const [, mime, b64] = match
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
    return NextResponse.json(
      err("bad_request", `Unsupported image type: ${mime}`),
      { status: 400 },
    )
  }

  const bytes = Buffer.from(b64, "base64")
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json(
      err("too_large", `Image must be under ${MAX_BYTES / 1024 / 1024}MB`),
      { status: 413 },
    )
  }

  try {
    // Store the bytes in the Blob table — the wallpaper's imageUrl will
    // point to /api/blobs/[id], so the catalog list stays small.
    const blob = await withDbRetry(() =>
      db.blob.create({
        data: {
          mime,
          size: bytes.length,
          data: bytes,
        },
      }),
    )

    const wallpaper = await withDbRetry(() =>
      db.wallpaper.create({
        data: {
          title,
          category,
          imageUrl: `/api/blobs/${blob.id}`,
          thumbUrl: `/api/blobs/${blob.id}`,
          tags: JSON.stringify(parseTags(body.tags)),
          resolution: body.resolution ?? "1080x1920",
          fileSizeKb: Math.ceil(bytes.length / 1024),
          orientation: body.orientation ?? "portrait",
          featured: false,
          active: false, // hidden until approved
          source: "user-upload",
          accentColor: "#0f172a",
          uploadedById: session.userId,
          status: "pending",
        },
      }),
    )

    broadcast({ type: "wallpaper.created", id: wallpaper.id, ts: Date.now() })

    return NextResponse.json(
      ok({
        wallpaperId: wallpaper.id,
        blobId: blob.id,
        status: "pending",
        message:
          "Upload received. It will appear in the public catalog once an admin approves it.",
      }),
    )
  } catch (e) {
    console.error("[kiki:uploads] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not save your upload. Please retry."),
      { status: 503 },
    )
  }
}
