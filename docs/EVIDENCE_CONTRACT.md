# Evidence contract - version 0.1

This is the conceptual contract; implementation schemas and tests must conform. Schema design should keep raw source records distinct from derived assertions.

## Source evidence

Each source has stable id, job id, source kind (audio, photo, manual entry), creation timestamp, content reference and capture status. Preserve original content and subsequent corrections as distinct revisions. Do not place sensitive media in Git.

## Claim

Each structured claim has id, job id, field, value, sourceIds, attribution (technician, instrument reading reported by technician, model suggestion), review status and optional uncertainty or conflict marker. Model suggestions cannot claim to be instrument-verified.

## Electrical test

- component: identified equipment component or unknown
- instrument: multimeter, other, unknown
- voltagePresence: present, absent, unknown
- measuredVoltage: nullable finite nonnegative numeric value
- unit: VAC, VDC, unknown
- measurementPoints: optional technician-provided text
- sourceIds: one or more existing sources

No reading amount is inferred from voltagePresence. Zero is a real value and not a missing value. An explicit zero reading alone does not automatically prove lack of supply without measurement context. Presence and magnitude conflicts are flagged for human review, never silently corrected.

## Distinct workflow states

- customer response: unknown, agreed_to_plan, declined, deferred
- part: not_assessed, proposed, approved, ordered, received, installed
- visit: not_proposed, proposed, scheduled, completed, cancelled
- report: draft, reviewed, approved, exported

Customer agreement is not proof of an order or appointment. A planned action is not a completed action. Future implementation may add transitions, but must not silently skip authorizations.

## Invariants

1. Missing model/serial/voltage values remain null or unknown.
2. Every derived field references original evidence; references resolve to the same job.
3. Preserve reported evidence separately from technician diagnosis and model inference.
4. No invented numeric measurements, equipment identifiers, purchase events or booking events.
5. Conflicts trigger review; automation does not pick a convenient version.
6. Report approval requires a technician action and preserves the approved revision.
7. Original evidence is never overwritten by AI or edited reports.
