// Kiki auth helpers — bcryptjs for password hashing, jose for JWT.
// Both are pure-JS so they work on Vercel serverless without native binaries.
import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { withDbRetry } from "@/lib/kiki"

const COOKIE_NAME = "kiki_session"
const SESSION_DAYS = 7

export type SessionUser = {
  userId: string
  email: string
  role: "user" | "admin"
  displayName: string | null
}

function getSecret(): Uint8Array {
  const s = process.env.KIKI_JWT_SECRET
  if (!s || s.length < 16) {
    // Dev fallback — never used in prod where KIKI_JWT_SECRET must be set
    if (process.env.NODE_ENV === "production") {
      const err = new Error("KIKI_JWT_SECRET must be set in production. Add it on Vercel: Settings → Environment Variables → name=KIKI_JWT_SECRET, value=`openssl rand -hex 32` (32 hex chars), tick all environments, save, redeploy.") as Error & { code?: string }
      err.code = "jwt_secret_missing"
      throw err
    }
    console.warn("[kiki:auth] KIKI_JWT_SECRET not set — using dev fallback. Set it before deploying.")
    return new TextEncoder().encode("kiki-dev-secret-DO-NOT-USE-IN-PROD-change-me")
  }
  return new TextEncoder().encode(s)
}

export async function hashPassword(pw: string): Promise<string> {
  // 10 rounds = ~80ms on modern hardware. Good enough for an MVP.
  return bcrypt.hash(pw, 10)
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(pw, hash)
  } catch {
    return false
  }
}

export async function signToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    })
    return {
      userId: String(payload.userId ?? ""),
      email: String(payload.email ?? ""),
      role: (payload.role as "user" | "admin") ?? "user",
      displayName: (payload.displayName as string | null) ?? null,
    }
  } catch {
    return null
  }
}

/** Read the current session from the cookie. Returns null if not signed in. */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

/** Throw a 401-shaped error if no session. Returns the user otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const s = await getSession()
  if (!s) {
    const err = new Error("unauthorized") as Error & { status?: number }
    err.status = 401
    throw err
  }
  return s
}

/** Throw a 403-shaped error if the user isn't an admin. Returns the user otherwise. */
export async function requireAdmin(): Promise<SessionUser> {
  const s = await requireUser()
  if (s.role !== "admin") {
    const err = new Error("forbidden") as Error & { status?: number }
    err.status = 403
    throw err
  }
  return s
}

/** Set the session cookie on the response (httpOnly, secure in prod, lax sameSite). */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

/** Clear the session cookie. */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

/**
 * The FIRST user to register becomes the admin. Subsequent users get
 * role="user" — they can upload wallpapers but those go through admin
 * approval before they appear in the RN app catalog.
 */
export async function assignRoleForNewUser(): Promise<"user" | "admin"> {
  const count = await withDbRetry(() => db.user.count())
  return count === 0 ? "admin" : "user"
}

export const AUTH_COOKIE_NAME = COOKIE_NAME
