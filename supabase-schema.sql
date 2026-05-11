create table if not exists portfolio (
  id text primary key default 'main',
  data jsonb default '{}',
  updated_at timestamptz default now()
);

create table if not exists transactions (
  id text primary key,
  party text not null,
  type text not null,
  date date not null,
  quantity numeric,
  unit_price_eur numeric,
  fee_eur numeric,
  amount_eur numeric,
  note text,
  metal_type text,
  silver_unit text,
  gold_unit text,
  instrument text,
  t212_id text,
  value_eur numeric,
  updated_at timestamptz default now()
);

create table if not exists portfolio_daily_values (
  date date primary key,
  total_eur numeric not null,
  invested_eur numeric not null,
  updated_at timestamptz default now()
);

create table if not exists asset_price_history (
  asset text not null,
  date date not null,
  nav numeric not null,
  updated_at timestamptz default now(),
  primary key (asset, date)
);

alter table portfolio enable row level security;
alter table transactions enable row level security;
alter table portfolio_daily_values enable row level security;
alter table asset_price_history enable row level security;

drop policy if exists "allow all" on portfolio;
drop policy if exists "allow all" on transactions;
drop policy if exists "allow all" on portfolio_daily_values;
drop policy if exists "allow all" on asset_price_history;

create policy "allow all" on portfolio for all using (true) with check (true);
create policy "allow all" on transactions for all using (true) with check (true);
create policy "allow all" on portfolio_daily_values for all using (true) with check (true);
create policy "allow all" on asset_price_history for all using (true) with check (true);
