import type { ReportType, TankerStatus, WaterStatus } from "./types";

export function statusLabel(status: WaterStatus) {
  if (status === "normal") return "Нормальное давление";
  if (status === "low") return "Слабый напор";
  return "Воды нет";
}

export function statusTone(status: WaterStatus) {
  if (status === "normal") return "text-[#1f9d55] bg-[#e5f8ec]";
  if (status === "low") return "text-[#e09a12] bg-[#fff4de]";
  return "text-[#e5484d] bg-[#fdecec]";
}

export function fillFor(status: WaterStatus, baseFill: string) {
  if (status === "low") return "#F2C94C";
  if (status === "none") return "#F08A8A";
  return baseFill;
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
