"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Activity,
  Box,
  Cloud,
  Database,
  Download,
  Heart,
  ImagePlus,
  LayoutGrid,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Star,
  StarOff,
  Trash2,
  Upload,
  User as UserIcon,
  Wifi,
  X,
} from "lucide-react"

import { AuthModal, type SessionUser } from "@/components/kiki/auth-modal"
import { UploadModal } from "@/components/kiki/upload-modal"
import { PendingTab } from "@/components/kiki/pending-tab"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"

// ---------- Types ----------
type PublicWallpaper = {
  id: string
  title: string
  imageUrl: string
  thumbUrl: string
  category: string
  tags: string[]
  resolution: string
  fileSizeKb: number
  orientation: string
  featured: boolean
  downloads: number
  source: string
  accentColor: string
  createdAt: string
  updatedAt: string
  status?: string
  uploadedById?: string | null
}

type ApiListResponse<T> = { ok: true; data: T } | { ok: false; error: string }

// ---------- Helpers ----------
async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  // Retry on 503 (transient Neon cold-start / connection failures).
  // The API route already retries server-side once; this is the second
  // line of defense for when even the server-side retry wasn't enough.
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      })
      // Retry on 503 — server says "DB unreachable, try again"
      if (res.status === 503 && attempt < 2) {
        // Exponential backoff: 800ms, 1600ms
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
        continue
      }
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<T>
      if (!res.ok || !("ok" in json) || !json.ok) {
        const msg = "ok" in json && !json.ok ? json.error : `HTTP ${res.status}`
        throw new Error(msg)
      }
      return json.data
    } catch (e) {
      lastErr = e
      // Network failure — retry with backoff too
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
        continue
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Network error")
}

