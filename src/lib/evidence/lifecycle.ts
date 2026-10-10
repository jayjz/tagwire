import { z } from "zod";
import { sourceIdsSchema, textSchema, timestampSchema } from "./records";

export const transitions = {
  job: {
    unknown: ["open"],
    open: ["in_progress", "cancelled"],
    in_progress: ["awaiting_follow_up", "repair_completed", "cancelled"],
    awaiting_follow_up: ["in_progress", "cancelled"],
    repair_completed: ["closed"],
    closed: [],
    cancelled: [],
  },
  part: {
    not_assessed: ["proposed"],
    proposed: ["approved"],
    approved: ["requested"],
    requested: ["ordered"],
    ordered: ["received"],
    received: ["installed"],
    installed: [],
  },
  visit: {
    not_proposed: ["proposed"],
    proposed: ["scheduled", "cancelled"],
    scheduled: ["completed", "cancelled"],
    completed: [],
    cancelled: ["proposed"],
  },
} as const;
export type Workflow = keyof typeof transitions;
export const initialStates = {
  job: "unknown",
  part: "not_assessed",
  visit: "not_proposed",
} as const;
const eventBase = {
  id: textSchema,
  jobId: textSchema,
  sourceIds: sourceIdsSchema,
  recordedBy: textSchema,
  occurredAt: timestampSchema,
  details: textSchema.nullable(),
};
export const jobStatusSchema = z.enum([
  "unknown",
  "open",
  "in_progress",
  "awaiting_follow_up",
  "repair_completed",
  "closed",
  "cancelled",
]);
export const partStatusSchema = z.enum([
  "not_assessed",
  "proposed",
  "approved",
  "requested",
  "ordered",
  "received",
  "installed",
]);
export const visitStatusSchema = z.enum([
  "not_proposed",
  "proposed",
  "scheduled",
  "completed",
  "cancelled",
]);
export const workflowEventSchema = z
  .discriminatedUnion("workflow", [
    z.strictObject({
      ...eventBase,
      workflow: z.literal("job"),
      from: jobStatusSchema,
      to: jobStatusSchema,
    }),
    z.strictObject({
      ...eventBase,
      workflow: z.literal("part"),
      from: partStatusSchema,
      to: partStatusSchema,
    }),
    z.strictObject({
      ...eventBase,
      workflow: z.literal("visit"),
      from: visitStatusSchema,
      to: visitStatusSchema,
    }),
  ])
  .superRefine((event, ctx) => {
    try {
      assertTransition(event.workflow, event.from, event.to);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: (error as Error).message });
    }
  });
export type WorkflowEvent = z.infer<typeof workflowEventSchema>;

export function assertTransition(
  workflow: Workflow,
  from: string,
  to: string,
): void {
  const graph: Record<string, readonly string[]> = transitions[workflow];
  if (!graph[from]?.includes(to))
    throw new Error(`Invalid ${workflow} transition: ${from} -> ${to}`);
}

// Validates the complete append-only history; agreement is deliberately not an event.
export type WorkflowStates = {
  job: z.infer<typeof jobStatusSchema>;
  part: z.infer<typeof partStatusSchema>;
  visit: z.infer<typeof visitStatusSchema>;
};
export function workflowStates(
  events: readonly WorkflowEvent[],
): WorkflowStates {
  const states: WorkflowStates = { ...initialStates };
  for (const input of events) {
    const event = workflowEventSchema.parse(input);
    if (states[event.workflow] !== event.from)
      throw new Error("Workflow history does not match previous state");
    assertTransition(event.workflow, event.from, event.to);
    switch (event.workflow) {
      case "job":
        states.job = event.to;
        break;
      case "part":
        states.part = event.to;
        break;
      case "visit":
        states.visit = event.to;
        break;
    }
  }
  return states;
}
