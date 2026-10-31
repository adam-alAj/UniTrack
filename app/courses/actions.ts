"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  CourseInputSchema,
  CourseUpdateSchema,
  type CourseActionResult,
} from "@/lib/courses/schema";

function fields(formData: FormData) {
  const parseNullable = (key: string) =>
    String(formData.get(key) ?? "").trim() || null;
  return {
    name: String(formData.get("name") ?? ""),
    course_code: parseNullable("course_code"),
    instructor: parseNullable("instructor"),
    aliases: String(formData.get("aliases") ?? "")
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean),
    color: String(formData.get("color") ?? "blue"),
  };
}

async function owner() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error || !user ? null : { supabase, user };
}

function revalidateCourses() {
  revalidatePath("/courses");
  revalidatePath("/calendar");
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function createCourse(
  formData: FormData,
): Promise<CourseActionResult> {
  const current = await owner();
  if (!current)
    return {
      success: false,
      error: "Your session expired. Sign in and try again.",
    };
  const parsed = CourseInputSchema.safeParse(fields(formData));
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the course details.",
    };

  const { error } = await current.supabase
    .from("courses")
    .insert({ ...parsed.data, user_id: current.user.id });
  if (error)
    return {
      success: false,
      error:
        "The course could not be saved. Its name or code may already be in use.",
    };
  revalidateCourses();
  return { success: true };
}

export async function updateCourse(
  formData: FormData,
): Promise<CourseActionResult> {
  const current = await owner();
  if (!current)
    return {
      success: false,
      error: "Your session expired. Sign in and try again.",
    };
  const parsed = CourseUpdateSchema.safeParse({
    ...fields(formData),
    id: String(formData.get("id") ?? ""),
  });
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the course details.",
    };
  const { id, ...values } = parsed.data;
  const { data, error } = await current.supabase
    .from("courses")
    .update(values)
    .eq("id", id)
    .eq("user_id", current.user.id)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return { success: false, error: "The course could not be updated." };
  revalidateCourses();
  return { success: true };
}

export async function deleteCourse(
  idValue: string,
): Promise<CourseActionResult> {
  const current = await owner();
  if (!current)
    return {
      success: false,
      error: "Your session expired. Sign in and try again.",
    };
  const id = z.string().uuid().safeParse(idValue);
  if (!id.success)
    return { success: false, error: "The selected course is invalid." };
  const { data, error } = await current.supabase
    .from("courses")
    .delete()
    .eq("id", id.data)
    .eq("user_id", current.user.id)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return { success: false, error: "The course could not be deleted." };
  revalidateCourses();
  return { success: true };
}
