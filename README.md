# Komektesu backend

Dispatch console for Aktau water supply. District outlines, the coast, roads, and depot distances come from OpenStreetMap (`lib/aktau-geo.ts`, built by `scripts/fetch-osm.py` and `scripts/build-districts.py`). Pressure, district colour, and tanker ETAs are still a model and stay labelled as a demo. They are not live КЖСА telemetry.

Supabase is the record of districts, reports, tankers, delivery requests, notifications, and feedback. The phone and this console call `/api/*`. The server writes with `SUPABASE_SERVICE_ROLE_KEY`. The anon key cannot read or write those tables. Apply `supabase/schema.sql` in the Supabase SQL editor before starting.

A restart shows the last saved city: served districts at normal pressure and the tanker list parked at the КЖСА depot, once, when those tables are empty. **Сбросить** writes the 14/15 outage and the sample residents into the same tables.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The resident app reads the same API (`/api/state`, `/api/reports`, `/api/requests`) and joins district ids onto its own copy of the geometry. A resident request waits until a dispatcher sends a tanker from this console (`/api/dispatch`). Building counts, when Overpass returns them, come from `scripts/fetch-buildings.py` (8×8 tiles, checkpointed to `scripts/osm/buildings.json`) and then `python3 scripts/build-districts.py`. If that file is empty, the console hides the housing-count stat instead of showing zero.

Pitch path: press **Сбросить** to open the 14/15 incident. Send the suggested tanker, run **Сценарий: порыв в 17 мкр**, then **Сбросить** again. A normal restart keeps whatever was saved.
