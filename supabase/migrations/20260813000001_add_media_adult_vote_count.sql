-- Needed to persist TMDB's adult flag and vote_count so the content filter
-- (spec 21 §4) can be evaluated without a live TMDB round trip.
alter table media
  add column if not exists adult boolean not null default false,
  add column if not exists vote_count int not null default 0;
