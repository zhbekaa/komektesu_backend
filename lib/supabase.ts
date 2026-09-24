import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Report } from "./types";

let client: SupabaseClient | null | undefined;

export function getSupabase() {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    client = null;
    return null;
  }
  client = createClient(url, key);
  return client;
}

export async function persistReport(report: Report) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("reports").insert({
    id: report.id,
    district_id: report.districtId,
    building: report.building,
    type: report.type,
    resident_name: report.residentName,
    created_at: new Date(report.createdAt).toISOString(),
    confirmed: report.confirmed,
  });
  if (error) throw error;
}
