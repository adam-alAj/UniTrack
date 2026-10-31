# UniTrack Implementation Log

Updated for Prompt 02. Scope: Phases 04–06 only, continuing the Phase 00–03 foundation. Phase 07 and later are out of scope.

## Phase 00 — Repository and requirements inspection

- Source documents reviewed completely: `Docs/UniTrack_Project_Plan.md`, `Docs/UniTrack_Implementation_Plan.md`, and `Docs/UniTrack_Gmail_Sync.gs`.
- Inspected repository tree, Git state, app source, dependencies, environment template, and prior implementation log. Existing work was preserved.
- Git branch: `main...origin/main`. Existing untracked `supabase/.temp/` is ignored; its content was not opened or copied.
- Node, npm, pnpm, yarn, bun, Supabase CLI, psql, and clasp are unavailable in this environment. No configured project credentials were found.

## Phase 01 — Application foundation

- Existing Next.js App Router, TypeScript, Tailwind, shadcn conventions, Lucide, ESLint/Prettier, responsive shell, README, and `.env.example` retained.
- Validation: static config JSON parsing and source credential-pattern check had passed in Prompt 01. Dependency install, dev server, lint, and build remain unverified because Node/npm are unavailable; no lockfile exists.

## Phase 02 — Database and authentication foundation

- `202610310001_initial_schema.sql` defines courses, email messages, tasks, announcements, sync runs, indexes, constraints, owner-only RLS policies, and owner-consistent foreign keys.
- Static inspection found RLS enabled on all five user tables and 20 authenticated owner CRUD policies. No development seed data is used.
- Login/logout and protected route source exists; live Auth behavior and migration application were not verified because Supabase CLI/project credentials and Node/npm are unavailable.

## Phase 03 — Gmail feasibility evidence

- User-provided screenshots (used as source evidence; redacted fixtures only) show:
  1. Automated due reminder: visible sender `noreply-eclass@bethlehem.edu`; subject shape `Due on [weekday, date, time]: [task]`; body names an assignment, course code/name, explicit due time, and “Go to activity”.
  2. Digest: subject `You have assignments due in [N] days`; one shared calendar date and multiple course/task bullets with individual due times and activity links.
  3. Overdue reminder: subject `Overdue: [task]`; explicit weekday/date/time and activity link.
  4. Separate instructor notice: subject `Course Project`; sender address not visible; body states a course project is posted and gives a date-only submission deadline.
- Observed date text is English month-name format (e.g. `[weekday], [day] [month] [year], [time] AM/PM`) and date-only (`[day] [month] [year]`). Screenshot links are labels; actual portal URLs are unavailable.
- Candidate query for automated notices: `from:noreply-eclass@bethlehem.edu`. This was derived from visible evidence but was NOT executed against Gmail. It will not cover instructor-sent mail without an additional reviewed search strategy.
- Live diagnostic search, scheduled trigger execution, Workspace authorization, and admin restrictions remain unverified. No trigger was installed. The prior Prompt 01 browser session showed an earlier one-time read but not a scheduled trigger; it does not establish this worker's feasibility.

## Phase 04 — Email parsing engine

### Implemented
- `lib/email/` normalizes HTML/plain text, classifies messages, matches configured courses, extracts tasks/deadlines/links, handles digest items, and returns review reasons rather than inventing missing details.
- Date parsing accepts explicit English month-name dates. A due timestamp remains null if time/timezone is missing, the date is ambiguous, or the local time is invalid/ambiguous (DST). Original date wording is retained. `UNITRACK_SOURCE_TIMEZONE` must be configured with the institution's IANA zone.
- Redacted screenshot-derived fixtures and parser unit tests added. Fixtures contain no private names, content, or portal URLs.
- `zod` and `tsx` dependencies/scripts added. Course matching uses only configured user courses; it never creates a course from an email.

### Validation
- Unit tests are authored but not run: npm/Node are unavailable. Parser behavior is not marked validated.

## Phase 05 — Secure ingestion API and atomic database write

