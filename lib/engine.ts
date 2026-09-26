/**
 * Aktau water supply for the dispatch console and the resident app.
 *
 * OpenStreetMap geometry stays in lib/aktau-geo.ts and is joined by district id.
 * Pressure and ETAs stay calculated from lib/aktau.ts and are labelled simulated.
 * Reports, confirmations, tanker trips, notices, and the outage banner are rows
 * in Supabase. A snapshot is a fresh read. Startup seeds a calm city once.
 * The 14/15 outage is written only when someone presses Сбросить.
 */

import { DEPOT, DISTRICT_GEO, type DistrictGeo } from "./aktau-geo";
import {
  ASSUMPTION_NOTES,
  ASSUMPTIONS,
  CITY,
  COVERAGE,
  SOURCES,
  UTILITY,
  WATER_SOURCE,
  etaMinutesForUnits,
  unitsToKm,
} from "./aktau";
import { ActionError } from "./errors";
import { reportLabel } from "./labels";
import {
  arriveTanker,
  dispatchTanker,
  ensureSeeded,
  finishRequest,
  insertFeedback,
  insertNotification,
  insertReports,
  insertRequest,
  loadCity,
  markNotificationsRead as markReadRows,
  nextRequestNumber,
  saveDistrict,
  sendRequest,
  setIncident,
  setReportFlag,
  writeCity,
  type CityRows,
} from "./supabase";
import type {
  Anomaly,
  AppNotification,
  DeliveryRequest,
  DistrictState,
  Incident,
  Report,
  ReportType,
  ScheduleSlot,
  Snapshot,
  Suggestion,
  Tanker,
  WaterStatus,
} from "./types";

/** Trips play back faster than real life so an arrival is visible in a pitch. */
export const SIM_RATIO = 20;

const BURST_WINDOW_MS = ASSUMPTIONS.burstWindowMin * 60 * 1000;
const BURST_THRESHOLD = ASSUMPTIONS.burstThreshold;

/** Districts with residents. Industrial quarters are map context only. */
export const SERVED_DISTRICTS = DISTRICT_GEO.filter(
  (district) => district.kind !== "industrial",
);

const GEO_BY_ID = new Map(DISTRICT_GEO.map((district) => [district.id, district]));

export function geoFor(id: string): DistrictGeo | undefined {
  return GEO_BY_ID.get(id);
}

export const DEFAULT_HOME_DISTRICT = "14";

const FLEET = [
  { number: 12, plate: "823 KZ 12", capacity: 6000 },
  { number: 7, plate: "417 AK 12", capacity: 4000 },
  { number: 4, plate: "205 BN 12", capacity: 4000 },
  { number: 9, plate: "744 CH 12", capacity: 10000 },
  { number: 3, plate: "118 DM 12", capacity: 6000 },
  { number: 21, plate: "560 EL 12", capacity: 4000 },
] as const;

// --- scenario ---------------------------------------------------------------

/**
 * The incident Сбросить writes: a repair on the main feeding 14 and 15 мкр.
 * Startup does not load this.
 */
const SCENARIO = {
  id: "feeder-14-15",
  title: "Ремонт на магистрали, 14 и 15 мкр",
  summary:
    "Бригада КЖСА меняет участок магистрали между 14 и 15 мкр. Подача в двух районах перекрыта, у соседних районов просело давление.",
  outage: ["14", "15"],
  expectedNormalAt: "18:00",
  startedMinutesAgo: 96,
} as const;

/**
 * Newer districts on the northern edge sit furthest from the depot and the
 * reservoir, so they carry chronically weaker pressure in the demo scenario.
 */
const FAR_EDGE_KM = 4.3;

