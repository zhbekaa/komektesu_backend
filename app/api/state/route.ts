import { getSnapshot } from "@/lib/engine";
import { json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export function GET(request: Request) {
  const home = new URL(request.url).searchParams.get("home") ?? "14";
  return json(getSnapshot(home));
}
