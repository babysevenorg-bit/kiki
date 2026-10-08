// Kiki auth — get the current session. Returns 200 with user info if signed in,
// 200 with null if not (so the dashboard can check without an error).
import { NextResponse } from "next/server"
import { ok } from "@/lib/kiki"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json(ok({ user: null }))
  }
  return NextResponse.json(ok({ user: session }))
}
