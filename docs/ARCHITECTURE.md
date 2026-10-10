# Architecture - proposed V0

## Runtime

Phone browser -> Next.js app -> local durable capture -> optional sync to trusted workstation -> processing -> review -> report.

Browser offline storage (IndexedDB) is the initial capture queue; browser storage is not guaranteed permanent. Provide storage quota/error feedback and explicit export or backup before treating a job as safely retained. Do not assume background sync or locked-screen audio capture will work across browsers.

The workstation may run Ollama and local speech-to-text. The phone must not directly expose Ollama on a public network. Any cross-device endpoint requires authentication, HTTPS or a secured authenticated tunnel, request size limits, and explicit media retention controls. LAN HTTP is not sufficient for reliable mobile media permissions.

## Components

- src/app: mobile-first UX, capture status and review routes.
- src/lib/capture: abstract capture device and browser implementation.
- src/lib/evidence: validated source and claim schemas, persistence interfaces.
- src/lib/inference: replaceable transcription and model adapters; no authority to mutate source evidence.
- src/lib/report: deterministic projection from approved claims, export adapters.

Directories are targets, not proof of implementation. Do not install extra packages until the feature needs them.

## Data lifecycle

1. Persist original media locally and acknowledge only after success.
2. Append timestamped transcript / human notes as sources.
3. Generate suggestions with model version, prompt/schema version and source references.
4. Validate schema and referential integrity, flag uncertainty/conflicts.
5. Require technician review, retain corrections and report revision.
6. Export with source references and explicit unknowns.

## Safety and privacy

No autonomous maintenance instructions or LOTO decisions. Field capture must respect property-owner consent and applicable workplace rules. Avoid real customer identifiers in tests. No raw customer media in analytics, Git history, or external model calls without informed approval.
