import { z } from "zod";

export const textSchema = z.string().trim().min(1);
export const sourceIdsSchema = z
  .array(textSchema)
  .min(1)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Duplicate source references",
  );
export const timestampSchema = z.iso.datetime({ offset: true }).nullable();
const identity = { id: textSchema, jobId: textSchema };

// Null timestamps preserve missing capture metadata in imported historical evidence.
export const sourceSchema = z
  .strictObject({
    ...identity,
    kind: z.enum(["photo", "recording", "technician_entry", "transcript"]),
    origin: z.enum(["technician", "model"]),
    actorId: textSchema,
    createdAt: timestampSchema,
    contentRef: textSchema.nullable(),
    text: textSchema.nullable(),
    captureStatus: z.enum(["pending", "saved", "failed"]),
    parentSourceIds: z.array(textSchema),
    supersedesSourceId: textSchema.nullable(),
  })
  .superRefine((source, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (source.kind !== "transcript" && source.origin !== "technician")
      issue("Raw evidence must have technician origin");
    if (source.kind === "transcript" && !source.parentSourceIds.length)
      issue("Transcript requires original recording references");
    if (["photo", "recording"].includes(source.kind) && !source.contentRef)
      issue("Media requires a content reference");
    if (
      ["technician_entry", "transcript"].includes(source.kind) &&
      !source.text
    )
      issue("Text evidence requires content");
  });

export const authoritySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.enum([
      "technician_entered",
      "technician_reported",
      "technician_observed",
      "instrument_reading_reported",
      "technician_diagnosis",
    ]),
    technicianId: textSchema,
  }),
  z.strictObject({
    kind: z.literal("model_interpretation"),
    modelId: textSchema,
    review: z.literal("proposed"),
  }),
  z.strictObject({
    kind: z.literal("technician_confirmed"),
    technicianId: textSchema,
    confirmationSourceIds: sourceIdsSchema,
  }),
]);
const claimBase = {
  ...identity,
  sourceIds: sourceIdsSchema,
  authority: authoritySchema,
};
export const electricalTestSchema = z
  .strictObject({
    ...claimBase,
    kind: z.literal("electrical"),
    component: textSchema,
    instrument: z.enum(["multimeter", "other", "unknown"]),
    instrumentDetails: textSchema.nullable(),
    voltagePresence: z.enum(["present", "absent", "unknown"]),
    measuredVoltage: z.number().finite().nonnegative().nullable(),
    measurementStatus: z.enum(["performed", "not_performed", "unknown"]),
    unit: z.enum(["VAC", "VDC", "unknown"]),
    measurementPoints: textSchema.nullable(),
    testContext: textSchema.nullable(),
  })
  .superRefine((test, ctx) => {
    if (
      test.measuredVoltage !== null &&
      test.measurementStatus !== "performed"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Numeric reading requires a performed measurement",
      });
    }
    if (
      test.measurementStatus === "not_performed" &&
      test.voltagePresence !== "unknown"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Untested voltage presence must remain unknown",
      });
    }
  });
export const observationSchema = z.strictObject({
  ...claimBase,
  kind: z.literal("mechanical"),
  component: textSchema,
  finding: textSchema,
  value: z.union([textSchema, z.boolean(), z.number().finite(), z.null()]),
});
export const diagnosisSchema = z
  .strictObject({
    ...claimBase,
    kind: z.literal("diagnosis"),
    assessment: textSchema,
    uncertainty: textSchema.nullable(),
  })
  .superRefine((claim, ctx) => {
    if (
      ![
        "technician_diagnosis",
        "model_interpretation",
        "technician_confirmed",
      ].includes(claim.authority.kind)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Diagnosis requires explicit diagnostic attribution",
      });
    }
  });
export const claimSchema = z.discriminatedUnion("kind", [
  electricalTestSchema,
  observationSchema,
  diagnosisSchema,
]);
export const communicationSchema = z
  .strictObject({
    ...identity,
    sourceIds: sourceIdsSchema,
    technicianId: textSchema,
    message: textSchema,
    customerResponse: z.enum([
      "unknown",
      "agreed_to_plan",
      "declined",
      "deferred",
    ]),
    authorization: z.strictObject({
      status: z.enum(["unknown", "authorized", "declined"]),
      scope: textSchema.nullable(),
    }),
  })
  .superRefine((communication, ctx) => {
    if (
      communication.authorization.status !== "unknown" &&
      communication.authorization.scope === null
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Explicit authorization or refusal requires its scope",
      });
    }
  });
export const partRequestSchema = z.strictObject({
  ...identity,
  component: textSchema,
  description: textSchema,
  partNumber: textSchema.nullable(),
  sourceIds: sourceIdsSchema,
});
export const conflictSchema = z.strictObject({
  id: textSchema,
  claimIds: z.array(textSchema).min(1),
  reason: textSchema,
  status: z.literal("requires_review"),
});
export type Source = z.infer<typeof sourceSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type ElectricalTest = z.infer<typeof electricalTestSchema>;
export type Authority = z.infer<typeof authoritySchema>;

// Dedicated boundary for untrusted extraction output: human authority is rejected.
export const modelProposalSchema = claimSchema.refine(
  (claim) => claim.authority.kind === "model_interpretation",
  "Model output must retain proposed model authority",
);

export type MechanicalObservation = z.infer<typeof observationSchema>;
export type Diagnosis = z.infer<typeof diagnosisSchema>;
export type Communication = z.infer<typeof communicationSchema>;
export type PartRequest = z.infer<typeof partRequestSchema>;
