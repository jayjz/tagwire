import { z } from "zod";
import {
  claimSchema,
  communicationSchema,
  modelProposalSchema,
  partRequestSchema,
  conflictSchema,
  sourceIdsSchema,
  sourceSchema,
  textSchema,
} from "./records";
import { workflowEventSchema, workflowStates } from "./lifecycle";

export const customerSchema = z.strictObject({
  id: textSchema,
  label: textSchema,
  sourceIds: sourceIdsSchema,
});
export const equipmentSchema = z.strictObject({
  id: textSchema,
  type: textSchema.nullable(),
  brand: textSchema.nullable(),
  model: textSchema.nullable(),
  serial: textSchema.nullable(),
  sourceIds: sourceIdsSchema,
});
export type Customer = z.infer<typeof customerSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;

export const serviceCallSchema = z
  .strictObject({
    id: textSchema,
    customer: customerSchema,
    equipment: equipmentSchema,
    partRequest: partRequestSchema.nullable(),
    sources: z.array(sourceSchema),
    claims: z.array(claimSchema),
    communications: z.array(communicationSchema),
    workflowEvents: z.array(workflowEventSchema),
    conflicts: z.array(conflictSchema),
  })
  .superRefine((call, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    const sources = new Map(call.sources.map((source) => [source.id, source]));
    const claims = new Map(call.claims.map((claim) => [claim.id, claim]));
    const ids = [
      ...call.sources,
      ...call.claims,
      ...call.communications,
      ...call.workflowEvents,
      ...call.conflicts,
    ].map((record) => record.id);
    if (new Set(ids).size !== ids.length)
      issue(
        "Record identifiers must be unique; append revisions instead of replacing evidence",
      );
    function checkRefs(refs: string[], humanOnly = false) {
      for (const id of refs) {
        const source = sources.get(id);
        if (!source || source.jobId !== call.id)
          issue(`Unresolved or cross-job source: ${id}`);
        else if (source.captureStatus !== "saved")
          issue(`Source is not saved: ${id}`);
        else if (humanOnly && !isHumanSource(id, new Set()))
          issue(`Model output cannot establish human evidence: ${id}`);
      }
    }
    function isHumanSource(id: string, seen: Set<string>): boolean {
      const source = sources.get(id);
      if (!source || seen.has(id) || source.origin !== "technician")
        return false;
      return source.parentSourceIds.every((parent) =>
        isHumanSource(parent, new Set([...seen, id])),
      );
    }
    for (const source of call.sources) {
      if (source.jobId !== call.id) issue("Source belongs to another job");
      checkRefs(source.parentSourceIds);
      if (
        source.kind === "transcript" &&
        source.parentSourceIds.some(
          (id) => sources.get(id)?.kind !== "recording",
        )
      )
        issue("Transcript parents must be recordings");
      if (source.supersedesSourceId) checkRefs([source.supersedesSourceId]);
      // Detect cyclic parent/revision links without modifying any source.
      function visit(id: string, ancestors: Set<string>) {
        if (ancestors.has(id)) {
          issue("Cyclic source provenance");
          return;
        }
        const item = sources.get(id);
        if (item)
          for (const parent of [
            ...item.parentSourceIds,
            ...(item.supersedesSourceId ? [item.supersedesSourceId] : []),
          ])
            visit(parent, new Set([...ancestors, id]));
      }
      visit(source.id, new Set());
    }
    checkRefs(call.customer.sourceIds, true);
    checkRefs(call.equipment.sourceIds, true);
    if (call.partRequest) {
      if (call.partRequest.jobId !== call.id)
        issue("Part request belongs to another job");
      checkRefs(call.partRequest.sourceIds, true);
    }
    for (const claim of call.claims) {
      if (claim.jobId !== call.id) issue("Claim belongs to another job");
      const authority = claim.authority;
      checkRefs(
        claim.sourceIds,
        authority.kind !== "model_interpretation" &&
          authority.kind !== "technician_confirmed",
      );
      if (authority.kind === "technician_confirmed") {
        checkRefs(authority.confirmationSourceIds, true);
        if (
          authority.confirmationSourceIds.some((id) =>
            claim.sourceIds.includes(id),
          )
        )
          issue(
            "Confirmation must be separate from the evidence being confirmed",
          );
        if (
          authority.confirmationSourceIds.some(
            (id) =>
              sources.get(id)?.kind !== "technician_entry" ||
              sources.get(id)?.actorId !== authority.technicianId,
          )
        )
          issue(
            "Confirmation requires a separate entry by the confirming technician",
          );
      }
    }
    for (const record of [...call.communications, ...call.workflowEvents]) {
      if (record.jobId !== call.id)
        issue("Workflow or communication belongs to another job");
      checkRefs(record.sourceIds, true);
    }
    try {
      workflowStates(call.workflowEvents);
    } catch (error) {
      issue((error as Error).message);
    }
    for (const conflict of call.conflicts) {
      if (
        new Set(conflict.claimIds).size !== conflict.claimIds.length ||
        conflict.claimIds.some((id) => !claims.has(id))
      )
        issue("Conflict must reference distinct existing claims");
    }
    const covered = (ids: string[]) =>
      call.conflicts.some((conflict) =>
        ids.every((id) => conflict.claimIds.includes(id)),
      );
    for (const claim of call.claims) {
      if (
        claim.kind === "electrical" &&
        ((claim.voltagePresence === "present" && claim.measuredVoltage === 0) ||
          (claim.voltagePresence === "absent" &&
            claim.measuredVoltage !== null &&
            claim.measuredVoltage > 0)) &&
        !covered([claim.id])
      )
        issue("Presence/magnitude conflict requires review");
    }
    for (let i = 0; i < call.claims.length; i++)
      for (const right of call.claims.slice(i + 1)) {
        const left = call.claims[i];
        const voltageConflict =
          left.kind === "electrical" &&
          right.kind === "electrical" &&
          left.component === right.component &&
          ((left.voltagePresence !== "unknown" &&
            right.voltagePresence !== "unknown" &&
            left.voltagePresence !== right.voltagePresence) ||
            (left.measuredVoltage !== null &&
              right.measuredVoltage !== null &&
              left.unit === right.unit &&
              left.measuredVoltage !== right.measuredVoltage));
        const mechanicalConflict =
          left.kind === "mechanical" &&
          right.kind === "mechanical" &&
          left.component === right.component &&
          left.finding === right.finding &&
          left.value !== right.value;
        if (
          (voltageConflict || mechanicalConflict) &&
          !covered([left.id, right.id])
        )
          issue("Conflicting evidence requires explicit review marker");
      }
  });
export type ServiceCall = z.infer<typeof serviceCallSchema>;

// No mutation/update path: corrections are new records, with explicit conflicts.
export function appendEvidence(
  call: ServiceCall,
  additions: {
    sources?: ServiceCall["sources"];
    claims?: ServiceCall["claims"];
    conflicts?: ServiceCall["conflicts"];
    workflowEvents?: ServiceCall["workflowEvents"];
    communications?: ServiceCall["communications"];
  },
): ServiceCall {
  serviceCallSchema.parse(call);
  return serviceCallSchema.parse({
    ...call,
    sources: [...call.sources, ...(additions.sources ?? [])],
    claims: [...call.claims, ...(additions.claims ?? [])],
    conflicts: [...call.conflicts, ...(additions.conflicts ?? [])],
    workflowEvents: [
      ...call.workflowEvents,
      ...(additions.workflowEvents ?? []),
    ],
    communications: [
      ...call.communications,
      ...(additions.communications ?? []),
    ],
  });
}

export function appendModelProposals(
  call: ServiceCall,
  input: unknown,
): ServiceCall {
  return appendEvidence(call, {
    claims: z.array(modelProposalSchema).parse(input),
  });
}
