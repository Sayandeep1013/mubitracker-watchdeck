-- Bucket service (spec 23). Replaces the cursor concept: a client with a
-- bucketId always has a next request it can make, removing the null-cursor
-- dead end (audit failure 1.3).
create table if not exists deck_buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  filter_hash text not null,
  status text not null check (status in ('ready','serving','consumed')),
  items jsonb not null,
  partial boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  served_at timestamptz
);

create index if not exists idx_deck_buckets_lookup on deck_buckets (user_id, filter_hash, status);

alter table deck_buckets enable row level security;
create policy deck_buckets_all on deck_buckets for all using (auth.uid() = user_id);
