// Kiki — per-device wallpaper rotation config.
// The RN app reads this to know which wallpapers to rotate through and at what interval,
// and writes back when the user edits the rotation tool in the app.
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { broadcast } from "@/lib/broadcaster"
import { err, isValidDeviceId, ok, withDbRetry } from "@/lib/kiki"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await params
  if (!isValidDeviceId(deviceId)) {
    return NextResponse.json(err("bad_request", "Invalid deviceId"), {
      status: 400,
    })
  }
  try {
    let config = await withDbRetry(() =>
      db.rotationConfig.findUnique({ where: { deviceId } }),
    )
    if (!config) {
      // Create an empty default so the RN app can show "no wallpapers selected yet"
      config = await withDbRetry(() =>
        db.rotationConfig.create({
          data: { deviceId, wallpaperIds: "[]", intervalSec: 60 },
        }),
      )
    }
    return NextResponse.json(
      ok({
        deviceId: config.deviceId,
        wallpaperIds: JSON.parse(config.wallpaperIds) as string[],
        intervalSec: config.intervalSec,
        activeFrom: config.activeFrom,
        activeTo: config.activeTo,
        shuffle: config.shuffle,
        lastSwapAt: config.lastSwapAt?.toISOString() ?? null,
        updatedAt: config.updatedAt.toISOString(),
      }),
    )
  } catch (e) {
    console.error("[kiki:rotation:get] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not reach the rotation database."),
      { status: 503 },
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await params
  if (!isValidDeviceId(deviceId)) {
    return NextResponse.json(err("bad_request", "Invalid deviceId"), {
      status: 400,
    })
  }
  let body: {
    wallpaperIds?: unknown
    intervalSec?: number
    activeFrom?: number
    activeTo?: number
    shuffle?: boolean
    lastSwapAt?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(err("bad_json", "Invalid JSON body"), {
      status: 400,
    })
  }

  // Coerce wallpaperIds safely
  let wallpaperIds: string[] = []
  if (Array.isArray(body.wallpaperIds)) {
    wallpaperIds = body.wallpaperIds
      .filter((w) => typeof w === "string" && w.length > 0)
      .slice(0, 8) // hard cap of 8 — see RN app design
  }

  const intervalSec = Math.min(
    86400,
    Math.max(1, Number(body.intervalSec ?? 60) || 60),
  )
  const activeFrom = Math.min(
    23,
    Math.max(0, Math.floor(Number(body.activeFrom ?? 0) || 0)),
  )
  const activeTo = Math.min(
    24,
    Math.max(0, Math.floor(Number(body.activeTo ?? 24) || 24)),
  )
  const shuffle = Boolean(body.shuffle ?? false)
  const lastSwapAt =
    typeof body.lastSwapAt === "string" &&
    !Number.isNaN(Date.parse(body.lastSwapAt))
      ? new Date(body.lastSwapAt)
      : undefined

  try {
    const config = await withDbRetry(() =>
      db.rotationConfig.upsert({
        where: { deviceId },
        update: {
          wallpaperIds: JSON.stringify(wallpaperIds),
          intervalSec,
          activeFrom,
          activeTo,
          shuffle,
          ...(lastSwapAt ? { lastSwapAt } : {}),
        },
        create: {
          deviceId,
          wallpaperIds: JSON.stringify(wallpaperIds),
          intervalSec,
          activeFrom,
          activeTo,
          shuffle,
          ...(lastSwapAt ? { lastSwapAt } : {}),
        },
      }),
    )

    broadcast({ type: "rotation.changed", deviceId, ts: Date.now() })

    return NextResponse.json(
      ok({
        deviceId: config.deviceId,
        wallpaperIds,
        intervalSec,
        activeFrom,
        activeTo,
        shuffle,
        lastSwapAt: config.lastSwapAt?.toISOString() ?? null,
        updatedAt: config.updatedAt.toISOString(),
      }),
    )
  } catch (e) {
    console.error("[kiki:rotation:put] error:", (e as Error)?.message)
    return NextResponse.json(
      err("db_unreachable", "Could not save rotation config. Please retry."),
      { status: 503 },
    )
  }
}
