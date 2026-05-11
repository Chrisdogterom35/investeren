-- Historische koersen voor het investeringen-dashboard.
-- Draai dit script in Supabase SQL Editor.
--
-- De frontend schrijft naar asset_price_history met de volgende asset-codes:
-- meesman_aandelen_wereldwijd_totaal, gold_eur_per_gram, silver_eur_per_ounce,
-- btc_eur, eth_eur, paxg_eur.

create table if not exists asset_price_history (
  asset text not null,
  date date not null,
  nav numeric(18, 8) not null,
  source text,
  updated_at timestamptz not null default now(),
  primary key (asset, date),
  constraint asset_price_history_asset_check check (
    asset in (
      'meesman_aandelen_wereldwijd_totaal',
      'gold_eur_per_gram',
      'silver_eur_per_ounce',
      'btc_eur',
      'eth_eur',
      'paxg_eur'
    )
  ),
  constraint asset_price_history_nav_positive check (nav > 0)
);

alter table asset_price_history
  add column if not exists source text;

alter table asset_price_history
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'asset_price_history_asset_check'
  ) then
    alter table asset_price_history
      add constraint asset_price_history_asset_check check (
        asset in (
          'meesman_aandelen_wereldwijd_totaal',
          'gold_eur_per_gram',
          'silver_eur_per_ounce',
          'btc_eur',
          'eth_eur',
          'paxg_eur'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'asset_price_history_nav_positive'
  ) then
    alter table asset_price_history
      add constraint asset_price_history_nav_positive check (nav > 0);
  end if;
end $$;

create index if not exists asset_price_history_date_idx
  on asset_price_history (date);

create index if not exists asset_price_history_asset_date_desc_idx
  on asset_price_history (asset, date desc);

alter table asset_price_history enable row level security;

drop policy if exists "asset price history read" on asset_price_history;
drop policy if exists "asset price history write" on asset_price_history;

create policy "asset price history read"
  on asset_price_history for select
  using (true);

create policy "asset price history write"
  on asset_price_history for all
  using (true)
  with check (true);

create or replace view meesman_price_history as
select
  date,
  nav as price_eur_per_part,
  source,
  updated_at
from asset_price_history
where asset = 'meesman_aandelen_wereldwijd_totaal'
order by date;

create or replace view gold_price_history as
select
  date,
  nav as price_eur_per_gram,
  source,
  updated_at
from asset_price_history
where asset = 'gold_eur_per_gram'
order by date;

create or replace view silver_price_history as
select
  date,
  nav as price_eur_per_ounce,
  source,
  updated_at
from asset_price_history
where asset = 'silver_eur_per_ounce'
order by date;

create or replace view bitcoin_price_history as
select
  date,
  nav as price_eur,
  source,
  updated_at
from asset_price_history
where asset = 'btc_eur'
order by date;

create or replace view ethereum_price_history as
select
  date,
  nav as price_eur,
  source,
  updated_at
from asset_price_history
where asset = 'eth_eur'
order by date;

create or replace view paxgold_price_history as
select
  date,
  nav as price_eur,
  source,
  updated_at
from asset_price_history
where asset = 'paxg_eur'
order by date;

-- Handige laatste-koers view voor checks/dashboards in Supabase.
create or replace view latest_asset_prices as
select distinct on (asset)
  asset,
  date,
  nav,
  source,
  updated_at
from asset_price_history
order by asset, date desc;

-- Optionele seed voor de officiële Meesman-koersen die al in de app gebruikt worden.
insert into asset_price_history (asset, date, nav, source)
values
  ('meesman_aandelen_wereldwijd_totaal', '2026-04-10', 96.0370, 'investing.com'),
  ('meesman_aandelen_wereldwijd_totaal', '2026-04-24', 100.0430, 'investing.com'),
  ('meesman_aandelen_wereldwijd_totaal', '2026-05-05', 101.1950, 'meesman.nl'),
  ('meesman_aandelen_wereldwijd_totaal', '2026-05-08', 102.7860, 'meesman.nl')
on conflict (asset, date) do update
set
  nav = excluded.nav,
  source = excluded.source,
  updated_at = now();
