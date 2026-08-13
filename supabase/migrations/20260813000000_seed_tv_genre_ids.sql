-- TMDB TV-specific genre ids absent from the initial seed (spec 21 §5).
-- Their absence caused an FK violation on media_genres inserts for series,
-- and because the insert was a single multi-row statement, one bad id
-- dropped every genre for that title.
insert into genres (id, name) values
  (10759, 'Action & Adventure'),
  (10762, 'Kids'),
  (10763, 'News'),
  (10764, 'Reality'),
  (10765, 'Sci-Fi & Fantasy'),
  (10766, 'Soap'),
  (10767, 'Talk'),
  (10768, 'War & Politics')
on conflict (id) do nothing;
