# Sendmybill database setup

The complete schema is defined by the checked-in migrations in `supabase/migrations`.

## Fresh project verification

1. Install the Supabase CLI and Docker.
2. Run `supabase start` from the repository root.
3. Run `supabase db reset`. This recreates the local database from every checked-in migration.
4. Run `supabase gen types typescript --local > src/integrations/supabase/types.ts` after every schema change.
5. Run `npm run verify` to check types, lint, tests, and the production build.

Row-level security remains the final authorization boundary. The React route guard is only a user-experience layer; every public table and storage operation must continue to scope access with `auth.uid()`.

Company assets are private. The database stores bucket-relative object paths and the application requests short-lived signed URLs for display.

## Linked project deployment

1. Confirm `supabase/config.toml` targets the same project as `VITE_SUPABASE_URL`.
2. Run `npx supabase link --project-ref <project-ref>`.
3. Run `npx supabase db push --dry-run` and review the exact pending migration list.
4. Run `npx supabase db push` only after the dry run is clean.
5. Run `npx supabase migration list` and confirm every local version has a matching remote version.

Do not mark a migration as applied merely to skip a failing statement. Migration-history repair is only appropriate after read-only schema checks prove that the migration's objects already exist remotely.
