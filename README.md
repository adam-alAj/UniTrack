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
4. Apply both migrations to the project. With the Supabase CLI, run `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase db push`.
5. Create the initial owner account in Supabase Authentication. Public sign-up is not exposed by this app.
6. Start the app: `npm run dev`, then open <http://localhost:3000>.

The login screen reports when public Supabase configuration is missing. Authenticated users are routed through Supabase's server-side session validation. The dashboard shell uses empty states until real records are available; it contains no sample university data.

## Environment variables

| Variable | Use | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key; authorization is enforced by RLS | Browser safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only ingestion repository | Server only; never use in browser code |
| `UNITRACK_INGEST_SECRET` | Shared bearer secret for Apps Script ingestion | Server only; never commit it |
| `UNITRACK_OWNER_USER_ID` | Supabase auth user UUID that owns ingested records | Server only |
| `UNITRACK_SOURCE_TIMEZONE` | IANA timezone used to convert explicitly stated local deadlines | Server only; configure before interpreting timed deadlines |

Never place a service-role key or ingestion secret in a `NEXT_PUBLIC_*` variable. Apps Script secrets belong in Script Properties, not this repository.

## Database security

The initial migration creates `courses`, `email_messages`, `tasks`, `announcements`, and `sync_runs`. It enables RLS on each table with authenticated owner-only policies. Gmail message IDs are unique per owner; task and announcement references enforce that linked course and email rows have the same owner. No real university records are seeded.

Validate policy behavior in a non-production Supabase project with two test accounts before deploying real data. Applying migrations and live cross-account checks require Supabase project credentials.

## Gmail integration

The ingestion API is `POST /api/ingest/email`; its server validates a bounded payload and bearer secret, derives owner identity from server configuration, parses records, and writes them atomically through a restricted database function. The Apps Script worker is `scripts/UniTrack_Gmail_Sync.gs`; copy it and `scripts/appsscript.json` into an Apps Script project, enable the Advanced Gmail service, configure required Script Properties, authorize read-only Gmail access, and run `diagnoseUniTrack` before installing the five-minute trigger with `setupUniTrackTrigger`.

User-provided screenshots show automated reminders from `noreply-eclass@bethlehem.edu`, due reminder subjects, “You have assignments due in N days” digest subjects, overdue notices, and a separate instructor-sent course project notice. A candidate query for automated notices is `from:noreply-eclass@bethlehem.edu`. It was not run against Gmail in this environment and does not cover instructor-sent mail. Portal URLs are not visible in the supplied screenshots. The parser preserves explicit date text and leaves a due timestamp null for a date without a time, missing timezone, ambiguity, or invalid date; configure the university's IANA timezone before ingestion.

Email payload bodies are stored in `email_messages` to support traceability. Limit access through owner-only RLS and treat database backups/logging as private student data. The worker logs counts/status only, never message content, query, sender, or subject. Gmail read and trigger authorization must be tested in the intended Workspace account before enabling scheduled execution.

## Commands

- `npm run dev` — local development server
- `npm run lint` — ESLint
- `npm run format:check` — Prettier check
- `npm run build` — production build
- `supabase db push` — apply pending local migrations to the linked project
- `npm test` — parser, ingestion handler, and Apps Script worker unit tests

The current workspace may not have the required credentials or runtime installed. See `IMPLEMENTATION_LOG.md` for the recorded validation status and blockers.
