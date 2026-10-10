# M1 evidence foundation

This implementation follows the requested M1 evidence-contract scope. ROADMAP.md originally labels this scope M0 and durable capture M1. Durable capture remains deferred; no capture workflow is shipped here.

## Entry points

- `src/lib/evidence/records.ts`: strict Zod source, authority, electrical, mechanical, diagnosis, communication, part descriptor and conflict schemas, with inferred TypeScript types.
- `src/lib/evidence/service-call.ts`: customer/equipment contracts, aggregate same-job reference validation, append-only additions, and `appendModelProposals` for untrusted extraction output.
- `src/lib/evidence/lifecycle.ts`: explicit job, part and return-visit transitions; `workflowStates` computes current status from validated history.
- `src/lib/evidence/smith-fixture.ts`: curated projection of the unchanged fictional HVAC-001 JSON. This is a deterministic fixture adapter, not an inference implementation.

Use `serviceCallSchema.parse` at data boundaries. Standalone record schemas check structure; resolving sources, authority ancestry, duplicates, workflow history and conflicts requires the aggregate schema. Stable record IDs are application identifiers, not equipment model/serial numbers.

## Evidence and authority

Raw photo/recording/manual records remain distinct from claims and transcripts. Transcripts reference recordings; machine transcripts retain model origin. Source corrections append new records with `supersedesSourceId`; original records and claims remain available. Pending/failed captures may be represented, but cannot support claims before being saved. Unknown historical capture timestamps are explicitly null, including every timestamp in the Smith fixture. No current timestamp is substituted.

Claims distinguish technician entry, report, observation, reported instrument reading, diagnosis, proposed model interpretation and technician confirmation. Model proposals cannot contain human authority at the extraction entry point. Technician claims cannot rely on model-origin source ancestry. Confirmation requires a separate manual record by the confirming technician. Confirmation does not prove independent instrument verification or factual correctness.

Customer/equipment metadata, part descriptors, communications and workflow events also require evidence references. Source IDs must be nonempty, resolve to saved sources in the same call, and cannot be duplicated in a claim. Claims cannot cite another claim as original source evidence.

Voltage presence and magnitude are independent. A performed test may have null magnitude; an explicit zero remains zero. Instrument and unit may remain unknown even for a numeric reading. `measurementStatus` distinguishes performed, not performed and unknown testing; an unperformed test cannot assert measured presence or magnitude. Presence-only evidence never produces a numeric reading.

Contradictory presence/magnitude within a test, differing known voltage readings/presence for a component, and conflicting mechanical values for the same finding require explicit `requires_review` conflict records. Single-record conflicts cite that record; cross-record conflicts cite both. Values are retained unchanged. This comparison is conservative: separate test contexts may explain differences, but a human must review them. Free-text semantic contradictions require explicit human conflict marking; there is no language-based conflict detector.

## Actions remain explicit

Customer response and scoped authorization are independent. An agreement to a plan does not manufacture authorization for a particular repair or purchase. Smith has agreement to the plan, with specific authorization scope unknown.

Part history is `not_assessed -> proposed -> approved -> requested -> ordered -> received -> installed`. The single part descriptor holds a nullable part number; it does not imply a request or order occurred. Return history is `not_proposed -> proposed -> scheduled -> completed`, with cancellation and reproposal supported. Job history starts unknown, with explicit opening, work, follow-up, repair completion, closure and cancellation transitions. No job lifecycle event is invented for Smith.

Each transition records human attribution and source IDs. Ordering requires the preceding approval and request events; scheduling requires a separate sourced transition. History cannot skip steps or claim a different previous state. Smith ends with replacement proposed and return proposed within one week; no order, appointment, part number or repair completion is created.

## Dependencies and verification

Zod was already installed; its [official schema documentation](https://zod.dev/api) informed validation. Vitest 4.0.18 is the only added direct dependency, for deterministic Node unit tests. Its declared peers support the existing Node 20 type definitions and Node 22 runtime; see the [Vitest 4 guide](https://v4.vitest.dev/guide/). Vitest 5 requires newer Node types; newer Vitest 4 resolution also encountered an npm resolver crash. The exact compatible version avoids unrelated dependency upgrades. Existing lockfile entries retain their versions and metadata. React testing packages are unnecessary for these framework-independent tests.

[Dexie](https://dexie.org/docs/) was evaluated as an IndexedDB wrapper for later durable capture. M1 has no persistence calls, so Dexie is not installed.

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`. Existing CI runs these categories already. Tests check structure and invariants, not whether a technician statement is true.

## Limits

This is an in-memory contract foundation for one service call, one part descriptor and one follow-up workflow. It does not authenticate a technician, enforce tamper-proof storage, interpret source text, verify that a source supports a particular statement, capture media, persist offline, finalize reports, order parts or book appointments. Future integrations must keep model output at the model-proposal boundary and establish human identity before accepting technician actions. Report approval and immutable approved revisions remain part of the later report milestone.

Local verification on 2026-10-10: 41 tests passed; lint, typecheck and `git diff --check` passed. `npm run build` failed because Turbopack's CSS loader could not bind a local port (`Operation not permitted`). The same failure reproduced on an isolated copy of untouched commit `ffd21f956b408971c81813e1b4fe3c60591ff3be`, including an escalated attempt. The build remains unverified in this environment; Next.js configuration and application files were not changed to work around it.
