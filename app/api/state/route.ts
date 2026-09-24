import { DEFAULT_HOME_DISTRICT, getSnapshot } from "@/lib/engine";
import { json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export function GET(request: Request) {
  const home = new URL(request.url).searchParams.get("home") ?? DEFAULT_HOME_DISTRICT;
  return json(getSnapshot(home));
}
