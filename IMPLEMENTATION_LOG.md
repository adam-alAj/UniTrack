# UniTrack Implementation Log

Historical entry below records Prompt 02. The latest entry (Prompt 03) records current work for Phases 07–08.

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
- At that checkpoint, the exact next project phase was **Phase 07**.

## Prompt 03 — Phases 07–08: Dashboard, shell, and tasks

### Repository and requirements review
- Re-read `Docs/UniTrack_Project_Plan.md`, `Docs/UniTrack_Implementation_Plan.md`, and `Docs/UniTrack_Gmail_Sync.gs` completely before editing.
- Inspected current Git state, App Router pages, shell, auth actions/client, both database migrations, parser, ingestion route/repository, package scripts, and task schema. Existing backend and schema were retained; no migration was required.
- Existing Node/npm absence was reconfirmed. Supabase Auth/database credentials remain unavailable, so browser/live verification cannot run.

### Phase 07 changes
- Replaced placeholder dashboard with authenticated server-side reads for real tasks, recent announcements, and latest sync run.
- Each dashboard query explicitly filters by `user.id`; Supabase RLS remains in force.
- Added exact-count queries for pending, next-seven-day, upcoming-exam, completed, and overdue cards; upcoming/undated lists and five overdue examples are fetched separately.
- Added useful no-data states, per-query failure messaging, a route loading skeleton, and an application error boundary.
- Finalized responsive desktop sidebar, header/account logout, and mobile Overview/Tasks navigation. Future-phase destinations are visibly disabled.

### Phase 08 changes
- Added `/tasks` with search, combined course/type/status/date filters, and due-date/created-date sorting.
- Added a task details/edit/create dialog with optional deadline, course, type, status, description, original deadline wording, review state, source email metadata, and validated Gmail link.
- Added manual task creation and editing/status changes through server actions. Zod validates both payloads; current owner is re-derived from `auth.getUser()`, all reads/updates filter by `user_id`, inserts assign that ID server-side, and authenticated Supabase client/RLS authorizes writes.
- Task list reads use deterministic, owner-scoped pagination. Gmail links are revalidated against HTTPS `mail.google.com` before opening in a new tab.
- Missing deadlines remain null and display as “No deadline”; the form does not infer one.
- Added schema tests for nullable deadlines, supported statuses/types, UUID update IDs, and strict rejection of a forged `user_id` field.

### Validation performed
- `git diff --check` — PASS after Prompt 03 changes (Git reports only its configured LF-to-CRLF conversion warnings).
- `package.json` JSON parse — PASS.
- Static ownership review — dashboard, task, course, announcement, and sync queries include authenticated `user.id`; task update filters both record ID and authenticated owner; insert takes `user_id` only from `auth.getUser()`.
- `npm run lint`, `npm run build`, `npm test` — attempted after final changes; each was unable to start because `npm` is not available on PATH. No result is claimed for lint/build/tests.
- No Supabase credentials were available for live data, RLS isolation, insert/update, or cross-user denial checks. No fake dashboard data or seed records were added.
- Responsive visual/browser checks were not available; layout was inspected in source only.

### Status
- Phase 07: implemented in source; live data, responsive browser, and error/loading validation blocked.
- Phase 08: implemented in source; persistence, Zod/runtime, RLS denial, and browser interaction validation blocked.
- Overall Prompt 03: **PARTIAL / BLOCKED on runtime and Supabase validation**.
- Exact next project phase: **Phase 09 — Academic Calendar**.

## Prompt 04 — Phases 09–10: Calendar, announcements, sync recovery, courses

### Repository review
- Re-read the project plan, implementation plan, and Gmail Apps Script completely before editing. Inspected the implementation log, dashboard/tasks, schema migrations, parser/ingestion route, worker, and shared shell.
- Found an existing ingestion gap needed for recovery: duplicate Gmail IDs were always treated as complete, including failed records, and the worker did not write sync summaries. Added a focused migration and worker summary endpoint while preserving the existing ingestion model.

