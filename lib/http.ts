import { NextResponse } from "next/server";
import { ActionError } from "./errors";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function messageOf(error: unknown) {
  if (!(error instanceof Error)) return "Не удалось сохранить";
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    const cause = current.cause as { code?: string; hostname?: string } | undefined;
    if (cause?.code === "ENOTFOUND") {
      return `Нет связи с Supabase${cause.hostname ? ` (${cause.hostname})` : ""}. Проверьте SUPABASE_URL.`;
    }
    current = cause;
  }
  if (error.message.includes("fetch failed") || error.message.includes("ENOTFOUND")) {
    return "Нет связи с Supabase. Проверьте SUPABASE_URL.";
  }
  return error.message;
}

export function fail(error: unknown) {
  const status = error instanceof ActionError ? error.status : 500;
  return json({ error: messageOf(error) }, status);
}
