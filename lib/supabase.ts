import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ASSUMPTIONS } from "./aktau";
import { DISTRICT_GEO } from "./aktau-geo";
import { ActionError } from "./errors";
import type {
  AppNotification,
  DeliveryRequest,
  DistrictState,
  Incident,
  Report,
  Tanker,
  TankerStatus,
} from "./types";

const NAMES = new Map(DISTRICT_GEO.map((district) => [district.id, district.name]));

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

function db() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ActionError(
      "База не настроена: задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY",
      503,
    );
  }
  return supabase;
}

function raise(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export type CityRows = {
  districts: DistrictState[];
  tankers: Tanker[];
  reports: Report[];
  requests: DeliveryRequest[];
  notifications: AppNotification[];
  incident: Incident | null;
};

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function ms(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).getTime();
}

function districtRow(district: DistrictState) {
  return {
    id: district.id,
    name: NAMES.get(district.id) ?? district.id,
    status: district.status,
    expected_normal_at: district.expectedNormalAt,
    pressure_bar: district.pressureBar,
    cause: district.cause,
    updated_at: iso(district.updatedAt),
  };
}

function reportRow(report: Report) {
  return {
    id: report.id,
    district_id: report.districtId,
    building: report.building,
    type: report.type,
    resident_name: report.residentName,
    confirmed: report.confirmed,
    dismissed: report.dismissed,
    created_at: iso(report.createdAt),
  };
}

function tankerRow(tanker: Tanker) {
  return {
    id: tanker.id,
    number: tanker.number,
    plate: tanker.plate,
    status: tanker.status,
    capacity_liters: tanker.capacityLiters,
    water_liters: tanker.waterLiters,
    x: tanker.x,
    y: tanker.y,
    start_x: tanker.startX,
    start_y: tanker.startY,
    target_x: tanker.targetX,
    target_y: tanker.targetY,
    target_district_id: tanker.targetDistrictId,
    trip_started_at: tanker.tripStartedAt ? iso(tanker.tripStartedAt) : null,
    trip_duration_ms: tanker.tripDurationMs || null,
    updated_at: new Date().toISOString(),
  };
}

function requestRow(request: DeliveryRequest) {
  return {
    id: request.id,
    number: request.number,
    district_id: request.districtId,
    building: request.building,
    tanker_id: request.tankerId,
    status: request.status,
    resident_name: request.residentName,
    created_at: iso(request.createdAt),
  };
}

function notificationRow(notification: AppNotification) {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    kind: notification.kind,
    read: notification.read,
    audience: notification.audience,
    created_at: iso(notification.createdAt),
  };
}

function incidentRow(incident: Incident) {
  return {
    id: incident.id,
    title: incident.title,
    summary: incident.summary,
    district_ids: incident.districtIds,
    started_at: iso(incident.startedAt),
    expected_normal_at: incident.expectedNormalAt,
  };
}

type DistrictRecord = {
  id: string;
  status: DistrictState["status"];
  expected_normal_at: string | null;
  pressure_bar: number | null;
  cause: string | null;
  updated_at: string;
};

type ReportRecord = {
  id: string;
  district_id: string;
  building: string;
  type: Report["type"];
  resident_name: string | null;
  confirmed: boolean;
  dismissed: boolean;
  created_at: string;
};

type TankerRecord = {
  id: string;
  number: number;
  plate: string | null;
  status: TankerStatus;
  capacity_liters: number | null;
  water_liters: number;
  x: number | null;
  y: number | null;
  start_x: number | null;
  start_y: number | null;
  target_x: number | null;
  target_y: number | null;
  target_district_id: string | null;
  trip_started_at: string | null;
  trip_duration_ms: number | null;
};

type RequestRecord = {
  id: string;
  number: number;
  district_id: string;
  building: string;
  tanker_id: string | null;
  status: DeliveryRequest["status"];
  resident_name: string | null;
  created_at: string;
};

type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  kind: AppNotification["kind"];
  read: boolean;
  audience: string | null;
  created_at: string;
};

type IncidentRecord = {
  id: string;
  title: string;
  summary: string;
  district_ids: string[];
  started_at: string;
  expected_normal_at: string | null;
};

function toDistrict(row: DistrictRecord): DistrictState {
  return {
    id: row.id,
    status: row.status,
    pressureBar: row.pressure_bar ?? ASSUMPTIONS.nominalPressureBar,
    expectedNormalAt: row.expected_normal_at,
    updatedAt: ms(row.updated_at) ?? Date.now(),
    complaints6h: 0,
    cause: row.cause,
  };
}

