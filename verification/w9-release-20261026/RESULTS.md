# W9 integrated release verification

Closure assembled on 28 October 2026 (Africa/Cairo). Execution evidence was recorded on 26 October; timestamps have not been backfilled.

**Offline engineering verification: COMPLETE / PASS_OFFLINE_ENGINEERING_ONLY; separate closure review passed. Operational release / Phase 4 activation: BLOCKED.** W9 cannot truthfully be marked as an unrestricted launch pass while its W0-W8 dependencies remain open.

## Demonstrated results

- All 340 enumerated tests passed; zero failures, skipped, cancelled or TODO tests. The legacy npm script omits newer suites; the release command enumerates every app/*.test.mjs.
- 1,000 generated cases, seed 20261023, passed across 40 category/variant/cost cells with 1,000 distinct material inputs. The independent reviewer checked integer tick arithmetic and replay/funding evidence. Cases test invariants, not profitable parameters.
- Three isolated production-interface session scenarios passed across four ledgers, including successful entry/exit, rejection, no fill, blocked exit, restart, and pending reconciliation. Synthetic market clocks and actual invocation clocks remain labeled separately. These are not three observed exchange sessions.
- Provider outage, corrupt/omitted receipts and a hanging local provider stub preserve visible exposure and explicit incomplete status. Real source availability and provider model uptime are not established by injected failures.
- Crash, late wake, permission denial, model-adapter timeout, lost-owner fencing, report destination failure and session clock cases are mapped in REQUIREMENT-MATRIX.md. Sleep is simulated, not a physical-host endurance test.
- Independent baseline restore verified 3,304 files (1,004,411,857 bytes), four SQLite stores, and 37 original tables / 267,353 original rows after migration. Original column contents were unchanged.
- Code/config rollback retained eight newer ledger events and evidence. Matching older execution code replayed; mismatched release was rejected. This proves read-only archived replay only. Older clients/evaluators are not approved for operational use.

## Repairs made during W9

Registered v5 holdings and pending obligations now survive unrelated legacy failures. Ambiguous identity is an explicit critical gap with exposure retained. Checkpoints persist in SQLite before external delivery; throwing/hanging sinks and obstructed report directories finalize truthfully. Production budgets reserve time for reporting. Observation-only minute collection avoids the old paper config, validates retained captures and rejects wrong exchange, omitted names, stale timestamps and duplicate/off-grid minutes. User interventions remain identifiable and excluded from policy comparisons.

The execution release and frozen investment policy were preserved. Evaluation behavior changed intentionally; regenerated reports require the new evaluation release. Source and exact byte hashes are in source-manifest.json. Original W7/W8 evidence was not rewritten.

## Requirement and audit closure

REQUIREMENT-MATRIX.md and requirement-matrix.json map all 18 frozen mandatory groups, six semantic contracts, fault cases and launch exclusions to evidence. AUDIT-CLOSURE.md disposes all 14 original findings with implementation, evidence and residual limitations. Initial failed/reduced-coverage attempts remain saved; full-suite-3, generated-1000-expanded and final-sessions-1 are authoritative corrected runs. Earlier generated runs are superseded for coverage, not erased.

## Reproduction

source-release.zip contains exact source and required frozen test resources. source-manifest.json lists every byte hash; reconstruction-files.json verifies extraction. The reconstructed source suite is run separately and saved under reconstructed-suite-4 (340 tests required). Use Node 24.22.1 and the pinned lock with installed dependencies. From reconstructed-source-4 run `node app/v5-release-agent.mjs tests ../reconstructed-suite-NEW`, and use `generated` / `sessions` with distinct new isolated output directories to regenerate those scenarios. The archive omits production databases and credentials. It includes an explicitly labeled empty synthetic SQLite file and empty evidence directories for containment guard tests. The first three reconstruction attempts exposed missing package resources/directories; their failures and manifests remain saved. Reconstruct into a new directory with `python reconstruct-release.py NEW_DIRECTORY`, then run the release command. This is same-host reproduction: node_modules is not vendored and the approved comparison amendment contains its original absolute document path. Cross-host hermetic reproduction is not claimed.

## Scope and remaining launch gates

Schedules remain paused and no pilot or real trade is authorized. Applicable source permissions and official rules (W1), current universe/action/data admission (W3), actual client comprehension (W8), and separately authorized two-session observed rehearsal (W10) remain blocked. The approved five-stock buy-and-hold comparator lacks integrated runtime/entitlements and same-period observations; economic comparisons remain blocked. Further cohorts and real capital need separate authorization and evidence.

The separate reviewer is an AI subagent with access to the same repository, not a human consultancy or independent organization. Its scope and unresolved objections must be read with closure-review/FINAL-REVIEW.md. Software test success establishes tested behavior, not a predictive edge, acceptable FULL risk, or real-market fill accuracy.

Final separate review: closure-review/FINAL-REVIEW.md confirms the offline scope and retains all operational blockers. RELEASE-GATE.json is the machine-readable disposition. verification-evidence.zip and evidence-manifest.json preserve canonical logs and isolated ledgers without the large restored production copies.
