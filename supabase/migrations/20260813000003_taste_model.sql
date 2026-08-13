-- Taste model (spec 22). Converts user_media history into per-dimension
-- affinity scores that drive bucket quotas and ranking (spec 23).
create table if not exists user_taste (
  user_id uuid primary key references profiles(id) on delete cascade,
  vector jsonb not null,
  decision_count int not null,
  computed_at timestamptz not null default now()
);

alter table user_taste enable row level security;
create policy user_taste_all on user_taste for all using (auth.uid() = user_id);

-- Raw weighted accepted/decided sums per genre/format/classification.
-- Laplace smoothing is applied in application code (keeps the alpha/prior
-- constants visible in one place instead of duplicated into SQL).
create or replace function compute_user_taste(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with decided as (
    select um.media_id, um.status,
           power(0.5, extract(epoch from (now() - um.updated_at)) / (86400.0 * 180)) as w
    from user_media um
    where um.user_id = p_user_id
      and um.status in ('watched', 'watch_later', 'unwatched')
  ),
  genre_agg as (
    select mg.genre_id::text as key,
           sum(w) filter (where d.status in ('watched', 'watch_later')) as accepted,
           sum(w) as decided
    from decided d
    join media_genres mg on mg.media_id = d.media_id
    group by mg.genre_id
  ),
  format_agg as (
    select m.format::text as key,
           sum(w) filter (where d.status in ('watched', 'watch_later')) as accepted,
           sum(w) as decided
    from decided d
    join media m on m.id = d.media_id
    group by m.format
  ),
  classification_agg as (
    select m.classification::text as key,
           sum(w) filter (where d.status in ('watched', 'watch_later')) as accepted,
           sum(w) as decided
    from decided d
    join media m on m.id = d.media_id
    group by m.classification
  )
  select jsonb_build_object(
    'decisionCount', (select count(*) from decided),
    'genre', (select coalesce(jsonb_object_agg(key, jsonb_build_object('accepted', accepted, 'decided', decided)), '{}'::jsonb) from genre_agg),
    'format', (select coalesce(jsonb_object_agg(key, jsonb_build_object('accepted', accepted, 'decided', decided)), '{}'::jsonb) from format_agg),
    'classification', (select coalesce(jsonb_object_agg(key, jsonb_build_object('accepted', accepted, 'decided', decided)), '{}'::jsonb) from classification_agg)
  );
$$;

revoke all on function compute_user_taste(uuid) from public;
grant execute on function compute_user_taste(uuid) to service_role;
