// Kiki backend — DEBUG endpoint. Returns env var presence + Prisma client status +
// a live DB connection test. Used to diagnose 503 issues on Vercel.
//
// This endpoint NEVER leaks credentials — it only shows:
//   - whether each env var is set (true/false)
//   - the URL prefix + host (masked)
//   - whether Prisma Client can be imported
//   - whether a simple count() query succeeds
//
// Use this after a Vercel deploy to figure out why API routes return 503.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Mask a connection string: keep protocol + host, hide user + password.
function maskUrl(s: string | undefined): string {
  if (!s) return "(unset)"
  try {
    // URL parsing doesn't work for postgresql:// URLs in some Node versions,
    // so do it manually.
    const m = /^([a-z]+:\/\/)([^:@]+)(:[^@]+)?@([^/]+)\/(.+)$/.exec(s)
    if (m) return `${m[1]}${m[2]}:***@${m[4]}/${m[5].split("?")[0]}${m[5].includes("?") ? "?" + m[5].split("?")[1].slice(0, 60) + "..." : ""}`
    return s.slice(0, 30) + "..."
  } catch {
    return "(unparseable)"
  }
}

export async function GET() {
  // Check env var presence
  const env = {
    NODE_ENV: process.env.NODE_ENV ?? "(unset)",
    DATABASE_URL_set: !!process.env.DATABASE_URL,
    DATABASE_URL_preview: maskUrl(process.env.DATABASE_URL),
    DATABASE_URL_UNPOOLED_set: !!process.env.DATABASE_URL_UNPOOLED,
    DATABASE_URL_UNPOOLED_preview: maskUrl(process.env.DATABASE_URL_UNPOOLED),
    KIKI_JWT_SECRET_set: !!process.env.KIKI_JWT_SECRET,
    KIKI_JWT_SECRET_length: process.env.KIKI_JWT_SECRET?.length ?? 0,
    // Common Vercel auto-set vars
    VERCEL_ENV: process.env.VERCEL_ENV ?? "(unset)",
    VERCEL_URL: process.env.VERCEL_URL ? "(set)" : "(unset)",
  }

  // Check Prisma Client can be imported + queried
  let prismaStatus: "ok" | "import_fail" | "query_fail" | "ok" = "ok"
  let prismaError: string | null = null
  let testCount = 0

  try {
    // The import itself might fail if @prisma/client wasn't generated
    try {
      // Just calling db.$connect would also work, but count() does both.
      testCount = await db.user.count()
    } catch (e) {
      prismaStatus = "query_fail"
      prismaError = (e as Error)?.message ?? String(e)
    }
  } catch (e) {
    prismaStatus = "import_fail"
    prismaError = (e as Error)?.message ?? String(e)
  }

  // Diagnosis: tell the user what's wrong + how to fix
  const diagnosis: string[] = []
  if (!env.DATABASE_URL_set) {
    diagnosis.push("❌ DATABASE_URL is not set on Vercel. Add it in Project → Settings → Environment Variables.")
  }
  if (env.DATABASE_URL_set && !env.DATABASE_URL_preview.includes("pgbouncer=true")) {
    diagnosis.push("⚠️ DATABASE_URL is set but is missing &pgbouncer=true. Append it to your Neon pooled URL or you'll get 'prepared statement does not exist' errors.")
  }
  if (!env.DATABASE_URL_UNPOOLED_set) {
    diagnosis.push("⚠️ DATABASE_URL_UNPOOLED is not set. Required for prisma migrate/db:push on Vercel.")
  }
  if (env.NODE_ENV === "production" && !env.KIKI_JWT_SECRET_set) {
    diagnosis.push("❌ KIKI_JWT_SECRET is not set. Required for auth (register/login) in production. Generate with: openssl rand -hex 32")
  }
  if (env.KIKI_JWT_SECRET_set && env.KIKI_JWT_SECRET_length < 16) {
    diagnosis.push("⚠️ KIKI_JWT_SECRET is too short (< 16 chars). Use at least 32 chars (openssl rand -hex 32).")
  }
  if (prismaStatus === "import_fail") {
    diagnosis.push("❌ Prisma Client could not be imported. The `postinstall: prisma generate` script likely failed during Vercel build. Check the build log.")
  }
  if (prismaStatus === "query_fail") {
    diagnosis.push(`❌ Prisma query failed: ${prismaError?.slice(0, 200)}`)
  }
  if (diagnosis.length === 0) {
    diagnosis.push("✅ Everything looks configured. If you're still seeing 503s, they may be transient — try again in 30s (Neon free tier cold-start).")
  }

  return NextResponse.json(
    {
      ok: true,
      time: new Date().toISOString(),
      env,
      prisma: {
        status: prismaStatus,
        error: prismaError?.slice(0, 500) ?? null,
        userCount: testCount,
      },
      diagnosis,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  )
}