function scenarioStatuses() {
  const statuses = new Map<string, { status: WaterStatus; cause: string | null }>();
  for (const district of SERVED_DISTRICTS) {
    statuses.set(district.id, { status: "normal", cause: null });
  }

  for (const id of SCENARIO.outage) {
    statuses.set(id, { status: "none", cause: SCENARIO.title });
  }

  // Neighbours of an outage lose pressure because the branch is re-routed.
  for (const id of SCENARIO.outage) {
    for (const neighbour of geoFor(id)?.neighbours ?? []) {
      const current = statuses.get(neighbour);
      if (!current || current.status !== "normal") continue;
      statuses.set(neighbour, {
        status: "low",
        cause: `Переключение сети из-за работ в ${geoFor(id)?.name ?? id}`,
      });
    }
  }

  for (const district of SERVED_DISTRICTS) {
    const current = statuses.get(district.id);
    if (!current || current.status !== "normal") continue;
    if (district.depotKm >= FAR_EDGE_KM) {
      statuses.set(district.id, {
        status: "low",
        cause: "Удалённый участок сети, давление ниже нормы в часы пик",
      });
    }
  }

  return statuses;
}

// --- deterministic randomness ----------------------------------------------

/** Mulberry32, so a reset reproduces the same demo. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kazakh and Russian given names, matching how Aktau's population reads. */
const FIRST_NAMES = [
  "Айбек", "Әсел", "Нұрлан", "Гүлнар", "Ержан", "Динара", "Мадина", "Тимур",
  "Алия", "Дәурен", "Жанна", "Санжар", "Аяулым", "Бекзат", "Елена", "Сергей",
  "Ольга", "Дмитрий", "Наталья", "Андрей", "Ирина", "Виктор", "Асхат", "Камила",
];
const SURNAME_INITIALS = [
  "А.", "Б.", "Д.", "Е.", "Ж.", "К.", "М.", "Н.", "О.", "С.", "Т.", "Ш.",
];

function personName(random: () => number) {
  const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
  const initial = SURNAME_INITIALS[Math.floor(random() * SURNAME_INITIALS.length)];
  return `${first} ${initial}`;
}

/**
 * Plausible building number. Aktau numbers buildings within a microdistrict,
 * and bigger districts hold more of them.
 */
function buildingNumber(district: DistrictGeo, random: () => number) {
  const ceiling = Math.max(8, Math.min(72, Math.round(district.areaKm2 * 70)));
  return String(1 + Math.floor(random() * ceiling));
}

function uid() {
  return crypto.randomUUID();
}

