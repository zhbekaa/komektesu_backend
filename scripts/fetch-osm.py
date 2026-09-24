#!/usr/bin/env python3
"""Download the raw OpenStreetMap extract that `build-districts.py` turns into
`lib/aktau-geo.ts`.

Overpass rejects one big Aktau-wide building query, so buildings are fetched as a
4x4 tile grid with retries across mirrors. Output lands in `scripts/osm/`.

    python3 scripts/fetch-osm.py

Data (c) OpenStreetMap contributors, ODbL.
"""

import json
import os
import time
import urllib.request

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Bounding box around Aktau city proper.
SOUTH, NORTH = 43.6200, 43.7060
WEST, EAST = 51.1200, 51.2250
TILES = 8

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "osm")


def fetch(query, tries=8):
    for attempt in range(tries):
        mirror = MIRRORS[attempt % len(MIRRORS)]
        try:
            request = urllib.request.Request(
                mirror,
                data=query.encode(),
                headers={"User-Agent": "komektesu-mvp/1.0 (district map data)"},
            )
            with urllib.request.urlopen(request, timeout=300) as response:
                body = response.read()
            if body[:1] in (b"{", b"["):
                return json.loads(body)
            print(f"  non-json from {mirror}: {body[:120]!r}", flush=True)
        except Exception as error:  # noqa: BLE001 - mirrors fail in many ways
            print(f"  error from {mirror}: {error}", flush=True)
        time.sleep(15 + attempt * 10)
    return None


def write(name, payload):
    path = os.path.join(OUT_DIR, name)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle)
    print(f"wrote {path}", flush=True)


def fetch_districts():
    print("districts…", flush=True)
    query = """[out:json][timeout:120];
area["name"="Ақтау"]["place"="city"]->.a;
(
  way(area.a)["place"~"^(neighbourhood|suburb|quarter)$"];
  node(area.a)["place"~"^(neighbourhood|suburb|quarter)$"];
);
out geom;"""
    data = fetch(query)
    if data:
        write("districts.json", data)


def fetch_base_geometry():
    print("coastline, boundary, roads…", flush=True)
    query = f"""[out:json][timeout:180];
(
  way["natural"="coastline"]({SOUTH - 0.04},{WEST - 0.04},{NORTH + 0.05},{EAST + 0.04});
  relation["boundary"="administrative"]["name"~"Ақтау|Актау"]({SOUTH},{WEST},{NORTH},{EAST});
  way["highway"~"^(primary|trunk|secondary)$"]({SOUTH},{WEST},{NORTH},{EAST});
);
out geom;"""
    data = fetch(query)
    if data:
        write("base.json", data)


def fetch_landmarks():
    print("water infrastructure…", flush=True)
    query = """[out:json][timeout:120];
(
  nwr["man_made"="water_works"](43.55,51.05,43.80,51.30);
  nwr["man_made"="reservoir_covered"](43.55,51.05,43.80,51.30);
  nwr["man_made"="water_tower"](43.55,51.05,43.80,51.30);
  nwr["power"="plant"](43.55,51.05,43.80,51.30);
  nwr["name"~"МАЭК|MAEK|Каспий жылу"](43.55,51.05,43.80,51.30);
);
out center tags;"""
    data = fetch(query)
    if data:
        write("landmarks.json", data)


def fetch_buildings():
    print("buildings (tiled)…", flush=True)
    elements = {}
    for row in range(TILES):
        for col in range(TILES):
            south = SOUTH + (NORTH - SOUTH) * row / TILES
            north = SOUTH + (NORTH - SOUTH) * (row + 1) / TILES
            west = WEST + (EAST - WEST) * col / TILES
            east = WEST + (EAST - WEST) * (col + 1) / TILES
            # `out center` without full tags keeps the response small; the
            # building kind is the only tag worth carrying.
            query = (
                f"[out:json][timeout:180];"
                f'way["building"]({south},{west},{north},{east});'
                f"out center tags;"
            )
            print(f"  tile {row},{col}", flush=True)
            data = fetch(query)
            if data is None:
                print("    failed, skipping", flush=True)
                continue
            for element in data["elements"]:
                elements[element["id"]] = element
            print(f"    +{len(data['elements'])} (total {len(elements)})", flush=True)
            time.sleep(3)
    write("buildings.json", {"elements": list(elements.values())})


def present(name):
    path = os.path.join(OUT_DIR, name)
    return os.path.exists(path) and os.path.getsize(path) > 32


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    if present("districts.json"):
        print("districts.json already present, skipping", flush=True)
    else:
        fetch_districts()
    if present("base.json"):
        print("base.json already present, skipping coastline and roads", flush=True)
    else:
        fetch_base_geometry()
    if present("landmarks.json"):
        print("landmarks.json already present, skipping", flush=True)
    else:
        fetch_landmarks()
    if present("buildings.json"):
        print("buildings.json already present, skipping (use scripts/fetch-buildings.py to resume)", flush=True)
    else:
        fetch_buildings()
    print("done", flush=True)
