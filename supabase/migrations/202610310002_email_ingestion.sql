-- Persist parser review details and the ingestion transaction atomically.
alter table public.email_messages
  add column review_reasons text[] not null default '{}';

alter table public.tasks
  add column original_due_text text,
  add column review_reasons text[] not null default '{}';

alter table public.announcements
  add column review_reasons text[] not null default '{}';

-- A digest notification may contain multiple assignments; the email key, not a
-- one-task-per-email index, is the idempotency boundary.
drop index if exists public.tasks_source_email_unique;

grant select on public.courses, public.email_messages to service_role;

create or replace function public.ingest_email_message(
  p_user_id uuid,
  p_gmail_message_id text,
  p_gmail_thread_id text,
  p_sender text,
  p_subject text,
  p_received_at timestamptz,
  p_gmail_url text,
  p_body_text text,
  p_processing_status text,
  p_review_reasons text[],
  p_tasks jsonb,
  p_announcement jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email_id uuid;
  v_task jsonb;
begin
  if p_processing_status is null or p_processing_status not in ('processed', 'needs_review') then
    raise exception 'Invalid email processing status';
  end if;

  if jsonb_typeof(p_tasks) is distinct from 'array' then
    raise exception 'Tasks must be a JSON array';
  end if;

  insert into public.email_messages (
    user_id,
    gmail_message_id,
    gmail_thread_id,
    sender,
    subject,
    received_at,
    gmail_url,
    body_text,
    processing_status,
    review_reasons,
    processed_at
  ) values (
    p_user_id,
    p_gmail_message_id,
    p_gmail_thread_id,
    p_sender,
    p_subject,
    p_received_at,
    p_gmail_url,
    p_body_text,
    p_processing_status,
    coalesce(p_review_reasons, '{}'),
    now()
  )
  on conflict (user_id, gmail_message_id) do nothing
  returning id into v_email_id;

  if v_email_id is null then
    return 'duplicate';
  end if;

  for v_task in select value from jsonb_array_elements(p_tasks) as item(value)
  loop
    insert into public.tasks (
      user_id,
      course_id,
      source_email_id,
      title,
      description,
      type,
      due_at,
      original_due_text,
      source_url,
      needs_review,
      review_reasons
    ) values (
      p_user_id,
      nullif(v_task ->> 'course_id', '')::uuid,
      v_email_id,
      v_task ->> 'title',
      v_task ->> 'description',
      v_task ->> 'type',
      nullif(v_task ->> 'due_at', '')::timestamptz,
      v_task ->> 'original_due_text',
      v_task ->> 'source_url',
      coalesce((v_task ->> 'needs_review')::boolean, false),
      coalesce(array(select jsonb_array_elements_text(v_task -> 'review_reasons')), '{}')
    );
  end loop;

  if p_announcement is not null then
    insert into public.announcements (
      user_id,
      course_id,
      source_email_id,
      title,
      content,
      source_url,
      received_at,
      needs_review,
      review_reasons
    ) values (
      p_user_id,
      nullif(p_announcement ->> 'course_id', '')::uuid,
      v_email_id,
      p_announcement ->> 'title',
      p_announcement ->> 'content',
      p_announcement ->> 'source_url',
      nullif(p_announcement ->> 'received_at', '')::timestamptz,
      coalesce((p_announcement ->> 'needs_review')::boolean, false),
      coalesce(array(select jsonb_array_elements_text(p_announcement -> 'review_reasons')), '{}')
    );
  end if;

  return p_processing_status;
end;
$function$;

revoke execute on function public.ingest_email_message(
  uuid, text, text, text, text, timestamptz, text, text, text, text[], jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.ingest_email_message(
  uuid, text, text, text, text, timestamptz, text, text, text, text[], jsonb, jsonb
) to service_role;
