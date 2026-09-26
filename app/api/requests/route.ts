import { getSnapshot, requestDelivery } from "@/lib/engine";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      districtId?: string;
      building?: string;
      residentName?: string;
    };
    if (!body.districtId) return json({ error: "districtId is required" }, 400);
    await requestDelivery({
      districtId: body.districtId,
      building: body.building,
      residentName: body.residentName,
    });
    return json(await getSnapshot(body.districtId));
  } catch (error) {
    return fail(error);
  }
}
