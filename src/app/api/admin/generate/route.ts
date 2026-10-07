// Kiki admin — generate an HD wallpaper with the z-ai-web-dev-sdk image generator.
// The admin dashboard uses this to populate the catalog quickly. Returns the
// generated image URL — the admin can then save it as a wallpaper row.
import { NextRequest, NextResponse } from "next/server"
import ZAI from "z-ai-web-dev-sdk"
import { err, ok } from "@/lib/kiki"

export const dynamic = "force-dynamic"

const FALLBACK_URL =
  "https://images.unsplash.com/photo-1506905925346-21b8a3c9e024?w=1080&q=80"

export async function POST(req: NextRequest) {
  let body: { prompt?: string; size?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(err("bad_json", "Invalid JSON"), { status: 400 })
  }
  const prompt = (body.prompt ?? "").trim()
  if (prompt.length < 3) {
    return NextResponse.json(
      err("bad_request", "prompt (>=3 chars) is required"),
      { status: 400 },
    )
  }

  let imageUrl = FALLBACK_URL
  let usedFallback = true
  try {
    const zai = await ZAI.create()
    const result = await zai.images.generate({
      prompt: `HD phone wallpaper, vertical 9:16 portrait, ${prompt}, highly detailed, vibrant color grading, suitable as a phone lockscreen`,
      size: (body.size as "1024x1024" | "1024x1792" | "1792x1024") || "1024x1792",
    })
    // The SDK returns either base64 or a hosted URL depending on version.
    const data = (result as unknown as { data?: { url?: string; b64?: string; base64?: string } }).data
    if (data?.url) {
      imageUrl = data.url
      usedFallback = false
    } else if (data?.b64 || data?.base64) {
      // Return as a data URL so the dashboard can preview immediately.
      imageUrl = `data:image/png;base64,${data.b64 ?? data.base64}`
      usedFallback = false
    }
  } catch (e) {
    console.error("[kiki:generate] image gen failed, using fallback:", e)
  }

  return NextResponse.json(
    ok({
      imageUrl,
      prompt,
      usedFallback,
      note: usedFallback
        ? "Image generation service unavailable; returned an Unsplash fallback. Save it anyway and try again later."
        : "Generated successfully.",
    }),
  )
}
