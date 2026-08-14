-- TMDB response cache (spec 50 §7) — shared across serverless instances,
-- keyed by path + normalized params (never includes the API key). Written
-- and read only by the service-role client in apps/web/src/lib/tmdb/provider.ts.
create table if not exists tmdb_cache (
  cache_key text primary key,
  response jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists tmdb_cache_expires_idx on tmdb_cache (expires_at);
alter table tmdb_cache enable row level security;
-- No policies — service-role only, same reasoning as analytics_events.

-- Global TMDB rate budget (spec 50 §7) — replaces the old per-instance
-- 35ms setTimeout gate, which was meaningless on serverless: N concurrent
-- instances each kept their own independent timer, so the real aggregate
-- request rate was never actually bounded. Fixed 1-second window, atomic
-- increment via upsert; the caller backs off when this returns false.
create table if not exists tmdb_rate_limit (
  window_start timestamptz primary key,
  request_count int not null default 0
);

create or replace function tmdb_rate_limit_acquire(p_budget int default 35)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('second', now());
  v_count int;
begin
  insert into tmdb_rate_limit (window_start, request_count)
  values (v_window, 1)
  on conflict (window_start) do update set request_count = tmdb_rate_limit.request_count + 1
  returning request_count into v_count;

  delete from tmdb_rate_limit where window_start < now() - interval '10 seconds';

  return v_count <= p_budget;
end;
$$;

revoke all on function tmdb_rate_limit_acquire(int) from public;
grant execute on function tmdb_rate_limit_acquire(int) to service_role;
