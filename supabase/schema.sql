-- Komektesu: Aktau water supply, resident reports, and tanker fleet.
-- The Next.js server is the only writer. It uses SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses row level security. The anon key has no access.
--
-- Safe to re-run. Existing tables keep their rows; new columns are added.
-- Map geometry is not stored here. Clients join district id onto lib/aktau-geo.ts.
--
-- A tanker trip is one row: start, target, trip_started_at, trip_duration_ms.
-- x and y are the parked or arrived position, not a GPS sample every few seconds.
-- The server computes the moving dot from the trip when it reads a snapshot,
-- and writes x and y once, on arrival.

create table if not exists districts (
  id text primary key,
  name text not null,
  status text not null check (status in ('normal', 'low', 'none')),
  expected_normal_at text,
  pressure_bar double precision,
  cause text,
  updated_at timestamptz not null default now()
);

create table if not exists reports (
  id text primary key,
  district_id text not null references districts (id),
  building text not null,
  type text not null check (type in ('no_water', 'no_hot', 'low_pressure', 'emergency')),
  resident_name text,
  confirmed boolean not null default false,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reports_district_created_idx
  on reports (district_id, building, created_at desc);

create table if not exists tankers (
  id text primary key,
  number integer not null,
  plate text not null default '',
  status text not null check (status in ('idle', 'en_route', 'serving')),
  capacity_liters integer not null default 0,
  water_liters integer not null,
  x double precision,
  y double precision,
  start_x double precision,
  start_y double precision,
  target_x double precision,
  target_y double precision,
  target_district_id text references districts (id),
  trip_started_at timestamptz,
  trip_duration_ms integer,
  eta_minutes integer,
  updated_at timestamptz not null default now()
);

create table if not exists delivery_requests (
  id text primary key,
  number integer not null,
  district_id text not null references districts (id),
  building text not null,
  tanker_id text references tankers (id),
  status text not null check (status in ('accepted', 'en_route', 'done')),
  resident_name text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  title text not null,
  body text not null,
  kind text not null,
  read boolean not null default false,
  -- Null reaches the whole city. A name reaches only that typed resident.
  audience text,
  created_at timestamptz not null default now()
);

create table if not exists feedback (
  id text primary key,
  resident_name text,
  body text not null,
  created_at timestamptz not null default now()
);

-- The outage banner. Not rebuilt from a fresh scenario on startup.
create table if not exists incidents (
  id text primary key,
  title text not null,
  summary text not null,
  district_ids text[] not null,
  started_at timestamptz not null,
  expected_normal_at text
);

alter table districts add column if not exists cause text;
alter table reports add column if not exists dismissed boolean not null default false;
alter table notifications add column if not exists audience text;
alter table tankers add column if not exists plate text not null default '';
alter table tankers add column if not exists capacity_liters integer not null default 0;
alter table tankers add column if not exists start_x double precision;
alter table tankers add column if not exists start_y double precision;
alter table tankers add column if not exists target_x double precision;
alter table tankers add column if not exists target_y double precision;
alter table tankers add column if not exists trip_started_at timestamptz;
alter table tankers add column if not exists trip_duration_ms integer;

alter table reports enable row level security;
alter table districts enable row level security;
alter table tankers enable row level security;
alter table delivery_requests enable row level security;
alter table notifications enable row level security;
alter table feedback enable row level security;
alter table incidents enable row level security;

-- The earlier policies let anyone with the anon key read operations and insert
-- complaints, and they did not allow the updates dispatch needs. The server
-- writes with the service role, so these policies are not the access control.
drop policy if exists "public read districts" on districts;
drop policy if exists "public read reports" on reports;
drop policy if exists "public insert reports" on reports;
drop policy if exists "public read tankers" on tankers;
drop policy if exists "public read requests" on delivery_requests;
drop policy if exists "public read notifications" on notifications;

revoke all on table districts from anon, authenticated, PUBLIC;
revoke all on table reports from anon, authenticated, PUBLIC;
revoke all on table tankers from anon, authenticated, PUBLIC;
revoke all on table delivery_requests from anon, authenticated, PUBLIC;
revoke all on table notifications from anon, authenticated, PUBLIC;
revoke all on table feedback from anon, authenticated, PUBLIC;
revoke all on table incidents from anon, authenticated, PUBLIC;
