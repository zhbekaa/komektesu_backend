#!/usr/bin/env python3
"""Turn the OpenStreetMap extract in `scripts/osm/` into `lib/aktau-geo.ts`.

Run `scripts/fetch-osm.py` first, then:

    python3 scripts/build-districts.py

Everything the map draws comes from here: real microdistrict polygons, the
Caspian coastline, arterial roads, and per-district area and building counts.
Nothing is hand-drawn.

Data (c) OpenStreetMap contributors, ODbL.
"""

import json
import math
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
OSM_DIR = os.path.join(HERE, "osm")
BACKEND_OUT = os.path.abspath(os.path.join(HERE, "..", "lib", "aktau-geo.ts"))
APP_OUT = os.path.abspath(
    os.path.join(HERE, "..", "..", "komektesu", "lib", "aktau-geo.ts")
)

# Canvas is sized from the real bounding box so nothing is stretched.
CANVAS_WIDTH = 1000.0
PAD = 26.0
SIMPLIFY_DISTRICT = 0.9
SIMPLIFY_COAST = 1.1
SIMPLIFY_ROAD = 1.6

# Industrial and utility quarters exist on the map but have no residential
# water customers, so they render as context only.
INDUSTRIAL = re.compile(r"промзона|промышленн", re.IGNORECASE)

# Real water infrastructure, matched against scripts/osm/landmarks.json by OSM id
# so the labels stay meaningful even as OSM tags change.
LANDMARK_LABELS = {
    415472528: ("depot", "КЖСА", "База «Каспий жылу, су арнасы»"),
    1474358559: ("reservoir", "Резервуар", "Закрытый резервуар питьевой воды"),
    224369646: ("source", "МАЭК", "МАЭК — опреснение и энергетика"),
}


def load(name):
    with open(os.path.join(OSM_DIR, name), encoding="utf-8") as handle:
        return json.load(handle)


# --- naming -----------------------------------------------------------------

# Keep Kazakh orthography. OSM name:ru often drops ғ/қ/ө (Шыгыс, Толкын);
# the map should show the spelling from the Kazakh name.
KK_TO_RU = {
    "Шығыс": "Шығыс",
    "Толқын": "Толқын",
    "Толкын": "Толқын",
    "Самал": "Самал",
    "Көл Жағасы": "Көл Жағасы",
}

NUMBERED = re.compile(
    r"^(?:мк?р|микрорайон|шағын\s+аудан[ы]?)?\s*"
    r"(\d+)\s*([А-ЯҚҒҮҰӘӨҺІа-я]?)"
    r"(?:\s*-?й)?\s*"
    r"(?:мк?р|микрорайон|шағын\s+аудан[ы]?)?\s*$",
    re.IGNORECASE,
)

LETTER_RU = {
    "А": "А",
    "Б": "Б",
    "В": "В",
    "Г": "Г",
    "A": "А",
    "B": "Б",
}

TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "ғ": "g", "д": "d", "е": "e",
    "ё": "e", "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "қ": "q",
    "л": "l", "м": "m", "н": "n", "ң": "n", "о": "o", "ө": "o", "п": "p",
    "р": "r", "с": "s", "т": "t", "у": "u", "ұ": "u", "ү": "u", "ф": "f",
    "х": "h", "һ": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "і": "i", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def slugify(text):
    out = []
    for char in text.lower():
        if char in TRANSLIT:
            out.append(TRANSLIT[char])
        elif char.isalnum():
            out.append(char)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-")


def classify(osm_name):
    """Return (id, russian name, kazakh name, kind)."""
    name = osm_name.strip()
    if INDUSTRIAL.search(name):
        label = name.replace("квартал ", "")
        return slugify(label), label, name, "industrial"

    cleaned = re.sub(r"\s*(ж/к|мкр\.?)\s*$", "", name).strip()
    match = NUMBERED.match(cleaned)
    if match:
        number, letter = match.group(1), match.group(2)
        letter_ru = LETTER_RU.get(letter.upper(), "") if letter else ""
        label = f"{number}{letter_ru}"
        district_id = f"{number}{letter_ru.lower()}" if letter_ru else number
        return district_id, f"{label} мкр", f"{label} шағын аудан", "microdistrict"

    russian = cleaned
    for kazakh, translated in KK_TO_RU.items():
        russian = russian.replace(kazakh, translated)
    russian = re.sub(r"\s*шағын\s+ауданы?\s*", "", russian, flags=re.IGNORECASE).strip()
    russian = re.sub(r"\s*микрорайон\s*", "", russian, flags=re.IGNORECASE).strip()
    kazakh_name = re.sub(
        r"\s*(шағын\s+ауданы?|микрорайон)\s*", "", cleaned, flags=re.IGNORECASE
    ).strip()
    return slugify(russian or cleaned), russian or cleaned, kazakh_name, "named"


