# Independent fix verification

Actor `/root/w7_independent_review`; actual verification completed 2026-10-25T23:04:44Z. This is a separate AI review, not independent-human or provider-attested model validation.

Read the changed fixed-exit/provenance implementation and affected regression source, then independently executed `node --test app/v5-w7.test.mjs`: **19 tests, 19 passed, zero failed/skipped**, 6.625 seconds reported duration. Full output: `w7-regression-19.txt`.

The two initial fixed-exit findings are resolved by guards plus regressions: supplements cannot introduce evidence asymmetrically where original exposure/pending orders exist, and wrapper options cannot replace audited inputs. The wrapper regression also verifies unchanged ledger bytes. The initial failing reproduction remains retained separately.

The later accepted-intent regression now demonstrates the key funded-cash requirement: original sale proceeds settle and fund a later accepted desired cash budget of EGP100,000; after suppressing that sale, the counterfactual retains the first holding and reduces the second order quantity while retaining the original budget ceiling. Available cash stays nonnegative and no new approval is inferred. Mandatory stops, action holds, missing marks, original approval tampering and both base/stress no-exit economics are covered.

Statistical provenance findings are resolved in the reviewed version: baseline must precede all recorded activity and the entry window; the full reported day set must match the union of admitted rule-book session days, including after entries stop; the evaluation release must match the frozen trial. Regression coverage includes late baseline, omitted entry day, omitted later day and changed evaluator digest. Scope remains SOURCE_BOUND_ENGINEERING and cannot produce a prospective superiority claim.

Limitations remain: engineering/synthetic evidence is not operational readiness or market-data authenticity. Test success does not establish the economic value of the discretionary exits. Future implementation edits after this verification require the corresponding version-bound review/checks.
