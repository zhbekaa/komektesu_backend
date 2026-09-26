import { addReport, confirmReport, dismissReport, getSnapshot } from "@/lib/engine";
import { fail, json, preflight } from "@/lib/http";
import type { ReportType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPES: ReportType[] = ["no_water", "no_hot", "low_pressure", "emergency"];

export function OPTIONS() {
  return preflight();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      districtId?: string;
      building?: string;
      type?: ReportType;
      residentName?: string;
      confirmId?: string;
      dismissId?: string;
    };
    if (body.confirmId) {
      await confirmReport(body.confirmId);
      return json(await getSnapshot());
    }
    if (body.dismissId) {
      await dismissReport(body.dismissId);
      return json(await getSnapshot());
    }
    if (!body.districtId || !body.type || !TYPES.includes(body.type)) {
      return json({ error: "districtId and type are required" }, 400);
    }
    await addReport({
      districtId: body.districtId,
      building: body.building,
      type: body.type,
      residentName: body.residentName,
    });
    return json(await getSnapshot(body.districtId));
  } catch (error) {
    return fail(error);
  }
}