function formatBytes(kb: number) {
  if (!kb) return "—"
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ---------- Page ----------
export default function Page() {
  const [wallpapers, setWallpapers] = useState<PublicWallpaper[]>([])
  const [categories, setCategories] = useState<
    { id: string; name: string; slug: string; icon: string; accent: string; count: number }[]
  >([])
  const [stats, setStats] = useState<{
    total: number
    featured: number
    downloads: number
    today: number
  }>({ total: 0, featured: 0, downloads: 0, today: 0 })

  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sort, setSort] = useState<"recent" | "trending" | "downloads">("recent")
  const [editing, setEditing] = useState<PublicWallpaper | null>(null)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sseConnected, setSseConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<string>("—")

  // Auth + upload state
  const [user, setUser] = useState<SessionUser | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [myUploads, setMyUploads] = useState<PublicWallpaper[]>([])
  const [myUploadsLoading, setMyUploadsLoading] = useState(false)
  const [pendingSignal, setPendingSignal] = useState(0)
  const isAdmin = user?.role === "admin"

  // Fetch session on mount
  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ user: SessionUser | null }>("/api/auth/me")
        if (data.user) setUser(data.user)
      } catch {
        // ignore — user just stays unsigned-in
      }
    })()
  }, [])

  // Fetch user's own uploads whenever they sign in
  const refreshMyUploads = useCallback(async () => {
    if (!user) {
      setMyUploads([])
      return
    }
    setMyUploadsLoading(true)
    try {
      const data = await apiFetch<{ items: PublicWallpaper[] }>(
        "/api/users/me/uploads",
      )
      setMyUploads(data.items)
    } catch (e) {
      // silent — likely just not signed in
    } finally {
      setMyUploadsLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refreshMyUploads()
  }, [refreshMyUploads])

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
      setMyUploads([])
      toast.success("Signed out")
    } catch (e) {
      toast.error(`Sign out failed: ${(e as Error).message}`)
    }
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set("query", query)
      if (categoryFilter !== "all") params.set("category", categoryFilter)
      params.set("sort", sort)
      params.set("limit", "96")
      const [list, cats, feat] = await Promise.all([
        apiFetch<{ items: PublicWallpaper[]; total: number }>(
          `/api/wallpapers?${params.toString()}`,
        ),
        apiFetch<{
          items: { id: string; name: string; slug: string; icon: string; accent: string; count: number }[]
        }>("/api/categories"),
        apiFetch<{ items: PublicWallpaper[] }>("/api/featured"),
      ])
      setWallpapers(list.items)
      setCategories(cats.items)
      const totalDownloads = list.items.reduce((s, w) => s + w.downloads, 0)
      const today = list.items.filter(
        (w) => Date.now() - new Date(w.updatedAt).getTime() < 86_400_000,
      ).length
      setStats({
        total: list.total,
        featured: feat.items.length,
        downloads: totalDownloads,
        today,
      })
    } catch (e) {
      toast.error(`Failed to load catalog: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [query, categoryFilter, sort])

  // Initial load
  useEffect(() => {
    void refresh()
  }, [refresh])

  // SSE subscription — refresh when catalog changes from anywhere
  useEffect(() => {
    const es = new EventSource("/api/events")
    es.addEventListener("open", () => {
      setSseConnected(true)
    })
    es.addEventListener("hello", (e) => {
      setSseConnected(true)
      setLastEvent(`hello @ ${new Date().toLocaleTimeString()}`)
    })
    es.addEventListener("wallpaper.created", (e) => {
      setLastEvent(`created @ ${new Date().toLocaleTimeString()}`)
      void refresh()
    })
    es.addEventListener("wallpaper.updated", (e) => {
      setLastEvent(`updated @ ${new Date().toLocaleTimeString()}`)
      void refresh()
    })
    es.addEventListener("wallpaper.deleted", (e) => {
      setLastEvent(`deleted @ ${new Date().toLocaleTimeString()}`)
      void refresh()
    })
    es.addEventListener("download.counted", (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setLastEvent(`download #${data.total} @ ${new Date().toLocaleTimeString()}`)
      setWallpapers((prev) =>
        prev.map((w) =>
          w.id === data.id ? { ...w, downloads: data.total } : w,
        ),
      )
    })
    es.addEventListener("category.changed", () => {
      setLastEvent(`category @ ${new Date().toLocaleTimeString()}`)
      void refresh()
    })
    es.onerror = () => {
      setSseConnected(false)
    }
    return () => es.close()
  }, [refresh])

  const handleToggleFeatured = useCallback(
    async (w: PublicWallpaper) => {
      // Optimistic update
      setWallpapers((prev) =>
        prev.map((x) => (x.id === w.id ? { ...x, featured: !x.featured } : x)),
      )
      try {
        await apiFetch(`/api/admin/wallpapers`, {
          method: "PATCH",
          body: JSON.stringify({ id: w.id, featured: !w.featured }),
        })
        toast.success(`${w.title} ${w.featured ? "unfeatured" : "featured"}`)
      } catch (e) {
        toast.error(`Update failed: ${(e as Error).message}`)
        void refresh()
      }
    },
    [refresh],
  )

  const handleDelete = useCallback(
    async (w: PublicWallpaper) => {
      if (!confirm(`Delete "${w.title}"? This cannot be undone.`)) return
      try {
        await fetch(`/api/wallpapers/${w.id}`, { method: "DELETE" })
        toast.success(`${w.title} deleted`)
        void refresh()
      } catch (e) {
        toast.error(`Delete failed: ${(e as Error).message}`)
      }
    },
    [refresh],
  )

  // Live "online" indicator pill
  const livePill = (
    <div className="flex items-center gap-2">
      <span
        className={`relative flex h-2.5 w-2.5 ${sseConnected ? "" : "opacity-50"}`}
      >
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-70 ${
            sseConnected ? "bg-emerald-500 animate-ping" : "bg-zinc-400"
          }`}
        />
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            sseConnected ? "bg-emerald-500" : "bg-zinc-400"
          }`}
        />
      </span>
      <span className="text-xs text-muted-foreground">
        {sseConnected ? "Live stream" : "Disconnected"}
      </span>
      <span className="hidden sm:inline text-xs text-muted-foreground">
        · {lastEvent}
      </span>
    </div>
  )

  const statsCards = (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Box className="h-4 w-4" />}
        label="Total wallpapers"
        value={stats.total}
        sub={`${stats.today} added today`}
      />
      <StatCard
        icon={<Star className="h-4 w-4" />}
        label="Featured"
        value={stats.featured}
        sub="Shown on home hero"
      />
      <StatCard
        icon={<Download className="h-4 w-4" />}
        label="Total downloads"
        value={stats.downloads}
        sub="All-time count"
      />
      <StatCard
        icon={<LayoutGrid className="h-4 w-4" />}
        label="Categories"
        value={categories.length}
        sub="Active chips in RN app"
      />
    </div>
  )

  const filterBar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, tag, or category..."
          className="pl-9 h-10"
          onKeyDown={(e) => {
            if (e.key === "Enter") void refresh()
          }}
        />
      </div>
      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className="h-10 w-full sm:w-48">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.name}>
              {c.icon} {c.name} ({c.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
        <SelectTrigger className="h-10 w-full sm:w-40">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Most recent</SelectItem>
          <SelectItem value="trending">Trending</SelectItem>
          <SelectItem value="downloads">Most downloaded</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={() => void refresh()} className="h-10">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
      {user && (
        <Button
          variant="outline"
          onClick={() => setUploadOpen(true)}
          className="h-10"
          title="Upload your own wallpaper"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Upload</span>
        </Button>
      )}
      <Button
        variant="default"
        onClick={() => setCreating(true)}
        className="h-10 kiki-gradient text-white hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Add wallpaper</span>
      </Button>
    </div>
  )

  const wallpaperGrid = (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
      {wallpapers.map((w) => (
        <Card
          key={w.id}
          className="group overflow-hidden border-border/70 hover:border-primary/40 hover:shadow-lg transition-all p-0 gap-0"
        >
          <div className="relative aspect-[9/16] overflow-hidden bg-muted">
            { }
            <img
              src={w.thumbUrl}
              alt={w.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            {/* Top gradient + featured star */}
            <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/40 to-transparent" />
            <button
              onClick={() => handleToggleFeatured(w)}
              className={`absolute top-2 right-2 h-8 w-8 rounded-full grid place-items-center backdrop-blur-md transition ${
                w.featured
                  ? "bg-amber-400/90 text-black"
                  : "bg-black/40 text-white hover:bg-black/60"
              }`}
              aria-label={w.featured ? "Unfeature" : "Feature"}
              title={w.featured ? "Featured" : "Mark as featured"}
            >
              <Star className="h-4 w-4" fill={w.featured ? "currentColor" : "none"} />
            </button>
            {/* Bottom gradient + title overlay */}
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <div className="text-white text-xs font-semibold line-clamp-1">{w.title}</div>
              <div className="text-white/70 text-[10px] flex items-center gap-1">
                <span className="truncate">{w.category}</span>
                <span>·</span>
                <span>{w.resolution}</span>
              </div>
            </div>
          </div>
          <div className="p-2 flex items-center justify-between gap-1.5 bg-card">
            <Badge variant="secondary" className="text-[10px] py-0.5 px-1.5 font-medium">
              <Download className="h-3 w-3 mr-1" />
              {w.downloads}
            </Badge>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setEditing(w)}
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 hover:text-destructive"
                onClick={() => handleDelete(w)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )

  const emptyState = (
    <div className="grid place-items-center py-20 text-center">
      <div className="kiki-gradient h-14 w-14 rounded-2xl grid place-items-center mb-4">
        <ImagePlus className="h-7 w-7 text-white" />
      </div>
      <p className="text-lg font-semibold">No wallpapers match your filters</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md">
        Try a different search, or add a new wallpaper to the catalog.
      </p>
      <Button
        onClick={() => setCreating(true)}
        className="kiki-gradient text-white hover:opacity-90"
      >
        <Plus className="h-4 w-4 mr-1" />
        Add wallpaper
      </Button>
    </div>
  )

  const apiDocs = (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Cloud className="h-4 w-4 text-primary" />
          API contract for the React Native app
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ApiRow
          method="GET"
          path="/api/wallpapers"
          desc="List wallpapers. Params: query, category, featured=1, sort=recent|trending|downloads, page, limit"
        />
        <ApiRow method="GET" path="/api/wallpapers/[id]" desc="Single wallpaper detail" />
        <ApiRow method="DELETE" path="/api/wallpapers/[id]" desc="Delete a wallpaper (admin)" />
        <ApiRow method="GET" path="/api/categories" desc="Active categories for chip rail" />
        <ApiRow method="GET" path="/api/featured" desc="Featured rail for home hero banner" />
        <ApiRow method="POST" path="/api/downloads" desc="Record a download event. Body: { wallpaperId, deviceId }" />
        <ApiRow
          method="GET"
          path="/api/rotation/[deviceId]"
          desc="Get the per-device rotation config (creates default on first read)"
        />
        <ApiRow
          method="PUT"
          path="/api/rotation/[deviceId]"
          desc="Update rotation. Body: { wallpaperIds[], intervalSec, activeFrom, activeTo, shuffle }"
        />
        <ApiRow method="GET" path="/api/events" desc="SSE stream: wallpaper.created/updated/deleted, download.counted, category.changed, rotation.changed" />
        <ApiRow method="GET" path="/api/health" desc="Health check + endpoint fingerprint" />
      </CardContent>
    </Card>
  )

  const deployCard = (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          Deploy to Vercel + Neon
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-3">
        <p className="text-muted-foreground">
          The dev database is SQLite. For production, switch to Neon Postgres.
        </p>
        <ol className="space-y-2 list-decimal pl-5 text-sm">
          <li>
            Create a project at <span className="font-mono text-primary">neon.tech</span> and copy the connection string.
          </li>
          <li>
            In <span className="font-mono text-primary">prisma/schema.prisma</span>, change <span className="font-mono">provider = "sqlite"</span> to <span className="font-mono">"postgresql"</span>.
          </li>
          <li>
            Push the project to GitHub, then import it on <span className="font-mono text-primary">vercel.com</span>.
          </li>
          <li>
            Add an env var <span className="font-mono">DATABASE_URL</span> = your Neon string, and <span className="font-mono">DATABASE_URL_UNPOOLED</span> for migrations.
          </li>
          <li>
            Run <span className="font-mono">bun run db:push</span> once against Neon to create tables.
          </li>
        </ol>
        <Separator />
        <p className="text-xs text-muted-foreground">
          For real-time SSE on Vercel, replace <span className="font-mono">src/lib/broadcaster.ts</span> with an Upstash Redis pubsub so events fan out across serverless instances.
        </p>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Toaster richColors position="top-right" />
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="kiki-gradient h-9 w-9 rounded-xl grid place-items-center shadow-md">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight">
                Kiki <span className="kiki-text-gradient">Backend</span>
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground -mt-0.5">
                A little corner for your phone · wallpaper catalog API
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              className="h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            {user ? (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2"
                  title={user.email}
                >
                  <div className="h-6 w-6 rounded-full kiki-gradient grid place-items-center">
                    <UserIcon className="h-3 w-3 text-white" />
                  </div>
                  <span className="max-w-[120px] truncate text-xs">
                    {user.displayName ?? user.email}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="h-8"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setAuthOpen(true)}
                className="h-8 kiki-gradient text-white hover:opacity-90"
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span>Sign in</span>
              </Button>
            )}
          </div>
          {livePill}
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero */}
        <section className="rounded-3xl kiki-gradient text-white p-6 sm:p-8 kiki-shadow relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" aria-hidden>
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
          </div>
          <div className="relative">
            <Badge className="bg-white/20 text-white border-0 hover:bg-white/20 mb-3">
              <Sparkles className="h-3 w-3 mr-1" />
              Backend v1.0
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              The catalog server behind the Kiki React Native app
            </h2>
            <p className="text-white/80 mt-2 max-w-2xl text-sm sm:text-base">
              Manage HD wallpapers, downloads, rotation configs, and AI-generated
              lockscreen art. Real-time updates stream to the mobile app via SSE so
              the catalog is always fresh — online or offline.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 text-xs">
              <Pill icon={<Database className="h-3 w-3" />}>Neon-ready schema</Pill>
              <Pill icon={<Cloud className="h-3 w-3" />}>Vercel-ready API</Pill>
              <Pill icon={<Wifi className="h-3 w-3" />}>Real-time SSE</Pill>
              <Pill icon={<Heart className="h-3 w-3" />}>Offline-capable RN</Pill>
            </div>
          </div>
        </section>

        {statsCards}

        <Tabs defaultValue="catalog" className="w-full">
          <TabsList className={`grid w-full ${user ? (isAdmin ? "grid-cols-4 sm:max-w-2xl" : "grid-cols-3 sm:max-w-lg") : "grid-cols-2 sm:max-w-md"}`}>
            <TabsTrigger value="catalog" className="text-xs sm:text-sm">
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
              Catalog
            </TabsTrigger>
            {user && (
              <TabsTrigger value="my-uploads" className="text-xs sm:text-sm">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                My Uploads
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="pending" className="text-xs sm:text-sm">
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Pending
              </TabsTrigger>
            )}
            <TabsTrigger value="settings" className="text-xs sm:text-sm">
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="mt-4 space-y-4">
            {filterBar}
            <div className="kiki-scroll max-h-[calc(100vh-22rem)] overflow-y-auto pr-1 -mr-1 pb-2">
              {loading && wallpapers.length === 0 ? (
                <div className="grid place-items-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : wallpapers.length === 0 ? (
                emptyState
              ) : (
                wallpaperGrid
              )}
            </div>
          </TabsContent>

          {user && (
            <TabsContent value="my-uploads" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Your uploads</h3>
                  <p className="text-sm text-muted-foreground">
                    Wallpapers you've submitted. Pending ones are awaiting
                    admin approval.
                  </p>
                </div>
                <Button
                  onClick={() => setUploadOpen(true)}
                  className="kiki-gradient text-white hover:opacity-90"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload new
                </Button>
              </div>
              {myUploadsLoading ? (
                <div className="grid place-items-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : myUploads.length === 0 ? (
                <div className="grid place-items-center py-20 text-center">
                  <div className="kiki-gradient h-14 w-14 rounded-2xl grid place-items-center mb-4">
                    <ImagePlus className="h-7 w-7 text-white" />
                  </div>
                  <p className="text-lg font-semibold">No uploads yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md">
                    Click "Upload new" to share your first wallpaper with the
                    Kiki community.
                  </p>
                  <Button
                    onClick={() => setUploadOpen(true)}
                    className="kiki-gradient text-white hover:opacity-90"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload your first wallpaper
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {myUploads.map((w) => (
                    <Card
                      key={w.id}
                      className="group overflow-hidden border-border/70 p-0 gap-0"
                    >
                      <div className="relative aspect-[9/16] overflow-hidden bg-muted">
                        { }
                        <img
                          src={w.thumbUrl}
                          alt={w.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 top-0 p-2 flex items-start justify-between">
                          {w.status === "pending" && (
                            <Badge className="bg-amber-500/90 text-white border-0">
                              Pending
                            </Badge>
                          )}
                          {w.status === "published" && (
                            <Badge className="bg-emerald-500/90 text-white border-0">
                              Published
                            </Badge>
                          )}
                          {w.status === "rejected" && (
                            <Badge className="bg-rose-500/90 text-white border-0">
                              Rejected
                            </Badge>
                          )}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                          <div className="text-white text-xs font-semibold line-clamp-1">
                            {w.title}
                          </div>
                          <div className="text-white/70 text-[10px]">
                            {w.category}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="pending" className="mt-4 space-y-4">
              <PendingTab refreshSignal={pendingSignal} />
            </TabsContent>
          )}

          <TabsContent value="settings" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {apiDocs}
              {deployCard}
            </div>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Generate a wallpaper with AI
                </CardTitle>
              </CardHeader>
              <GeneratePanel
                busy={generating}
                onBusyChange={setGenerating}
                onSaved={() => {
                  void refresh()
                  setPendingSignal((s) => s + 1)
                }}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Sticky footer */}
      <footer className="border-t border-border bg-card/50 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Kiki</span>
            <span>·</span>
            <span>Next.js 16 + Prisma + Neon-ready</span>
          </div>
          <div className="flex items-center gap-2">
            <span>SSE: {sseConnected ? "live" : "off"}</span>
            <span>·</span>
            <span>{stats.total} wallpapers</span>
            <span>·</span>
            <span>{categories.length} categories</span>
          </div>
        </div>
      </footer>

      {/* Editors */}
      <WallpaperSheet
        open={!!editing}
        wallpaper={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          void refresh()
        }}
      />
      <WallpaperSheet
        open={creating}
        wallpaper={null}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false)
          void refresh()
        }}
      />

      {/* Auth + Upload modals */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={(u) => {
          setUser(u)
          void refreshMyUploads()
          if (u.role === "admin") setPendingSignal((s) => s + 1)
        }}
      />
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          void refreshMyUploads()
          setPendingSignal((s) => s + 1)
        }}
      />
    </div>
  )
}

