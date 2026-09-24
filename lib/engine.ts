import type {
  Anomaly,
  AppNotification,
  DeliveryRequest,
  District,
  Report,
  ReportType,
  ScheduleSlot,
  Snapshot,
  Tanker,
  WaterStatus,
} from "./types";
import { persistReport } from "./supabase";

/** Real seconds pass faster so an 8-minute arrival is visible in a pitch. */
export const SIM_RATIO = 20;
const BURST_WINDOW_MS = 15 * 60 * 1000;
const BURST_THRESHOLD = 10;

type Store = {
  districts: District[];
  tankers: Tanker[];
  reports: Report[];
  requests: DeliveryRequest[];
  notifications: AppNotification[];
  nextRequestNumber: number;
};

const globalStore = globalThis as typeof globalThis & { __komektesu?: Store };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function pressureFor(status: WaterStatus) {
  if (status === "none") return 0.2;
  if (status === "low") return 1.1;
  return 3.2;
}

const DISTRICT_DEFS: Omit<District, "status" | "expectedNormalAt" | "updatedAt" | "pressureBar">[] = [
  {
    id: "17",
    name: "17 мкр",
    baseFill: "#8FCF7C",
    path: "M150 48L208 34L232 72L204 112L150 104L128 72L150 48Z",
    label: { x: 156, y: 62 },
    anchor: { x: 180, y: 73 },
  },
  {
    id: "18",
    name: "18 мкр",
    baseFill: "#8FCF7C",
    path: "M240 30L318 22L346 62L316 102L248 94L222 58L240 30Z",
    label: { x: 262, y: 50 },
    anchor: { x: 284, y: 62 },
  },
  {
    id: "16",
    name: "16 мкр",
    baseFill: "#7EC86E",
    path: "M58 118L132 100L162 140L138 186L68 180L36 142L58 118Z",
    label: { x: 78, y: 132 },
    anchor: { x: 99, y: 143 },
  },
  {
    id: "14",
    name: "14 мкр",
    baseFill: "#8FCF7C",
    path: "M150 118L232 100L274 142L262 210L190 226L138 186L130 146L150 118Z",
    label: { x: 178, y: 150 },
    anchor: { x: 190, y: 163 },
  },
  {
    id: "12",
    name: "12 мкр",
    baseFill: "#8FCF7C",
    path: "M274 126L350 114L372 168L336 210L274 194L250 156L274 126Z",
    label: { x: 286, y: 150 },
    anchor: { x: 311, y: 162 },
  },
  {
    id: "11",
    name: "11 мкр",
    baseFill: "#7EC86E",
    path: "M42 196L124 184L154 232L120 278L42 268L18 226L42 196Z",
    label: { x: 62, y: 218 },
    anchor: { x: 86, y: 231 },
  },
  {
    id: "9",
    name: "9 мкр",
    baseFill: "#8FCF7C",
    path: "M166 214L246 202L278 254L238 306L164 296L140 252L166 214Z",
    label: { x: 186, y: 242 },
    anchor: { x: 209, y: 254 },
  },
  {
    id: "7",
    name: "7 мкр",
    baseFill: "#8FCF7C",
    path: "M28 286L114 274L138 326L106 372L28 362L6 320L28 286Z",
    label: { x: 48, y: 312 },
    anchor: { x: 72, y: 323 },
  },
  {
    id: "3",
    name: "3 мкр",
    baseFill: "#7EC86E",
    path: "M148 308L224 298L250 350L210 394L144 382L126 338L148 308Z",
    label: { x: 164, y: 336 },
    anchor: { x: 188, y: 346 },
  },
  {
    id: "1",
    name: "1 мкр",
    baseFill: "#8FCF7C",
    path: "M20 378L96 364L116 418L68 454L12 434L0 396L20 378Z",
    label: { x: 36, y: 400 },
    anchor: { x: 58, y: 409 },
  },
];

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

export function etaMinutesFor(dist: number) {
  return Math.max(4, Math.min(28, Math.round(dist / 12.3)));
}

function homePoint(district: District) {
  return { x: district.anchor.x, y: district.anchor.y + 16 };
}