function pressureFor(status: WaterStatus, random?: () => number) {
  const jitter = random ? (random() - 0.5) * 0.4 : 0;
  if (status === "none") return Math.max(0, ASSUMPTIONS.outagePressureBar + jitter * 0.3);
  if (status === "low") return Math.max(0.4, ASSUMPTIONS.lowPressureBar + jitter);
  return ASSUMPTIONS.nominalPressureBar + jitter;
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

/** Delivery point for a district: its centroid, which is inside the polygon. */
function deliveryPoint(district: DistrictGeo) {
  return { x: district.center.x, y: district.center.y };
}

function fleetAt(fill: (capacity: number) => number): Tanker[] {
  return FLEET.map((spec, index) => {
    const angle = (index / FLEET.length) * Math.PI * 2;
    const x = DEPOT.x + Math.cos(angle) * 22;
    const y = DEPOT.y + Math.sin(angle) * 22;
    return {
      id: String(spec.number),
      number: spec.number,
      plate: spec.plate,
      status: "idle" as const,
      capacityLiters: spec.capacity,
      waterLiters: fill(spec.capacity),
      x,
      y,
      startX: x,
      startY: y,
      targetX: x,
      targetY: y,
      targetDistrictId: null,
      tripStartedAt: null,
      tripDurationMs: 0,
      initialEtaMin: 0,
    };
  });
}

/** Real tanker list, parked at the КЖСА yard. Written once, when the tables are empty. */
function parkedFleet(): Tanker[] {
  return fleetAt((capacity) => Math.round((capacity * 0.8) / 100) * 100);
}

function baselineDistricts(now: number): DistrictState[] {
  return SERVED_DISTRICTS.map((geo) => ({
    id: geo.id,
    status: "normal" as const,
    pressureBar: ASSUMPTIONS.nominalPressureBar,
    expectedNormalAt: null,
    updatedAt: now,
    complaints6h: 0,
    cause: null,
  }));
}

function scenarioFleet(random: () => number): Tanker[] {
  return fleetAt((capacity) => Math.round((capacity * (0.55 + random() * 0.45)) / 100) * 100);
}

/** The 14/15 demo, including the invented residents. Not used at startup. */
function buildScenario(now: number): CityRows {
  const random = rng(20240924);
  const statuses = scenarioStatuses();

  const districts: DistrictState[] = SERVED_DISTRICTS.map((geo) => {
    const { status, cause } = statuses.get(geo.id) ?? { status: "normal" as const, cause: null };
    return {
      id: geo.id,
      status,
      pressureBar: Number(pressureFor(status, random).toFixed(1)),
      expectedNormalAt: status === "none" ? SCENARIO.expectedNormalAt : null,
      updatedAt:
        now - Math.round((status === "normal" ? 25 + random() * 40 : 4 + random() * 14)) * 60 * 1000,
      complaints6h: 0,
      cause,
    };
  });

  const incident: Incident = {
    id: SCENARIO.id,
    title: SCENARIO.title,
    summary: SCENARIO.summary,
    districtIds: [...SCENARIO.outage],
    startedAt: now - SCENARIO.startedMinutesAgo * 60 * 1000,
    expectedNormalAt: SCENARIO.expectedNormalAt,
  };

  const reports: Report[] = [];
  function addSeedReport(geo: DistrictGeo, type: ReportType, minutesAgo: number) {
    reports.push({
      id: `seed-${reports.length}`,
      districtId: geo.id,
      building: buildingNumber(geo, random),
      type,
      residentName: personName(random),
      createdAt: now - Math.round(minutesAgo * 60 * 1000),
      confirmed: minutesAgo > 45,
      dismissed: false,
    });
  }

  for (const geo of SERVED_DISTRICTS) {
    const state = districts.find((item) => item.id === geo.id);
    if (!state) continue;
    if (state.status === "none") {
      const count = 6 + Math.floor(random() * 5);
      for (let i = 0; i < count; i += 1) {
        addSeedReport(geo, random() < 0.75 ? "no_water" : "emergency", random() * 180);
      }
    } else if (state.status === "low") {
      const count = 1 + Math.floor(random() * 3);
      for (let i = 0; i < count; i += 1) {
        addSeedReport(geo, random() < 0.7 ? "low_pressure" : "no_hot", random() * 320);
      }
    } else if (random() < 0.22) {
      addSeedReport(geo, random() < 0.5 ? "no_hot" : "low_pressure", 60 + random() * 400);
    }
  }
  // The resident demo opens as Айбек Н. at 14 мкр, дом 12.
  const demoHome = geoFor("14");
  if (demoHome) {
    reports.push({
      id: "seed-demo-aybek",
      districtId: demoHome.id,
      building: "12",
      type: "no_water",
      residentName: "Айбек Н.",
      createdAt: now - 3 * 60 * 60 * 1000,
      confirmed: false,
      dismissed: false,
    });
  }
  reports.sort((a, b) => b.createdAt - a.createdAt);

  const tankers = scenarioFleet(random);

  const firstOutage = geoFor(SCENARIO.outage[0]);
  const requests: DeliveryRequest[] = [];
  if (firstOutage) {
    const point = deliveryPoint(firstOutage);
    const serving = tankers[0];
    serving.status = "serving";
    serving.x = point.x;
    serving.y = point.y;
    serving.startX = point.x;
    serving.startY = point.y;
    serving.targetX = point.x;
    serving.targetY = point.y;
    serving.targetDistrictId = firstOutage.id;
    serving.waterLiters = Math.round(serving.capacityLiters * 0.35);
    requests.push({
      id: "req-460",
      number: 460,
      districtId: firstOutage.id,
      building: buildingNumber(firstOutage, random),
      tankerId: serving.id,
      status: "done",
      createdAt: now - 42 * 60 * 1000,
      residentName: personName(random),
    });
  }

  const outageNames = SCENARIO.outage.map((id) => geoFor(id)?.name ?? id).join(" и ");
  const notifications: AppNotification[] = [
    {
      id: "n1",
      title: `Нет воды: ${outageNames}`,
      body: `${SCENARIO.summary} Ожидаемое восстановление — ${SCENARIO.expectedNormalAt}.`,
      createdAt: incident.startedAt,
      read: false,
      kind: "outage",
      audience: null,
    },
    {
      id: "n2",
      title: "Водовоз на месте",
      body: firstOutage
        ? `Водовоз №${tankers[0].number} раздаёт воду в ${firstOutage.name}.`
        : "Водовоз раздаёт воду.",
      createdAt: now - 18 * 60 * 1000,
      read: false,
      kind: "tanker",
      audience: null,
    },
    {
      id: "n3",
      title: "График подачи",
      body: `Восстановление подачи в ${outageNames} запланировано на ${SCENARIO.expectedNormalAt}.`,
      createdAt: now - 52 * 60 * 1000,
      read: true,
      kind: "schedule",
      audience: null,
    },
  ];

  return { districts, tankers, reports, requests, notifications, incident };
}

function servedGeo(id: string) {
  const geo = geoFor(id);
  if (!geo || geo.kind === "industrial") throw new ActionError("Unknown district", 404);
  return geo;
}

async function readCity() {
  await ensureSeeded(baselineDistricts(Date.now()), parkedFleet());
  const city = await loadCity();
  const districtOrder = new Map(SERVED_DISTRICTS.map((district, index) => [district.id, index]));
  const tankerOrder = new Map(FLEET.map((spec, index) => [String(spec.number), index]));
  city.districts.sort(
    (a, b) => (districtOrder.get(a.id) ?? 999) - (districtOrder.get(b.id) ?? 999),
  );
  city.tankers.sort((a, b) => (tankerOrder.get(a.id) ?? 999) - (tankerOrder.get(b.id) ?? 999));
  return city;
}

function nameFor(id: string) {
  return geoFor(id)?.name ?? id;
}

function placeLine(report: Report) {
  return `${reportLabel(report.type)}: ${nameFor(report.districtId)}, дом ${report.building}.`;
}

function notice(
  title: string,
  body: string,
  kind: AppNotification["kind"],
  audience: string | null = null,
): AppNotification {
  return {
    id: uid(),
    title,
    body,
    createdAt: Date.now(),
    read: false,
    kind,
    audience,
  };
}

// --- trips ------------------------------------------------------------------

/** When a stored trip has elapsed, write serving once and close the request. */
async function settleArrivals(city: CityRows, now: number) {
  let changed = false;
  for (const tanker of city.tankers) {
    if (tanker.status !== "en_route" || !tanker.tripStartedAt || !tanker.tripDurationMs) continue;
    if ((now - tanker.tripStartedAt) / tanker.tripDurationMs < 1) continue;
    const waterLiters = Math.max(0, tanker.waterLiters - ASSUMPTIONS.litresPerStop);
    const arrived = await arriveTanker(tanker.id, {
      x: tanker.targetX,
      y: tanker.targetY,
      waterLiters,
    });
    if (!arrived) continue;
    changed = true;
    const request = city.requests.find(
      (item) => item.tankerId === tanker.id && item.status === "en_route",
    );
    if (request) await finishRequest(request.id);
    await insertNotification(
      notice(
        `Водовоз №${tanker.number} на месте`,
        `${nameFor(tanker.targetDistrictId ?? "")}, можно набирать воду. Остаток ${waterLiters.toLocaleString("ru-RU")} л.`,
        "tanker",
      ),
    );
  }
  return changed;
}

/** Idle tankers ordered by real distance to a district, fullest first on ties. */
function rankIdle(city: CityRows, geo: DistrictGeo) {
  const point = deliveryPoint(geo);
  return city.tankers
    .filter((tanker) => tanker.status === "idle" && tanker.waterLiters > 0)
    .map((tanker) => ({
      tanker,
      units: distance(tanker.x, tanker.y, point.x, point.y),
    }))
    .sort((a, b) => a.units - b.units || b.tanker.waterLiters - a.tanker.waterLiters);
}

export async function dispatchNearest(
  districtId: string,
  building?: string,
  residentName = "Диспетчер",
) {
  const geo = servedGeo(districtId);
  const city = await readCity();
  const targetBuilding = building?.trim() || "";
  const point = deliveryPoint(geo);

  for (const best of rankIdle(city, geo)) {
    const eta = etaMinutesForUnits(best.units);
    const now = Date.now();
    const claimed = await dispatchTanker(best.tanker.id, {
      startX: best.tanker.x,
      startY: best.tanker.y,
      targetX: point.x,
      targetY: point.y,
      targetDistrictId: geo.id,
      tripStartedAt: now,
      tripDurationMs: Math.round((eta * 60 * 1000) / SIM_RATIO),
    });
    if (!claimed) continue;

    const waiting = city.requests
      .filter(
        (item) =>
          item.districtId === districtId &&
          item.status === "accepted" &&
          (!targetBuilding || item.building === targetBuilding),
      )
      .sort((a, b) => a.createdAt - b.createdAt);
    const existing = waiting[0];
    let request: DeliveryRequest;
    if (existing) {
      await sendRequest(existing.id, best.tanker.id);
      request = { ...existing, tankerId: best.tanker.id, status: "en_route" };
    } else {
      request = {
        id: uid(),
        number: await nextRequestNumber(),
        districtId,
        building: targetBuilding || "—",
        tankerId: best.tanker.id,
        status: "en_route",
        createdAt: now,
        residentName,
      };
      await insertRequest(request);
    }

    await insertNotification(
      notice(
        `Водовоз №${best.tanker.number} в пути`,
        `${geo.name}: водовоз №${best.tanker.number} прибудет примерно через ${eta} мин (${unitsToKm(best.units).toFixed(1)} км).`,
        "tanker",
      ),
    );
    return { tanker: best.tanker, request, eta };
  }
  return null;
}

/** Resident asks for water. The tanker stays put until a dispatcher sends it. */
export async function requestDelivery(input: {
  districtId: string;
  building?: string;
  residentName?: string;
}) {
  const geo = servedGeo(input.districtId);
  const city = await readCity();
  const building = input.building?.trim() || "—";
  const residentName = input.residentName?.trim() || "Житель";
  const open = city.requests.find(
    (item) =>
      item.districtId === input.districtId &&
      item.building === building &&
      item.status !== "done",
  );
  if (open) return open;

  const request: DeliveryRequest = {
    id: uid(),
    number: await nextRequestNumber(),
    districtId: geo.id,
    building,
    tankerId: null,
    status: "accepted",
    createdAt: Date.now(),
    residentName,
  };
  await insertRequest(request);
  return request;
}

// --- reports ----------------------------------------------------------------

export async function addReport(input: {
  districtId: string;
  building?: string;
  type: ReportType;
  residentName?: string;
}) {
  const geo = servedGeo(input.districtId);
  const city = await readCity();
  const state = city.districts.find((item) => item.id === geo.id);
  if (!state) throw new ActionError("Unknown district", 404);

  const building = input.building?.trim() || "—";
  const residentName = input.residentName?.trim() || "Житель";
  const report: Report = {
    id: uid(),
    districtId: geo.id,
    building,
    type: input.type,
    residentName,
    createdAt: Date.now(),
    confirmed: false,
    dismissed: false,
  };
  await insertReports([report]);

  const severe = input.type === "no_water" || input.type === "emergency";
  if (severe && state.status !== "none") {
    state.status = "none";
    state.expectedNormalAt = null;
    state.updatedAt = Date.now();
    state.pressureBar = Number(pressureFor("none").toFixed(1));
    state.cause = `Сигналы жителей, ${geo.name}`;
    await saveDistrict(state);
    await insertNotification(
      notice(
        `Нет воды: ${geo.name}`,
        `Жители сообщают об отключении, дом ${building}. Район отмечен на карте.`,
        "outage",
      ),
    );
  } else if (!severe && state.status === "normal") {
    state.status = "low";
    state.expectedNormalAt = null;
    state.updatedAt = Date.now();
    state.pressureBar = Number(pressureFor("low").toFixed(1));
    state.cause = `Сигналы о слабом напоре, ${geo.name}`;
    await saveDistrict(state);
    await insertNotification(
      notice(`Слабый напор: ${geo.name}`, "Подача сохраняется, давление ниже нормы.", "schedule"),
    );
  }
  return report;
}

export async function confirmReport(id: string) {
  const report = (await readCity()).reports.find((item) => item.id === id);
  if (!report) throw new ActionError("Report not found", 404);
  if (report.dismissed || report.confirmed) return report;
  await setReportFlag(id, "confirmed");
  await insertNotification(
    notice(
      "Сигнал подтверждён",
      `${placeLine(report)} Служба приняла сообщение.`,
      "report",
      report.residentName,
    ),
  );
  return { ...report, confirmed: true };
}

export async function dismissReport(id: string) {
  const report = (await readCity()).reports.find((item) => item.id === id);
  if (!report) throw new ActionError("Report not found", 404);
  if (report.confirmed || report.dismissed) return report;
  await setReportFlag(id, "dismissed");
  await insertNotification(
    notice(
      "Сигнал не подтверждён",
      `${placeLine(report)} Диспетчер не нашёл такой проблемы.`,
      "report",
      report.residentName,
    ),
  );
  return { ...report, dismissed: true };
}

export async function addFeedback(text: string, residentName: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new ActionError("Напишите сообщение", 400);
  const entry = {
    id: uid(),
    text: trimmed,
    residentName: residentName.trim() || "Житель",
    createdAt: Date.now(),
  };
  await insertFeedback(entry);
  return entry;
}

export async function markNotificationsRead(ids?: string[]) {
  await markReadRows(ids);
}

/** Demo control: flood one building with complaints to trip the burst rule. */
export async function runOutageScenario(districtId = DEFAULT_HOME_DISTRICT) {
  const geo = servedGeo(districtId);
  const now = Date.now();
  const random = rng(now & 0xffff);
  const building = buildingNumber(geo, random);
  const reports: Report[] = [];
  for (let i = 0; i < BURST_THRESHOLD; i += 1) {
    reports.push({
      id: uid(),
      districtId,
      building,
      type: "no_water",
      residentName: personName(random),
      createdAt: now - i * 55 * 1000,
      confirmed: false,
      dismissed: false,
    });
  }
  await readCity();
  await insertReports(reports);

  const city = await loadCity();
  const state = city.districts.find((item) => item.id === districtId);
  if (!state) throw new ActionError("Unknown district", 404);
  state.status = "none";
  state.expectedNormalAt = null;
  state.updatedAt = now;
  state.pressureBar = Number(pressureFor("none").toFixed(1));
  state.cause = `Возможный порыв, дом ${building}`;
  await saveDistrict(state);
  await setIncident({
    id: `burst-${districtId}`,
    title: `Возможный порыв: ${geo.name}, дом ${building}`,
    summary: `${BURST_THRESHOLD} жалоб из одного дома за ${ASSUMPTIONS.burstWindowMin} минут. Это быстрее обычного вечернего разбора воды, поэтому отмечено как авария.`,
    districtIds: [districtId],
    startedAt: now,
    expectedNormalAt: null,
  });
  await insertNotification(
    notice(
      `Нет воды: ${geo.name}`,
      `Серия жалоб из дома ${building}. Район отмечен на карте.`,
      "outage",
    ),
  );
}

export async function resetDemo() {
  await writeCity(buildScenario(Date.now()));
}

// --- analysis ---------------------------------------------------------------

function detectAnomalies(city: CityRows, now: number): Anomaly[] {
  const groups = new Map<string, Report[]>();
  for (const report of city.reports) {
    if (now - report.createdAt > BURST_WINDOW_MS) continue;
    const key = `${report.districtId}|${report.building}`;
    const list = groups.get(key) ?? [];
    list.push(report);
    groups.set(key, list);
  }

  const anomalies: Anomaly[] = [];
  for (const [key, list] of groups) {
    if (list.length < BURST_THRESHOLD) continue;
    const [districtId, building] = key.split("|");
    anomalies.push({
      id: key,
      districtId,
      building,
      count: list.length,
      kind: "pipe_burst",
      message: `Возможный порыв: ${list.length} жалоб из дома ${building}, ${nameFor(districtId)}, за ${ASSUMPTIONS.burstWindowMin} минут.`,
    });
  }

  const lastHour = city.reports.filter((report) => now - report.createdAt <= 3600_000).length;
  const prevHour = city.reports.filter((report) => {
    const age = now - report.createdAt;
    return age > 3600_000 && age <= 2 * 3600_000;
  }).length;
  if (lastHour >= 6 && lastHour >= prevHour * 2 && anomalies.length === 0) {
    anomalies.push({
      id: "demand-peak",
      districtId: city.incident?.districtIds[0] ?? SERVED_DISTRICTS[0].id,
      building: "*",
      count: lastHour,
      kind: "demand_peak",
      message: `Пик обращений: ${lastHour} за последний час против ${prevHour} часом ранее.`,
    });
  }
  return anomalies;
}

function scheduleFor(status: WaterStatus, expectedNormalAt: string | null): ScheduleSlot[] {
  if (status === "none") {
    const back = expectedNormalAt ?? "18:00";
    return [
      { from: "06:00", to: "09:00", title: "Подача отключена", status: "none" },
      { from: "09:00", to: back, title: "Ремонтные работы", status: "none" },
      { from: back, to: "22:00", title: "Восстановление подачи", status: "low" },
      { from: "22:00", to: "06:00", title: "Подача по графику", status: "low" },
    ];
  }
  if (status === "low") {
    return [
      { from: "06:00", to: "09:00", title: "Подача воды", status: "normal" },
      { from: "09:00", to: "18:00", title: "Ограниченная подача", status: "low" },
      { from: "18:00", to: "22:00", title: "Подача воды", status: "normal" },
      { from: "22:00", to: "06:00", title: "Ограниченная подача", status: "low" },
    ];
  }
  return [
    { from: "06:00", to: "09:00", title: "Подача воды", status: "normal" },
    { from: "09:00", to: "18:00", title: "Подача воды", status: "normal" },
    { from: "18:00", to: "22:00", title: "Подача воды", status: "normal" },
    { from: "22:00", to: "06:00", title: "Подача воды", status: "normal" },
  ];
}

/** Rule-based readout of the current picture. Deliberately not called a forecast. */
function situationText(city: CityRows, anomalies: Anomaly[], now: number) {
  const burst = anomalies.find((item) => item.kind === "pipe_burst");
  if (burst) {
    return `${burst.message} Ближайший свободный водовоз можно отправить вручную.`;
  }
  const outages = city.districts.filter((item) => item.status === "none");
  const lastHour = city.reports.filter((report) => now - report.createdAt <= 3600_000).length;
  if (outages.length > 0) {
    const names = outages.map((item) => nameFor(item.id)).join(", ");
    return `Без воды: ${names}. За последний час ${lastHour} обращений, порог порыва — ${BURST_THRESHOLD} из одного дома за ${ASSUMPTIONS.burstWindowMin} минут.`;
  }
  if (lastHour >= 4) {
    return `Обращения растут: ${lastHour} за час. Стоит держать свободный водовоз ближе к удалённым районам.`;
  }
  return "Аварийных отключений нет. Обращения в пределах обычного фона.";
}

function withEta(tanker: Tanker): Tanker {
  if (!tanker.tripDurationMs) return { ...tanker, initialEtaMin: 0 };
  return {
    ...tanker,
    initialEtaMin: Math.round((tanker.tripDurationMs * SIM_RATIO) / 60_000),
  };
}

function publicTanker(tanker: Tanker, home: { x: number; y: number } | null, now: number) {
  let x = tanker.x;
  let y = tanker.y;
  let etaMinutes = 0;
  if (tanker.status === "en_route" && tanker.tripStartedAt && tanker.tripDurationMs) {
    const progress = Math.min(1, (now - tanker.tripStartedAt) / tanker.tripDurationMs);
    x = tanker.startX + (tanker.targetX - tanker.startX) * progress;
    y = tanker.startY + (tanker.targetY - tanker.startY) * progress;
    etaMinutes = Math.max(0, Math.round(tanker.initialEtaMin * (1 - progress)));
  }
  const units = home ? distance(x, y, home.x, home.y) : null;
  return {
    ...tanker,
    x,
    y,
    etaMinutes,
    etaToHome:
      tanker.status === "idle" && units !== null
        ? etaMinutesForUnits(units)
        : tanker.status === "en_route"
          ? etaMinutes
          : null,
    distanceKm: units === null ? null : Number(unitsToKm(units).toFixed(1)),
  };
}

function project(city: CityRows, homeDistrictId: string, now: number): Snapshot {
  const tankers = city.tankers.map(withEta);
  const view: CityRows = { ...city, tankers };
  const homeGeo = geoFor(homeDistrictId) ?? SERVED_DISTRICTS[0];
  const home = deliveryPoint(homeGeo);
  const anomalies = detectAnomalies(view, now);

  const districts = view.districts.map((district) => ({
    ...district,
    complaints6h: view.reports.filter(
      (report) =>
        report.districtId === district.id && now - report.createdAt <= 6 * 3600_000,
    ).length,
  }));

  const schedules: Record<string, ScheduleSlot[]> = {};
  for (const district of districts) {
    schedules[district.id] = scheduleFor(district.status, district.expectedNormalAt);
  }

  const hourly: { hour: number; count: number }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const start = now - (i + 1) * 3600_000;
    const end = now - i * 3600_000;
    hourly.push({
      hour: new Date(end).getHours(),
      count: view.reports.filter(
        (report) => report.createdAt > start && report.createdAt <= end,
      ).length,
    });
  }

  const suggestions: Suggestion[] = [];
  const pendingIds = new Set(
    view.requests.filter((item) => item.status === "accepted").map((item) => item.districtId),
  );
  const needsWater = districts.filter(
    (district) =>
      district.status === "none" ||
      pendingIds.has(district.id) ||
      anomalies.some(
        (item) => item.districtId === district.id && item.kind === "pipe_burst",
      ),
  );
  for (const district of needsWater) {
    const geo = geoFor(district.id);
    if (!geo) continue;
    const covered = tankers.some(
      (tanker) =>
        tanker.targetDistrictId === district.id &&
        (tanker.status === "en_route" || tanker.status === "serving"),
    );
    if (covered) continue;
    const best = rankIdle(view, geo)[0];
    if (!best) continue;
    const burst = anomalies.find(
      (item) => item.districtId === district.id && item.kind === "pipe_burst",
    );
    const pending = view.requests.find(
      (item) => item.districtId === district.id && item.status === "accepted",
    );
    suggestions.push({
      districtId: district.id,
      districtName: geo.name,
      tankerId: best.tanker.id,
      tankerNumber: best.tanker.number,
      tankerPlate: best.tanker.plate,
      etaMinutes: etaMinutesForUnits(best.units),
      distanceKm: Number(unitsToKm(best.units).toFixed(1)),
      reason: pending
        ? `Заявка №${pending.number} от ${pending.residentName}, дом ${pending.building}.`
        : (burst?.message ??
          district.cause ??
          `${geo.name} без воды, ближайший свободный водовоз в ${unitsToKm(best.units).toFixed(1)} км.`),
    });
  }
  suggestions.sort((a, b) => a.etaMinutes - b.etaMinutes);

  return {
    serverTime: now,
    homeDistrictId: homeGeo.id,
    meta: {
      simulated: true,
      city: CITY.name,
      operator: UTILITY.name,
      waterSource: `${WATER_SOURCE.name} — ${WATER_SOURCE.method.toLowerCase()}`,
      coverage: {
        districts: COVERAGE.districts,
        areaKm2: Number(COVERAGE.areaKm2.toFixed(1)),
        buildings: COVERAGE.buildings,
        residentialBuildings: COVERAGE.residentialBuildings,
      },
      sources: SOURCES.map((item) => ({ ...item })),
      assumptions: [...ASSUMPTION_NOTES],
    },
    incident: view.incident,
    districts,
    tankers: tankers.map((tanker) => publicTanker(tanker, home, now)),
    reports: view.reports,
    requests: view.requests,
    notifications: view.notifications,
    anomalies,
    schedules,
    hourly,
    situation: situationText({ ...view, districts }, anomalies, now),
    suggestions,
  };
}

export async function getSnapshot(homeDistrictId = DEFAULT_HOME_DISTRICT): Promise<Snapshot> {
  const now = Date.now();
  let city = await readCity();
  if (await settleArrivals(city, now)) city = await readCity();
  return project(city, homeDistrictId, now);
}
