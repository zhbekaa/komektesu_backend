# Komektesu backend

Dispatch console for Aktau water supply. District outlines, the coast, roads, and depot distances come from OpenStreetMap (`lib/aktau-geo.ts`, built by `scripts/fetch-osm.py` and `scripts/build-districts.py`). Pressure, the tanker fleet, complaints, and schedules are simulated and labelled as a demo. They are not live КЖСА telemetry.

The live demo keeps state in memory so a pitch works without hosted services. New reports are also written to Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Apply `supabase/schema.sql` in the Supabase SQL editor first.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The resident app reads the same API (`/api/state`, `/api/reports`, `/api/requests`) and joins district ids onto its own copy of the geometry. A resident request waits until a dispatcher sends a tanker from this console (`/api/dispatch`). Building counts, when Overpass returns them, come from `scripts/fetch-buildings.py` (8×8 tiles, checkpointed to `scripts/osm/buildings.json`) and then `python3 scripts/build-districts.py`. If that file is empty, the console hides the housing-count stat instead of showing zero.

Pitch path: the overview opens on the 14/15 incident. Send the suggested tanker, run **Сценарий: порыв в 17 мкр**, then **Сбросить**.
