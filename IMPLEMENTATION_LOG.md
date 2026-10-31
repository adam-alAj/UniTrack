# UniTrack Implementation Log

Scope for this run: Phases 00–03 only. Later phases are out of scope.

## Phase 00 — Repository and Requirements Inspection

### Changes
- Recorded the repository state, requirements checklist, configuration gaps, and validation constraints here.
- Read all of `Docs/UniTrack_Project_Plan.md`, `Docs/UniTrack_Implementation_Plan.md`, and `Docs/UniTrack_Gmail_Sync.gs` completely before modifying project files.

### Checklist mapped to phases
- [x] Phase 00: inspect repository, requirements, existing changes, tools, and missing configuration.
- [x] Phase 01: Next.js App Router, TypeScript, Tailwind, shadcn/ui foundation, shell, safe env template, and README implemented; runtime checks blocked.
- [x] Phase 02: Supabase schema/RLS migrations, browser/server clients, protected routes, login/logout implemented; live checks blocked.
- [ ] Phase 03: inspect real mailbox samples, derive evidence-based Gmail query, verify scheduled trigger, and record redacted patterns. Preliminary access test observed; core checks blocked.
- [x] Explicitly excluded Phases 04–12.

### Commands executed
- `Get-Content -Raw` on all three source documents; output limit required complete numbered chunk reads afterward.
- `Get-ChildItem -Force -Recurse`
- `git status --short --branch`
- `rg --files` for repository instructions, package/lock files, application files, configuration, and log.
- `node --version`, `npm --version`, `git --version`; checked `supabase`, `clasp`, and related environment variables.

### Validation
- [x] Source documents present and completely reviewed.
- [x] Workspace contents inspected; existing work preserved.
- [x] Configuration gaps recorded.

### Issues
- Initial workspace contained only `Docs/` and `.brud/history/cleanup.json`; no app, package manifest, lockfile, or `AGENTS.md` was present.
- `git status` cannot run because this is not a Git repository. Git itself is installed.
- Node.js/npm, Supabase CLI, and clasp are not available on PATH.
- No relevant Supabase project credentials or local Gmail/Apps Script environment variables are present.

### Decisions
- Started the app in new application paths and preserved the existing documentation and `.brud` files.
- Did not invent university-specific senders, subjects, courses, language, dates, links, or email patterns.
- Continued independent implementation while recording database and Gmail integration checkpoints as blocked.

### Status
COMPLETE

## Phase 01 — Initialize Next.js Application

### Changes
- Added a Next.js 16 App Router + TypeScript foundation, responsive shell, Tailwind CSS v4, shadcn/ui configuration and Button component, Lucide icons, ESLint flat config, and Prettier config.
- Added safe `.env.example`, README setup/security notes, and package scripts/dependencies.
- Dashboard uses empty states; no sample university records are fabricated.

### Commands executed
- Checked current official Next.js App Router/installation/ESLint, shadcn Next.js, and Supabase SSR client documentation.
- Parsed `package.json`, `tsconfig.json`, `components.json`, and `.prettierrc.json` with PowerShell `ConvertFrom-Json` — PASS.
- Scanned project source for token-shaped secret values — PASS (no matches; safe env placeholders are documented separately).
- `npm install` — could not start because `npm` is unavailable.
- `npm run dev` — could not start because `npm` is unavailable.
- `npm run lint` — could not start because `npm` is unavailable.
- `npm run build` — could not start because `npm` is unavailable.

### Validation
- [ ] Dependencies install — BLOCKED (npm unavailable).
- [ ] Development server starts — BLOCKED (Node/npm unavailable).
- [ ] Lint passes — BLOCKED (Node/npm unavailable).
- [ ] Production build passes — BLOCKED (Node/npm unavailable).
- [x] Static credential-pattern scan of project source found no literal credential values; `.env.example` contains placeholders only. Git history/source-control check unavailable because `.git` is absent.

### Issues
- Node/npm are missing and the dependency install, dev-server, lint, and build checks cannot run.
- No lockfile could be generated without npm.

