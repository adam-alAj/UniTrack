# UniTrack — Implementation Plan

> Version: 1.0  
> Execution style: Strict phase-by-phase  
> Target: 2–3 days for a focused MVP  
> Primary implementer: Codex  
> Source of truth: `UniTrack_Project_Plan.md`

---

## How to Use This Plan

- Execute phases in order.
- Do not skip validation checkpoints.
- Do not start the next phase while the current phase has failing critical checks.
- Read the complete project plan before coding.
- Inspect the existing repository before modifying it.
- Preserve working code; do not rewrite architecture without a demonstrated blocker.
- Keep changes small and testable.
- Record commands, outcomes, decisions, and blockers in `IMPLEMENTATION_LOG.md`.
- Do not claim a phase is complete without running its acceptance checks.
- If a required credential or account permission is missing, stop only the blocked integration work and continue independent work where safe.

## Day 1 — Foundation and Email Feasibility

### Phase 00 — Repository and Requirements Inspection

**Objective:** Understand the workspace and lock the implementation scope.

Tasks:
1. Inspect repository structure, package manager, existing code, and Git status.
2. Read `UniTrack_Project_Plan.md` completely.
3. Read this implementation plan completely.
4. Identify existing conventions and reuse them.
5. Create `IMPLEMENTATION_LOG.md`.
6. Record unresolved configuration values without inventing them.
7. Create a concise implementation checklist.

Acceptance criteria:
- [ ] Repository state documented.
- [ ] Project plan and implementation plan reviewed.
- [ ] No existing work overwritten.
- [ ] Known unknowns recorded.

### Phase 01 — Initialize Next.js Application

**Objective:** Create the frontend/backend application foundation.

Tasks:
1. Initialize Next.js App Router with TypeScript.
2. Configure Tailwind CSS.
3. Install and initialize shadcn/ui.
4. Add Lucide icons.
5. Configure ESLint and formatting.
6. Establish a clean folder structure:
   - `app/`
   - `components/`
   - `components/ui/`
   - `lib/`
   - `lib/supabase/`
   - `lib/email/`
   - `types/`
   - `supabase/migrations/`
7. Add `.env.example` with variable names only and safe placeholders.
8. Add a README with local setup steps.
9. Create a responsive app shell with sidebar and top bar; use temporary navigation placeholders only.

Validation:
- [ ] Dependencies install successfully.
- [ ] `npm run dev` starts.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] No secrets in repository.

### Phase 02 — Supabase Database and Authentication

**Objective:** Establish the secure data layer.

Tasks:
1. Create or connect the Supabase project.
2. Add SQL migrations for:
   - `courses`
   - `email_messages`
   - `tasks`
   - `announcements`
   - `sync_runs`
3. Add foreign keys, checks, indexes, and unique idempotency constraint.
4. Add `user_id` ownership fields.
5. Enable RLS on every user-owned table.
6. Add owner-only policies.
7. Configure Supabase Auth.
8. Implement browser and server Supabase clients using current recommended SSR patterns.
9. Add protected route behavior.
10. Seed only clearly marked development data.

Validation:
- [ ] Migrations apply cleanly.
- [ ] RLS is enabled on all user-owned tables.
- [ ] User A cannot read or modify User B records.
- [ ] Service-role key is server-only.
- [ ] Login/logout works.
- [ ] Build and lint pass.

Checkpoint:
Do not build the full dashboard on an insecure or unverified data layer.

### Phase 03 — Gmail Access and Search Feasibility

**Objective:** Verify the actual university mailbox and discover real notification patterns.

Known fact: A preliminary script successfully connected to the university mailbox.

Tasks:
1. Create or open the Apps Script project.
2. Use the least-privilege Gmail read scope needed.
3. Run a diagnostic search with a conservative query such as `newer_than:7d`.
4. Inspect a small sample of matching messages.
5. Record actual sender addresses, subject patterns, course identifiers, language, date formats, and portal URL patterns.
6. Build the final Gmail search query from observed evidence, not assumptions.
7. Confirm a time-driven trigger can execute under the university account.
8. Record Apps Script authorization and Workspace restrictions, if any.
9. Do not log or commit full private email content.