### Phase 09 changes
- Added `/calendar`, a Monday-first responsive month view with local date/time display, month navigation, event type styling, empty-month copy, and selection opening the existing task editor.
- Calendar reads are authenticated and owner-scoped, include only non-null deadlines, and use stable pagination. Undated tasks are defensively excluded from rendering.
- Added calendar date utility tests for month boundaries and local day keys.

### Phase 10 changes
- Added `/announcements` for owner-scoped announcements, related course and source email metadata, received dates, review markers, and validated source links.
- Added `/sync` for last successful sync, recent run statuses/counts, and failed/review/received messages. Raw error summaries are replaced by safe generic descriptions; email bodies are never selected for display.
- Added authenticated retry action for failed messages. It reloads the saved message under the current user, reuses the original Gmail message ID and ingestion parser, and writes transactionally through the existing atomic ingestion RPC.
- Added migration functions to record failures and permit a failed Gmail ID to be retried atomically; successful/reviewed rows remain duplicates. Concurrent retries serialize on the existing unique key.
- Updated the Apps Script worker to report sync outcome/counts to `/api/ingest/sync-run` using the configured bearer secret. The route uses the server-only admin client and a server-configured owner ID; the migration grants only the required service role insert privilege.
- Added `/courses` management for name, code, instructor, aliases, and color. Parser course matching already consumed course aliases, so course management populates that existing matching path without changing parser architecture.
- Added navigation for all implemented sections, server-side owner filters, safe failure display, schemas, and focused tests for the new pure logic/handlers.

### Validation and blockers
- `git diff --check` — PASS; Git only reports configured LF-to-CRLF conversion notices.
- PowerShell JSON parsing of `package.json`, `tsconfig.json`, and `scripts/appsscript.json` — PASS.
- Credential-pattern scan of repository text — PASS; it found only documentation, env variable names/placeholders, and server-side key references. No token-shaped credential value was found.
- Source-level ownership/security review — PASS: page queries scope by authenticated `user.id`; course and task mutations derive owner from `auth.getUser()` and filter by that owner; sync reporting uses a secret and server-configured owner; browser code does not import the service-role client; RLS was not disabled.
- Static migration review — PASS by inspection: failure records and task/announcement inserts use the same `(user_id, gmail_message_id)` identity; retry inserts are transactional and existing successful/review rows are not overwritten.
- `node --version`, `npm --version`, `npm test`, `npm run lint`, `npm run build`, and `npm run dev` — BLOCKED: Node.js/npm are not installed or available on PATH in this environment. No runtime result is claimed.
- Supabase migration application, live RLS isolation, concurrent retry verification, and login/live data checks — BLOCKED: Supabase CLI/project credentials are unavailable.
- Apps Script diagnostic search and time-trigger execution — BLOCKED: no authorized Apps Script project/runtime is connected. The worker can report sync runs once configured, but live Gmail/Workspace feasibility cannot be claimed.
- Browser responsive/interaction checks — BLOCKED: no running app due missing Node/npm.

### Status
- Phase 09: implemented in source; live database and browser validation blocked.
- Phase 10: implemented in source; migration, RLS, retry, worker, and browser runtime validation blocked.
- Overall Prompt 04: **PARTIAL / BLOCKED on environment validation**; do not treat phases as verified complete until blocked checks run.
- Exact next project phase after completing required validation: **Phase 11**.

## Prompt 05 — Phases 11–12: End-to-end hardening and production release

### Phase 11 review and changes
- Re-read all mandatory project documentation and reviewed repository status, tests, migrations, environment template, worker, and deployment configuration.
- Found that `Docs/UniTrack_Gmail_Sync.gs` was stale relative to `scripts/UniTrack_Gmail_Sync.gs`: it used GmailApp's broader access, logged the full search query and account email, and omitted the sync-run reporting contract. Synchronized the documentation copy to the least-privilege Advanced Gmail API worker used by the project.
- Extended the worker tests to cover an HTTP 401 response without cursor advancement and a trigger invocation that exits while the script lock is held.
- Added `Docs/DEPLOYMENT.md` with non-destructive production setup, manual verification steps, recovery, secret rotation, and a final checklist; linked it from README.

