-- UniTrack Phase 02 foundation. All records belong to one authenticated user.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  course_code text check (course_code is null or length(btrim(course_code)) between 1 and 64),
  instructor text check (instructor is null or length(btrim(instructor)) <= 160),
  aliases text[] not null default '{}',
  color text not null default 'blue' check (length(color) between 1 and 32),
  created_at timestamptz not null default now(),
  constraint courses_id_user_id_unique unique (id, user_id)
);

create unique index courses_user_code_unique
  on public.courses (user_id, lower(btrim(course_code)))
  where course_code is not null;
create unique index courses_user_name_unique
  on public.courses (user_id, lower(btrim(name)));

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null check (length(btrim(gmail_message_id)) between 1 and 512),
  gmail_thread_id text check (gmail_thread_id is null or length(gmail_thread_id) <= 512),
  sender text not null check (length(btrim(sender)) between 1 and 512),
  subject text check (subject is null or length(subject) <= 2000),
  received_at timestamptz,
  gmail_url text check (gmail_url is null or length(gmail_url) <= 4096),
  body_text text not null default '',
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'needs_review', 'failed', 'ignored')),
  processing_error text check (processing_error is null or length(processing_error) <= 4000),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_messages_user_gmail_id_unique unique (user_id, gmail_message_id),
  constraint email_messages_id_user_id_unique unique (id, user_id)
);

create index email_messages_user_status_received_idx
  on public.email_messages (user_id, processing_status, received_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid,
  source_email_id uuid,
  title text not null check (length(btrim(title)) between 1 and 500),
  description text check (description is null or length(description) <= 20000),
  type text not null default 'other' check (type in ('assignment', 'quiz', 'exam', 'other')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  source_url text check (source_url is null or length(source_url) <= 4096),
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_course_owner_fk foreign key (course_id, user_id)
    references public.courses (id, user_id) on delete set null (course_id),
  constraint tasks_source_email_owner_fk foreign key (source_email_id, user_id)
    references public.email_messages (id, user_id) on delete set null (source_email_id)
);

create index tasks_user_due_idx on public.tasks (user_id, due_at);
create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_user_course_idx on public.tasks (user_id, course_id);
create unique index tasks_source_email_unique
  on public.tasks (user_id, source_email_id) where source_email_id is not null;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid,
  source_email_id uuid,
  title text not null check (length(btrim(title)) between 1 and 500),
  content text check (content is null or length(content) <= 20000),
  source_url text check (source_url is null or length(source_url) <= 4096),
  received_at timestamptz,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  constraint announcements_course_owner_fk foreign key (course_id, user_id)
    references public.courses (id, user_id) on delete set null (course_id),
  constraint announcements_source_email_owner_fk foreign key (source_email_id, user_id)
    references public.email_messages (id, user_id) on delete set null (source_email_id)
);

create index announcements_user_received_idx
  on public.announcements (user_id, received_at desc);
create index announcements_user_course_idx on public.announcements (user_id, course_id);
create unique index announcements_source_email_unique
  on public.announcements (user_id, source_email_id) where source_email_id is not null;

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  found_count integer not null default 0 check (found_count >= 0),
  processed_count integer not null default 0 check (processed_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  error_summary text check (error_summary is null or length(error_summary) <= 4000),
  constraint sync_runs_finish_after_start check (finished_at is null or finished_at >= started_at)
);

create index sync_runs_user_started_idx on public.sync_runs (user_id, started_at desc);

alter table public.courses enable row level security;
alter table public.email_messages enable row level security;
alter table public.tasks enable row level security;
alter table public.announcements enable row level security;
alter table public.sync_runs enable row level security;

create policy "courses_owner_select" on public.courses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "courses_owner_insert" on public.courses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "courses_owner_update" on public.courses
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "courses_owner_delete" on public.courses
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "email_messages_owner_select" on public.email_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "email_messages_owner_insert" on public.email_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "email_messages_owner_update" on public.email_messages
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "email_messages_owner_delete" on public.email_messages
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "tasks_owner_select" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks_owner_insert" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks_owner_update" on public.tasks
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "tasks_owner_delete" on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "announcements_owner_select" on public.announcements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "announcements_owner_insert" on public.announcements
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "announcements_owner_update" on public.announcements
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "announcements_owner_delete" on public.announcements
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "sync_runs_owner_select" on public.sync_runs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "sync_runs_owner_insert" on public.sync_runs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sync_runs_owner_update" on public.sync_runs
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "sync_runs_owner_delete" on public.sync_runs
  for delete to authenticated using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.courses,
  public.email_messages,
  public.tasks,
  public.announcements,
  public.sync_runs
to authenticated;