Validation:
- [ ] Real university messages can be read.
- [ ] The query excludes unrelated personal mail as much as practical.
- [ ] Trigger execution is permitted.
- [ ] At least 3 representative notification samples are documented safely (redact personal data).
- [ ] Exact parser patterns are recorded.

Checkpoint:
Successful one-time Gmail access does not automatically prove scheduled triggers or every required scope will work. Validate both.

### Phase 04 — Email Parsing Engine

**Objective:** Convert raw email data into a structured, reviewable representation.

Tasks:
1. Create pure parsing functions separate from Gmail and Supabase code.
2. Normalize HTML/plain text safely.
3. Define a typed parser result:
   - classification
   - course candidate
   - title
   - description
   - due date
   - portal URL
   - confidence/review reason
4. Add configurable keyword dictionaries for assignment, quiz, exam, and announcement.
5. Add course matching using configured course codes/names/aliases.
6. Add date extraction only for formats observed in real emails.
7. Preserve the original date text for review/debugging.
8. Handle unknown language/patterns without crashing.
9. Add unit tests for representative redacted email fixtures.
10. Do not call an AI service in this phase.

Validation:
- [ ] Assignment fixture classified correctly.
- [ ] Quiz fixture classified correctly.
- [ ] Exam fixture classified correctly.
- [ ] Announcement fixture classified correctly.
- [ ] Unknown fixture goes to review.
- [ ] Missing/ambiguous deadline remains null.
- [ ] Unmatched course remains unassigned.
- [ ] Parser tests pass.

---

## Day 2 — Secure Integration and Main UI

### Phase 05 — Secure Ingestion API

**Objective:** Receive Apps Script payloads and persist them idempotently.

Tasks:
1. Implement a Next.js Route Handler, e.g. `POST /api/ingest/email`.
2. Validate request method, content type, body size, and Zod schema.
3. Authenticate with a long random shared secret from server environment.
4. Reject missing or invalid secret.
5. Never expose the secret to browser code.
6. Use server-only Supabase service-role client after authentication.
7. Insert or retrieve `email_messages` by `(user_id, gmail_message_id)`.
8. Make repeated requests safe.
9. Run parser and create task/announcement/review state.
10. Use a transaction/RPC or another safe strategy so partial persistence does not create inconsistent records.
11. Return clear machine-readable status:
    - `processed`
    - `duplicate`
    - `needs_review`
    - `failed`
12. Do not return private data unnecessarily.
13. Add structured logs without full email body or secrets.

Validation:
- [ ] Valid request accepted.
- [ ] Missing secret rejected.
- [ ] Invalid secret rejected.
- [ ] Invalid payload rejected.
- [ ] Same Gmail message ID does not create duplicates.
- [ ] Database errors return retryable failure.
- [ ] No service-role key or secret reaches client bundle.

### Phase 06 — Apps Script Synchronization Worker

**Objective:** Poll Gmail and deliver messages safely.

Tasks:
1. Add `UniTrack_Gmail_Sync.gs` to the Apps Script project.
2. Configure Script Properties:
   - `UNITRACK_API_URL`
   - `UNITRACK_INGEST_SECRET`
   - `GMAIL_SEARCH_QUERY`
   - `LOOKBACK_DAYS`
   - `BATCH_SIZE`
3. Use Gmail search with a bounded lookback and an appropriate sync cursor.
4. Use a script lock to prevent overlapping executions.
5. For each message:
   - collect metadata and plain-text body;
   - construct Gmail URL;
   - send HTTPS POST;
   - inspect HTTP status and response body;
   - mark processed only after confirmed success or confirmed duplicate.
6. Do not mark messages processed after timeout, non-2xx response, or ambiguous response.
7. Add a setup function to create the time-driven trigger.
8. Add a manual sync function for testing.
9. Add a health/diagnostic function that does not reveal secrets.
10. Keep batch size conservative and monitor Apps Script quotas.

