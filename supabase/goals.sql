-- Savings goals (personal). Supabase > SQL Editor > New query > paste > Run. Safe to run more than once.
-- Run supabase/wallets.sql first (goal deposits can optionally come from a wallet).

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  target_date date,
  color text not null default '#00844a',
  created_at timestamptz not null default now()
);
create index if not exists goals_user on public.goals(user_id);

-- Every deposit (+) or withdrawal (-) on a goal. wallet_id is optional: when set, the money comes from / returns to that wallet.
create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  amount numeric(12,2) not null check (amount <> 0),
  wallet_id uuid references public.wallets(id) on delete set null,
  occurred_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists gc_goal on public.goal_contributions(goal_id, occurred_on);
create index if not exists gc_wallet on public.goal_contributions(wallet_id);

drop trigger if exists goals_log on public.goals;
create trigger goals_log after insert or update or delete on public.goals for each row execute function public.log_change();
drop trigger if exists goal_contributions_log on public.goal_contributions;
create trigger goal_contributions_log after insert or update or delete on public.goal_contributions for each row execute function public.log_change();

alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;
drop policy if exists "own goals" on public.goals;
create policy "own goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own goal contributions" on public.goal_contributions;
create policy "own goal contributions" on public.goal_contributions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reset-all now also clears goals
create or replace function public.reset_all(code text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select passcode_hash into h from public.settings where user_id = auth.uid();
  if h is null then raise exception 'Set a passcode first'; end if;
  if crypt(coalesce(code, ''), h) <> h then raise exception 'Wrong passcode'; end if;
  delete from public.goal_contributions where user_id = auth.uid();
  delete from public.goals where user_id = auth.uid();
  delete from public.transfers where user_id = auth.uid();
  delete from public.transactions where user_id = auth.uid();
  delete from public.overall_expenses where user_id = auth.uid();
  delete from public.debts where user_id = auth.uid();
  delete from public.wallets where user_id = auth.uid();
  delete from public.stores where user_id = auth.uid();
  delete from public.history where user_id = auth.uid();
end $$;
