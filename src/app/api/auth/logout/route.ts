// Kiki auth — logout. Clears the session cookie.
import { NextResponse } from "next/server"
import { ok } from "@/lib/kiki"
import { clearSessionCookie } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST() {
  await clearSessionCookie()
  return NextResponse.json(ok({ loggedOut: true }))
}
