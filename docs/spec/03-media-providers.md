# 03 — Media Providers

## Primary: TMDB

[The Movie Database API](https://developer.themoviedb.org/) is the primary metadata provider for movies, TV, search, posters, discovery, and external IDs.

### Licensing (Personal Project)

- Developer API: **free** for non-commercial use
- Required: approved TMDB logo + disclaimer in About/Credits
- Disclaimer: *"This product uses the TMDB API but is not endorsed or certified by TMDB."*
- Commercial use requires separate agreement with TMDB

### Rate Limiting

- Soft ceiling ~40–50 requests/second
- Handle HTTP 429 with exponential backoff
- Implement token bucket at ~30 req/s in application code
- Cache aggressively; deduplicate in-flight requests

### Endpoints Used

| Operation | TMDB Endpoint |
|---|---|
| Search | `/search/multi`, `/search/movie`, `/search/tv` |
| Details | `/movie/{id}`, `/tv/{id}` |
| Discover movies | `/discover/movie` |
| Discover TV | `/discover/tv` |
| Genres | `/genre/movie/list`, `/genre/tv/list` |
| External IDs | `/find/{external_id}` |
| Changes | `/movie/changes`, `/tv/changes` (future worker) |

### Image Handling

Store `poster_path` and `backdrop_path` only. Construct URLs at runtime:

```text
https://image.tmdb.org/t/p/w500{poster_path}
```

Deck cards use `w342` or `w500`; do not load original resolution.

### Normalization

TMDB responses are mapped to internal `NormalizedMedia`:

```typescript
{
  provider: 'tmdb',
  providerId: string,
  format: 'movie' | 'series',
  classification: Classification,
  title: string,
  originalTitle: string,
  overview: string,
  releaseDate: string | null,
  year: number | null,
  originalLanguage: string,
  posterPath: string | null,
  backdropPath: string | null,
  runtime: number | null,
  genreIds: number[],
  popularity: number,
}
```

## Secondary: Jikan/MAL (Phase 4)

- Unofficial read-only API
- Rate limit: 3 req/sec, 60 req/min
- Use for anime enrichment only (MAL IDs, studios, seasons)
- Never depend on Jikan for core tracking loop

## Caching Strategy

```text
TMDB → Backend normalize → Upsert media + media_external_ids → Return to client
```

- Search results: cache normalized media in DB on first touch
- Details: upsert on deck/search encounter
- Genres: sync once, refresh weekly
- Do not permanently mirror poster binaries without checking terms

## Error Handling

If TMDB is unavailable:
- Serve cached media from PostgreSQL
- Search shows "temporarily unavailable"
- Deck continues if batch already loaded

## Security

`TMDB_API_KEY` is server-only. Never embed in client bundles.
