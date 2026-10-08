// Helpers shared across Kiki API routes.

export const PAGE_SIZE_DEFAULT = 24
export const PAGE_SIZE_MAX = 96

export type ApiOk<T> = { ok: true; data: T }
export type ApiErr = { ok: false; error: string; code?: string }
export type ApiResult<T> = ApiOk<T> | ApiErr

export function ok<T>(data: T): ApiOk<T> {
  return { ok: true, data }
}

export function err(error: string, code?: string): ApiErr {
  return { ok: false, error, code }
}

/**
 * Wrap a Prisma promise so transient DB connection failures are retried
 * once. Neon's free tier scales compute to zero after 5 min of inactivity,
 * so the FIRST request after idle can fail with a connection timeout —
 * a short retry with backoff turns that into a successful request.
 *
 * This only retries on connection-class errors. Data errors (unique
 * constraint, not found, etc.) are returned to the caller untouched.
 */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e)
    // Match Prisma's connection-error signatures from pg + Neon
    const isTransient = /Timed out|Connection terminated|Can't reach database server|Connection refused|read ETIMEDOUT|ECONNRESET|socket hang up/i.test(
      msg,
    )
    if (!isTransient) throw e
    // Wait 600ms then retry once. Neon cold-start usually takes <300ms.
    await new Promise((r) => setTimeout(r, 600))
    return await fn()
  }
}

export function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0)
      .slice(0, 20)
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parseTags(parsed)
      if (typeof parsed === "string") return parseTags(parsed.split(","))
    } catch {
      // fallthrough to comma split
    }
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20)
  }
  return []
}

// Headers that let the React Native / browser client cache wallpapers safely.
export function cacheHeaders(maxAgeSeconds = 60): HeadersInit {
  return {
    "Cache-Control": `public, max-age=${maxAgeSeconds}, stale-while-revalidate=300`,
  }
}

// Device ids are client-generated on the RN side; we just need a sane length.
export function isValidDeviceId(id: unknown): id is string {
  return typeof id === "string" && id.length >= 8 && id.length <= 128
}

// Strip a Prisma wallpaper row into the shape the RN app expects.
export function toPublicWallpaper(row: {
  id: string
  title: string
  imageUrl: string
  thumbUrl: string
  category: string
  tags: string
  resolution: string
  fileSizeKb: number
  orientation: string
  featured: boolean
  active: boolean
  downloads: number
  source: string
  accentColor: string
  createdAt: Date
  updatedAt: Date
  status?: string
  uploadedById?: string | null
}) {
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.imageUrl,
    thumbUrl: row.thumbUrl,
    category: row.category,
    tags: parseTags(row.tags),
    resolution: row.resolution,
    fileSizeKb: row.fileSizeKb,
    orientation: row.orientation,
    featured: row.featured,
    downloads: row.downloads,
    source: row.source,
    accentColor: row.accentColor,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: row.status ?? "published",
    uploadedById: row.uploadedById ?? null,
  }
}
