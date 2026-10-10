# Inference and training policy

## Initial approach

Use a swappable adapter for transcription, nameplate vision, and structured field extraction. Begin with manually labeled expected outputs and an untrained baseline. Model support, latency and memory fit on RTX 4060 8 GB must be measured, not assumed. No model weights or prompts should be treated as correctness guarantees.

## Extraction contract

Input: explicit source ids and content; output: proposed fields, referenced source ids, nulls/unknowns, and uncertainty/conflicts. Models must not create purchase events, appointment confirmations, numerical readings, or equipment identifiers absent from sources. Programmatic schema checking detects structure, not factual accuracy.

## Evaluation

Maintain separated training/dev/test cases; split by service-call scenario to avoid template leakage. Score field precision/recall, unsupported factual additions (especially numbers), null/unknown handling, provenance accuracy, correction time, and latency. Include contradictory and noisy cases. Keep golden examples immutable during model comparison.

## Unsloth gate

Do not fine-tune for V0. After the baseline, only propose supervised fine-tuning if repeated errors remain and a labeled dataset is large/varied enough to evaluate generalization. Compare base and tuned model on the same held-out suite. Pretraining from scratch is not planned.
