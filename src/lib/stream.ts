// Bounded SSE with database reads: no in-memory event bus, sticky sessions, or Redis required.
// Deploy on a Node runtime with streaming and a request duration >= 30 seconds.
export function eventStream(request: Request, load: () => Promise<unknown>) {
  const encoder = new TextEncoder();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finish: (() => void) | undefined;
  const stream = new ReadableStream({
    async start(controller) {
      const started = Date.now();
      let last = "";
      const stop = () => {
        if (stopped) return;
        stopped = true;
        clearTimeout(timer);
        controller.close();
        request.signal.removeEventListener("abort", stop);
        finish?.();
      };
      request.signal.addEventListener("abort", stop, { once: true });
      const pause = () =>
        new Promise<void>((resolve) => {
          finish = resolve;
          timer = setTimeout(resolve, 1500);
        });
      try {
        controller.enqueue(encoder.encode("retry: 2000\n\n"));
        while (!stopped && Date.now() - started < 25000) {
          const json = JSON.stringify(await load());
          if (stopped) break;
          if (json !== last) {
            controller.enqueue(encoder.encode(`data: ${json}\n\n`));
            last = json;
          } else controller.enqueue(encoder.encode(": heartbeat\n\n"));
          await pause();
        }
      } catch {
        if (!stopped)
          controller.enqueue(
            encoder.encode("event: stream-error\ndata: {}\n\n"),
          );
      } finally {
        stop();
      }
    },
    cancel() {
      stopped = true;
      clearTimeout(timer);
      finish?.();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "private, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
