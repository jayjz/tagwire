# V0 acceptance plan

## Golden fixture

fixtures/hvac-001-smith/case.json describes a fictionalized service call. Do not use its absent readings or equipment identifiers as an invitation to fabricate data.

## Mandatory tests

1. Voltage presence can be present while measuredVoltage is null.
2. A numeric zero is preserved and never collapsed to null.
3. Present/absent/unknown are representable independently from magnitude.
4. Model and serial remain absent unless evidence supports them.
5. A technician diagnosis does not become an instrument fact.
6. Customer agreement does not imply part ordered or visit scheduled.
7. Broken source references and contradictory claims fail validation or require review.
8. Failed offline writes are displayed as failed; no false save confirmation.
9. A report cannot be approved by inference code.
10. Approved report contains only reviewed claims, clearly labeled unknowns and source references.

## Field usability gates

Run one end-to-end simulated call; measure completion time, corrections, taps and capture failures. Browser mic/camera, network loss, page reload and failed model availability must be exercised on the target phone before claiming field readiness.
