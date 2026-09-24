import { getSnapshot, resetDemo, runOutageScenario } from "@/lib/engine";
import { json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function POST(request: Request) {
  const body = (await request.json()) as { action?: "outage" | "reset"; districtId?: string };
  if (body.action === "reset") {
    resetDemo();
    return json(getSnapshot());
  }
  runOutageScenario(body.districtId ?? "14");
  return json(getSnapshot(body.districtId ?? "14"));
}
