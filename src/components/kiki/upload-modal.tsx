"use client"

import { useState } from "react"
import { ImagePlus, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

const CATEGORY_OPTIONS = [
  "Nature",
  "Abstract",
  "Minimal",
  "City",
  "Anime",
  "Space",
  "Animals",
  "Dark",
  "User Upload",
]

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB

export function UploadModal({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean
  onClose: () => void
  onUploaded: () => void
}) {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("User Upload")
  const [tags, setTags] = useState("")
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setTitle("")
    setCategory("User Upload")
    setTags("")
    setImageDataUrl(null)
    setImagePreview(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)}MB. Max is 4MB.`,
      )
      return
    }
    // Convert to base64 data URL
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImageDataUrl(result)
      setImagePreview(result)
    }
    reader.onerror = () => toast.error("Could not read the file")
    reader.readAsDataURL(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Give your wallpaper a title")
      return
    }
    if (!imageDataUrl) {
      toast.error("Choose an image to upload")
      return
    }
    setBusy(true)
    try {
      await apiFetch("/api/uploads", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          category,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          imageDataUrl,
        }),
      })
      toast.success("Upload received! It will appear in the catalog once an admin approves it.")
      reset()
      onUploaded()
      onClose()
    } catch (e) {
      toast.error((e as Error).message || "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="kiki-gradient h-12 w-12 rounded-2xl grid place-items-center shadow-md mb-2">
            <ImagePlus className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-xl">Upload a wallpaper</DialogTitle>
          <DialogDescription>
            Your upload goes into a moderation queue. An admin approves it
            before it shows in the catalog. Max 4MB, JPG/PNG/WebP/GIF.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 mt-2">
          {/* Image picker + preview */}
          <div className="space-y-2">
            <Label className="text-xs">Image</Label>
            {imagePreview ? (
              <div className="relative aspect-[9/16] max-h-72 mx-auto rounded-xl overflow-hidden bg-muted border border-border">
                { }
                <img
                  src={imagePreview}
                  alt="Upload preview"
                  className="h-full w-full object-cover"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => {
                    setImageDataUrl(null)
                    setImagePreview(null)
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-[9/16] max-h-72 mx-auto rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-accent/30 cursor-pointer transition-colors">
                <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Click to choose an image
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  JPG, PNG, WebP, or GIF — up to 4MB
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={onFileChange}
                />
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="up-title" className="text-xs">
              Title
            </Label>
            <Input
              id="up-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sunset Over the Bay"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-tags" className="text-xs">
                Tags (comma-separated)
              </Label>
              <Input
                id="up-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="sunset, ocean, warm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !imageDataUrl}
              className="kiki-gradient text-white hover:opacity-90"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Submit for review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
