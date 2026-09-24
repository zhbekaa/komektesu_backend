-- Komektesu: Aktau water supply, resident reports, and tanker fleet.
-- The Next.js demo runs on an in-memory engine and mirrors new reports here
-- when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.

create table if not exists districts (
  id text primary key,
  name text not null,
  status text not null check (status in ('normal', 'low', 'none')),
  expected_normal_at text,
  pressure_bar double precision,
  updated_at timestamptz not null default now()
);

create table if not exists reports (
  id text primary key,
  district_id text not null references districts (id),
  building text not null,
  type text not null check (type in ('no_water', 'no_hot', 'low_pressure', 'emergency')),
  resident_name text,
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reports_district_created_idx
  on reports (district_id, building, created_at desc);

create table if not exists tankers (
  id text primary key,
  number integer not null,
  status text not null check (status in ('idle', 'en_route', 'serving')),
  water_liters integer not null,
  x double precision,
  y double precision,
  target_district_id text references districts (id),
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
  created_at timestamptz not null default now()
);

alter table reports enable row level security;
alter table districts enable row level security;
alter table tankers enable row level security;
alter table delivery_requests enable row level security;
alter table notifications enable row level security;

create policy "public read districts" on districts for select using (true);
create policy "public read reports" on reports for select using (true);
create policy "public insert reports" on reports for insert with check (true);
create policy "public read tankers" on tankers for select using (true);
create policy "public read requests" on delivery_requests for select using (true);
create policy "public read notifications" on notifications for select using (true);
