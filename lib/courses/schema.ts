import { z } from "zod";

export const CourseColorSchema = z.enum(["blue", "violet", "green", "amber", "rose", "slate"]);

const CourseFieldsSchema = z.object({
  name: z.string().trim().min(1, "Course name is required.").max(160),
  course_code: z.string().trim().max(64).nullable(),
  instructor: z.string().trim().max(160).nullable(),
  aliases: z.array(z.string().trim().min(1).max(100)).max(20),
  color: CourseColorSchema,
}).strict();

function validateAliases(course: { aliases: string[] }, context: z.RefinementCtx) {
  const aliases = course.aliases.map((alias) => alias.toLocaleLowerCase());
  if (new Set(aliases).size !== aliases.length) {
    context.addIssue({ code: "custom", path: ["aliases"], message: "Each alias should appear only once." });
  }
}

export const CourseInputSchema = CourseFieldsSchema.superRefine(validateAliases);
export const CourseUpdateSchema = CourseFieldsSchema.extend({ id: z.string().uuid() }).strict().superRefine(validateAliases);
export type CourseInput = z.infer<typeof CourseInputSchema>;
export type CourseRecord = CourseInput & { id: string; user_id: string; created_at: string; task_count: number };
export type CourseActionResult = { success: true } | { success: false; error: string };
