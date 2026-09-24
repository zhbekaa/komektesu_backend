import { dispatchNearest, getSnapshot } from "@/lib/engine";
import { json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    districtId?: string;
    building?: string;
    residentName?: string;
  };
  if (!body.districtId) return json({ error: "districtId is required" }, 400);
  const result = dispatchNearest(body.districtId, body.building, body.residentName);
  if (!result) return json({ error: "Нет свободных водовозов" }, 409);
  return json(getSnapshot(body.districtId));
}
