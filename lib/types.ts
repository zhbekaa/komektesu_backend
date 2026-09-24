export type WaterStatus = "normal" | "low" | "none";

export type ReportType = "no_water" | "no_hot" | "low_pressure" | "emergency";

export type TankerStatus = "idle" | "en_route" | "serving";

export type District = {
  id: string;
  name: string;
  status: WaterStatus;
  baseFill: string;
  path: string;
  label: { x: number; y: number };
  anchor: { x: number; y: number };
  expectedNormalAt: string | null;
  updatedAt: number;
  pressureBar: number;
};

export type Report = {
  id: string;
  districtId: string;
  building: string;
  type: ReportType;
  residentName: string;
  createdAt: number;
  confirmed: boolean;
};

export type Tanker = {
  id: string;
  number: number;
  status: TankerStatus;
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
  kind: "outage" | "tanker" | "schedule";
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

export type PublicTanker = Tanker & {
  etaMinutes: number;
  etaToHome: number | null;
};

export type Snapshot = {
  serverTime: number;
  homeDistrictId: string;
  districts: District[];
  tankers: PublicTanker[];
  reports: Report[];
  requests: DeliveryRequest[];
  notifications: AppNotification[];
  anomalies: Anomaly[];
  schedules: Record<string, ScheduleSlot[]>;
  hourly: { hour: number; count: number }[];
  forecast: string;
  complaintCounts: Record<string, number>;
  suggestions: {
    districtId: string;
    districtName: string;
    tankerId: string;
    tankerNumber: number;
    etaMinutes: number;
    reason: string;
  }[];
};