// ---------- Sub-components ----------
function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub: string
}) {
  return (
    <Card className="border-border/70 hover:border-primary/40 transition-colors">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary grid place-items-center">
            {icon}
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
          {value.toLocaleString()}
        </div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  )
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-white">
      {icon}
      {children}
    </span>
  )
}

function ApiRow({
  method,
  path,
  desc,
}: {
  method: string
  path: string
  desc: string
}) {
  const methodColor =
    method === "GET"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
      : method === "POST"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
      : method === "PUT"
      ? "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30"
      : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-start">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${methodColor}`}>
          {method}
        </span>
        <code className="text-xs font-mono text-foreground">{path}</code>
      </div>
      <p className="text-xs text-muted-foreground sm:pl-1">{desc}</p>
    </div>
  )
}

function GeneratePanel({
  busy,
  onBusyChange,
  onSaved,
}: {
  busy: boolean
  onBusyChange: (b: boolean) => void
  onSaved: () => void
}) {
  const [prompt, setPrompt] = useState("")
  const [preview, setPreview] = useState<string | null>(null)
  const [usedFallback, setUsedFallback] = useState(false)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("Abstract")

  async function generate() {
    if (prompt.trim().length < 3) {
      toast.error("Prompt must be at least 3 characters")
      return
    }
    onBusyChange(true)
    setPreview(null)
    setUsedFallback(false)
    try {
      const res = await apiFetch<{
        imageUrl: string
        usedFallback: boolean
        note: string
      }>("/api/admin/generate", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      })
      setPreview(res.imageUrl)
      setUsedFallback(res.usedFallback)
      if (res.usedFallback) toast.info(res.note)
      else toast.success("Generated!")
    } catch (e) {
      toast.error(`Generation failed: ${(e as Error).message}`)
    } finally {
      onBusyChange(false)
    }
  }

  async function saveAsWallpaper() {
    if (!preview) return
    if (!title.trim()) {
      toast.error("Give the wallpaper a title first")
      return
    }
    try {
      await apiFetch("/api/admin/wallpapers", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          imageUrl: preview,
          thumbUrl: preview,
          category,
          tags: [prompt.split(" ").slice(0, 3).join(" ").toLowerCase(), "ai"],
          resolution: "1024x1792",
          orientation: "portrait",
          source: "kiki-ai",
          accentColor: "#1e1b4b",
        }),
      })
      toast.success("Saved to catalog!")
      setPreview(null)
      setTitle("")
      setPrompt("")
      onSaved()
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`)
    }
  }

  return (
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Prompt</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. calm rainy night cityscape, neon reflections, cinematic, portrait"
          rows={3}
        />
        <div className="flex gap-2">
          <Button
            onClick={generate}
            disabled={busy}
            className="kiki-gradient text-white hover:opacity-90"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Generate
          </Button>
        </div>
      </div>

      {preview && (
        <div className="grid sm:grid-cols-[auto_1fr] gap-4 items-start">
          <div className="relative w-32 h-56 rounded-xl overflow-hidden bg-muted border border-border">
            { }
            <img src={preview} alt="Generated" className="h-full w-full object-cover" />
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Rainy Neon Night"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Nature", "Abstract", "Minimal", "City", "Anime", "Space", "Animals", "Dark"].map(
                    (c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveAsWallpaper} size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Save to catalog
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generate}
                disabled={busy}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Regenerate
              </Button>
            </div>
            {usedFallback && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ Using a fallback image because the AI image service was unavailable.
              </p>
            )}
          </div>
        </div>
      )}
    </CardContent>
  )
}

function WallpaperSheet({
  open,
  wallpaper,
  onClose,
  onSaved,
}: {
  open: boolean
  wallpaper: PublicWallpaper | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!wallpaper
  const [form, setForm] = useState({
    title: "",
    imageUrl: "",
    thumbUrl: "",
    category: "Abstract",
    tags: "",
    resolution: "1080x1920",
    fileSizeKb: 0,
    orientation: "portrait",
    source: "kiki-studio",
    accentColor: "#0f172a",
    featured: false,
    active: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (wallpaper) {
      setForm({
        title: wallpaper.title,
        imageUrl: wallpaper.imageUrl,
        thumbUrl: wallpaper.thumbUrl,
        category: wallpaper.category,
        tags: wallpaper.tags.join(", "),
        resolution: wallpaper.resolution,
        fileSizeKb: wallpaper.fileSizeKb,
        orientation: wallpaper.orientation,
        source: wallpaper.source,
        accentColor: wallpaper.accentColor,
        featured: wallpaper.featured,
        active: true,
      })
    } else if (open) {
      // Reset for create mode
      setForm({
        title: "",
        imageUrl: "",
        thumbUrl: "",
        category: "Abstract",
        tags: "",
        resolution: "1080x1920",
        fileSizeKb: 0,
        orientation: "portrait",
        source: "kiki-studio",
        accentColor: "#0f172a",
        featured: false,
        active: true,
      })
    }
  }, [wallpaper, open])

  async function save() {
    if (!form.title.trim() || !form.imageUrl.trim() || !form.thumbUrl.trim()) {
      toast.error("Title, image URL, and thumb URL are required")
      return
    }
    setSaving(true)
    try {
      if (isEdit && wallpaper) {
        await apiFetch("/api/admin/wallpapers", {
          method: "PATCH",
          body: JSON.stringify({ id: wallpaper.id, ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) }),
        })
        toast.success("Wallpaper updated")
      } else {
        await apiFetch("/api/admin/wallpapers", {
          method: "POST",
          body: JSON.stringify({ ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) }),
        })
        toast.success("Wallpaper added to catalog")
      }
      onSaved()
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto kiki-scroll">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEdit ? "Edit wallpaper" : "Add wallpaper"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update fields and broadcast the change to all devices."
              : "Add a new wallpaper to the Kiki catalog."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Misty Mountain Sunrise"
            />
          </Field>

          <Field label="Image URL (full HD)">
            <Input
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://cdn.../wallpaper-hd.jpg"
            />
          </Field>

          <Field label="Thumbnail URL (preview)">
            <Input
              value={form.thumbUrl}
              onChange={(e) => setForm({ ...form, thumbUrl: e.target.value })}
              placeholder="https://cdn.../wallpaper-thumb.jpg"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use a smaller image (~420px wide) so the RN grid stays fast.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Nature"
              />
            </Field>
            <Field label="Resolution">
              <Input
                value={form.resolution}
                onChange={(e) => setForm({ ...form, resolution: e.target.value })}
                placeholder="1080x1920"
              />
            </Field>
          </div>

          <Field label="Tags (comma-separated)">
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="dark, mountains, 4k"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="File size (KB)">
              <Input
                type="number"
                value={form.fileSizeKb}
                onChange={(e) =>
                  setForm({ ...form, fileSizeKb: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Source">
              <Input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="unsplash | kiki-ai"
              />
            </Field>
          </div>

          <Field label="Accent color (hex)">
            <div className="flex items-center gap-2">
              <Input
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                placeholder="#0f172a"
                className="flex-1"
              />
              <span
                className="h-10 w-10 rounded-md border border-border"
                style={{ background: form.accentColor }}
              />
            </div>
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm">Featured</Label>
              <p className="text-xs text-muted-foreground">Show on home hero rail</p>
            </div>
            <Switch
              checked={form.featured}
              onCheckedChange={(v) => setForm({ ...form, featured: v })}
            />
          </div>

          {form.imageUrl && (
            <div className="aspect-[9/16] max-h-64 mx-auto rounded-xl overflow-hidden bg-muted border border-border">
              { }
              <img
                src={form.imageUrl}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving} className="flex-1 kiki-gradient text-white hover:opacity-90">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Add to catalog"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
