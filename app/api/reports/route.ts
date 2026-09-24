import { addReport, confirmReport, getSnapshot } from "@/lib/engine";
import { json, preflight } from "@/lib/http";
import type { ReportType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPES: ReportType[] = ["no_water", "no_hot", "low_pressure", "emergency"];

export function OPTIONS() {
  return preflight();
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    districtId?: string;
    building?: string;
    type?: ReportType;
    residentName?: string;
    confirmId?: string;
  };
  if (body.confirmId) {
    const report = confirmReport(body.confirmId);
    if (!report) return json({ error: "Report not found" }, 404);
    return json(getSnapshot());
  }
  if (!body.districtId || !body.type || !TYPES.includes(body.type)) {
    return json({ error: "districtId and type are required" }, 400);
  }
  addReport({
    districtId: body.districtId,
    building: body.building,
    type: body.type,
    residentName: body.residentName,
  });
  return json(getSnapshot(body.districtId));
}
