// Kiki — record a download event and bump the wallpaper's total count.
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { broadcast } from "@/lib/broadcaster"
import { err, isValidDeviceId, ok } from "@/lib/kiki"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let body: { wallpaperId?: string; deviceId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(err("bad_json", "Invalid JSON body"), {
      status: 400,
    })
  }
  const { wallpaperId, deviceId } = body
  if (!wallpaperId || !isValidDeviceId(deviceId)) {
    return NextResponse.json(
      err("bad_request", "wallpaperId and deviceId (>=8 chars) are required"),
      { status: 400 },
    )
  }

  const wallpaper = await db.wallpaper.findUnique({ where: { id: wallpaperId } })
  if (!wallpaper || !wallpaper.active) {
    return NextResponse.json(err("not_found", "Wallpaper not found"), {
      status: 404,
    })
  }

  const event = await db.downloadEvent.create({
    data: {
      wallpaperId,
      deviceId: deviceId as string,
    },
  })
  const updated = await db.wallpaper.update({
    where: { id: wallpaperId },
    data: { downloads: { increment: 1 } },
  })

  broadcast({
    type: "download.counted",
    id: wallpaperId,
    total: updated.downloads,
    ts: Date.now(),
  })

  return NextResponse.json(
    ok({
      eventId: event.id,
      wallpaperId,
      totalDownloads: updated.downloads,
    }),
  )
}
