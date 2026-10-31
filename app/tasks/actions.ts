"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { TaskInputSchema, TaskUpdateSchema, type TaskActionResult } from "@/lib/tasks/schema";

function nullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function taskFields(formData: FormData) {
  const rawDate = String(formData.get("due_at") ?? "").trim();
  return {
    title: String(formData.get("title") ?? ""),
    description: nullableText(formData.get("description")),
    course_id: nullableText(formData.get("course_id")),
    type: String(formData.get("type") ?? "assignment"),
    status: String(formData.get("status") ?? "not_started"),
    due_at: rawDate ? new Date(rawDate).toISOString() : null,
  };
}

async function ownerClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, user };
}

export async function createTask(formData: FormData): Promise<TaskActionResult> {
  const owner = await ownerClient();
  if (!owner) return { success: false, error: "Your session expired. Sign in and try again." };

  let fields: ReturnType<typeof taskFields>;
  try {
    fields = taskFields(formData);
  } catch {
    return { success: false, error: "Enter a valid deadline." };
  }
  const parsed = TaskInputSchema.safeParse(fields);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the task details." };

  const { error } = await owner.supabase.from("tasks").insert({ ...parsed.data, user_id: owner.user.id });
  if (error) return { success: false, error: "The task could not be saved. Check the course and try again." };

  revalidatePath("/");
  revalidatePath("/tasks");
  return { success: true };
}

export async function updateTask(formData: FormData): Promise<TaskActionResult> {
  const owner = await ownerClient();
  if (!owner) return { success: false, error: "Your session expired. Sign in and try again." };

  let fields: ReturnType<typeof taskFields>;
  try {
    fields = taskFields(formData);
  } catch {
    return { success: false, error: "Enter a valid deadline." };
  }
  const parsed = TaskUpdateSchema.safeParse({ ...fields, id: String(formData.get("id") ?? "") });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the task details." };

  const { id, ...values } = parsed.data;
  const { data, error } = await owner.supabase
    .from("tasks")
    .update(values)
    .eq("id", id)
    .eq("user_id", owner.user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { success: false, error: "The task could not be updated. It may no longer be available." };
  revalidatePath("/");
  revalidatePath("/tasks");
  return { success: true };
}
