# Komektesu backend

Dispatch console for Aktau water supply: neighborhood status, resident reports, tanker fleet, and a simple burst detector.

The live demo keeps state in memory so a pitch works without hosted services. New reports are also written to Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Apply `supabase/schema.sql` in the Supabase SQL editor first.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The resident app reads the same API (`/api/state`, `/api/reports`, `/api/dispatch`). On the overview, **Сценарий: отключение в 14 мкр** files 10 complaints from building 12 within 15 minutes, turns the neighborhood red, flags a possible pipe burst, and sends the nearest idle tanker.
