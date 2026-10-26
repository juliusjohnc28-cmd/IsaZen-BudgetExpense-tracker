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
