# Archived migrations (pre-baseline)

These files were the repo's `supabase/migrations/` before the 2026-11-18 resync. They are **not** read by the
Supabase CLI or Git-integrated branching anymore.

Why: production (`ufbjphmsblgwzkofpgai`) had 118 versions recorded in `supabase_migrations.schema_migrations`,
58 of which were applied from other tools (Bolt, Prompt Studio, Sticker Studio, Display) and never committed here,
while 3 repo files were recorded under different versions (or applied by hand). Branching/`db push` refuse to run
when remote history contains versions missing locally, so the history was squashed:

- `supabase/migrations/20261118213000_baseline_live_schema.sql` recreates the live `public` schema (plus storage
  buckets/policies and the `auth.users` signup trigger), generated from the production catalog.
- Production history was repaired (history table only, no DDL) so it lists exactly the baseline version.
- A JSON backup of the old history rows, including recorded statements, was taken before the repair.

Do not move files from here back into `supabase/migrations/`.