### Decisions
- Used Next.js 16 `proxy.ts` for Supabase session refresh/protection and the Supabase SSR browser/server clients.
- Implementation is present, but Phase 01 is not complete until required runtime checks pass.

### Status
BLOCKED (implementation drafted; validation toolchain unavailable)

## Phase 02 — Supabase Database and Authentication

### Changes
- Added `supabase/migrations/202610310001_initial_schema.sql` with all five tables, constraints, indexes, message idempotency, owner-consistent foreign keys, RLS, authenticated owner-only policies, and task update timestamps.
- Added browser/server Supabase clients, fail-closed route protection, password login, and logout.
- Added Supabase CLI project configuration and README migration/account setup.
- No seed data or service-role database client was added.

### Commands executed
- Static migration policy check: each table has RLS enabled and four owner policies (select/insert/update/delete).
- Static SQL review confirmed the migration contains composite owner FKs and `(user_id, gmail_message_id)` uniqueness.
- Checked Supabase CLI availability; command not found. No project credentials are present.

### Validation
- [ ] Migrations apply cleanly — BLOCKED (Supabase CLI/project credentials unavailable).
- [ ] RLS and cross-user isolation verified against a database — BLOCKED. Static SQL check confirms five RLS-enabled tables and 20 owner-only policies.
- [ ] Login/logout works — BLOCKED (Node/npm runtime and Supabase credentials unavailable).
- [x] No code imports/exposes a service-role value to browser modules. Its variable appears only as a server-only placeholder in `.env.example` and README.

### Issues
- Live database, RLS, and authentication validation cannot run without Supabase CLI/project credentials and an available Node/npm runtime.

### Decisions
- Browser writes will use the authenticated client and RLS. The service-role key and ingestion secret are reserved for a future server-only ingestion integration.
- SQL/application behavior is unverified until the migration is applied and exercised in Supabase.

### Status
BLOCKED (migration/auth implementation drafted; live validation unavailable)

## Phase 03 — Gmail Access and Search Feasibility

### Changes
- Inspected the currently open Apps Script project and visible execution history. A prior one-time Gmail read check completed successfully, confirming a Gmail read path had been authorized in that project.
- The visible sample was a generic Google Drive notification, not a university coursework notice. No private message content was copied into the repository.
- The pre-existing one-time diagnostic writes sender and subject metadata to its Apps Script execution log; avoid rerunning it on private mail until that diagnostic is redacted.
- Attempted read-only inspection of trigger status; the Apps Script browser window became unavailable during refresh/navigation.

### Commands executed
- Read-only Apps Script project/execution history inspection through the existing authorized browser session.
- Read-only trigger-page navigation attempt; automation reported the window minimized and then rejected state refresh after user input was detected.
- No Gmail diagnostic search, message-body read, trigger creation, permission prompt, or Apps Script project edit was performed.

### Validation
- [x] Preliminary one-time Gmail read access observed in a completed Apps Script execution.
- [ ] Real university notification samples inspected — BLOCKED (no confirmed university notification identified).
- [ ] Evidence-based Gmail query established — BLOCKED (no verified sender/subject sample).
- [ ] Time-driven trigger verified — BLOCKED (trigger UI and scheduled execution evidence unavailable).
- [ ] Three redacted representative patterns documented — BLOCKED (would require inventing samples without source messages).

### Issues
- University notification sender addresses, subjects, courses/codes, languages/date formats, portal URL patterns, and representative samples remain unknown.
- The existing one-time diagnostic logs sender/subject metadata in Apps Script execution history. It was not modified because the current Apps Script editor became unavailable during the read-only inspection attempt.
- Scheduled trigger authorization, required scopes, UrlFetch configuration, and Workspace administrator restrictions remain unknown.
- Installing a time-driven trigger adds persistent scheduled execution; action-time confirmation is required before installation. No trigger was installed.

### Decisions
- Did not run a broad mailbox search or document speculative patterns. The supplied script's `newer_than:7d` is an example only, not a verified university-specific query.
- Treat the successful manual read as preliminary evidence only; Gmail integration and scheduled trigger feasibility are not fully verified.

### Status
BLOCKED (mailbox sample and trigger verification required)
