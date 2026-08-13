-- get_eligible_media (spec 23 §4) filters on format/classification and
-- orders by popularity — support both instead of a sequential scan.
create index if not exists idx_media_popularity on media (popularity desc);
create index if not exists idx_media_format_classification on media (format, classification);