# --- geometry ---------------------------------------------------------------


def make_projection(points):
    lats = [lat for lat, _ in points]
    lons = [lon for _, lon in points]
    lat0 = (min(lats) + max(lats)) / 2
    k = math.cos(math.radians(lat0))

    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    span_x = (max_lon - min_lon) * k
    span_y = max_lat - min_lat

    inner = CANVAS_WIDTH - 2 * PAD
    scale = inner / span_x
    height = span_y * scale + 2 * PAD

    def project(lat, lon):
        x = PAD + (lon - min_lon) * k * scale
        y = PAD + (max_lat - lat) * scale
        return x, y

    # metres per SVG unit, for turning pixel distances into real ones
    metres_per_unit = (span_x * 111_320.0) / inner
    return project, CANVAS_WIDTH, height, metres_per_unit


def simplify(points, tolerance):
    """Ramer-Douglas-Peucker."""
    if len(points) < 3:
        return points

    def rdp(pts):
        if len(pts) < 3:
            return pts
        (x1, y1), (x2, y2) = pts[0], pts[-1]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy)
        worst, index = -1.0, 0
        for i in range(1, len(pts) - 1):
            x, y = pts[i]
            if norm == 0:
                dist = math.hypot(x - x1, y - y1)
            else:
                dist = abs(dy * (x - x1) - dx * (y - y1)) / norm
            if dist > worst:
                worst, index = dist, i
        if worst <= tolerance:
            return [pts[0], pts[-1]]
        return rdp(pts[: index + 1])[:-1] + rdp(pts[index:])

    return rdp(points)


def ring_area(points):
    """Signed area in squared SVG units."""
    total = 0.0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        total += x1 * y2 - x2 * y1
    return total / 2


def centroid(points):
    area = ring_area(points)
    if abs(area) < 1e-9:
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    cx = cy = 0.0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        cross = x1 * y2 - x2 * y1
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    return cx / (6 * area), cy / (6 * area)


def point_in_ring(x, y, ring):
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            t = (y - y1) / (y2 - y1)
            if x < x1 + t * (x2 - x1):
                inside = not inside
    return inside


def fmt(value):
    return f"{value:.1f}".rstrip("0").rstrip(".")


def to_path(rings, close=True):
    parts = []
    for ring in rings:
        if len(ring) < 2:
            continue
        head = f"M{fmt(ring[0][0])} {fmt(ring[0][1])}"
        tail = "".join(f"L{fmt(x)} {fmt(y)}" for x, y in ring[1:])
        parts.append(head + tail + ("Z" if close else ""))
    return "".join(parts)


# --- coastline --------------------------------------------------------------


def chain_coastline(ways):
    """Join OSM coastline ways into one north-to-south polyline."""
    segments = [[(p["lat"], p["lon"]) for p in w["geometry"]] for w in ways]
    segments = [s for s in segments if len(s) > 2 and s[0] != s[-1]]
    if not segments:
        return []
    chain = segments.pop(0)
    changed = True
    while segments and changed:
        changed = False
        for i, seg in enumerate(segments):
            if seg[0] == chain[-1]:
                chain += seg[1:]
            elif seg[-1] == chain[0]:
                chain = seg[:-1] + chain
            else:
                continue
            segments.pop(i)
            changed = True
            break
    return chain


# --- main -------------------------------------------------------------------


