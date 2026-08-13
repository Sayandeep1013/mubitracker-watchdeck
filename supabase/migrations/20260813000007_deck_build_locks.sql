-- Bucket-build concurrency guard (spec 23 §6). Postgres advisory locks
-- don't fit this app's execution model: PostgREST/Supabase REST issues
-- each query as its own isolated request (no session affinity across
-- calls), and buildBucket() spans many separate round-trips, not one DB
-- transaction — an advisory *xact* lock would release the instant the
-- request that acquired it finished. A row with a unique key and
-- on-conflict-do-nothing gives the same atomic "only one winner" guarantee
-- without needing a held connection.
create table if not exists deck_build_locks (
  user_id uuid not null references profiles(id) on delete cascade,
  filter_hash text not null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, filter_hash)
);

alter table deck_build_locks enable row level security;
create policy deck_build_locks_all on deck_build_locks for all using (auth.uid() = user_id);
