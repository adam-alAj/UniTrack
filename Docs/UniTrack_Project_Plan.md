# UniTrack — Project Plan

> Version: 1.0  
> Status: Approved MVP specification  
> Target delivery: 2–3 days  
> Product type: Single-user academic task management web application

---

## 1. Product Overview

### 1.1 Problem

University instructors publish assignments, quizzes, exams, and course announcements through the university portal. Students receive email notifications about these events, but important information is scattered across the inbox. This makes it easy to overlook deadlines or forget what needs to be done.

### 1.2 Solution

UniTrack is a personal academic assistant that automatically reads university notification emails, extracts useful information, and organizes it into a single web dashboard.

The student should not need to manually create a task when a supported university notification arrives. The system should capture the email, identify its likely type and course, extract available details, and create a task or announcement record. Uncertain information must be flagged for review rather than invented.

### 1.3 Product Goal

Provide one reliable place to answer:

- What do I need to do?
- Which course does it belong to?
- When is it due?
- What is urgent?
- What have I completed?
- Which university announcements have arrived recently?

### 1.4 MVP Success Criteria

The MVP is successful when:

1. A new university notification email can be discovered automatically.
2. The email is transferred to the application without exposing credentials or database secrets.
3. A supported notification is classified and saved as a task or announcement.
4. Duplicate processing does not create duplicate records.
5. The dashboard shows the saved item without manual refresh being required for long periods.
6. The user can edit a task and change its status.
7. The original email can be opened from the task or announcement.
8. Failed processing is visible and can be retried safely.
9. The deployed system works without a developer machine running.

---

## 2. Scope

### 2.1 Included in MVP

- Single-user application.
- Gmail integration through Google Apps Script and `GmailApp`.
- Scheduled email polling using an installable time-driven trigger.
- Configurable Gmail search query.
- Secure ingestion endpoint.
- Email metadata and body capture.
- Deterministic classification for Assignment, Quiz, Exam, and Announcement.
- Course matching using configurable aliases/course codes.
- Extraction of title, description, deadline, and original email URL when present.
- Uncertain or incomplete extraction marked for review.
- Supabase PostgreSQL storage.
- Dashboard summary.
- Task list, filters, status changes, and manual editing.
- Academic calendar.
- Announcement list.
- Sync status and processing history.
- Deployment to Vercel and Supabase.

### 2.2 Explicitly Out of Scope

Do not implement these during the MVP:

- University portal scraping or automated portal login.
- Downloading assignment attachments from the portal.
- Automatic submission of assignments.
- Multi-user or university-wide tenancy.
- Mobile native application.
- Telegram/WhatsApp bot.
- Paid AI APIs or mandatory LLM-based extraction.
- Complex notification delivery channels.
- Grade tracking, GPA calculation, or timetable management.
- Advanced analytics.
- Browser extension.

These may be considered after the MVP has been tested with real university emails.

---

## 3. Confirmed Technical Assumptions

- The university mailbox is Google/Gmail or Google Workspace.
- A preliminary Apps Script test successfully authenticated and accessed the university mailbox.
- The user wants a web dashboard.
- The user is not yet certain whether the university Workspace administrator restricts all external integrations. The successful mailbox test confirms the tested access path, but deployment must still validate scheduled execution and any required authorization scopes.
- The application is initially for one student.
- The email format and exact sender addresses may vary; configuration must not hard-code an unverified sender or subject pattern.

---

## 4. Final Technology Stack

| Layer            | Technology                           | Responsibility                     |
| ---------------- | ------------------------------------ | ---------------------------------- |
| Frontend         | Next.js App Router + TypeScript      | Web application                    |
| Styling          | Tailwind CSS                         | Layout and styling                 |
| UI components    | shadcn/ui                            | Accessible interface components    |
| Icons            | Lucide                               | Interface icons                    |
| Forms/validation | React Hook Form + Zod                | Form validation                    |
| Database         | Supabase PostgreSQL                  | Persistent application data        |
| Authentication   | Supabase Auth                        | Protect the dashboard              |
| Authorization    | Supabase RLS                         | Restrict user data                 |
| Email reader     | Google Apps Script `GmailApp`        | Read matching university emails    |
| Scheduler        | Apps Script time-driven trigger      | Run email polling periodically     |
| Transport        | Apps Script `UrlFetchApp` HTTPS POST | Send email payloads to the backend |
| Backend          | Next.js Route Handler                | Validate and ingest payloads       |
| Database access  | Supabase server-side client          | Server-only database operations    |
| Hosting          | Vercel                               | Deploy Next.js                     |
| Version control  | Git + GitHub                         | Source control                     |

### 4.1 Architecture Principle

Google Apps Script is the email polling worker. Next.js is the authenticated application and secure ingestion API. Supabase is the source of truth.

