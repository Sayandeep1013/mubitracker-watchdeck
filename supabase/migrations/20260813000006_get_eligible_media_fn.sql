-- Bucket service candidate query (spec 23 §4): one indexed query replaces
-- v1's 1-12 serial TMDB round trips. Eligibility anti-join per spec 24 §7.
create or replace function get_eligible_media(
  p_user_id uuid,
  p_formats text[] default null,
  p_classifications text[] default null,
  p_genre_ids int[] default null,
  p_languages text[] default null,
  p_year_from int default null,
  p_year_to int default null,
  p_limit int default 500
)
returns table (
  id uuid,
  format text,
  classification text,
  popularity float,
  year int,
  title text,
  original_title text,
  overview text,
  original_language text,
  poster_path text,
  backdrop_path text,
  runtime int,
  genre_ids int[]
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select m.id, m.format, m.classification, m.popularity, m.year,
           m.title, m.original_title, m.overview, m.original_language,
           m.poster_path, m.backdrop_path, m.runtime
    from media m
    where (p_formats is null or m.format::text = any(p_formats))
      and (p_classifications is null or m.classification::text = any(p_classifications))
      and (p_languages is null or m.original_language = any(p_languages))
      and (p_year_from is null or m.year >= p_year_from)
      and (p_year_to is null or m.year <= p_year_to)
      and not m.adult
      and m.vote_count >= 10
      and (p_genre_ids is null or exists (
        select 1 from media_genres mg2 where mg2.media_id = m.id and mg2.genre_id = any(p_genre_ids)
      ))
      and not exists (  -- spec 24 §7 eligibility anti-join
        select 1 from user_media um
        where um.user_id = p_user_id and um.media_id = m.id
          and (um.status in ('watched', 'watch_later')
               or (um.status = 'unwatched' and (um.hidden_until is null or um.hidden_until > now())))
      )
      and not exists (  -- 24h impression suppression
        select 1 from deck_impressions di
        where di.user_id = p_user_id and di.media_id = m.id
          and di.shown_at > now() - interval '24 hours'
      )
    -- Filter, order, and limit BEFORE joining media_genres — aggregating
    -- genre arrays is only needed for the rows actually kept, not every
    -- eligible row. Doing the join+group-by over the whole eligible set
    -- first (thousands of rows) before the limit was the entire cost here:
    -- ~1.2s vs ~35ms restructured this way (measured via EXPLAIN ANALYZE).
    order by m.popularity desc nulls last
    limit p_limit
  )
  select b.id, b.format::text, b.classification::text, b.popularity, b.year,
         b.title, b.original_title, b.overview, b.original_language,
         b.poster_path, b.backdrop_path, b.runtime,
         coalesce(array_agg(mg.genre_id) filter (where mg.genre_id is not null), '{}') as genre_ids
  from base b
  left join media_genres mg on mg.media_id = b.id
  group by b.id, b.format, b.classification, b.popularity, b.year, b.title,
           b.original_title, b.overview, b.original_language, b.poster_path,
           b.backdrop_path, b.runtime;
$$;

revoke all on function get_eligible_media(uuid, text[], text[], int[], text[], int, int, int) from public;
grant execute on function get_eligible_media(uuid, text[], text[], int[], text[], int, int, int) to service_role;
