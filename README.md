# UniTrack

UniTrack is a private academic workspace for university tasks and course announcements. The foundation uses Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui conventions, Lucide icons, Supabase Auth, PostgreSQL, and row-level security.

## Requirements

- Node.js 20.9 or newer and npm
- A Supabase project
- Supabase CLI for applying the migration

## Local setup

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project. Keep every server-only value out of browser code.
4. Apply `supabase/migrations/202610310001_initial_schema.sql` to the project. With the Supabase CLI, run `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase db push`.
5. Create the initial owner account in Supabase Authentication. Public sign-up is not exposed by this app.
6. Start the app: `npm run dev`, then open <http://localhost:3000>.

The login screen reports when public Supabase configuration is missing. Authenticated users are routed through Supabase's server-side session validation. The dashboard shell uses empty states until real records are available; it contains no sample university data.

## Environment variables

| Variable | Use | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key; authorization is enforced by RLS | Browser safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Reserved for a future authenticated server ingestion path | Server only; not used by the browser or current app |
| `UNITRACK_INGEST_SECRET` | Reserved for the future Apps Script ingestion endpoint | Server only; never commit it |
| `UNITRACK_OWNER_USER_ID` | Owner UUID for a future trusted single-user ingestion worker | Server only |

Never place a service-role key or ingestion secret in a `NEXT_PUBLIC_*` variable. Apps Script secrets belong in Script Properties, not this repository.

## Database security

The initial migration creates `courses`, `email_messages`, `tasks`, `announcements`, and `sync_runs`. It enables RLS on each table with authenticated owner-only policies. Gmail message IDs are unique per owner; task and announcement references enforce that linked course and email rows have the same owner. No real university records are seeded.

Validate policy behavior in a non-production Supabase project with two test accounts before deploying real data. Applying migrations and live cross-account checks require Supabase project credentials.

## Gmail integration

The source worker is documented at `Docs/UniTrack_Gmail_Sync.gs`. It requires an HTTPS ingestion endpoint, which is outside this foundation phase. Do not install or schedule the worker until the endpoint and its secrets are configured. The search query must be set only after reviewing a small, redacted sample of actual university notifications; no sender, subject, language, course, or deadline pattern is assumed here.

## Commands

- `npm run dev` — local development server
- `npm run lint` — ESLint
- `npm run format:check` — Prettier check
- `npm run build` — production build
- `supabase db push` — apply pending local migrations to the linked project

The current workspace may not have the required credentials or runtime installed. See `IMPLEMENTATION_LOG.md` for the recorded validation status and blockers.
