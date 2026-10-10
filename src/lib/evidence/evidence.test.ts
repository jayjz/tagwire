import { describe, expect, it } from "vitest";
import fixture from "../../../fixtures/hvac-001-smith/case.json";
import { electricalTestSchema, sourceSchema } from "./records";
import {
  appendEvidence,
  appendModelProposals,
  serviceCallSchema,
} from "./service-call";
import { createSmithServiceCall } from "./smith-fixture";
import {
  assertTransition,
  transitions,
  workflowStates,
  type WorkflowEvent,
} from "./lifecycle";

const smith = createSmithServiceCall;
const voltage = () => electricalTestSchema.parse(smith().claims[0]);

describe("canonical Miss Smith evidence", () => {
  it("validates the curated projection without manufacturing facts", () => {
    const call = smith();
    expect(serviceCallSchema.parse(call)).toEqual(call);
    expect(call.customer.label).toBe(fixture.customerLabel);
    expect(call.equipment).toMatchObject(fixture.equipment);
    expect(call.claims[0]).toMatchObject(fixture.expected.electricalTest);
    expect(call.sources.slice(1).map((source) => source.text)).toEqual(
      fixture.events.map((event) => event.text),
    );
    expect(call.sources.every((source) => source.createdAt === null)).toBe(
      true,
    );
    expect(call.claims.find((claim) => claim.id === "windings")).toMatchObject({
      authority: { kind: "technician_diagnosis" },
      uncertainty: expect.stringContaining("no separate winding test"),
    });
  });
  it("keeps equipment model and serial explicitly unknown", () => {
    expect(smith().equipment).toMatchObject({ model: null, serial: null });
    const { model: _model, ...missing } = smith().equipment;
    void _model;
    expect(
      serviceCallSchema.safeParse({ ...smith(), equipment: missing }).success,
    ).toBe(false);
    expect(
      serviceCallSchema.safeParse({
        ...smith(),
        equipment: { ...smith().equipment, serial: "" },
      }).success,
    ).toBe(false);
  });
  it("does not turn customer agreement into an order, appointment, or completed repair", () => {
    const call = smith();
    expect(call.communications[0].customerResponse).toBe("agreed_to_plan");
    expect(call.communications[0].authorization).toEqual({
      status: "unknown",
      scope: null,
    });
    expect(call.partRequest?.partNumber).toBeNull();
    expect(workflowStates(call.workflowEvents)).toEqual({
      job: "unknown",
      part: "proposed",
      visit: "proposed",
    });
  });
});

describe("electrical semantics", () => {
  it.each(["present", "absent", "unknown"] as const)(
    "preserves %s with an unknown numeric reading",
    (voltagePresence) => {
      expect(
        electricalTestSchema.parse({ ...voltage(), voltagePresence })
          .measuredVoltage,
      ).toBeNull();
    },
  );
  it("preserves actual zero, unknown method, and unknown unit independently", () => {
    const reading = electricalTestSchema.parse({
      ...voltage(),
      voltagePresence: "unknown",
      measuredVoltage: 0,
      instrument: "unknown",
      unit: "unknown",
    });
    expect(reading.measuredVoltage).toBe(0);
    expect(reading.instrument).toBe("unknown");
  });
  it("distinguishes an unperformed test from a performed test without recorded magnitude", () => {
    const reading = electricalTestSchema.parse({
      ...voltage(),
      voltagePresence: "unknown",
      measurementStatus: "not_performed",
    });
    expect(reading.measurementStatus).not.toBe(voltage().measurementStatus);
    expect(
      electricalTestSchema.safeParse({ ...reading, measuredVoltage: 0 })
        .success,
    ).toBe(false);
    expect(
      electricalTestSchema.safeParse({ ...reading, voltagePresence: "present" })
        .success,
    ).toBe(false);
  });
  it.each([
    { unit: "amps" },
    { measuredVoltage: -1 },
    { measuredVoltage: NaN },
    { measuredVoltage: Infinity },
    { measuredVoltage: "0" },
    { measuredVoltage: undefined },
    { instrument: null },
    { unexpected: true },
  ])("rejects malformed record %j", (change) => {
    expect(
      electricalTestSchema.safeParse({ ...voltage(), ...change }).success,
    ).toBe(false);
  });
});

