-- Supabase > SQL Editor > New query > paste > Run. Safe to run on top of the earlier version.

create table if not exists public.history (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  table_name text not null,
  new_data jsonb,
  old_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#2f6f4f',
  logo text,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('income','expense')),
  occurred_on date not null default current_date,
  description text not null default '',
  category text not null default 'General',
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tx_user_date on public.transactions(user_id, occurred_on);

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.history(user_id, action, table_name, old_data) values (old.user_id, tg_op, tg_table_name, to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.history(user_id, action, table_name, new_data, old_data) values (new.user_id, tg_op, tg_table_name, to_jsonb(new), to_jsonb(old));
    return new;
  else
    insert into public.history(user_id, action, table_name, new_data) values (new.user_id, tg_op, tg_table_name, to_jsonb(new));
    return new;
  end if;
end $$;

drop trigger if exists stores_log on public.stores;
create trigger stores_log after insert or update or delete on public.stores for each row execute function public.log_change();
drop trigger if exists transactions_log on public.transactions;
create trigger transactions_log after insert or update or delete on public.transactions for each row execute function public.log_change();

alter table public.stores       enable row level security;
alter table public.transactions enable row level security;
alter table public.history      enable row level security;

drop policy if exists "own stores" on public.stores;
create policy "own stores" on public.stores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "read own history" on public.history;
create policy "read own history" on public.history for select using (auth.uid() = user_id);

-- Store color and logo (for databases created before this feature)
alter table public.stores add column if not exists color text not null default '#2f6f4f';
alter table public.stores add column if not exists logo text;

-- Reset-all protection: a passcode checked inside the database (stored hashed)
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  passcode_hash text
);
alter table public.settings enable row level security; -- no policies: only the functions below can touch it

create or replace function public.has_passcode() returns boolean
language sql security definer set search_path = public as $$
  select exists(select 1 from public.settings where user_id = auth.uid() and passcode_hash is not null)
$$;

create or replace function public.set_passcode(new_code text, old_code text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if length(coalesce(new_code, '')) < 4 then raise exception 'Passcode must be at least 4 characters'; end if;
  select passcode_hash into h from public.settings where user_id = auth.uid();
  if h is not null and (old_code is null or crypt(old_code, h) <> h) then raise exception 'Current passcode is incorrect'; end if;
  insert into public.settings(user_id, passcode_hash) values (auth.uid(), crypt(new_code, gen_salt('bf')))
  on conflict (user_id) do update set passcode_hash = excluded.passcode_hash;
end $$;

-- Overall expenses: business-wide costs (salary, maintenance...) not tied to one store.
-- They are deducted from the combined income of all stores.
create table if not exists public.overall_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_on date not null default current_date,
  description text not null default '',
  category text not null default 'General',
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists oe_user_date on public.overall_expenses(user_id, occurred_on);
drop trigger if exists overall_expenses_log on public.overall_expenses;
create trigger overall_expenses_log after insert or update or delete on public.overall_expenses for each row execute function public.log_change();
alter table public.overall_expenses enable row level security;
drop policy if exists "own overall expenses" on public.overall_expenses;
create policy "own overall expenses" on public.overall_expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.reset_all(code text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select passcode_hash into h from public.settings where user_id = auth.uid();
  if h is null then raise exception 'Set a passcode first'; end if;
  if crypt(coalesce(code, ''), h) <> h then raise exception 'Wrong passcode'; end if;
  delete from public.transactions where user_id = auth.uid();
  delete from public.overall_expenses where user_id = auth.uid();
  delete from public.stores where user_id = auth.uid();
  delete from public.history where user_id = auth.uid();
end $$;

revoke execute on function public.has_passcode() from public, anon;
revoke execute on function public.set_passcode(text, text) from public, anon;
revoke execute on function public.reset_all(text) from public, anon;
grant execute on function public.has_passcode() to authenticated;
grant execute on function public.set_passcode(text, text) to authenticated;
grant execute on function public.reset_all(text) to authenticated;


-- Business / Personal space: personal entries have no store
alter table public.transactions add column if not exists workspace text not null default 'business';
alter table public.transactions alter column store_id drop not null;
alter table public.transactions drop constraint if exists tx_workspace_chk;
alter table public.transactions add constraint tx_workspace_chk check (workspace in ('business','personal'));
alter table public.transactions drop constraint if exists tx_store_required;
alter table public.transactions add constraint tx_store_required check (workspace = 'personal' or store_id is not null);
create index if not exists tx_user_ws on public.transactions(user_id, workspace, occurred_on);


-- Utang tracker (personal): who owes you and who you owe
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  direction text not null check (direction in ('owed_to_me','i_owe')),
  person text not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_amount numeric(12,2) not null default 0,
  due_on date,
  note text not null default '',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists debts_user on public.debts(user_id, due_on);
drop trigger if exists debts_log on public.debts;
create trigger debts_log after insert or update or delete on public.debts for each row execute function public.log_change();
alter table public.debts enable row level security;
drop policy if exists "own debts" on public.debts;
create policy "own debts" on public.debts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reset-all now also clears utang records
create or replace function public.reset_all(code text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select passcode_hash into h from public.settings where user_id = auth.uid();
  if h is null then raise exception 'Set a passcode first'; end if;
  if crypt(coalesce(code, ''), h) <> h then raise exception 'Wrong passcode'; end if;
  delete from public.transactions where user_id = auth.uid();
  delete from public.overall_expenses where user_id = auth.uid();
  delete from public.debts where user_id = auth.uid();
  delete from public.stores where user_id = auth.uid();
  delete from public.history where user_id = auth.uid();
end $$;
