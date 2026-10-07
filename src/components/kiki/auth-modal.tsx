"use client"

import { useEffect, useState } from "react"
import { Loader2, LogIn, Sparkles } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type SessionUser = {
  userId: string
  email: string
  role: "user" | "admin"
  displayName: string | null
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

export function AuthModal({
  open,
  onClose,
  onAuthenticated,
}: {
  open: boolean
  onClose: () => void
  onAuthenticated: (user: SessionUser) => void
}) {
  const [tab, setTab] = useState<"signin" | "signup">("signup")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [busy, setBusy] = useState(false)

  // Reset state when the modal closes
  useEffect(() => {
    if (!open) {
      setPassword("")
      setTimeout(() => {
        setEmail("")
        setDisplayName("")
      }, 300)
    }
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const url = tab === "signin" ? "/api/auth/login" : "/api/auth/register"
      const payload: { email: string; password: string; displayName?: string } = {
        email: email.trim().toLowerCase(),
        password,
      }
      if (tab === "signup" && displayName.trim()) {
        payload.displayName = displayName.trim()
      }
      const data = await apiFetch<{
        userId: string
        email: string
        role: string
        displayName: string | null
      }>(url, {
        method: "POST",
        body: JSON.stringify(payload),
      })
      toast.success(
        tab === "signin"
          ? `Welcome back, ${data.displayName ?? data.email}!`
          : `Account created — you're ${data.role === "admin" ? "the admin" : "signed in"}!`,
      )
      onAuthenticated({
        userId: data.userId,
        email: data.email,
        role: data.role as "user" | "admin",
        displayName: data.displayName,
      })
      onClose()
    } catch (e) {
      toast.error((e as Error).message || "Authentication failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="kiki-gradient h-12 w-12 rounded-2xl grid place-items-center shadow-md mb-2">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-xl">
            {tab === "signin" ? "Welcome back to Kiki" : "Join Kiki"}
          </DialogTitle>
          <DialogDescription>
            {tab === "signin"
              ? "Sign in to upload wallpapers and manage your collection."
              : "Create an account to upload wallpapers. The first account becomes admin."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signup">Sign up</TabsTrigger>
            <TabsTrigger value="signin">Sign in</TabsTrigger>
          </TabsList>

          <TabsContent value="signup">
            <form onSubmit={submit} className="space-y-3 mt-2">
              {tab === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="au-display" className="text-xs">
                    Display name (optional)
                  </Label>
                  <Input
                    id="au-display"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="artist name or @username"
                    autoComplete="nickname"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="au-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="au-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="au-pw" className="text-xs">
                  Password
                </Label>
                <Input
                  id="au-pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="at least 8 characters"
                  autoComplete={tab === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full kiki-gradient text-white hover:opacity-90"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4 mr-1" />
                )}
                Create account
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signin">
            <form onSubmit={submit} className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="ai-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="ai-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-pw" className="text-xs">
                  Password
                </Label>
                <Input
                  id="ai-pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="your password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full kiki-gradient text-white hover:opacity-90"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4 mr-1" />
                )}
                Sign in
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <DialogFooter className="text-xs text-muted-foreground text-center">
          <p>
            By continuing, you agree to use Kiki for personal wallpaper creation
            and sharing. Don&apos;t upload copyrighted material you don&apos;t own.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
