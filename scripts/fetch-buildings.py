#!/usr/bin/env python3
"""Fetch only the building footprints, in small tiles.

Split out from `fetch-osm.py` because Overpass mirrors routinely time out on
city-wide building queries and this is the part worth retrying on its own.

    python3 scripts/fetch-buildings.py
"""

import json
import os
import time
import urllib.request

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

SOUTH, NORTH = 43.6200, 43.7060
WEST, EAST = 51.1200, 51.2250
TILES = 8

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "osm")
OUT_PATH = os.path.join(OUT_DIR, "buildings.json")


def fetch(query, tries=12):
    for attempt in range(tries):
        mirror = MIRRORS[attempt % len(MIRRORS)]
        try:
            request = urllib.request.Request(
                mirror,
                data=query.encode(),
                headers={"User-Agent": "komektesu-mvp/1.0 (district map data)"},
            )
            with urllib.request.urlopen(request, timeout=240) as response:
                body = response.read()
            if body[:1] in (b"{", b"["):
                return json.loads(body)
        except Exception:  # noqa: BLE001 - mirrors fail in many ways
            pass
        time.sleep(4 + attempt * 4)
    return None


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    elements = {}
    if os.path.exists(OUT_PATH):
        with open(OUT_PATH, encoding="utf-8") as handle:
            for element in json.load(handle)["elements"]:
                elements[element["id"]] = element
        print(f"resuming with {len(elements)} buildings", flush=True)

    failed = 0
    for row in range(TILES):
        for col in range(TILES):
            south = SOUTH + (NORTH - SOUTH) * row / TILES
            north = SOUTH + (NORTH - SOUTH) * (row + 1) / TILES
            west = WEST + (EAST - WEST) * col / TILES
            east = WEST + (EAST - WEST) * (col + 1) / TILES
            query = (
                f"[out:json][timeout:120];"
                f'way["building"]({south},{west},{north},{east});'
                f"out center tags;"
            )
            data = fetch(query)
            if data is None:
                failed += 1
                print(f"tile {row},{col}: failed", flush=True)
                continue
            for element in data["elements"]:
                elements[element["id"]] = element
            print(
                f"tile {row},{col}: +{len(data['elements'])} (total {len(elements)})",
                flush=True,
            )
            # Checkpoint so a later crash does not lose progress.
            with open(OUT_PATH, "w", encoding="utf-8") as handle:
                json.dump({"elements": list(elements.values())}, handle)
            time.sleep(1)

    print(f"done: {len(elements)} buildings, {failed} tiles failed", flush=True)


if __name__ == "__main__":
    main()