function createStore(now = Date.now()): Store {
  const districts: District[] = DISTRICT_DEFS.map((def) => {
    const status: WaterStatus = def.id === "14" ? "low" : def.id === "9" ? "none" : "normal";
    return {
      ...def,
      status,
      expectedNormalAt: status === "low" ? "18:00" : status === "none" ? null : null,
      updatedAt: now - (def.id === "14" ? 10 : def.id === "9" ? 26 : 40) * 60 * 1000,
      pressureBar: pressureFor(status),
    };
  });

  const tankers: Tanker[] = [
    {
      id: "12",
      number: 12,
      status: "idle",
      waterLiters: 4000,
      x: 200,
      y: 78,
      startX: 200,
      startY: 78,
      targetX: 200,
      targetY: 78,
      targetDistrictId: null,
      tripStartedAt: null,
      tripDurationMs: 0,
      initialEtaMin: 0,
    },
    {
      id: "7",
      number: 7,
      status: "idle",
      waterLiters: 3200,
      x: 78,
      y: 248,
      startX: 78,
      startY: 248,
      targetX: 78,
      targetY: 248,
      targetDistrictId: null,
      tripStartedAt: null,
      tripDurationMs: 0,
      initialEtaMin: 0,
    },
    {
      id: "4",
      number: 4,
      status: "serving",
      waterLiters: 1800,
      x: 330,
      y: 150,
      startX: 330,
      startY: 150,
      targetX: 330,
      targetY: 150,
      targetDistrictId: "12",
      tripStartedAt: null,
      tripDurationMs: 0,
      initialEtaMin: 0,
    },
    {
      id: "9",
      number: 9,
      status: "idle",
      waterLiters: 5100,
      x: 250,
      y: 300,
      startX: 250,
      startY: 300,
      targetX: 250,
      targetY: 300,
      targetDistrictId: null,
      tripStartedAt: null,
      tripDurationMs: 0,
      initialEtaMin: 0,
    },
    {
      id: "3",
      number: 3,
      status: "idle",
      waterLiters: 4500,
      x: 145,
      y: 48,
      startX: 145,
      startY: 48,
      targetX: 145,
      targetY: 48,
      targetDistrictId: null,
      tripStartedAt: null,
      tripDurationMs: 0,
      initialEtaMin: 0,
    },
  ];

  const reports: Report[] = [];
  for (let i = 0; i < 12; i += 1) {
    reports.push({
      id: `hist-${i}`,
      districtId: i % 2 === 0 ? "14" : "9",
      building: "12",
      type: i % 3 === 0 ? "low_pressure" : "no_water",
      residentName: "Айбек Н.",
      createdAt: now - (i === 0 ? 26 : 26 + i * 20) * 60 * 60 * 1000,
      confirmed: i >= 3,
    });
  }

  const cityNoise: { districtId: string; type: ReportType; hoursAgo: number }[] = [
    { districtId: "9", type: "no_water", hoursAgo: 1 },
    { districtId: "9", type: "no_water", hoursAgo: 1.2 },
    { districtId: "9", type: "emergency", hoursAgo: 2 },
    { districtId: "9", type: "no_water", hoursAgo: 3 },
    { districtId: "14", type: "low_pressure", hoursAgo: 2 },
    { districtId: "14", type: "low_pressure", hoursAgo: 5 },
    { districtId: "11", type: "no_hot", hoursAgo: 4 },
    { districtId: "7", type: "low_pressure", hoursAgo: 6 },
    { districtId: "3", type: "no_hot", hoursAgo: 7 },
    { districtId: "16", type: "low_pressure", hoursAgo: 8 },
    { districtId: "1", type: "no_water", hoursAgo: 9 },
    { districtId: "18", type: "low_pressure", hoursAgo: 3 },
  ];
  cityNoise.forEach((item, index) => {
    reports.push({
      id: `city-${index}`,
      districtId: item.districtId,
      building: String(4 + (index % 6)),
      type: item.type,
      residentName: `Житель ${index + 1}`,
      createdAt: now - item.hoursAgo * 60 * 60 * 1000,
      confirmed: item.hoursAgo > 4,
    });
  });

  const notifications: AppNotification[] = [
    {
      id: "n1",
      title: "Перебои с давлением",
      body: "Сегодня в 14 мкр возможны перебои с давлением.",
      createdAt: now - 20 * 60 * 1000,
      read: false,
      kind: "schedule",
    },
    {
      id: "n2",
      title: "Водовозы в городе",
      body: "Доступно 5 водовозов. Ближайший №12 — около 8 минут.",
      createdAt: now - 2 * 60 * 1000,
      read: false,
      kind: "tanker",
    },
    {
      id: "n3",
      title: "График на вечер",
      body: "В 18:00 в 14 мкр ожидается нормальное давление.",
      createdAt: now - 50 * 60 * 1000,
      read: false,
      kind: "schedule",
    },
  ];

  return {
    districts,
    tankers,
    reports,
    requests: [
      {
        id: "req-458",
        number: 458,
        districtId: "14",
        building: "12",
        tankerId: "12",
        status: "accepted",
        createdAt: now - 8 * 60 * 1000,
        residentName: "Айбек Н.",
      },
    ],
    notifications,
    nextRequestNumber: 459,
  };
}