Validation:
- [ ] Manual sync works.
- [ ] New email reaches API.
- [ ] Successful message receives sync cursor.
- [ ] Failed API request is not labeled processed.
- [ ] Re-running sync does not create duplicate tasks.
- [ ] Trigger is installed and executes.
- [ ] Script lock prevents overlap.
- [ ] Script Properties are used for secrets/configuration.

### Phase 07 — Dashboard and Application Shell

**Objective:** Build the primary user experience using real Supabase data.

Tasks:
1. Finalize responsive sidebar and header.
2. Build overview dashboard.
3. Add summary cards:
   - pending tasks
   - due soon
   - upcoming exams
   - completed
4. Add upcoming tasks list.
5. Add overdue section.
6. Add recent announcements.
7. Add last synchronization status.
8. Add loading, empty, and error states.
9. Ensure every query is scoped to the authenticated user.
10. Use realistic UI labels and avoid placeholder content in production.

Validation:
- [ ] Dashboard loads authenticated user's data.
- [ ] Empty state is useful.
- [ ] Loading and error states work.
- [ ] Mobile and desktop layouts are usable.
- [ ] No cross-user data leakage.

### Phase 08 — Task Management

**Objective:** Make extracted tasks actionable.

Tasks:
1. Build tasks table/list.
2. Add filters for course, type, status, and date.
3. Add search.
4. Add sort by due date and creation date.
5. Add task detail/edit dialog.
6. Allow status transitions:
   - not_started
   - in_progress
   - completed
7. Allow manual creation of a task.
8. Add source email link.
9. Visually mark `needs_review`.
10. Validate all updates with Zod and RLS.

Validation:
- [ ] Filters work together.
- [ ] Edit persists.
- [ ] Status update persists.
- [ ] Manual task creation works.
- [ ] Original email opens.
- [ ] Review-required task is distinguishable.
- [ ] Unauthorized update is rejected.

---

## Day 3 — Calendar, Quality, Deployment

### Phase 09 — Academic Calendar

**Objective:** Display real dated tasks in a calendar.

Tasks:
1. Add a calendar library only if needed; prefer a lightweight solution.
2. Implement month view.
3. Query tasks with non-null due dates.
4. Render assignment, quiz, and exam events distinctly.
5. Allow navigation between months.
6. Open task details when an event is selected.
7. Handle timezone conversion consistently.
8. Do not display undated tasks as dated events.

Validation:
- [ ] Due dates appear on correct local dates.
- [ ] Null dates are excluded.
- [ ] Month navigation works.
- [ ] Selecting an event opens the correct task.

### Phase 10 — Announcements, Sync History, and Recovery

**Objective:** Make the ingestion system observable and recoverable.

Tasks:
1. Build announcements page.
2. Build email/sync page.
3. Show last sync and recent sync runs.
4. Show messages needing review.
5. Show failed processing records.
6. Add retry/reprocess action using the same idempotency key.
7. Ensure retries do not duplicate tasks.
8. Add course management for names, codes, aliases, and colors.

Validation:
- [ ] Announcement appears in the correct page.
- [ ] Sync history is accurate.
- [ ] Failed record is visible.
- [ ] Retry succeeds after the underlying issue is fixed.
- [ ] Retry does not create duplicates.
- [ ] Course aliases match expected notifications.

### Phase 11 — End-to-End Testing and Hardening

**Objective:** Verify the complete real-world workflow.

Test scenarios:
1. New assignment notification arrives.
2. New quiz notification arrives.
3. New exam notification arrives.
4. General announcement arrives.
5. Duplicate email is encountered.
6. Email has no deadline.
7. Email has ambiguous date.
8. Course cannot be matched.
9. API is unavailable.
10. API returns unauthorized.
11. Apps Script trigger runs twice/overlaps.
12. User edits an extracted task.
13. User marks a task completed.
14. User opens the original email.
15. User from another account attempts to access protected data.

