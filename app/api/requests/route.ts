import { getSnapshot, requestDelivery } from "@/lib/engine";
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
  const created = requestDelivery({
    districtId: body.districtId,
    building: body.building,
    residentName: body.residentName,
  });
  if (!created) return json({ error: "Unknown district" }, 404);
  return json(getSnapshot(body.districtId));
}
