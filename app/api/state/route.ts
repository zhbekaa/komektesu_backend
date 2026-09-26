import { DEFAULT_HOME_DISTRICT, getSnapshot } from "@/lib/engine";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const home = new URL(request.url).searchParams.get("home") ?? DEFAULT_HOME_DISTRICT;
  try {
    return json(await getSnapshot(home));
  } catch (error) {
    return fail(error);
  }
}
