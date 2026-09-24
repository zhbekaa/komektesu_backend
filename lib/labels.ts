import type { ReportType, TankerStatus, WaterStatus } from "./types";

export function statusLabel(status: WaterStatus) {
  if (status === "normal") return "Нормальное давление";
  if (status === "low") return "Слабый напор";
  return "Воды нет";
}

export function statusLabelShort(status: WaterStatus) {
  if (status === "normal") return "Норма";
  if (status === "low") return "Слабый напор";
  return "Нет воды";
}

export function statusTone(status: WaterStatus) {
  if (status === "normal") return "text-[#127a45] bg-[#e4f6ea]";
  if (status === "low") return "text-[#9a6400] bg-[#fdf1d8]";
  return "text-[#b4272b] bg-[#fdeaea]";
}

export function statusColor(status: WaterStatus) {
  if (status === "normal") return MAP.normal;
  if (status === "low") return MAP.low;
  return MAP.none;
}

/**
 * Map palette. Aktau sits between the Caspian and the Mangystau desert, so the
 * base tones are sea blue and sand rather than generic grey.
 */
export const MAP = {
  sea: "#C3DCEF",
  seaDeep: "#A9CBE4",
  coast: "#7FAECB",
  land: "#F1ECE2",
  road: "#DED5C6",
  roadMajor: "#D2C7B4",
  border: "#FFFFFF",
  normal: "#71BE8C",
  low: "#EFB44A",
  none: "#E4726E",
  inactive: "#DBD3C4",
  selected: "#2F6BFF",
  tanker: "#2F6BFF",
  tankerServing: "#E09A12",
  depot: "#1B2A4A",
  label: "#2A3342",
  labelMuted: "#7B8494",
} as const;

export function fillFor(status: WaterStatus) {
  if (status === "low") return MAP.low;
  if (status === "none") return MAP.none;
  return MAP.normal;
}

export function reportLabel(type: ReportType) {
  if (type === "no_water") return "Нет воды";
  if (type === "no_hot") return "Нет горячей воды";
  if (type === "low_pressure") return "Слабый напор";
  return "Авария";
}

export function tankerLabel(status: TankerStatus) {
  if (status === "idle") return "Свободен";
  if (status === "en_route") return "В пути";
  return "Раздаёт воду";
}

export function tankerTone(status: TankerStatus) {
  if (status === "idle") return "bg-[#e4f6ea] text-[#127a45]";
  if (status === "en_route") return "bg-[#e7f0ff] text-[#2f6bff]";
  return "bg-[#fdf1d8] text-[#9a6400]";
}

export function ago(ts: number, now: number) {
  const minutes = Math.max(0, Math.round((now - ts) / 60000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.round(hours / 24);
  if (days === 1) return "вчера";
  return `${days} дн. назад`;
}

export function litres(value: number) {
  return `${value.toLocaleString("ru-RU")} л`;
}
