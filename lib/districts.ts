import { DISTRICT_GEO, type DistrictGeo } from "./aktau-geo";
import type { DistrictState } from "./types";

/** Live state joined with the OSM geometry both clients bundle. */
export type DistrictView = DistrictGeo & DistrictState;

const GEO_BY_ID = new Map(DISTRICT_GEO.map((district) => [district.id, district]));

export function districtName(id: string) {
  return GEO_BY_ID.get(id)?.name ?? id;
}

export function districtGeo(id: string) {
  return GEO_BY_ID.get(id);
}

/** Join in the order districts appear in the geometry file (numeric, then named). */
export function joinDistricts(states: DistrictState[]): DistrictView[] {
  const stateById = new Map(states.map((state) => [state.id, state]));
  const views: DistrictView[] = [];
  for (const geo of DISTRICT_GEO) {
    const state = stateById.get(geo.id);
    if (state) views.push({ ...geo, ...state });
  }
  return views;
}

export function findDistrict(views: DistrictView[], id: string | null | undefined) {
  return views.find((district) => district.id === id) ?? views[0];
}
