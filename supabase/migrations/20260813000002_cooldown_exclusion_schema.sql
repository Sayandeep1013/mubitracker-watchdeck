-- Cooldown + exclusion (spec 24). Swiping left previously had no effect —
-- `unwatched` titles were immediately eligible again on the next batch.
alter table user_media
  add column if not exists reject_count int not null default 0,
  add column if not exists hidden_until timestamptz;

create index if not exists idx_user_media_hidden_until on user_media (user_id, hidden_until);

-- Replaces deck_sessions.shown_media_ids, which was specced for impression
-- suppression and never implemented (9 session rows, 0 with any ids).
create table if not exists deck_impressions (
  user_id  uuid not null references profiles(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  shown_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

create index if not exists idx_deck_impressions_user_shown on deck_impressions (user_id, shown_at);

alter table deck_impressions enable row level security;

create policy deck_impressions_all on deck_impressions for all using (auth.uid() = user_id);
