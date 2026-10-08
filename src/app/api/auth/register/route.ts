// Kiki auth — register a new account.
// The FIRST user becomes admin automatically; later users get role="user".
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { err, ok, withDbRetry } from "@/lib/kiki"
import {
  assignRoleForNewUser,
  hashPassword,
  setSessionCookie,
  signToken,
} from "@/lib/auth"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; displayName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(err("bad_json", "Invalid JSON"), { status: 400 })
  }

  const email = (body.email ?? "").trim().toLowerCase()
  const password = body.password ?? ""
  const displayName = (body.displayName ?? "").trim() || null

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(err("bad_email", "A valid email is required"), {
      status: 400,
    })
  }
  if (password.length < 8) {
    return NextResponse.json(
      err("weak_password", "Password must be at least 8 characters"),
      { status: 400 },
    )
  }

  try {
    const existing = await withDbRetry(() =>
      db.user.findUnique({ where: { email } }),
    )
    if (existing) {
      return NextResponse.json(
        err("email_taken", "An account with this email already exists"),
        { status: 409 },
      )
    }

    const passwordHash = await hashPassword(password)
    const role = await assignRoleForNewUser()
    const user = await withDbRetry(() =>
      db.user.create({
        data: {
          email,
          passwordHash,
          role,
          displayName: displayName ?? email.split("@")[0],
        },
      }),
    )

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
    console.error("[kiki:register] error:", (e as Error)?.message)
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
      err("db_unreachable", "Could not create account. Please retry."),
      { status: 503 },
    )
  }
}
