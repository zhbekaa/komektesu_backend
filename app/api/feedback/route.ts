import { addFeedback, getSnapshot } from "@/lib/engine";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string; residentName?: string };
    await addFeedback(body.text ?? "", body.residentName ?? "");
    return json(await getSnapshot());
  } catch (error) {
    return fail(error);
  }
}
