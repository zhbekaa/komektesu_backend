import { DEFAULT_HOME_DISTRICT, getSnapshot, resetDemo, runOutageScenario } from "@/lib/engine";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "outage" | "reset";
      districtId?: string;
    };
    if (body.action === "reset") {
      await resetDemo();
      return json(await getSnapshot());
    }
    const districtId = body.districtId ?? DEFAULT_HOME_DISTRICT;
    await runOutageScenario(districtId);
    return json(await getSnapshot(districtId));
  } catch (error) {
    return fail(error);
  }
}