describe("provenance and authority", () => {
  it.each([
    undefined,
    [],
    [""],
    ["  "],
    [123],
    [null],
    ["missing"],
    ["note-001", "note-001"],
  ])("rejects missing/malformed/unresolved references %j", (sourceIds) => {
    const call = smith();
    expect(
      serviceCallSchema.safeParse({
        ...call,
        claims: [{ ...call.claims[0], sourceIds }, ...call.claims.slice(1)],
      }).success,
    ).toBe(false);
  });
  it("rejects cross-job, unsaved and duplicate source records", () => {
    for (const patch of [
      { jobId: "another-job" },
      { captureStatus: "failed" },
      { captureStatus: "pending" },
    ]) {
      const call = smith();
      expect(
        serviceCallSchema.safeParse({
          ...call,
          sources: call.sources.map((source) =>
            source.id === "note-001" ? { ...source, ...patch } : source,
          ),
        }).success,
      ).toBe(false);
    }
    expect(() =>
      appendEvidence(smith(), { sources: [smith().sources[0]] }),
    ).toThrow();
  });
  it("keeps model interpretation proposed and prevents model sources establishing technician evidence", () => {
    const call = smith();
    const source = {
      ...call.sources[1],
      id: "transcript",
      kind: "transcript" as const,
      origin: "model" as const,
      parentSourceIds: ["recording"],
    };
    const recording = {
      ...call.sources[1],
      id: "recording",
      kind: "recording" as const,
      text: null,
      contentRef: "local:fictional-recording",
    };
    const claim = {
      ...voltage(),
      id: "suggestion",
      sourceIds: [source.id],
      authority: {
        kind: "model_interpretation" as const,
        modelId: "test-model",
        review: "proposed" as const,
      },
    };
    const proposed = appendEvidence(call, {
      sources: [recording, source],
      claims: [claim],
    });
    expect(proposed.claims.at(-1)?.authority.kind).toBe("model_interpretation");
    expect(() => appendModelProposals(call, [voltage()])).toThrow();
    expect(
      appendModelProposals(call, [
        { ...claim, sourceIds: ["note-001"] },
      ]).claims.at(-1)?.authority.kind,
    ).toBe("model_interpretation");
    expect(() =>
      appendEvidence(proposed, {
        claims: [
          {
            ...claim,
            id: "promoted",
            authority: {
              kind: "instrument_reading_reported",
              technicianId: "fixture-technician",
            },
          },
        ],
      }),
    ).toThrow();
    expect(
      serviceCallSchema.safeParse({
        ...call,
        claims: [
          {
            ...claim,
            sourceIds: ["note-001"],
            authority: { ...claim.authority, review: "verified" },
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("requires a distinct human confirmation record and preserves the proposal", () => {
    const call = smith();
    const proposal = {
      ...voltage(),
      id: "proposal",
      authority: {
        kind: "model_interpretation" as const,
        modelId: "test-model",
        review: "proposed" as const,
      },
    };
    const proposed = appendEvidence(call, { claims: [proposal] });
    const confirmation = {
      ...proposal,
      id: "confirmed",
      authority: {
        kind: "technician_confirmed" as const,
        technicianId: "fixture-technician",
        confirmationSourceIds: ["confirmation"],
      },
    };
    expect(() =>
      appendEvidence(proposed, { claims: [confirmation] }),
    ).toThrow();
    const confirmed = appendEvidence(proposed, {
      sources: [
        {
          ...call.sources[1],
          id: "confirmation",
          text: "I confirm the presence-only observation; no numeric reading recorded.",
        },
      ],
      claims: [confirmation],
    });
    expect(confirmed.claims).toHaveLength(call.claims.length + 2);
    expect(proposed.claims.at(-1)?.id).toBe("proposal");
  });
  it("rejects diagnosis disguised as a reported instrument fact", () => {
    const call = smith();
    call.claims[2].authority = {
      kind: "instrument_reading_reported",
      technicianId: "fixture-technician",
    };
    expect(serviceCallSchema.safeParse(call).success).toBe(false);
  });
  it("requires source content, valid metadata, and recording provenance for transcripts", () => {
    const source = smith().sources[0];
    expect(
      sourceSchema.safeParse({ ...source, createdAt: "yesterday" }).success,
    ).toBe(false);
    expect(
      sourceSchema.safeParse({ ...source, kind: "photo", contentRef: null })
        .success,
    ).toBe(false);
    expect(
      sourceSchema.safeParse({
        ...source,
        kind: "transcript",
        parentSourceIds: [],
      }).success,
    ).toBe(false);
    expect(() =>
      appendEvidence(smith(), {
        sources: [{ ...source, id: "cycle", supersedesSourceId: "cycle" }],
      }),
    ).toThrow();
  });
});

describe("append-only conflict review", () => {
  it("retains contradictory voltage observations only with explicit review", () => {
    const call = smith();
    const contradictory = {
      ...voltage(),
      id: "voltage-absent",
      voltagePresence: "absent" as const,
    };
    expect(() => appendEvidence(call, { claims: [contradictory] })).toThrow();
    const revised = appendEvidence(call, {
      claims: [contradictory],
      conflicts: [
        {
          id: "conflict",
          claimIds: ["voltage", "voltage-absent"],
          reason: "Contradictory reports; test contexts need review.",
          status: "requires_review",
        },
      ],
    });
    expect(revised.claims.slice(0, call.claims.length)).toEqual(call.claims);
    expect(call.claims).toHaveLength(4);
    expect(revised.conflicts[0].status).toBe("requires_review");
  });
  it("flags within-record magnitude/presence contradictions without changing zero", () => {
    const call = smith();
    call.claims[0] = { ...voltage(), measuredVoltage: 0 };
    expect(serviceCallSchema.safeParse(call).success).toBe(false);
    call.conflicts.push({
      id: "zero-review",
      claimIds: ["voltage"],
      reason: "Zero with reported presence requires context review.",
      status: "requires_review",
    });
    expect(serviceCallSchema.parse(call).claims[0]).toMatchObject({
      voltagePresence: "present",
      measuredVoltage: 0,
    });
  });
  it("rejects dangling conflict references and prevents overwriting a claim identifier", () => {
    expect(() => appendEvidence(smith(), { claims: [voltage()] })).toThrow();
    expect(() =>
      appendEvidence(smith(), {
        conflicts: [
          {
            id: "conflict",
            claimIds: ["voltage", "missing"],
            reason: "review",
            status: "requires_review",
          },
        ],
      }),
    ).toThrow();
  });
});

describe("explicit lifecycle transitions", () => {
  it("supports every declared transition and rejects skipped stages", () => {
    for (const workflow of ["job", "part", "visit"] as const)
      for (const [from, targets] of Object.entries(transitions[workflow]))
        for (const to of targets)
          expect(() => assertTransition(workflow, from, to)).not.toThrow();
    expect(() => assertTransition("part", "proposed", "ordered")).toThrow();
    expect(() => assertTransition("visit", "proposed", "completed")).toThrow();
    expect(() =>
      assertTransition("job", "unknown", "repair_completed"),
    ).toThrow();
    expect(() => assertTransition("part", "invented", "ordered")).toThrow();
  });
  it("records approval, request, order, receipt and installation as separate events", () => {
    const call = smith();
    const states = [
      "proposed",
      "approved",
      "requested",
      "ordered",
      "received",
      "installed",
    ] as const;
    const events = states
      .slice(1)
      .map((to, i): WorkflowEvent => ({
        ...call.workflowEvents[0],
        workflow: "part",
        id: `part-${to}`,
        from: states[i],
        to,
      }));
    expect(
      workflowStates(
        appendEvidence(call, { workflowEvents: events }).workflowEvents,
      ).part,
    ).toBe("installed");
    expect(workflowStates(call.workflowEvents).part).toBe("proposed");
    expect(() =>
      appendEvidence(call, {
        workflowEvents: [
          { ...events[0], workflow: "part", from: "approved", to: "requested" },
        ],
      }),
    ).toThrow();
  });
  it("scheduling requires a separate sourced transition", () => {
    const call = smith();
    const scheduled: WorkflowEvent = {
      ...call.workflowEvents[1],
      workflow: "visit",
      id: "appointment-confirmation",
      sourceIds: ["booking"],
      from: "proposed",
      to: "scheduled",
    };
    call.sources.push({
      ...call.sources[1],
      id: "booking",
      text: "Fictional test: customer and technician confirmed the return appointment.",
    });
    expect(
      workflowStates(
        appendEvidence(call, { workflowEvents: [scheduled] }).workflowEvents,
      ).visit,
    ).toBe("scheduled");
    expect(() =>
      appendEvidence(call, {
        workflowEvents: [{ ...scheduled, sourceIds: [] }],
      }),
    ).toThrow();
  });
});

describe("additional integrity boundaries", () => {
  it("preserves source corrections as distinct revisions", () => {
    const call = smith();
    const correction = {
      ...call.sources[1],
      id: "corrected-note",
      supersedesSourceId: "note-001",
      text: "Fictional correction: further test context is unknown.",
    };
    const revised = appendEvidence(call, { sources: [correction] });
    expect(revised.sources[1]).toEqual(call.sources[1]);
    expect(revised.sources.at(-1)?.supersedesSourceId).toBe("note-001");
  });
  it("requires provenance on customer, equipment, parts, communication and workflow", () => {
    const call = smith();
    expect(
      serviceCallSchema.safeParse({
        ...call,
        customer: { ...call.customer, sourceIds: [] },
      }).success,
    ).toBe(false);
    expect(
      serviceCallSchema.safeParse({
        ...call,
        equipment: { ...call.equipment, sourceIds: ["missing"] },
      }).success,
    ).toBe(false);
    expect(
      serviceCallSchema.safeParse({
        ...call,
        partRequest: { ...call.partRequest, sourceIds: [null] },
      }).success,
    ).toBe(false);
    expect(
      serviceCallSchema.safeParse({
        ...call,
        communications: [{ ...call.communications[0], sourceIds: [""] }],
      }).success,
    ).toBe(false);
    expect(
      serviceCallSchema.safeParse({
        ...call,
        workflowEvents: [{ ...call.workflowEvents[0], sourceIds: undefined }],
      }).success,
    ).toBe(false);
  });
  it("requires scope for explicit customer authorization", () => {
    const call = smith();
    call.communications[0].authorization.status = "authorized";
    expect(serviceCallSchema.safeParse(call).success).toBe(false);
  });
  it("requires a separate technician entry for confirmation", () => {
    const call = smith();
    const confirmed = {
      ...voltage(),
      id: "confirmed",
      authority: {
        kind: "technician_confirmed" as const,
        technicianId: "fixture-technician",
        confirmationSourceIds: ["note-001"],
      },
    };
    expect(() => appendEvidence(call, { claims: [confirmed] })).toThrow();
    expect(() =>
      appendEvidence(call, {
        claims: [
          {
            ...confirmed,
            authority: { ...confirmed.authority, confirmationSourceIds: [] },
          },
        ],
      }),
    ).toThrow();
  });
  it("preserves conflicting mechanical findings for review", () => {
    const call = smith();
    const seized = call.claims.find((claim) => claim.kind === "mechanical")!;
    if (seized.kind !== "mechanical")
      throw new Error("Expected mechanical fixture");
    const claim = { ...seized, id: "not-seized", value: false };
    expect(() => appendEvidence(call, { claims: [claim] })).toThrow();
    expect(
      appendEvidence(call, {
        claims: [claim],
        conflicts: [
          {
            id: "mechanical-conflict",
            claimIds: [seized.id, claim.id],
            reason: "Contradictory findings",
            status: "requires_review",
          },
        ],
      }).claims.at(-1),
    ).toEqual(claim);
  });
  it("records repair completion explicitly after service work", () => {
    const call = smith();
    const states = [
      "unknown",
      "open",
      "in_progress",
      "repair_completed",
      "closed",
    ] as const;
    const events = states
      .slice(1)
      .map((to, i): WorkflowEvent => ({
        ...call.workflowEvents[0],
        workflow: "job",
        id: `job-${to}`,
        from: states[i],
        to,
      }));
    expect(
      workflowStates(
        appendEvidence(call, { workflowEvents: events }).workflowEvents,
      ).job,
    ).toBe("closed");
  });
});
