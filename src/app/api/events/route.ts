// Kiki — Server-Sent Events stream. The RN app subscribes to refresh its
// catalog whenever a wallpaper is created, edited, deleted, downloaded, or
// the user's rotation config changes. Uses the in-process broadcaster; on
// Vercel, replace with Upstash Redis pubsub for multi-instance fan-out.
import type { NextRequest } from "next/server"
import { subscribe } from "@/lib/broadcaster"
import type { KikiEvent } from "@/lib/broadcaster"

export const dynamic = "force-dynamic"
// Disable Next.js body parsing for streaming responses
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Initial hello so the client knows the stream is alive
      controller.enqueue(
        encoder.encode(
          `event: hello\ndata: ${JSON.stringify({
            ts: Date.now(),
            message: "Kiki catalog stream is live",
          })}\n\n`,
        ),
      )

      // Heartbeat every 25s — keeps Vercel/edge from killing idle connections
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`:ping ${Date.now()}\n\n`))
        } catch {
          // controller closed
        }
      }, 25000)

      const unsubscribe = subscribe((event: KikiEvent) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
            ),
          )
        } catch {
          // ignore
        }
      })

      // Clean up on abort/close
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
