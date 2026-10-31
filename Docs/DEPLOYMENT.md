# UniTrack Deployment and Recovery Runbook

This runbook describes how to configure the production MVP without putting credentials in source control. It is a procedure, not evidence of a completed deployment. Check `IMPLEMENTATION_LOG.md` for the current release state.

## Prerequisites

- Node.js 20.9+ and npm for local validation.
- A production Supabase project, Vercel project, GitHub access, and an authorized university Apps Script account.
- A verified owner account and the UUID from Supabase Auth.
- A strong random ingestion secret generated in a password manager or secure terminal. Never put the secret in Git, a ticket, email, or chat.
- A confirmed IANA timezone for the university's deadline timestamps.

Use the worker in `scripts/UniTrack_Gmail_Sync.gs` (the copy at `Docs/UniTrack_Gmail_Sync.gs` is kept synchronized). Enable the Advanced Gmail API service and deploy the OAuth scopes in `scripts/appsscript.json`.

## Local pre-release checks

1. Install dependencies with `npm ci` when a lockfile is present; otherwise review dependency changes and run `npm install`.
2. Copy `.env.example` to `.env.local` and use a non-production Supabase project for testing.
3. Apply migrations to the test project with `supabase link --project-ref <test-project-ref>` and `supabase db push`.
4. Create two test accounts and verify owner-only access to each table. Test writes and reads as each account; do not use the service-role client for browser behavior tests.
5. Run `npm test`, `npm run lint`, `npm run format:check`, and `npm run build`.
6. Complete the test matrix in `IMPLEMENTATION_LOG.md`. Record blocked scenarios as blocked; do not substitute a source review for live RLS or end-to-end validation.

## Production sequence

1. Review `git status`, the complete diff, and a secret scan. Keep real `.env.local` data ignored by Git. Do not tag or publish an unvalidated release.
2. Push only a reviewed, validated commit to the configured GitHub repository. Confirm the remote commit hash before deployment.
3. Create/verify the production Supabase project and database backup/restore plan. Apply the checked-in migrations with `supabase link --project-ref <production-project-ref>` and `supabase db push`. Do not reset the database or run destructive SQL against production as part of deployment.
4. In Supabase Auth, set the production Site URL and exact allowed redirect URLs for the production domain and the required local development URL. Disable public sign-ups after provisioning the owner if the deployment is intended to remain single-user.
5. Configure Vercel project environment variables for Production:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - `UNITRACK_INGEST_SECRET` (server-only)
   - `UNITRACK_OWNER_USER_ID` (server-only Supabase Auth UUID)
   - `UNITRACK_SOURCE_TIMEZONE` (server-only IANA timezone)
6. Confirm the service role key, ingestion secret, and owner ID have no `NEXT_PUBLIC_` prefix. Redeploy after changing environment variables. Inspect the deployed JavaScript bundles for secrets before enabling ingestion.
7. Deploy the GitHub commit to Vercel. Visit the resulting HTTPS URL and verify login, logout, protected-page behavior, and the empty states before configuring Gmail.
8. In the authorized Apps Script project, copy `scripts/UniTrack_Gmail_Sync.gs` and `scripts/appsscript.json`, enable Advanced Gmail API v1, and authorize the declared read-only Gmail and external request/script trigger scopes.
9. Add Script Properties without printing their values:
   - `UNITRACK_API_URL` = production HTTPS URL ending in `/api/ingest/email`
   - `UNITRACK_INGEST_SECRET` = the same strong secret configured in Vercel
   - `GMAIL_SEARCH_QUERY` = the query verified against a small sample in the university mailbox
   - `LOOKBACK_DAYS` = `7` for initial validation
   - `BATCH_SIZE` = `20` for initial validation
10. Run `diagnoseUniTrack`, inspect its count-only result, then run `syncUniTrackEmails` manually. Verify a real notification in the email/sync view and the resulting task or announcement in the application. Re-run the sync and confirm the duplicate path does not add records.
11. Run `setupUniTrackTrigger` only after manual sync and duplicate handling pass. Confirm an execution succeeds in Apps Script Executions. Verify a second/overlapping invocation skips under the script lock.
12. Tag the release only after the final checklist is green and the production URL and live end-to-end record have been independently verified.

## Recovery

- **Worker/API outage:** Check Vercel function logs and Apps Script Executions. Logs should contain only stage/status/counts, not bearer values or message bodies. Failed deliveries do not advance the worker cursor; after service recovery, run `syncUniTrackEmails` manually. The worker's bounded lookback and overlap will retry the message.
- **Failed email record:** Review the generic failure stage in Email & Sync, fix the underlying configuration/database issue, then use Retry processing. It reuses the saved original Gmail message ID and is safe to invoke more than once. Verify the message leaves the failed list and that only one email row and the expected task/announcement exist.
- **Needs-review record:** Open the original email, verify its course/type/date, and edit the resulting task/course in UniTrack. Do not infer missing or ambiguous dates.
- **Incorrect task:** Edit the task in the authenticated UI. Preserve the source email record for traceability; do not delete production records as a retry technique.
- **Migration issue:** Stop the release, preserve logs and a database backup, and resolve forward with a reviewed migration. Do not disable RLS or reset production to get a migration through.

## Secret rotation

1. Generate a new high-entropy secret in a password manager or secure terminal; do not copy it into repository files or logs.
2. Update `UNITRACK_INGEST_SECRET` in Vercel and the matching Apps Script Script Property in a coordinated maintenance window. Redeploy/restart the Vercel deployment if required by the platform.
3. Run one manual sync and verify the authenticated sync summary and an ingestion result. Confirm the previous secret is rejected without logging either value.
4. If the Supabase service-role key may have leaked, rotate it in Supabase, update only Vercel's server-only variable, redeploy, and verify database access. Treat suspected exposure as a security incident and review provider audit logs.
5. Remove any accidentally committed secret from provider configuration immediately. Revoke/rotate it; deleting the Git line alone does not remove it from history.

## Release checklist

- [ ] Phases 00–12 have passed their runtime acceptance checks, or any deferral is explicitly approved and documented.
- [ ] Production URL serves the application over HTTPS; login and logout work.
- [ ] Migrations are applied; RLS is enabled and cross-account isolation is verified.
- [ ] Assignment, quiz, exam, announcement, unknown, missing-date, ambiguous-date, and unmatched-course samples are checked with redacted fixtures or approved real samples.
- [ ] API outage, unauthorized API response, duplicate delivery, and overlapping worker execution are verified.
- [ ] A real university notification reaches the production API and appears correctly in the dashboard.
- [ ] Editing/completion and original Gmail links work in production.
- [ ] Failed processing is visible and retry does not create duplicates.
- [ ] No secrets appear in the Git diff/history or browser bundle.
- [ ] Apps Script diagnostic, manual sync, and scheduled trigger are verified under the university account.
- [ ] README, implementation log, and this runbook reflect actual configuration and validation results.
- [ ] MVP release tag is created after all critical checks pass.