function store() {
  if (!globalStore.__komektesu) globalStore.__komektesu = createStore();
  return globalStore.__komektesu;
}

function districtById(id: string) {
  const district = store().districts.find((item) => item.id === id);
  if (!district) throw new Error(`Unknown district ${id}`);
  return district;
}

function notify(title: string, body: string, kind: AppNotification["kind"]) {
  store().notifications.unshift({
    id: uid(),
    title,
    body,
    createdAt: Date.now(),
    read: false,
    kind,
  });
}

function settleTrips(s: Store, now: number) {
  for (const tanker of s.tankers) {
    if (tanker.status !== "en_route" || !tanker.tripStartedAt || !tanker.tripDurationMs) continue;
    const progress = (now - tanker.tripStartedAt) / tanker.tripDurationMs;
    if (progress < 1) continue;
    tanker.status = "serving";
    tanker.x = tanker.targetX;
    tanker.y = tanker.targetY;
    tanker.waterLiters = Math.max(400, tanker.waterLiters - 800);
    const request = s.requests.find((item) => item.tankerId === tanker.id && item.status === "en_route");
    if (request) request.status = "done";
    const district = s.districts.find((item) => item.id === tanker.targetDistrictId);
    notify(
      `Водовоз №${tanker.number} на месте`,
      `${district?.name ?? "Район"}, можно набирать воду. Запас ${tanker.waterLiters.toLocaleString("ru-RU")} л.`,
      "tanker",
    );
  }
}

function assignTanker(tanker: Tanker, district: District, eta: number) {
  const home = homePoint(district);
  tanker.status = "en_route";
  tanker.startX = tanker.x;
  tanker.startY = tanker.y;
  tanker.targetX = home.x;
  tanker.targetY = home.y;
  tanker.targetDistrictId = district.id;
  tanker.tripStartedAt = Date.now();
  tanker.initialEtaMin = eta;
  tanker.tripDurationMs = (eta * 60 * 1000) / SIM_RATIO;
}

export function dispatchNearest(districtId: string, building = "12", residentName = "Айбек Н.") {
  const s = store();
  const district = districtById(districtId);
  const home = homePoint(district);
  const idle = s.tankers
    .filter((tanker) => tanker.status === "idle")
    .sort(
      (a, b) =>
        distance(a.x, a.y, home.x, home.y) - distance(b.x, b.y, home.x, home.y),
    );
  const tanker = idle[0];
  if (!tanker) return null;
  const eta = etaMinutesFor(distance(tanker.x, tanker.y, home.x, home.y));
  assignTanker(tanker, district, eta);

  let request = s.requests.find(
    (item) =>
      item.districtId === districtId &&
      item.building === building &&
      item.residentName === residentName &&
      item.status === "accepted",
  );
  if (request) {
    request.tankerId = tanker.id;
    request.status = "en_route";
  } else {
    request = {
      id: uid(),
      number: s.nextRequestNumber,
      districtId,
      building,
      tankerId: tanker.id,
      status: "en_route",
      createdAt: Date.now(),
      residentName,
    };
    s.nextRequestNumber += 1;
    s.requests.unshift(request);
  }

  notify(
    `Водовоз №${tanker.number} в пути`,
    `Водовоз №${tanker.number} прибудет к вашему дому через ${eta} минут.`,
    "tanker",
  );
  return { tanker, request, eta };
}

