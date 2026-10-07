// Lightweight in-process SSE broadcaster for the Kiki catalog.
// Subscribers (the React Native app and the dashboard itself) attach an async
// generator; emitters push events to every live subscriber. On Vercel, replace
// this with a Redis-backed pubsub (Upstash) for multi-instance fan-out — see
// /home/z/my-project/DEPLOY.md for the production recipe.

type KikiEvent =
  | { type: "wallpaper.created"; id: string; ts: number }
  | { type: "wallpaper.updated"; id: string; ts: number }
  | { type: "wallpaper.deleted"; id: string; ts: number }
  | { type: "category.changed"; ts: number }
  | { type: "download.counted"; id: string; total: number; ts: number }
  | { type: "rotation.changed"; deviceId: string; ts: number }

type Listener = (event: KikiEvent) => void

const listeners = new Set<Listener>()

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function broadcast(event: KikiEvent) {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // swallow — one dead listener must not break the fan-out
    }
  }
  return
}

export type { KikiEvent }
