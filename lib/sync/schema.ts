import { z } from "zod";

export const SyncRunSchema = z
  .object({
    started_at: z.string().datetime({ offset: true }),
    finished_at: z.string().datetime({ offset: true }),
    status: z.enum(["success", "partial", "failed"]),
    found_count: z.number().int().nonnegative(),
    processed_count: z.number().int().nonnegative(),
    failed_count: z.number().int().nonnegative(),
    error_summary: z.string().max(500).nullable(),
  })
  .strict()
  .refine((run) => Date.parse(run.finished_at) >= Date.parse(run.started_at), {
    message: "Sync finish time must be after start time.",
    path: ["finished_at"],
  });

export type SyncRunInput = z.infer<typeof SyncRunSchema>;