function toReport(row: ReportRecord): Report {
  return {
    id: row.id,
    districtId: row.district_id,
    building: row.building,
    type: row.type,
    residentName: row.resident_name ?? "Житель",
    createdAt: ms(row.created_at) ?? Date.now(),
    confirmed: row.confirmed,
    dismissed: row.dismissed,
  };
}

function toTanker(row: TankerRecord): Tanker {
  const x = row.x ?? 0;
  const y = row.y ?? 0;
  return {
    id: row.id,
    number: row.number,
    plate: row.plate ?? "",
    status: row.status,
    capacityLiters: row.capacity_liters ?? 0,
    waterLiters: row.water_liters,
    x,
    y,
    startX: row.start_x ?? x,
    startY: row.start_y ?? y,
    targetX: row.target_x ?? x,
    targetY: row.target_y ?? y,
    targetDistrictId: row.target_district_id,
    tripStartedAt: ms(row.trip_started_at),
    tripDurationMs: row.trip_duration_ms ?? 0,
    initialEtaMin: 0,
  };
}

function toRequest(row: RequestRecord): DeliveryRequest {
  return {
    id: row.id,
    number: row.number,
    districtId: row.district_id,
    building: row.building,
    tankerId: row.tanker_id,
    status: row.status,
    createdAt: ms(row.created_at) ?? Date.now(),
    residentName: row.resident_name ?? "Житель",
  };
}

function toNotification(row: NotificationRecord): AppNotification {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: ms(row.created_at) ?? Date.now(),
    read: row.read,
    kind: row.kind,
    audience: row.audience,
  };
}

function toIncident(row: IncidentRecord): Incident {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    districtIds: row.district_ids,
    startedAt: ms(row.started_at) ?? Date.now(),
    expectedNormalAt: row.expected_normal_at,
  };
}

const PAGE = 1000;

