/**
 * Reference facts about Aktau and the modelling assumptions this MVP runs on.
 *
 * The rule for this file: anything presented to a user as a fact has a source
 * recorded next to it. Everything else is an assumption, labelled as one, so the
 * demo never passes simulated telemetry off as a live reading.
 */

import { DISTRICT_GEO, METRES_PER_UNIT } from "./aktau-geo";

export const CITY = {
  name: "Актау",
  nameKk: "Ақтау",
  region: "Мангистауская область",
  lat: 43.65,
  lon: 51.16,
  /** Aktau is on the east shore of the Caspian. */
  sea: "Каспийское море",
} as const;

export const UTILITY = {
  /** The municipal heat and water operator for Aktau. */
  name: "ГКП «Каспий жылу, су арнасы»",
  short: "КЖСА",
  /** Depot location comes from OSM way 415472528 (see lib/aktau-geo.ts). */
  depotOsmId: 415472528,
} as const;

export const WATER_SOURCE = {
  /** Aktau has no fresh surface or ground water of its own: drinking water is
   *  desalinated Caspian seawater from the MAEK power and desalination complex
   *  south-east of the city. */
  name: "МАЭК",
  fullName: "Мангистауский атомно-энергетический комбинат",
  method: "Опреснение каспийской воды",
  osmId: 224369646,
} as const;

/** Aktau is one of the few cities where most streets have no names: addresses
 *  are «микрорайон + дом», which is why the app asks for exactly those two. */
export const ADDRESS_FORMAT = {
  note: "Адрес в Актау — микрорайон и номер дома, улиц в жилой части почти нет.",
} as const;

// --- Derived from OpenStreetMap ---------------------------------------------

const served = DISTRICT_GEO.filter((district) => district.kind !== "industrial");

export const COVERAGE = {
  /** Residential microdistricts and named housing areas mapped in OSM. */
  districts: served.length,
  /** Including industrial quarters drawn for context. */
  polygons: DISTRICT_GEO.length,
  areaKm2: served.reduce((sum, district) => sum + district.areaKm2, 0),
  buildings: served.reduce((sum, district) => sum + district.buildings, 0),
  residentialBuildings: served.reduce((sum, district) => sum + district.residential, 0),
} as const;

export const SOURCES = [
  {
    label: "Границы микрорайонов, береговая линия, дороги, инфраструктура",
    source: "OpenStreetMap (ODbL)",
    detail: `${DISTRICT_GEO.length} полигонов, выгрузка scripts/fetch-osm.py`,
  },
  {
    label: "Оператор водоснабжения и теплоснабжения",
    source: UTILITY.name,
    detail: "Городское коммунальное предприятие Актау",
  },
  {
    label: "Источник воды",
    source: `${WATER_SOURCE.name} — ${WATER_SOURCE.method.toLowerCase()}`,
    detail: WATER_SOURCE.fullName,
  },
] as const;

// --- Modelling assumptions --------------------------------------------------

/**
 * Everything below is an assumption for the demo, not a measurement. The UI
 * labels any value derived from these as simulated.
 */
export const ASSUMPTIONS = {
  /** Average speed of a loaded tanker in city traffic. */
  tankerSpeedKmh: 24,
  /** Minutes between accepting a job and the wheels moving. */
  dispatchOverheadMin: 4,
  /** Litres handed out at one stop before the tanker needs a refill. */
  litresPerStop: 800,
  /** Complaints from one building inside this window that look like a burst. */
  burstWindowMin: 15,
  burstThreshold: 10,
  /** Nominal pressure in a healthy branch, bar. */
  nominalPressureBar: 3.2,
  lowPressureBar: 1.1,
  outagePressureBar: 0.2,
} as const;

export const ASSUMPTION_NOTES = [
  `Скорость водовоза ${ASSUMPTIONS.tankerSpeedKmh} км/ч плюс ${ASSUMPTIONS.dispatchOverheadMin} мин на выезд — расчёт ETA по прямой между точками карты.`,
  `Порыв: ${ASSUMPTIONS.burstThreshold} и больше жалоб из одного дома за ${ASSUMPTIONS.burstWindowMin} минут.`,
  "Цвет района, давление и ETA — модель, пока КЖСА не передаёт давление и GPS водовозов. Жалобы считаются по сохранённым сообщениям.",
] as const;

/** Convert a distance in map units to real kilometres. */
export function unitsToKm(units: number) {
  return (units * METRES_PER_UNIT) / 1000;
}

/**
 * Minutes for a tanker to cover a straight-line map distance, including the
 * fixed dispatch overhead. Straight-line is an under-estimate on a road
 * network; the demo accepts that and says so.
 */
export function etaMinutesForUnits(units: number) {
  const km = unitsToKm(units);
  const driving = (km / ASSUMPTIONS.tankerSpeedKmh) * 60;
  return Math.max(3, Math.round(ASSUMPTIONS.dispatchOverheadMin + driving));
}
