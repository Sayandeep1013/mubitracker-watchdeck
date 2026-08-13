# Migration convention

Full detail: [`docs/spec/50-pipeline.md`](../../docs/spec/50-pipeline.md) §8.

**Filename:** `YYYYMMDDHHMMSS_snake_case_description.sql`, using the real UTC date/time the file is
added — not a placeholder, not a bumped copy of the previous file's date.

**Forward-only.** A mistake in an already-applied migration is corrected by a new migration, never
by editing the applied one.

**Apply order:** local → staging (once Stage 5.5 exists) → production, each verified with
`supabase migration list`. Take a manual backup before any migration that drops or alters a column.

⚠️ Four files are stamped `20250812*` and one `20260812073308`, predating this convention, so
lexical order doesn't match real chronology for those five. They are already applied and must
**not** be renamed — the inconsistency is documented here and in spec 50 §8 instead. Every
migration from `20260813000000` onward follows the convention correctly.