def main():
    districts_raw = load("districts.json")
    base_raw = load("base.json")
    try:
        buildings_raw = load("buildings.json")["elements"]
    except FileNotFoundError:
        print("! buildings.json missing - building counts will be 0")
        buildings_raw = []
    try:
        landmarks_raw = load("landmarks.json")["elements"]
    except FileNotFoundError:
        print("! landmarks.json missing - no infrastructure markers")
        landmarks_raw = []

    district_ways = [
        element
        for element in districts_raw["elements"]
        if element["type"] == "way"
        and "geometry" in element
        and element.get("tags", {}).get("name")
    ]

    coast_ways = [
        element
        for element in base_raw["elements"]
        if element.get("tags", {}).get("natural") == "coastline"
        and "geometry" in element
    ]
    road_ways = [
        element
        for element in base_raw["elements"]
        if element.get("tags", {}).get("highway") in {"primary", "trunk", "secondary"}
        and "geometry" in element
    ]

    # Projection is fitted to the districts so the city fills the canvas.
    anchor_points = [
        (p["lat"], p["lon"]) for w in district_ways for p in w["geometry"]
    ]
    project, width, height, metres_per_unit = make_projection(anchor_points)

    # --- districts
    districts = []
    seen = {}
    for way in district_ways:
        osm_name = way["tags"]["name"]
        district_id, name_ru, name_kk, kind = classify(osm_name)
        ring = [project(p["lat"], p["lon"]) for p in way["geometry"]]
        if ring[0] == ring[-1]:
            ring = ring[:-1]
        area_units = abs(ring_area(ring))
        if len(ring) < 3 or area_units < 4:
            continue
        # Keep the larger polygon if OSM has duplicates under one name.
        if district_id in seen and seen[district_id]["areaUnits"] >= area_units:
            continue
        simple = simplify(ring + [ring[0]], SIMPLIFY_DISTRICT)[:-1]
        if len(simple) < 3:
            simple = ring
        cx, cy = centroid(simple)
        if not point_in_ring(cx, cy, simple):
            cx, cy = sum(p[0] for p in simple) / len(simple), sum(
                p[1] for p in simple
            ) / len(simple)
        record = {
            "id": district_id,
            "name": name_ru,
            "nameKk": name_kk,
            "kind": kind,
            "osmId": way["id"],
            "osmName": osm_name,
            "ring": simple,
            "path": to_path([simple]),
            "center": (cx, cy),
            "areaUnits": area_units,
            "areaKm2": area_units * (metres_per_unit**2) / 1_000_000,
            "buildings": 0,
            "residential": 0,
        }
        seen[district_id] = record
    districts = list(seen.values())

    # --- buildings per district (real counts, point-in-polygon on centres)
    residential_tags = {
        "yes", "residential", "apartments", "house", "dormitory",
        "detached", "semidetached_house", "terrace",
    }
    for element in buildings_raw:
        centre = element.get("center")
        if not centre:
            continue
        x, y = project(centre["lat"], centre["lon"])
        kind = element.get("tags", {}).get("building")
        for district in districts:
            if point_in_ring(x, y, district["ring"]):
                district["buildings"] += 1
                if kind in residential_tags:
                    district["residential"] += 1
                break

    districts.sort(
        key=lambda d: (
            d["kind"] != "microdistrict",
            int(re.match(r"\d+", d["id"]).group()) if re.match(r"\d+", d["id"]) else 999,
            d["id"],
        )
    )

    # --- coastline and sea
    chain = chain_coastline(coast_ways)
    coast = [project(lat, lon) for lat, lon in chain]
    # Keep a band around the canvas so the sea polygon closes cleanly off-screen.
    margin = 120
    coast = [
        (x, y)
        for x, y in coast
        if -margin <= x <= width + margin and -margin <= y <= height + margin
    ]
    coast = simplify(coast, SIMPLIFY_COAST)
    coast_path = to_path([coast], close=False)
    # Sea sits west of the coastline: close the polyline off the left edge.
    if coast:
        sea_ring = [(-margin, coast[0][1])] + coast + [(-margin, coast[-1][1])]
        sea_path = to_path([sea_ring])
    else:
        sea_path = ""

    # --- roads, split into the runs that actually cross the canvas
    def clip_runs(points, pad=40):
        inside = lambda p: -pad <= p[0] <= width + pad and -pad <= p[1] <= height + pad
        runs, current = [], []
        for i, point in enumerate(points):
            neighbour_in = (i > 0 and inside(points[i - 1])) or (
                i + 1 < len(points) and inside(points[i + 1])
            )
            if inside(point) or neighbour_in:
                current.append(point)
            elif current:
                runs.append(current)
                current = []
        if current:
            runs.append(current)
        return [run for run in runs if len(run) >= 2]

    road_rings = []
    for way in road_ways:
        pts = [project(p["lat"], p["lon"]) for p in way["geometry"]]
        for run in clip_runs(pts):
            simple = simplify(run, SIMPLIFY_ROAD)
            if len(simple) >= 2:
                road_rings.append(simple)
    roads_path = to_path(road_rings, close=False)

    # --- landmarks
    landmarks = []
    for element in landmarks_raw:
        if element["id"] not in LANDMARK_LABELS:
            continue
        centre = element.get("center") or (
            {"lat": element.get("lat"), "lon": element.get("lon")}
            if element.get("lat")
            else None
        )
        if not centre:
            continue
        kind, short, full = LANDMARK_LABELS[element["id"]]
        x, y = project(centre["lat"], centre["lon"])
        landmarks.append(
            {
                "id": kind,
                "kind": kind,
                "label": short,
                "title": full,
                "osmId": element["id"],
                "x": x,
                "y": y,
                "onCanvas": 0 <= x <= width and 0 <= y <= height,
            }
        )
    landmarks.sort(key=lambda item: item["id"])

    depot = next((item for item in landmarks if item["kind"] == "depot"), None)
    if depot:
        for district in districts:
            cx, cy = district["center"]
            dist_units = math.hypot(cx - depot["x"], cy - depot["y"])
            district["depotKm"] = dist_units * metres_per_unit / 1000

    # --- adjacency: microdistricts in Aktau share road boundaries, so polygons
    # whose outlines come within ~100 m are treated as neighbours.
    touch_units = 100.0 / metres_per_unit
    for district in districts:
        district["neighbours"] = []
    for i, a in enumerate(districts):
        ax0 = min(p[0] for p in a["ring"]) - touch_units
        ax1 = max(p[0] for p in a["ring"]) + touch_units
        ay0 = min(p[1] for p in a["ring"]) - touch_units
        ay1 = max(p[1] for p in a["ring"]) + touch_units
        for b in districts[i + 1 :]:
            bx = [p[0] for p in b["ring"]]
            by = [p[1] for p in b["ring"]]
            if max(bx) < ax0 or min(bx) > ax1 or max(by) < ay0 or min(by) > ay1:
                continue
            close = any(
                math.hypot(px - qx, py - qy) <= touch_units
                for px, py in a["ring"]
                for qx, qy in b["ring"]
            )
            if close:
                a["neighbours"].append(b["id"])
                b["neighbours"].append(a["id"])
    for district in districts:
        district["neighbours"] = sorted(set(district["neighbours"]))

    # --- default view: the dense residential core, taken from district centres so
    # one sprawling outlying polygon cannot stretch the frame. Anything outside
    # still draws, because an SVG clips to its viewport rather than its viewBox.
    residential = [d for d in districts if d["kind"] != "industrial"]
    cx_all = sorted(d["center"][0] for d in residential)
    cy_all = sorted(d["center"][1] for d in residential)
    view_pad = 70.0
    vx0, vx1 = cx_all[0] - view_pad, cx_all[-1] + view_pad
    vy0, vy1 = cy_all[0] - view_pad, cy_all[-1] + view_pad
    view = {"x": vx0, "y": vy0, "w": vx1 - vx0, "h": vy1 - vy0}

    # --- emit
    landmark_rows = "\n".join(
        "  {\n"
        f'    id: "{item["id"]}",\n'
        f'    kind: "{item["kind"]}",\n'
        f'    label: "{item["label"]}",\n'
        f'    title: "{item["title"]}",\n'
        f'    osmId: {item["osmId"]},\n'
        f'    x: {fmt(item["x"])},\n'
        f'    y: {fmt(item["y"])},\n'
        f'    onCanvas: {"true" if item["onCanvas"] else "false"},\n'
        "  },"
        for item in landmarks
    )
    depot_x = fmt(depot["x"]) if depot else fmt(width / 2)
    depot_y = fmt(depot["y"]) if depot else fmt(height / 2)

    header = f"""// GENERATED FILE - do not edit by hand.
// Source: OpenStreetMap via scripts/fetch-osm.py + scripts/build-districts.py
// Aktau, Mangystau region, Kazakhstan. Data (c) OpenStreetMap contributors, ODbL.
// Districts: {len(districts)} | canvas {fmt(width)}x{fmt(height)} | {metres_per_unit:.2f} m per unit

export const MAP_WIDTH = {fmt(width)};
export const MAP_HEIGHT = {fmt(height)};

/** Tightest box around the residential city. Use as the map's starting view. */
export const DEFAULT_VIEW = {{
  x: {fmt(view["x"])},
  y: {fmt(view["y"])},
  w: {fmt(view["w"])},
  h: {fmt(view["h"])},
}};
/** Metres of real ground covered by one SVG unit, for distance and ETA maths. */
export const METRES_PER_UNIT = {metres_per_unit:.4f};

export const SEA_PATH =
  "{sea_path}";

export const COAST_PATH =
  "{coast_path}";

export const ROADS_PATH =
  "{roads_path}";

export type LandmarkKind = "depot" | "reservoir" | "source";

export type Landmark = {{
  id: string;
  kind: LandmarkKind;
  label: string;
  title: string;
  osmId: number;
  x: number;
  y: number;
  /** False when the real location sits outside the drawn canvas. */
  onCanvas: boolean;
}};

/** Real water infrastructure: the utility depot, a covered reservoir, and the
 *  MAEK desalination complex that produces the city's drinking water. */
export const LANDMARKS: Landmark[] = [
{landmark_rows}
];

/** Tanker base: the «Каспий жылу, су арнасы» yard. Falls back to canvas centre. */
export const DEPOT = {{ x: {depot_x}, y: {depot_y} }};

export type DistrictKind = "microdistrict" | "named" | "industrial";

export type DistrictGeo = {{
  id: string;
  /** Russian label used across the UI. */
  name: string;
  /** Kazakh label from OpenStreetMap. */
  nameKk: string;
  kind: DistrictKind;
  /** OSM way id, so any polygon can be traced back to source. */
  osmId: number;
  path: string;
  /** Label anchor and tanker delivery point, in SVG units. */
  center: {{ x: number; y: number }};
  areaKm2: number;
  /** Road-less straight-line distance from the utility depot, in km. */
  depotKm: number;
  /** Districts whose outlines come within ~100 m of this one. */
  neighbours: string[];
  /** Building footprints counted inside the polygon. */
  buildings: number;
  /** Subset of `buildings` tagged residential. */
  residential: number;
}};

export const DISTRICT_GEO: DistrictGeo[] = [
"""

    rows = []
    for district in districts:
        cx, cy = district["center"]
        rows.append(
            "  {\n"
            f'    id: "{district["id"]}",\n'
            f'    name: "{district["name"]}",\n'
            f'    nameKk: "{district["nameKk"]}",\n'
            f'    kind: "{district["kind"]}",\n'
            f'    osmId: {district["osmId"]},\n'
            f'    path: "{district["path"]}",\n'
            f"    center: {{ x: {fmt(cx)}, y: {fmt(cy)} }},\n"
            f'    areaKm2: {district["areaKm2"]:.3f},\n'
            f'    depotKm: {district.get("depotKm", 0):.2f},\n'
            f'    neighbours: [{", ".join(chr(34) + n + chr(34) for n in district["neighbours"])}],\n'
            f'    buildings: {district["buildings"]},\n'
            f'    residential: {district["residential"]},\n'
            "  },"
        )

    body = header + "\n".join(rows) + "\n];\n"

    for out in (BACKEND_OUT, APP_OUT):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8") as handle:
            handle.write(body)
        print(f"wrote {out} ({len(body) / 1024:.1f} KB)")

    served = [d for d in districts if d["kind"] != "industrial"]
    print(f"\n{len(districts)} polygons, {len(served)} residential")
    print(f"canvas {fmt(width)} x {fmt(height)}, {metres_per_unit:.2f} m/unit")
    print(f"buildings matched: {sum(d['buildings'] for d in districts)}")
    for district in districts[:10]:
        print(
            f"  {district['id']:>6}  {district['name']:<16} "
            f"{district['areaKm2']:.2f} km2  {district['buildings']:>4} bld"
        )


if __name__ == "__main__":
    main()
