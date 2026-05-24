-- Sync-metadata voor transacties.
-- Voer dit eenmalig uit in de Supabase SQL Editor als de live database
-- nog geen transactions.updated_at kolom heeft.

alter table transactions
  add column if not exists updated_at timestamptz default now();

update transactions
set updated_at = now()
where updated_at is null;