### Scenario matrix
| Required scenario | Existing test/source coverage | Actual end-to-end result |
|---|---|---|
| Assignment notification | Redacted parser fixture | NOT RUN |
| Quiz notification | Parser keyword probe | NOT RUN |
| Exam notification | Parser keyword probe | NOT RUN |
| Announcement | Parser keyword probe | NOT RUN |
| Duplicate email | Ingestion fake-repository and worker contract tests | NOT RUN |
| Missing deadline | Parser unit case | NOT RUN |
| Ambiguous date | Parser unit case | NOT RUN |
| Unmatched course | Parser fixture/review-reason assertions | NOT RUN |
| API unavailable | Worker transport-failure test | NOT RUN |
| API unauthorized | Worker 401 regression test added; ingestion auth rejection case exists | NOT RUN |
| Trigger overlap | Lock-held worker regression test added | NOT RUN against Apps Script runtime |
| Edit extracted task | Authenticated UI action exists | NOT RUN |
| Mark task completed | Authenticated UI action exists | NOT RUN |
| Open original email | URL validation/link UI exists | NOT RUN in browser |
| Cross-account data access | Owner-scoped queries and migration RLS policies exist | NOT RUN against Supabase |

### Phase 11 validation
- `git diff --check` — PASS (line-ending notices only).
- Static inspection — PASS for owner-scoped query/action patterns, service-role isolation, bearer authentication before ingestion, bounded payloads, server-configured owner ID, and enabled owner policies in migrations.
- `.env.example` and source credential-pattern scan — PASS for placeholders/references only; no production credential values found.
- `npm test`, `npm run lint`, `npm run format:check`, `npm run build`, and `npm ci` — BLOCKED: Node/npm and `node_modules` are absent. Tests were not executed; assertions were not weakened.
- Follow-up command attempts `npm install`, `npm test`, `npm run lint`, `npm run format:check`, `npm run build`, `supabase db push`, and `vercel --prod` — each stopped immediately because the executable is not installed/on PATH; no command reached a remote project.
- Supabase migration apply and live RLS checks — BLOCKED: Supabase CLI and project credentials are absent.
- Browser workflow and bundle inspection — BLOCKED: dependencies/runtime and a running production build are absent.
- Gmail live message, Apps Script lock/trigger, authorization, and Workspace policy — BLOCKED: no authorized Apps Script runtime is connected.

### Phase 12 validation
- Git branch/status and remote were inspected; the tree contains the implementation changes from Phases 07–10 plus this release documentation/test change.
- GitHub remote read (`git ls-remote origin HEAD`) — BLOCKED: outbound connection to `github.com:443` failed. No commit was pushed or release tag created.
- `vercel`, `supabase`, and `gh` CLIs and production environment credentials — NOT AVAILABLE. No production Supabase migration, Auth redirect change, Vercel deployment, Apps Script deployment, manual sync, or production trigger was attempted.
- No production URL exists to verify in this session. No claim is made for real Gmail-to-dashboard processing.
- README and `Docs/DEPLOYMENT.md` now document deployment configuration, recovery, rotation, and the release checklist without recording secret values.
- `git diff --check` and JSON parsing of `package.json`, `tsconfig.json`, and `scripts/appsscript.json` — PASS. Secret-pattern scan — PASS with no token-shaped credential values found. Client-tree source scan found the ingestion secret only in server route handlers; no browser components reference it.

### Final release state
- Phase 11: **INCOMPLETE / BLOCKED** pending execution of unit tests and live integration/RLS/browser checks.
- Phase 12: **INCOMPLETE / BLOCKED** pending runtime installation, authorized platform access, deployment, and real-message acceptance.
- MVP status: **INCOMPLETE**. Do not tag or claim production readiness until the runbook checklist is verified.
- Exact next step: install/use Node.js and npm with project dependencies, then run `npm ci` (or `npm install` because this repository currently has no lockfile), `npm test`, `npm run lint`, `npm run format:check`, and `npm run build`; then continue with test-project Supabase/RLS verification before production deployment.
