// Kiki auth — login. Validates credentials and sets the session cookie.
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { err, ok, withDbRetry } from "@/lib/kiki"
import {
  setSessionCookie,
  signToken,
  verifyPassword,
} from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(err("bad_json", "Invalid JSON"), { status: 400 })
  }

  const email = (body.email ?? "").trim().toLowerCase()
  const password = body.password ?? ""
  if (!email || !password) {
    return NextResponse.json(
      err("bad_request", "Email and password are required"),
      { status: 400 },
    )
  }

  try {
    const user = await withDbRetry(() =>
      db.user.findUnique({ where: { email } }),
    )
    // Same error message for "no such user" and "wrong password" so an
    // attacker can't probe which emails are registered.
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        err("bad_credentials", "Invalid email or password"),
        { status: 401 },
      )
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role as "user" | "admin",
      displayName: user.displayName ?? null,
    })
    await setSessionCookie(token)

    return NextResponse.json(
      ok({
        userId: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
      }),
    )
  } catch (e) {
    console.error("[kiki:login] error:", (e as Error)?.message)
    // Detect the specific "JWT secret missing" error so we can tell the user
    // exactly what to fix instead of the generic "db unreachable" message.
    if ((e as Error & { code?: string }).code === "jwt_secret_missing") {
      return NextResponse.json(
        err(
          "jwt_secret_missing",
          "KIKI_JWT_SECRET is not set on Vercel. Add it: Settings → Environment Variables → name=KIKI_JWT_SECRET, value=`openssl rand -hex 32`, tick all environments, save, redeploy.",
        ),
        { status: 500 },
      )
    }
    return NextResponse.json(
      err("db_unreachable", "Could not sign in. Please retry."),
      { status: 503 },
    )
  }
}
