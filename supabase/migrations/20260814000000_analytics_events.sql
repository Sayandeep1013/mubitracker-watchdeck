-- Analytics (spec 50 §6). Minimal client event sink — no PII, user_id is
-- the Supabase auth uuid. Written only by the service-role API route
-- (POST /api/v1/analytics/events); no client ever has direct table access.
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  event text not null check (event in (
    'deck_batch_served', 'media_classified', 'undo_used', 'deck_empty', 'filter_applied'
  )),
  properties jsonb not null default '{}'::jsonb,
  platform text not null check (platform in ('web', 'mobile')),
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_created_idx
  on analytics_events (event, created_at desc);
create index if not exists analytics_events_user_idx
  on analytics_events (user_id, created_at desc);

alter table analytics_events enable row level security;
-- No policies: RLS with zero policies denies all access to the anon/authenticated
-- roles, which is correct here — only the service-role client (bypasses RLS)
-- ever touches this table.

-- Headline metric (spec 50 §6): p50/p90 of media_classified.ms_since_card_shown
-- per platform. `select * from analytics_classification_latency_percentiles();`
create or replace function analytics_classification_latency_percentiles(p_since timestamptz default now() - interval '7 days')
returns table (platform text, p50_ms numeric, p90_ms numeric, samples bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    properties->>'platform' as platform,
    percentile_cont(0.5) within group (order by (properties->>'ms_since_card_shown')::numeric) as p50_ms,
    percentile_cont(0.9) within group (order by (properties->>'ms_since_card_shown')::numeric) as p90_ms,
    count(*) as samples
  from analytics_events
  where event = 'media_classified'
    and created_at >= p_since
  group by properties->>'platform';
$$;

revoke all on function analytics_classification_latency_percentiles(timestamptz) from public;
grant execute on function analytics_classification_latency_percentiles(timestamptz) to service_role;
