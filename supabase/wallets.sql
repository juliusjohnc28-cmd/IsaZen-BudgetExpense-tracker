-- Wallets (personal): Cash, GCash, Maya, bank accounts... each with its own balance, plus transfers.
-- Supabase > SQL Editor > New query > paste > Run. Safe to run more than once.

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'cash' check (kind in ('cash','ewallet','bank','other')),
  color text not null default '#00844a',
  opening_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists wallets_user on public.wallets(user_id);

-- Which wallet an income/expense went through (optional; old entries stay unassigned)
alter table public.transactions add column if not exists wallet_id uuid references public.wallets(id) on delete set null;
create index if not exists tx_wallet on public.transactions(wallet_id);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_wallet uuid not null references public.wallets(id) on delete cascade,
  to_wallet uuid not null references public.wallets(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  fee numeric(12,2) not null default 0 check (fee >= 0),
  occurred_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (from_wallet <> to_wallet)
);
create index if not exists transfers_user on public.transfers(user_id, occurred_on);

drop trigger if exists wallets_log on public.wallets;
create trigger wallets_log after insert or update or delete on public.wallets for each row execute function public.log_change();
drop trigger if exists transfers_log on public.transfers;
create trigger transfers_log after insert or update or delete on public.transfers for each row execute function public.log_change();

alter table public.wallets   enable row level security;
alter table public.transfers enable row level security;
drop policy if exists "own wallets" on public.wallets;
create policy "own wallets" on public.wallets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own transfers" on public.transfers;
create policy "own transfers" on public.transfers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reset-all now also clears wallets and transfers
create or replace function public.reset_all(code text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select passcode_hash into h from public.settings where user_id = auth.uid();
  if h is null then raise exception 'Set a passcode first'; end if;
  if crypt(coalesce(code, ''), h) <> h then raise exception 'Wrong passcode'; end if;
  delete from public.transfers where user_id = auth.uid();
  delete from public.transactions where user_id = auth.uid();
  delete from public.overall_expenses where user_id = auth.uid();
  delete from public.debts where user_id = auth.uid();
  delete from public.wallets where user_id = auth.uid();
  delete from public.stores where user_id = auth.uid();
  delete from public.history where user_id = auth.uid();
end $$;

-- Reference number on transactions (e.g. a GCash / bank reference no.)
alter table public.transactions add column if not exists ref text;