export function addReport(input: {
  districtId: string;
  building?: string;
  type: ReportType;
  residentName?: string;
}) {
  const s = store();
  const building = input.building?.trim() || "12";
  const residentName = input.residentName?.trim() || "Айбек Н.";
  const report: Report = {
    id: uid(),
    districtId: input.districtId,
    building,
    type: input.type,
    residentName,
    createdAt: Date.now(),
    confirmed: false,
  };
  s.reports.unshift(report);
  void persistReport(report).catch(() => undefined);

  const district = districtById(input.districtId);
  const severe = input.type === "no_water" || input.type === "emergency";
  if (severe) {
    district.status = "none";
    district.expectedNormalAt = null;
    district.updatedAt = Date.now();
    district.pressureBar = pressureFor("none");
    notify(
      `Нет воды: ${district.name}`,
      `Жители сообщают об отключении в ${district.name}, дом ${building}.`,
      "outage",
    );
    const already = s.tankers.some(
      (tanker) => tanker.targetDistrictId === district.id && tanker.status === "en_route",
    );
    if (!already) dispatchNearest(district.id, building, residentName);
  } else if (district.status === "normal") {
    district.status = "low";
    district.expectedNormalAt = "18:00";
    district.updatedAt = Date.now();
    district.pressureBar = pressureFor("low");
    notify(
      `Слабый напор: ${district.name}`,
      "Подача сохраняется, давление ниже нормы.",
      "schedule",
    );
  }
  return report;
}

export function confirmReport(id: string) {
  const report = store().reports.find((item) => item.id === id);
  if (report) report.confirmed = true;
  return report ?? null;
}

export function markNotificationsRead(ids?: string[]) {
  for (const item of store().notifications) {
    if (!ids || ids.includes(item.id)) item.read = true;
  }
}

export function runOutageScenario(districtId = "14") {
  const s = store();
  const now = Date.now();
  for (let i = 0; i < BURST_THRESHOLD; i += 1) {
    const report: Report = {
      id: uid(),
      districtId,
      building: "12",
      type: "no_water",
      residentName: i === 0 ? "Айбек Н." : `Житель ${i + 20}`,
      createdAt: now - i * 60 * 1000,
      confirmed: false,
    };
    s.reports.unshift(report);
    void persistReport(report).catch(() => undefined);
  }
  const district = districtById(districtId);
  district.status = "none";
  district.expectedNormalAt = null;
  district.updatedAt = now;
  district.pressureBar = pressureFor("none");
  notify(
    `Нет воды: ${district.name}`,
    "Серия жалоб из одного дома. Район отмечен красным.",
    "outage",
  );
  const already = s.tankers.some(
    (tanker) => tanker.targetDistrictId === district.id && tanker.status === "en_route",
  );
  if (!already) dispatchNearest(district.id, "12", "Айбек Н.");
}

export function resetDemo() {
  globalStore.__komektesu = createStore();
}

function detectAnomalies(s: Store, now: number): Anomaly[] {
  const groups = new Map<string, Report[]>();
  for (const report of s.reports) {
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
    const name = s.districts.find((item) => item.id === districtId)?.name ?? districtId;
    anomalies.push({
      id: key,
      districtId,
      building,
      count: list.length,
      kind: "pipe_burst",
      message: `Возможный порыв трубы: ${list.length} жалоб из дома ${building}, ${name}, за 15 минут.`,
    });
  }

  const lastHour = s.reports.filter((report) => now - report.createdAt <= 60 * 60 * 1000).length;
  const prevHour = s.reports.filter((report) => {
    const age = now - report.createdAt;
    return age > 60 * 60 * 1000 && age <= 2 * 60 * 60 * 1000;
  }).length;
  if (lastHour >= 6 && lastHour >= prevHour * 2 && !anomalies.some((item) => item.kind === "pipe_burst")) {
    anomalies.push({
      id: "peak",
      districtId: "14",
      building: "*",
      count: lastHour,
      kind: "demand_peak",
      message: `Пик обращений: ${lastHour} за час против ${prevHour} часом ранее.`,
    });
  }
  return anomalies;
}

