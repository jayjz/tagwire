# Milestones and handoffs

Status: planning only. Each step should be a scoped PR with tests and observed results.

## M0 - contracts and tests

Implement evidence schema/types, validation, golden fixture tests and job state transitions. No LLM, UI redesign or external service. Exit: all acceptance data invariants tested.

## M1 - durable capture

Mobile camera/audio/manual capture and IndexedDB queue, clear save/failure states. Exit: local evidence survives page reload and simulated network interruption on a target device.

## M2 - suggestions

Integrate one transcription and one extraction path behind adapters; reviewed suggestions retain source ids and unknowns. Exit: golden fixture extraction passes independently reviewed tests.

## M3 - report

Technician review, revision, approval, export and part/return status. Exit: complete Miss Smith call with no invented data.

## M4 - hands-free experiment

Compare voice/physical capture controls with ordinary phone interaction in constrained scenarios. Exit: measured interaction savings, reliability and failure log.

## M5 - model experiment (conditional)

Benchmark baseline against held-out calls; evaluate an Unsloth LoRA only on repeated, quantified errors. Exit: decision recorded including negative results.

## Definition of done per PR

Tests, lint, typecheck/build where available; no secret leaks or media fixtures containing real customer data; docs updated for changed contracts; known limitations stated. Avoid broad cleanup while implementing a milestone.