### Implemented
- `POST /api/ingest/email` validates method, bearer secret using constant-time byte comparison, JSON content type, 256 KiB bounded body, strict payload schema, HTTPS Gmail URL, and rejects unknown fields such as caller-supplied `user_id`.
- Owner UUID comes only from server configuration. The server-only Supabase admin module is isolated with `server-only`; service-role key is not used in browser code.
- Duplicate messages return before parsing/writing. The SQL function atomically records the email and its multiple task/announcement children and uses `(user_id, gmail_message_id)` as idempotency boundary.
- New migration `202610310002_email_ingestion.sql` adds review metadata and original due text, drops the old one-task-per-source-email index to support digest emails, and creates a pinned-search-path `SECURITY DEFINER` RPC with execution revoked from public/anon/authenticated and granted to `service_role` only.
- Handler unit tests cover auth, method/content type, schema/ownership rejection, review response, duplicate, sanitized/retryable DB error, and oversized body.

### Security review performed
- Static source review confirmed bearer auth precedes repository use; no caller-controlled owner ID; strict URL host validation; request size cap; no request/body/email data in handler or worker logs; generic retryable database errors; server-only service-role import; RLS remains enabled.
- Static migration review confirmed pinned empty `search_path`, explicit RPC execute grants, user ownership values, and transactional inserts. Live migration/RLS verification was not possible.

### Validation
- Handler unit tests authored but not run (npm/Node unavailable).
- Migration apply, live RLS checks, and concurrent duplicate test not run (Supabase CLI/project unavailable).

## Phase 06 — Gmail Apps Script worker

### Implemented
- `scripts/UniTrack_Gmail_Sync.gs` reads paginated messages via Advanced Gmail API, extracts plain text, posts to the ingestion contract, uses a lock and overlapping cursor, and only advances after exact successful status and matching message ID. It does not modify Gmail.
- `scripts/appsscript.json` enables Gmail API v1 and scopes `gmail.readonly`, `script.external_request`, and `script.scriptapp`. This intentionally replaces GmailApp's broader mailbox scope with least-privilege read access; deployer must enable the Advanced Gmail service and authorize it in the target Workspace account.
- Worker requires explicit `GMAIL_SEARCH_QUERY`, HTTPS endpoint and Script Properties; bounded diagnostics log counts/configuration presence only. It does not log query, body, sender, subject, or secret.
- Script tests cover response contract, cursor behavior, privacy-safe logs, endpoint/query configuration, and manifest scopes.

### Validation and blockers
- Apps Script unit tests are authored but not run (Node unavailable).
- Apps Script project deployment, live search diagnostic, authorization, time-driven trigger, UrlFetch access, and Workspace policy were not available to verify. Gmail query and trigger feasibility remain BLOCKED, not PASS.
- No private email content or secret was committed. Supabase temp metadata is ignored. Git status and diff whitespace checks were available; runtime secret scanners/build checks were not.

## Commands and results for Prompt 02

- `Get-Content`/`rg` source review of parser, handler, repository, migration, worker, fixtures, tests, and route — completed.
- `git status --short --branch` — `## main...origin/main` plus intended implementation changes; `supabase/.temp/` absent because ignored.
- `git diff --check` — PASS (only Git line-ending conversion warnings).
- PowerShell JSON parse for `package.json`, `tsconfig.json`, and `scripts/appsscript.json` — PASS.
- Static RLS policy count — PASS: all five tables enable RLS and have four owner CRUD policies each (20 total).
- Limited credential-pattern scan excluding generated/ignored metadata — PASS, no token-shaped values found. This is not a replacement for a dedicated secret scanner.
- `npm test` — NOT RUN: `npm` is not available on PATH.
- `npm install`, `npm run dev`, `npm run lint`, `npm run build` — NOT RUN: `npm` is not available on PATH.
- `supabase db push` and live RLS/Auth checks — NOT RUN: Supabase CLI and project credentials unavailable.
- Gmail diagnostic and trigger verification — NOT RUN: no connected Apps Script runtime/project authorization available.

## Phase status and next action

- Phases 00–03: implementation/documentation present; Phase 03 live Gmail checks remain blocked.
- Phase 04: implementation drafted; unit test validation blocked.
- Phase 05: implementation drafted; unit/database validation blocked.
- Phase 06: worker implemented; worker tests and live Gmail/trigger validation blocked.
- Overall Prompt 02: **PARTIAL / BLOCKED on environment validation**, not complete.
- Exact next project phase after this prompt: **Phase 07**.
