import { DISTRICT_GEO, MAP_HEIGHT, MAP_WIDTH, METRES_PER_UNIT } from "@/lib/aktau-geo";
import { COVERAGE, SOURCES } from "@/lib/aktau";
import { json, preflight } from "@/lib/http";

export function OPTIONS() {
  return preflight();
}

/**
 * Static reference data: the real Aktau districts behind the map. Separate from
 * `/api/state` because none of it changes at runtime, so clients can cache it.
 */
export function GET() {
  return json({
    canvas: { width: MAP_WIDTH, height: MAP_HEIGHT, metresPerUnit: METRES_PER_UNIT },
    coverage: COVERAGE,
    sources: SOURCES,
    districts: DISTRICT_GEO.map((district) => ({
      id: district.id,
      name: district.name,
      nameKk: district.nameKk,
      kind: district.kind,
      osmId: district.osmId,
      areaKm2: district.areaKm2,
      depotKm: district.depotKm,
      buildings: district.buildings,
      residential: district.residential,
      neighbours: district.neighbours,
    })),
  });
}
