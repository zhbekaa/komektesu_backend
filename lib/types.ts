export type WaterStatus = "normal" | "low" | "none";

export type ReportType = "no_water" | "no_hot" | "low_pressure" | "emergency";

export type TankerStatus = "idle" | "en_route" | "serving";

/**
 * Live state for one district. Geometry, names and areas are not sent over the
 * wire: both clients bundle `lib/aktau-geo.ts` and join on `id`, which keeps the
 * payload small and lets the map draw before the network answers.
 */
export type DistrictState = {
  id: string;
  status: WaterStatus;
  /** Simulated, not a network reading. See ASSUMPTIONS in lib/aktau.ts. */
  pressureBar: number;
  /** Planned time supply returns to normal, HH:MM, or null when unknown. */
  expectedNormalAt: string | null;
  updatedAt: number;
  /** Complaints filed in the last 6 hours. */
  complaints6h: number;
  /** Why this district is not normal, for the dispatcher. */
  cause: string | null;
};

export type Report = {
  id: string;
  districtId: string;
  building: string;
  type: ReportType;
  /** Typed on the phone for this demo. History and notices match the string; there is no residents row yet. */
  residentName: string;
  createdAt: number;
  confirmed: boolean;
  /** Dispatcher judged this signal as not matching the outage. */
  dismissed: boolean;
};

export type Tanker = {
  id: string;
  number: number;
  status: TankerStatus;
  /** Plate-style label so the fleet reads like real vehicles. */
  plate: string;
  capacityLiters: number;
  waterLiters: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  targetDistrictId: string | null;
  tripStartedAt: number | null;
  tripDurationMs: number;
  initialEtaMin: number;
};

export type PublicTanker = Tanker & {
  /** Minutes left on the current trip. */
  etaMinutes: number;
  /** Minutes to the caller's district, when the tanker is free. */
  etaToHome: number | null;
  /** Straight-line distance to the caller's district, km. */
  distanceKm: number | null;
};

export type DeliveryRequest = {
  id: string;
  number: number;
  districtId: string;
  building: string;
  tankerId: string | null;
  status: "accepted" | "en_route" | "done";
  createdAt: number;
  residentName: string;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  kind: "outage" | "tanker" | "schedule" | "report";
  /** Null reaches every resident. A name reaches only that person. */
  audience: string | null;
};

export type Anomaly = {
  id: string;
  districtId: string;
  building: string;
  count: number;
  kind: "pipe_burst" | "demand_peak";
  message: string;
};

export type ScheduleSlot = {
  from: string;
  to: string;
  title: string;
  status: WaterStatus;
};

export type Suggestion = {
  districtId: string;
  districtName: string;
  tankerId: string;
  tankerNumber: number;
  tankerPlate: string;
  etaMinutes: number;
  distanceKm: number;
  reason: string;
};

/** The current incident driving the scenario, so the UI can name a cause. */
export type Incident = {
  id: string;
  title: string;
  summary: string;
  districtIds: string[];
  startedAt: number;
  expectedNormalAt: string | null;
};

/**
 * Provenance shipped with every snapshot. The console renders this so nobody
 * mistakes the simulated operational layer for live utility telemetry.
 */
export type SnapshotMeta = {
  /** True while the operational layer is generated rather than measured. */
  simulated: boolean;
  city: string;
  operator: string;
  waterSource: string;
  /** Districts and geometry counted from the OSM extract. */
  coverage: {
    districts: number;
    areaKm2: number;
    buildings: number;
    residentialBuildings: number;
  };
  sources: { label: string; source: string; detail: string }[];
  assumptions: string[];
};

export type Snapshot = {
  serverTime: number;
  homeDistrictId: string;
  meta: SnapshotMeta;
  incident: Incident | null;
  districts: DistrictState[];
  tankers: PublicTanker[];
  reports: Report[];
  requests: DeliveryRequest[];
  notifications: AppNotification[];
  anomalies: Anomaly[];
  schedules: Record<string, ScheduleSlot[]>;
  hourly: { hour: number; count: number }[];
  /** Rule-based readout of the complaint trend. Not a forecast model. */
  situation: string;
  suggestions: Suggestion[];
};
