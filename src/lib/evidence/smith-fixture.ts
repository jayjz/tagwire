import fixture from "../../../fixtures/hvac-001-smith/case.json";
import { serviceCallSchema } from "./service-call";

// Explicit curated projection of the canonical fictional evidence; no text inference.
export function createSmithServiceCall() {
  const jobId = fixture.fixtureId;
  const technicianId = "fixture-technician";
  const record = {
    jobId,
    sourceIds: ["note-002"],
    authority: { kind: "technician_diagnosis", technicianId },
  };
  return serviceCallSchema.parse({
    id: jobId,
    customer: {
      id: "smith",
      label: fixture.customerLabel,
      sourceIds: ["fixture-context"],
    },
    equipment: {
      id: "smith-furnace",
      ...fixture.equipment,
      sourceIds: ["fixture-context"],
    },
    partRequest: {
      id: "replacement",
      jobId,
      component: "induced_draft_motor",
      description: "Replacement induced draft motor proposed",
      partNumber: null,
      sourceIds: ["note-003"],
    },
    sources: [
      {
        id: "fixture-context",
        jobId,
        kind: "technician_entry",
        origin: "technician",
        actorId: technicianId,
        createdAt: null,
        contentRef: "fixtures/hvac-001-smith/case.json",
        text: "Fictional fixture context: Miss Smith, Goodman furnace; model and serial unknown.",
        captureStatus: "saved",
        parentSourceIds: [],
        supersedesSourceId: null,
      },
      ...fixture.events.map((event) => ({
        id: event.id,
        jobId,
        kind: "technician_entry",
        origin: "technician",
        actorId: technicianId,
        createdAt: null,
        contentRef: null,
        text: event.text,
        captureStatus: "saved",
        parentSourceIds: [],
        supersedesSourceId: null,
      })),
    ],
    claims: [
      {
        id: "voltage",
        jobId,
        kind: "electrical",
        ...fixture.expected.electricalTest,
        authority: { kind: "instrument_reading_reported", technicianId },
        instrumentDetails: null,
        measurementStatus: "performed",
        measurementPoints: null,
        testContext: null,
      },
      {
        id: "seized",
        ...record,
        kind: "mechanical",
        authority: { kind: "technician_observed", technicianId },
        component: "induced_draft_motor",
        finding: "motorSeized",
        value: fixture.expected.mechanicalObservation.motorSeized,
      },
      {
        id: "diagnosis",
        ...record,
        kind: "diagnosis",
        assessment: fixture.expected.technicianAssessment,
        uncertainty: null,
      },
      {
        id: "windings",
        ...record,
        kind: "diagnosis",
        assessment: "defective windings",
        uncertainty:
          "Technician reported; no separate winding test was reported.",
      },
    ],
    communications: [
      {
        id: "customer-plan",
        jobId,
        sourceIds: ["note-003"],
        technicianId,
        message: fixture.events[2].text,
        customerResponse: fixture.expected.customerResponse,
        authorization: { status: "unknown", scope: null },
      },
    ],
    workflowEvents: [
      {
        id: "replacement-proposal",
        jobId,
        workflow: "part",
        from: "not_assessed",
        to: fixture.expected.partStatus,
        sourceIds: ["note-003"],
        recordedBy: technicianId,
        occurredAt: null,
        details:
          "Replacement proposed; order unconfirmed; part number unknown.",
      },
      {
        id: "return-proposal",
        jobId,
        workflow: "visit",
        from: "not_proposed",
        to: fixture.expected.visitStatus,
        sourceIds: ["note-003"],
        recordedBy: technicianId,
        occurredAt: null,
        details: "Within one week; no appointment confirmed.",
      },
    ],
    conflicts: [],
  });
}
