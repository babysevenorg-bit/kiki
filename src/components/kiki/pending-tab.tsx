"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Clock, Loader2, RefreshCw, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type PendingWallpaper = {
  id: string
  title: string
  imageUrl: string
  thumbUrl: string
  category: string
  resolution: string
  fileSizeKb: number
  status: string
  createdAt: string
  uploader: {
    userId: string
    email: string
    displayName: string | null
  } | null
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
  const json = (await res.json().catch(() => ({}))) as
    | { ok: true; data: T }
    | { ok: false; error: string }
  if (!res.ok || !("ok" in json) || !json.ok) {
    const msg = "ok" in json && !json.ok ? json.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json.data
}

export function PendingTab({ refreshSignal }: { refreshSignal: number }) {
  const [items, setItems] = useState<PendingWallpaper[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ items: PendingWallpaper[] }>(
        "/api/admin/pending",
      )
      setItems(data.items)
    } catch (e) {
      // Only show error if it's not "unauthorized" — the parent hides the
      // tab entirely for non-admins, but we still want to be safe.
      const msg = (e as Error).message
      if (msg !== "unauthorized" && msg !== "forbidden") {
        toast.error(`Could not load pending uploads: ${msg}`)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshSignal])

  const moderate = useCallback(
    async (id: string, action: "approve" | "reject") => {
      setBusyId(id)
      try {
        await apiFetch(`/api/admin/pending/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ action }),
        })
        toast.success(
          action === "approve"
            ? "Approved — wallpaper is now in the catalog"
            : "Rejected — wallpaper hidden",
        )
        setItems((prev) => prev.filter((w) => w.id !== id))
      } catch (e) {
        toast.error(`Moderation failed: ${(e as Error).message}`)
      } finally {
        setBusyId(null)
      }
    },
    [],
  )

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <div className="kiki-gradient h-14 w-14 rounded-2xl grid place-items-center mb-4">
          <Clock className="h-7 w-7 text-white" />
        </div>
        <p className="text-lg font-semibold">No pending uploads</p>
        <p className="text-sm text-muted-foreground mt-1">
          New user submissions will appear here for review.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} upload{items.length === 1 ? "" : "s"} awaiting review
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((w) => (
          <Card key={w.id} className="overflow-hidden border-border/70 p-0 gap-0">
            <div className="relative aspect-[9/16] max-h-80 bg-muted">
              { }
              <img
                src={w.thumbUrl}
                alt={w.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute top-2 left-2">
                <Badge className="bg-amber-500/90 text-white border-0">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              </div>
            </div>
            <div className="p-3 space-y-2 bg-card">
              <div>
                <p className="text-sm font-semibold line-clamp-1">{w.title}</p>
                <p className="text-xs text-muted-foreground">
                  {w.category} · {w.resolution}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {w.uploader ? (
                  <span>
                    By{" "}
                    <span className="font-medium text-foreground">
                      {w.uploader.displayName ?? w.uploader.email}
                    </span>
                  </span>
                ) : (
                  <span>Unknown uploader</span>
                )}
                <span className="ml-1">
                  · {Math.round(w.fileSizeKb / 1024)}MB
                </span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={busyId === w.id}
                  onClick={() => moderate(w.id, "approve")}
                >
                  {busyId === w.id ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 hover:text-destructive hover:border-destructive/40"
                  disabled={busyId === w.id}
                  onClick={() => moderate(w.id, "reject")}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