The browser must never receive the Supabase service-role key or the ingestion secret.

### 4.2 Data Flow

1. An instructor publishes an item on the university portal.
2. The university system sends an email notification.
3. The Apps Script time-driven trigger runs.
4. The script searches Gmail using the configured query and a bounded lookback window.
5. It extracts message metadata, plain-text body, and Gmail message ID.
6. It sends the payload to the HTTPS ingestion endpoint using a shared secret stored in Apps Script Script Properties.
7. The endpoint validates the secret and payload shape.
8. The backend checks whether the Gmail message ID has already been ingested.
9. The backend classifies and parses the email.
10. The backend matches the course using known course names, codes, and aliases.
11. It saves a task, announcement, or review item.
12. It records the processing result.
13. The script marks the email as processed only after the API confirms successful handling.
14. The dashboard displays the new record.

### 4.3 Important Reliability Rules

- Do not mark an email processed before the API confirms success.
- Use Gmail message ID as the idempotency key.
- Keep a bounded lookback window so a temporary failure does not permanently lose messages.
- The backend must also enforce uniqueness on the source message ID; Gmail labels alone are not sufficient.
- Retrying the same message must be safe.
- A malformed or unsupported email must be recorded as a review item or processing failure, not silently discarded.
- Do not invent due dates, course names, or task types.
- Preserve the original subject, sender, received timestamp, and a link to the Gmail message.
- Keep raw email content private; do not expose it publicly or log full bodies unnecessarily.

---

## 5. Functional Requirements

### FR-01: Gmail Synchronization

The system shall retrieve matching emails using a configurable Gmail search query.

### FR-02: Email Metadata Capture

The system shall capture:

- Gmail message ID
- Thread ID
- Subject
- Sender
- Received timestamp
- Plain-text body
- Gmail message URL
- Relevant headers when available

### FR-03: Classification

The system shall classify supported notifications as:

- `assignment`
- `quiz`
- `exam`
- `announcement`
- `unknown`

Classification shall be deterministic in the MVP and based on configurable keywords and known email patterns.

### FR-04: Information Extraction

The system shall attempt to extract:

- Course name or code
- Instructor, when available
- Item title
- Description or summary
- Due date and time, when explicitly present
- Portal URL, when present
- Notification type

If extraction confidence is insufficient, the item shall be marked `needs_review`.

### FR-05: Course Matching

The system shall match a notification to an existing course using exact course codes, normalized course names, and configured aliases.

If no safe match exists, the item shall remain unassigned and be visible for manual review.

### FR-06: Task Management

The user shall be able to:

- View tasks.
- Filter by course, type, status, and due date.
- Edit title, description, course, type, and due date.
- Change status.
- Mark a task completed.
- Open the original email.

### FR-07: Announcements

Non-actionable notifications shall be stored separately from tasks and displayed in an announcements view.

### FR-08: Calendar

The calendar shall display tasks and exams with explicit due dates. Items without a date shall not be assigned a fabricated calendar date.

### FR-09: Synchronization Visibility

The application shall display:

- Last successful synchronization time.
- Last synchronization outcome.
- Number of emails received/processed.
- Failed or review-required items.

### FR-10: Manual Recovery

The user shall be able to retry failed ingestion or reprocess an email safely without creating duplicates.

---

## 6. Non-Functional Requirements

- **Security:** Secrets must remain server-side or in Apps Script Script Properties.
- **Privacy:** Email content is personal data and must only be accessible to the authenticated owner.
- **Reliability:** Processing must be idempotent and retry-safe.
- **Usability:** The dashboard must make urgent tasks easy to identify.
- **Maintainability:** Keep email parsing separate from HTTP transport and database persistence.
- **Performance:** Dashboard queries should be paginated where appropriate and indexed by user, status, and due date.
- **Accessibility:** Use semantic controls, keyboard navigation, and readable contrast.
- **Time handling:** Store timestamps consistently in UTC (`timestamptz`) and display them in the user's local timezone. Preserve the original email timestamp.
- **Data integrity:** Unknown dates remain null; do not infer a deadline from the email received date.

---

## 7. Data Model

Use UUID primary keys and `timestamptz` for timestamps. Every user-owned record must include `user_id`.

### 7.1 `courses`

| Column      | Type        | Notes                   |
| ----------- | ----------- | ----------------------- |
| id          | uuid        | Primary key             |
| user_id     | uuid        | Owner                   |
| name        | text        | Required                |
| course_code | text        | Nullable                |
| instructor  | text        | Nullable                |
| aliases     | text[]      | Alternative names/codes |
| color       | text        | UI color token          |
| created_at  | timestamptz | Default now()           |

Unique recommendation: `(user_id, normalized course_code)` when course_code is not null.

### 7.2 `email_messages`

