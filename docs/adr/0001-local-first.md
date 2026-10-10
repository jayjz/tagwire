# ADR 0001 - local-first, evidence-first V0

Status: accepted for prototype design, not production validation.
Date: 2026-10-10

## Decision

Use a mobile-first Next.js capture interface and locally durable source records. AI is an optional, replaceable interpreter. Store raw evidence separately from structured assertions. Require human review before finalized report output.

## Reason

A solo developer needs a bounded workflow that operates without reliable job-site connectivity. The business hypothesis is reduced technician interaction burden, not autonomous diagnostics.

## Consequences

Offline storage and synchronization introduce failure modes. Browser media access may vary by platform. A workstation-dependent inference service is a lab setup, not a deployable field architecture. These limitations must be measured before wearable integration.

## Revisit when

Field trials establish capture reliability, repeatable time savings, and identifiable hardware requirements.