function scheduleFor(status: WaterStatus): ScheduleSlot[] {
  if (status === "none") {
    return [
      { from: "06:00", to: "09:00", title: "Подача отключена", status: "none" },
      { from: "09:00", to: "18:00", title: "Подача отключена", status: "none" },
      { from: "18:00", to: "21:00", title: "Ожидание водовоза", status: "low" },
      { from: "21:00", to: "06:00", title: "Подача отключена", status: "none" },
    ];
  }
  if (status === "low") {
    return [
      { from: "06:00", to: "09:00", title: "Подача воды", status: "normal" },
      { from: "09:00", to: "18:00", title: "Ограниченная подача", status: "low" },
      { from: "18:00", to: "21:00", title: "Подача воды", status: "normal" },
      { from: "21:00", to: "06:00", title: "Подача отключена", status: "none" },
    ];
  }
  return [
    { from: "06:00", to: "09:00", title: "Подача воды", status: "normal" },
    { from: "09:00", to: "18:00", title: "Подача воды", status: "normal" },
    { from: "18:00", to: "21:00", title: "Подача воды", status: "normal" },
    { from: "21:00", to: "06:00", title: "Подача отключена", status: "none" },
  ];
}

function forecastText(s: Store, anomalies: Anomaly[], now: number) {
  const burst = anomalies.find((item) => item.kind === "pipe_burst");
  if (burst) {
    return "Серия жалоб из одного дома за 15 минут не похожа на обычный разбор воды. Система считает это возможным порывом и предлагает водовоз.";
  }
  const lastHour = s.reports.filter((report) => now - report.createdAt <= 60 * 60 * 1000).length;
  if (lastHour >= 4) {
    return "Обращения растут. Если темп сохранится, пик придётся на ближайший час — имеет смысл держать свободный водовоз у верхних микрорайонов.";
  }
  return "Потребление близко к графику. Резких аномалий по жалобам и давлению нет.";
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
  const etaToHome =
    tanker.status === "idle" && home ? etaMinutesFor(distance(x, y, home.x, home.y)) : tanker.status === "en_route" ? etaMinutes : null;
  return { ...tanker, x, y, etaMinutes, etaToHome };
}

export function getSnapshot(homeDistrictId = "14"): Snapshot {
  const s = store();
  const now = Date.now();
  settleTrips(s, now);
  const homeDistrict = s.districts.find((item) => item.id === homeDistrictId) ?? s.districts[0];
  const home = homePoint(homeDistrict);
  const anomalies = detectAnomalies(s, now);
  const tankers = s.tankers.map((tanker) => publicTanker(tanker, home, now));
  const schedules: Record<string, ScheduleSlot[]> = {};
  for (const district of s.districts) schedules[district.id] = scheduleFor(district.status);

  const hourly: { hour: number; count: number }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const start = now - (i + 1) * 60 * 60 * 1000;
    const end = now - i * 60 * 60 * 1000;
    hourly.push({
      hour: new Date(end).getHours(),
      count: s.reports.filter((report) => report.createdAt > start && report.createdAt <= end).length,
    });
  }

  const complaintCounts: Record<string, number> = {};
  for (const district of s.districts) {
    complaintCounts[district.id] = s.reports.filter(
      (report) => report.districtId === district.id && now - report.createdAt <= 6 * 60 * 60 * 1000,
    ).length;
  }

  const suggestions = s.districts
    .filter((district) => district.status === "none" || anomalies.some((item) => item.districtId === district.id && item.kind === "pipe_burst"))
    .flatMap((district) => {
      const covered = s.tankers.some(
        (tanker) =>
          tanker.targetDistrictId === district.id &&
          (tanker.status === "en_route" || tanker.status === "serving"),
      );
      if (covered) return [];
      const point = homePoint(district);
      const nearest = s.tankers
        .filter((tanker) => tanker.status === "idle")
        .sort((a, b) => distance(a.x, a.y, point.x, point.y) - distance(b.x, b.y, point.x, point.y))[0];
      if (!nearest) return [];
      const burst = anomalies.find((item) => item.districtId === district.id && item.kind === "pipe_burst");
      return [
        {
          districtId: district.id,
          districtName: district.name,
          tankerId: nearest.id,
          tankerNumber: nearest.number,
          etaMinutes: etaMinutesFor(distance(nearest.x, nearest.y, point.x, point.y)),
          reason: burst ? burst.message : `${district.name} без воды, свободный водовоз рядом.`,
        },
      ];
    });

  return {
    serverTime: now,
    homeDistrictId,
    districts: s.districts,
    tankers,
    reports: s.reports,
    requests: s.requests,
    notifications: s.notifications,
    anomalies,
    schedules,
    hourly,
    forecast: forecastText(s, anomalies, now),
    complaintCounts,
    suggestions,
  };
}