| Column            | Type        | Notes                                          |
| ----------------- | ----------- | ---------------------------------------------- |
| id                | uuid        | Primary key                                    |
| user_id           | uuid        | Owner                                          |
| gmail_message_id  | text        | Required, unique per user                      |
| gmail_thread_id   | text        | Nullable                                       |
| sender            | text        | Required                                       |
| subject           | text        | Nullable                                       |
| received_at       | timestamptz | Nullable                                       |
| gmail_url         | text        | Nullable                                       |
| body_text         | text        | Private; restrict access                       |
| processing_status | text        | received/processed/needs_review/failed/ignored |
| processing_error  | text        | Nullable                                       |
| processed_at      | timestamptz | Nullable                                       |
| created_at        | timestamptz | Default now()                                  |

Unique constraint: `(user_id, gmail_message_id)`.

### 7.3 `tasks`

| Column          | Type        | Notes                             |
| --------------- | ----------- | --------------------------------- |
| id              | uuid        | Primary key                       |
| user_id         | uuid        | Owner                             |
| course_id       | uuid        | Nullable FK                       |
| source_email_id | uuid        | Nullable FK                       |
| title           | text        | Required                          |
| description     | text        | Nullable                          |
| type            | text        | assignment/quiz/exam/other        |
| status          | text        | not_started/in_progress/completed |
| priority        | text        | low/medium/high                   |
| due_at          | timestamptz | Nullable                          |
| source_url      | text        | Nullable                          |
| needs_review    | boolean     | Default false                     |
| created_at      | timestamptz | Default now()                     |
| updated_at      | timestamptz | Default now()                     |

### 7.4 `announcements`

| Column          | Type        | Notes         |
| --------------- | ----------- | ------------- |
| id              | uuid        | Primary key   |
| user_id         | uuid        | Owner         |
| course_id       | uuid        | Nullable FK   |
| source_email_id | uuid        | Nullable FK   |
| title           | text        | Required      |
| content         | text        | Nullable      |
| source_url      | text        | Nullable      |
| received_at     | timestamptz | Nullable      |
| needs_review    | boolean     | Default false |
| created_at      | timestamptz | Default now() |

### 7.5 `sync_runs`

| Column          | Type        | Notes                          |
| --------------- | ----------- | ------------------------------ |
| id              | uuid        | Primary key                    |
| user_id         | uuid        | Owner                          |
| started_at      | timestamptz | Required                       |
| finished_at     | timestamptz | Nullable                       |
| status          | text        | running/success/partial/failed |
| found_count     | integer     | Default 0                      |
| processed_count | integer     | Default 0                      |
| failed_count    | integer     | Default 0                      |
| error_summary   | text        | Nullable                       |

### 7.6 Database Rules

- Enable RLS on every user-owned table.
- Authenticated users may select/update/delete only their own records.
- Browser writes should use the authenticated Supabase client and RLS.
- Ingestion writes must use a server-only Supabase service-role client after validating the shared ingestion secret.
- Never expose `service_role` in `NEXT_PUBLIC_*` variables.
- Do not allow the Apps Script secret to be used as a database credential.
- Add indexes for `(user_id, due_at)`, `(user_id, status)`, `(user_id, course_id)`, and email idempotency.
- Use database constraints for allowed enum-like values, even if implemented as text plus CHECK constraints.

---

## 8. Email Parsing Strategy

### 8.1 MVP Strategy: Deterministic First

Do not require an AI model for the initial release.

Use a layered parser:

1. Normalize subject and body text.
2. Identify known university notification patterns.
3. Detect type using configurable keyword dictionaries.
4. Extract course code/name using configured course aliases.
5. Extract title from known subject/body patterns.
6. Extract explicit date/time patterns.
7. Extract URLs.
8. Calculate a parser confidence/status.
9. Save as task, announcement, or review item.

### 8.2 Confidence and Review

- High confidence: create a task/announcement normally.
- Medium confidence: create the record with `needs_review = true`.
- Low confidence: save the email as `needs_review`; do not fabricate a task title or deadline.
- Unknown type: preserve as an email record for review.

The UI must visually distinguish `needs_review` records.

### 8.3 Date Parsing

- Parse only dates explicitly present in the email.
- Handle configured formats found in real samples.
- Do not assume a year unless the source format makes it unambiguous.
- Store the original extracted date text for debugging/review if needed.
- If ambiguous, leave `due_at` null and require manual correction.
- Treat portal links and Gmail links separately.

### 8.4 Course Configuration

The first setup should allow the user to add course names, codes, instructors, and aliases manually. Do not infer the entire course catalog from arbitrary email text.

---

## 9. User Interface Structure

### Main Navigation

1. Overview
2. Tasks
3. Calendar
4. Courses
5. Announcements
6. Email & Sync
7. Settings

### Overview Dashboard