async function fetchAll<T>(
  table: "reports" | "notifications" | "delivery_requests",
  order: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from(table)
      .select("*")
      .order(order, { ascending: false })
      .range(from, from + PAGE - 1);
    raise(error);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

async function countOf(table: "districts" | "tankers") {
  const { count, error } = await db().from(table).select("*", { count: "exact", head: true });
  raise(error);
  return count ?? 0;
}

/** Insert the calm city once. A conflict means another request already seeded it. */
export async function ensureSeeded(districts: DistrictState[], tankers: Tanker[]) {
  if ((await countOf("districts")) === 0) {
    const { error } = await db().from("districts").insert(districts.map(districtRow));
    if (error && error.code !== "23505") throw new Error(error.message);
  }
  if ((await countOf("tankers")) === 0) {
    const { error } = await db().from("tankers").insert(tankers.map(tankerRow));
    if (error && error.code !== "23505") throw new Error(error.message);
  }
}

export async function loadCity(): Promise<CityRows> {
  const [districts, tankers, reports, requests, notifications, incident] = await Promise.all([
    db().from("districts").select("id, status, expected_normal_at, pressure_bar, cause, updated_at"),
    db().from("tankers").select(
      "id, number, plate, status, capacity_liters, water_liters, x, y, start_x, start_y, target_x, target_y, target_district_id, trip_started_at, trip_duration_ms",
    ),
    fetchAll<ReportRecord>("reports", "created_at"),
    fetchAll<RequestRecord>("delivery_requests", "created_at"),
    fetchAll<NotificationRecord>("notifications", "created_at"),
    db()
      .from("incidents")
      .select("id, title, summary, district_ids, started_at, expected_normal_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  raise(districts.error);
  raise(tankers.error);
  raise(incident.error);
  return {
    districts: ((districts.data ?? []) as DistrictRecord[]).map(toDistrict),
    tankers: ((tankers.data ?? []) as TankerRecord[]).map(toTanker),
    reports: reports.map(toReport),
    requests: requests.map(toRequest),
    notifications: notifications.map(toNotification),
    incident: incident.data ? toIncident(incident.data as IncidentRecord) : null,
  };
}

async function removeAll(
  table: "reports" | "delivery_requests" | "notifications" | "feedback" | "incidents",
) {
  const { error } = await db().from(table).delete().neq("id", "");
  raise(error);
}

/** Replace the saved city. Used by Сбросить, not by process startup.
 *  Districts and tankers are written first so a missing column fails before
 *  complaints are deleted. */
export async function writeCity(city: CityRows) {
  raise((await db().from("districts").upsert(city.districts.map(districtRow), { onConflict: "id" })).error);
  raise((await db().from("tankers").upsert(city.tankers.map(tankerRow), { onConflict: "id" })).error);

  await removeAll("delivery_requests");
  await removeAll("reports");
  await removeAll("notifications");
  await removeAll("feedback");
  await removeAll("incidents");

  await insertReports(city.reports);
  await insertRequests(city.requests);
  await insertNotifications(city.notifications);
  if (city.incident) {
    raise((await db().from("incidents").insert(incidentRow(city.incident))).error);
  }
}

export async function insertReports(reports: Report[]) {
  if (reports.length === 0) return;
  raise((await db().from("reports").insert(reports.map(reportRow))).error);
}

export async function insertRequests(requests: DeliveryRequest[]) {
  if (requests.length === 0) return;
  raise((await db().from("delivery_requests").insert(requests.map(requestRow))).error);
}

export async function insertNotifications(notifications: AppNotification[]) {
  if (notifications.length === 0) return;
  raise((await db().from("notifications").insert(notifications.map(notificationRow))).error);
}

export async function setReportFlag(id: string, flag: "confirmed" | "dismissed") {
  const patch = flag === "confirmed" ? { confirmed: true } : { dismissed: true };
  const { data, error } = await db().from("reports").update(patch).eq("id", id).select("id");
  raise(error);
  if (!data?.length) throw new ActionError("Report not found", 404);
}

export async function saveDistrict(district: DistrictState) {
  const { data, error } = await db()
    .from("districts")
    .update({
      status: district.status,
      expected_normal_at: district.expectedNormalAt,
      pressure_bar: district.pressureBar,
      cause: district.cause,
      updated_at: iso(district.updatedAt),
    })
    .eq("id", district.id)
    .select("id");
  raise(error);
  if (!data?.length) throw new ActionError("Unknown district", 404);
}

export async function insertNotification(notification: AppNotification) {
  await insertNotifications([notification]);
}

export async function insertRequest(request: DeliveryRequest) {
  await insertRequests([request]);
}

export async function sendRequest(id: string, tankerId: string) {
  const { error } = await db()
    .from("delivery_requests")
    .update({ tanker_id: tankerId, status: "en_route" })
    .eq("id", id);
  raise(error);
}

export async function finishRequest(id: string) {
  const { error } = await db().from("delivery_requests").update({ status: "done" }).eq("id", id);
  raise(error);
}

/**
 * Claim an idle tanker for a trip. Returns false when another dispatch already took it.
 * x and y stay where the tanker was; the moving dot is computed from the trip.
 */
export async function dispatchTanker(
  id: string,
  trip: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    targetDistrictId: string;
    tripStartedAt: number;
    tripDurationMs: number;
  },
) {
  const { data, error } = await db()
    .from("tankers")
    .update({
      status: "en_route",
      start_x: trip.startX,
      start_y: trip.startY,
      target_x: trip.targetX,
      target_y: trip.targetY,
      target_district_id: trip.targetDistrictId,
      trip_started_at: iso(trip.tripStartedAt),
      trip_duration_ms: trip.tripDurationMs,
      updated_at: iso(trip.tripStartedAt),
    })
    .eq("id", id)
    .eq("status", "idle")
    .select("id");
  raise(error);
  return (data?.length ?? 0) > 0;
}

/** One write when the trip is over. Returns false if another read already arrived it. */
export async function arriveTanker(id: string, arrived: { x: number; y: number; waterLiters: number }) {
  const { data, error } = await db()
    .from("tankers")
    .update({
      status: "serving",
      x: arrived.x,
      y: arrived.y,
      water_liters: arrived.waterLiters,
      trip_started_at: null,
      trip_duration_ms: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "en_route")
    .select("id");
  raise(error);
  return (data?.length ?? 0) > 0;
}

export async function nextRequestNumber() {
  const { data, error } = await db()
    .from("delivery_requests")
    .select("number")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  raise(error);
  return ((data?.number as number | undefined) ?? 0) + 1;
}

export async function setIncident(incident: Incident) {
  await removeAll("incidents");
  raise((await db().from("incidents").insert(incidentRow(incident))).error);
}

export async function insertFeedback(entry: {
  id: string;
  text: string;
  residentName: string;
  createdAt: number;
}) {
  raise(
    (
      await db().from("feedback").insert({
        id: entry.id,
        body: entry.text,
        resident_name: entry.residentName,
        created_at: iso(entry.createdAt),
      })
    ).error,
  );
}

export async function markNotificationsRead(ids?: string[]) {
  if (ids && ids.length === 0) return;
  let query = db().from("notifications").update({ read: true });
  query = ids ? query.in("id", ids) : query.eq("read", false);
  raise((await query).error);
}