Validation:
- [ ] All critical scenarios pass.
- [ ] No message is marked processed before confirmed API handling.
- [ ] No fabricated deadline.
- [ ] No duplicate task.
- [ ] Failures are visible and recoverable.
- [ ] RLS and secret handling verified.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Relevant unit/integration tests pass.

### Phase 12 — Production Deployment

**Objective:** Publish the working MVP.

Tasks:
1. Push code to GitHub.
2. Create/configure production Supabase project.
3. Apply production migrations.
4. Configure Auth redirect URLs.
5. Deploy to Vercel.
6. Set production environment variables.
7. Confirm service-role and ingestion secrets are server-only.
8. Deploy Apps Script.
9. Set Script Properties.
10. Run manual production sync.
11. Install production trigger.
12. Verify a real notification end-to-end.
13. Document recovery and secret rotation.
14. Tag the MVP release.

Validation:
- [ ] Production URL works.
- [ ] Authentication works.
- [ ] Database and RLS work.
- [ ] Apps Script trigger executes.
- [ ] Real email appears in dashboard.
- [ ] Duplicate test passes.
- [ ] No secrets in GitHub or browser bundle.
- [ ] README and setup instructions are complete.

---

## 3. Suggested Repository Structure

```text
unitrack/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── overview/
│   │   ├── tasks/
│   │   ├── calendar/
│   │   ├── courses/
│   │   ├── announcements/
│   │   ├── sync/
│   │   └── settings/
│   └── api/
│       └── ingest/
│           └── email/
│               └── route.ts
├── components/
│   ├── layout/
│   ├── dashboard/
│   ├── tasks/
│   ├── calendar/
│   ├── courses/
│   └── ui/
├── lib/
│   ├── supabase/
│   ├── email/
│   │   ├── normalize.ts
│   │   ├── classify.ts
│   │   ├── extract.ts
│   │   └── course-matcher.ts
│   ├── validation/
│   └── utils/
├── types/
├── supabase/
│   └── migrations/
├── scripts/
│   └── UniTrack_Gmail_Sync.gs
├── tests/
│   ├── fixtures/
│   └── email-parser/
├── .env.example
├── IMPLEMENTATION_LOG.md
├── README.md
└── package.json
```

Codex may adjust the exact structure if the current Next.js version or conventions require it, but must preserve the separation of concerns.

---

## 4. Environment Variables

### Next.js

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UNITRACK_INGEST_SECRET=
UNITRACK_OWNER_USER_ID=
```

### Apps Script Script Properties

```text
UNITRACK_API_URL=https://YOUR_DOMAIN/api/ingest/email
UNITRACK_INGEST_SECRET=LONG_RANDOM_SECRET
GMAIL_SEARCH_QUERY=newer_than:7d
LOOKBACK_DAYS=7
BATCH_SIZE=20
```

Do not commit actual values. Use a strong random secret and store it only in Apps Script Script Properties and Vercel server environment variables.

---

## 5. Time Budget and Priorities

| Priority | Phase | Target |
|---|---|---|
| P0 | 00–03: foundation, DB, Gmail feasibility | Day 1 |
| P0 | 04–06: parser, API, synchronization | Day 1–2 |
| P0 | 07–08: dashboard and task management | Day 2 |
| P1 | 09–10: calendar, announcements, recovery | Day 3 |
| P0 | 11–12: testing and deployment | Day 3 |

If time becomes limited:
1. Preserve secure ingestion and idempotency.
2. Preserve task listing/editing/status.
3. Preserve real email-to-dashboard end-to-end flow.
4. Defer calendar polish and nonessential UI refinements.
5. Never defer secret protection, RLS, or duplicate prevention.

---

## 6. Implementation Log Template

For every phase, record:

```md
## Phase XX — Name

### Changes
- ...

### Commands executed
- ...

### Validation
- [ ] Check — PASS/FAIL

### Issues
- ...

### Decisions
- ...

