-- Corpus ingestion (spec 21 §4/§8): rejected titles are recorded so a
-- later ingestion pass does not re-fetch and re-evaluate them.
create table if not exists media_rejected (
  provider text not null,
  external_id text not null,
  reason text not null,
  rejected_at timestamptz not null default now(),
  primary key (provider, external_id)
);
