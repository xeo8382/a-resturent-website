import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./errors";
export { HttpError } from "./errors";
export function checkOrigin(request: Request) {
  const origin = process.env.APP_ORIGIN;
  if (!origin) throw new HttpError(503, "Server origin is not configured.");
  if (request.headers.get("origin") !== new URL(origin).origin)
    throw new HttpError(403, "Invalid request origin.");
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "JSON required.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A JSON body is required.");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32768) {
      await reader.cancel();
      throw new HttpError(413, "Request too large.");
    }
    parts.push(value);
  }
  const body = Buffer.concat(parts).toString("utf8");
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  console.error(
    "Request failed:",
    error instanceof Error ? error.name : "Unknown error",
  );
  return NextResponse.json(
    { error: "Unable to complete this request. Please try again." },
    { status: 500 },
  );
}
export const privateHeaders = { "Cache-Control": "private, no-store" };