### Status
NOT STARTED / IN PROGRESS / BLOCKED / COMPLETE
```

---

## 7. Master Prompt for Codex

Use the following prompt when starting implementation. Keep the two plan files and the Gmail script in the repository or provide them to Codex as context.

```text
# Role
You are a senior full-stack software engineer responsible for implementing UniTrack, a production-minded single-user academic task management web application.

# Objective
Implement the UniTrack MVP exactly according to:
1. UniTrack_Project_Plan.md
2. UniTrack_Implementation_Plan.md
3. UniTrack_Gmail_Sync.gs

These documents are the source of truth. Read all of them completely before making changes.

# Context
UniTrack reads university notification emails from a Google/Gmail university account using Google Apps Script and GmailApp. A preliminary test has already confirmed that the account can be accessed successfully.

The application uses:
- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase PostgreSQL + Supabase Auth + RLS
- Google Apps Script for Gmail polling
- A secure Next.js ingestion endpoint
- Vercel deployment

The application is initially for one student. The MVP target is 2–3 days of focused work.

# Execution Rules
1. Inspect the repository, existing files, package manager, and Git status first.
2. Read all project documentation and the Gmail script before coding.
3. Follow the implementation phases in order.
4. Work on one phase at a time.
5. Before moving to the next phase, run that phase's validation checklist.
6. Do not claim success without actual command/test output.
7. Update IMPLEMENTATION_LOG.md after every phase.
8. Preserve working code and existing conventions.
9. Do not rewrite or re-architect working components without a demonstrated technical reason.
10. Do not expand the MVP scope.
11. If a requirement is ambiguous, inspect the project documents and existing code first. Ask only when a missing user decision or credential genuinely blocks progress.
12. Never invent university email formats, sender addresses, course codes, deadlines, or portal URLs. Use redacted real samples/configuration supplied by the user.
13. Do not introduce paid APIs or mandatory AI services.
14. Keep all secrets out of source control and browser bundles.
15. Never expose the Supabase service-role key or ingestion secret to client-side code.
16. Enforce Supabase RLS for user-owned records.
17. Use Gmail message ID as an idempotency key.
18. Never mark an email processed before the ingestion endpoint confirms success or a confirmed duplicate.
19. Do not fabricate a due date. Ambiguous or missing data must be flagged for review.
20. Do not scrape or log into the university portal.

# Required Engineering Practices
- TypeScript strictness where practical.
- Zod validation at API boundaries.
- Separate email normalization, classification, extraction, course matching, transport, and persistence.
- Add tests for parsing and idempotency.
- Add useful loading, empty, and error states.
- Keep timestamps timezone-safe.
- Use migrations for database changes.
- Keep logs useful but free of secrets and full private email bodies.
- Use accessible semantic UI components.

# Phase Workflow
Start with Phase 00 only:
- Inspect repository.
- Read the documents.
- Create IMPLEMENTATION_LOG.md.
- Report the current state and exact next actions.

Then proceed phase by phase. If the environment allows autonomous implementation, complete the current phase and its tests before continuing. If credentials or user actions are required, stop at that specific integration checkpoint and clearly state what is needed while continuing independent work safely.

# Output After Each Phase
Report:
1. Phase completed or blocked.
2. Files created/modified.
3. Commands and tests actually run.
4. PASS/FAIL results.
5. Remaining issues.
6. Exact next phase.

# Final Acceptance
The MVP is not complete until a real university email is automatically synchronized into the deployed dashboard, duplicate processing is prevented, tasks can be edited/completed, the original email can be opened, and security checks pass.
```

---

## 8. Final Release Checklist

- [ ] Phase 00–12 completed or explicitly deferred with reason.
- [ ] Production environment configured.
- [ ] Real Gmail notification processed.
- [ ] Task appears in dashboard.
- [ ] Duplicate email safely ignored.
- [ ] User can edit and complete task.
- [ ] Original email opens.
- [ ] Failed sync is visible and recoverable.
- [ ] RLS verified.
- [ ] Secrets verified absent from client bundle and Git history.
- [ ] README and implementation log updated.