- Pending task count
- Due soon count
- Upcoming exams count
- Completed task count
- Overdue tasks
- Upcoming task list
- Recent announcements
- Last synchronization status

### Tasks Page

- Search
- Course filter
- Type filter
- Status filter
- Due date sorting
- Task detail/edit dialog
- Original email link

### Calendar Page

- Month view initially
- Tasks and exams with due dates
- Click event to open task
- Do not show undated items as dated events

### Courses Page

- Add/edit/delete course
- Course code and aliases
- Course color
- Related tasks

### Email & Sync Page

- Last sync time
- Sync health
- Processed messages
- Needs-review messages
- Failed messages and retry action
- Gmail search query configuration guidance

---

## 10. Security and Privacy

1. Use Supabase Auth for dashboard access.
2. Enable RLS on all user-owned tables.
3. Keep Supabase service-role key in server-only environment variables.
4. Keep the Apps Script ingestion secret in Script Properties, never in source control.
5. Use HTTPS only.
6. Validate request body size and schema.
7. Compare the ingestion secret safely and reject missing/invalid secrets.
8. Add basic rate limiting or a timestamp/replay strategy if the endpoint becomes exposed.
9. Do not log full email bodies, tokens, or secrets.
10. Avoid storing attachments in the MVP.
11. Do not request Gmail send/modify scopes unless a feature requires them. Read-only Gmail access is preferred.
12. Explain the data flow and retention to the user.

### Ingestion Authentication

MVP may use a long random bearer secret in an `Authorization` header, stored in Apps Script Script Properties and a server-only Vercel environment variable. Rotate it if exposed.

For a hardened later version, use HMAC signatures with timestamp and replay protection.

---

## 11. Deployment

### Supabase

- Create project.
- Apply migrations.
- Configure Auth.
- Configure RLS.
- Add initial user and course data.

### Vercel

- Import Git repository.
- Configure environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  - `UNITRACK_INGEST_SECRET` (server-only)
  - `UNITRACK_OWNER_USER_ID` (server-only)
  - `UNITRACK_OWNER_USER_ID` (server-only; maps this trusted single-user worker to the authenticated owner's Supabase UUID)
- Deploy and verify authentication and ingestion.

### Google Apps Script

- Create standalone Apps Script project.
- Add the provided `UniTrack_Gmail_Sync.gs`.
- Configure Script Properties:
  - `UNITRACK_API_URL`
  - `UNITRACK_INGEST_SECRET`
  - `GMAIL_SEARCH_QUERY`
  - `LOOKBACK_DAYS`
  - `BATCH_SIZE`
- Run the setup function manually and approve permissions.
- Run one manual sync.
- Install the time-driven trigger.
- Inspect Apps Script Executions after the first scheduled run.

---

## 12. Risks and Mitigations

| Risk                                | Mitigation                                               |
| ----------------------------------- | -------------------------------------------------------- |
| University Workspace policy changes | Test scheduled Gmail access and reauthorization          |
| Email formats differ                | Keep parser configurable; add real samples incrementally |
| Wrong deadline extraction           | Null + review state rather than guessing                 |
| Duplicate notifications             | Unique Gmail message ID + idempotent backend             |
| Temporary API outage                | Do not label email processed until API success           |
| Trigger overlap                     | Script lock and bounded batch                            |
| Secret leakage                      | Script Properties and server environment variables       |
| Missing course match                | Unassigned review queue                                  |
| Timezone mismatch                   | UTC storage, local display, preserve source timestamp    |
| Gmail quotas                        | Small batch, periodic polling, monitor executions        |

---

## 13. Definition of Done

The MVP is done only when:

- [ ] The application is deployed.
- [ ] The dashboard is protected by authentication.
- [ ] RLS is enabled and tested.
- [ ] Gmail Apps Script can read a real university notification.
- [ ] Scheduled trigger runs successfully.
- [ ] A notification reaches the ingestion API.
- [ ] Duplicate ingestion does not create duplicate tasks.
- [ ] Task/announcement classification works on representative real emails.
- [ ] Ambiguous dates remain unset and are flagged for review.
- [ ] Tasks can be edited and completed.
- [ ] Calendar displays explicit deadlines correctly.
- [ ] Original email links work.
- [ ] Failed records can be retried.
- [ ] No secrets are committed to Git.
- [ ] A README explains setup, configuration, deployment, and troubleshooting.

---

## 14. Future Roadmap (Not MVP)

Only after real-world use:

- AI-assisted extraction for inconsistent email templates.
- Attachment metadata and file storage.
- Reminder notifications.
- Weekly academic digest.
- Multiple semesters and archived courses.
- Mobile/PWA enhancements.
- Portal integrations where officially supported.
- Multi-user support.

**Product principle:** Reliability and clarity are more valuable than adding many features.
