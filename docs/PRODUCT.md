# Product specification - V0

## Position

Tagwire captures and organizes technician-provided evidence during HVAC service calls. The differentiator to test is low-friction and eventually hands-free capture, not another generic AI service report.

## Users

Initial user: one HVAC technician performing residential equipment service. Future buyer hypothesis: small contractor/service manager; unvalidated.

## Golden path

1. Start a job with a pseudonymous customer label and optional equipment type.
2. Capture equipment nameplate photo; suggest model and serial, require review.
3. Record a spoken observation, attach test method and timestamp.
4. Capture before/after evidence and record a technician diagnosis separately.
5. Record what was communicated to the customer and their response.
6. Record distinct part and return-visit states.
7. Draft a source-linked report, review edits, approve, then export.

## V0 scope

Single technician, single device, one job at a time for the first milestone. Phone-first capture. Locally durable evidence. Optional local-machine inference. No real customer integrations.

## Not in V0

Automated diagnosis, live work-order integrations, parts ordering, scheduling, always-on voice activation, video streaming, smart-glasses support, fleet management, fine-tuning, multi-tenant cloud.

## Testable value

Time a complete case from first capture to approved report; count taps, typing, corrections, omissions, and failed captures. Compare with a technician's current process. A prototype success does not establish market demand.
