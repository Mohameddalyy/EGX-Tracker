# First implementation batch — verified engineering changes

Date: 24 October 2026. Scope: the first implementation batch in the audit remediation plan. Status: **engineering fixes implemented and regression-tested; Phase 4 remains NOT READY.** This is not activation, market research or evidence of trading performance.

## Changes and acceptance evidence

| Work | Implemented behavior | Evidence / remaining boundary |
|---|---|---|
| W0.1–0.2 baseline | Local source baseline commit `6a39953`; source/data archive, consistent SQLite snapshots and isolated restore; dependency supplement includes relay/connector | 3,304 primary files and four databases verified; 16,589 dependency files hash-verified. Restored original suite: 132 passed, zero failed. This is a same-machine restore, not an independent-machine disaster-recovery test. |
| W2.1–2.3 evidence admission | Current contract is mandatory for new promotion; unknown/empty claim families rejected; conditional inputs derived from declared value/quality claims even when omitted from supplied field lists; stale verification/coverage rejected | Original failure paths and positive cases covered in full promotion tests. Legacy reports remain historical. Contract validation cannot itself prove the source assertion or catch a dishonest thesis label; independent substantive review remains required. |
| W2.4–2.5 missing data / financial reconciliation | Optional gaps remain possible; required gaps block dependent approval. Reconciliation distinguishes PASSED, PARTIAL, NOT_EVALUABLE and FAILED; sourced subsets are not described as complete accounts | Revenue-only fixture returns NOT_EVALUABLE and consistent=false. Existing stored facts are displayed with recomputed coverage without rewriting original records. Stable runtime dictionary matches the frozen Phase 2 resource. |
| W3.1–3.2 readiness / capture provenance | Screening, preparation, promotion and paper proposals use shared history readiness. An updated stock capture cannot certify an untouched older daily tail; bar rows remain retained | Retained 296-stock check at the audit's historical cutoff has zero screening/readiness mismatches. SUCE is excluded for a missing expected session. Partial recapture fixture preserves all 160 bars and flags its untouched tail. Provider-session metadata remains preparation evidence, not an independently certified exchange calendar. |
| W3.3 event associations | Unambiguous retained ISIN associations reach stock research; conflicting/shared identities enter review quarantine; raw index preserved | All 23 recoverable notices across 11 tickers now reach selected contexts, out of 980 retained record versions. Association is explicitly unreviewed and grants no trading or corporate-action clearance. |
| W4.4 bounded queue | Existing unfinished work no longer prevents filling unused handoff capacity; owners retained, duplicates excluded, maximum five unfinished | Integration fixture starts with two unfinished claims, adds three, preserves existing owner and enqueues zero duplicates on repetition. Waiting-event states and complete resumable orchestration remain later W4 work. |
| W4.8 timing | Screen stages report measured durations; refresh checkpoints stage completion/failure and reuse to timing sidecars; token usage stays null when unmeasured | Fixture verifies successful, failed and reused stages. No live collector run or end-to-end latency SLA is claimed. Single offline samples: 296-stock numerical screen ~692 ms and retained event-context routing ~12 ms, excluding database loading, collection and analyst work. |
| W1 requirements | Permission/capability register and precise inquiry specification prepared | See SOURCE-ACCESS.md. Applicable data-use permission and effective exchange/broker rules remain unresolved external release gates; no outreach or purchase performed. |

Routing reconciliation also exposes seven identity-conflict records for review and 347 still-unmapped records. These are retained gaps, not silently cleared events. The dashboard's last importer remains `completed_with_errors`; this batch does not relabel or retry that historical collection.

### Evidence contract change

`egx-field-evidence-2` uses an explicit approval coverage cutoff with a maximum age of 30 minutes. This is a new verification guard, not a frozen strategy parameter, feed latency guarantee or requirement to redownload every source every 30 minutes. Each verified field records its actual check; event clearance and conditional financial inputs also record coverage through the cutoff. Old financial reporting periods remain usable when applicability and subsequent updates have actually been checked. Never refresh a timestamp without checking. Any existing report needing new approval must be reassessed under the new contract, not silently migrated.

### Tests and preservation

- Current regression suite: **144 passed, zero failed** (`full-tests-final.log`). Twelve added tests cover the audit failures, valid promotion, optional omission, temporal checks, retained-tail provenance, mapping conflicts, queue capacity and stage telemetry.
- Isolated restored original suite: **132 passed, zero failed** (`restored-baseline-tests-fixed.log`). The initial restore test exposed omitted relay/connector dependencies; adding a hashed supplement resolved both failures. The first supplement extraction hit Windows path-length limits; extended-length paths resolved it. Failed logs remain available.
- Seven original investment policies, all nine audited Phase 3 source files and original paper ledger digest are unchanged. Four automations remain PAUSED. Old experiment still has zero orders and zero fills. `retained-verification.json` contains the actual check, cutoff and routing cases.
- No market collection, new analyst decisions, paper entries, real trades or financial-policy amendments were performed. Dashboard reload verification is recorded separately in `runtime-smoke.json`.

## Recovery instructions

Archive location: `data/backups/remediation-batch1-20261024-verified/`. Use both `baseline.zip` and `dependencies.zip`, their SHA-256 manifests, and the verified `restore/` directory. Do not use the earlier incomplete folder without the `-verified` suffix. SQLite files were backed up through the online backup API, with integrity and table-count checks. Each database is consistent individually; the four snapshots are not one atomic cross-database transaction.

Restore into a separate directory using Windows extended-length paths, verify every manifest hash and database integrity, then run the restored package's test command under the recorded Node 24 runtime. Original data belongs to the pre-change baseline; do not overwrite a newer live ledger as an ordinary code rollback. The supplemental dependency archive excludes `.env` files, nested Git metadata and logs; this is not a credentials recovery mechanism. No remote push or cloud backup was made.

## What is still open

This batch closes the reproduced implementation defects within its stated boundaries. It does **not** close all W3 work or certify the full M1 milestone: effective-dated identity/action rules, historical universe and source vintages, complete event coverage and approved data-use basis remain open. W0 still needs broader release/migration practice. W4 still needs the complete incremental, resumable orchestrator, event invalidation, bounded deadlines and realistic capacity tests. W5–W11 retain the v5 signal/risk/execution engine, complete lifecycle, analytical validation, interface acceptance and explicit activation gates.

Next engineering batch: complete W4 orchestration against this repaired contract, then the frozen v5 engine and lifecycle. Keep external permission/rule-bundle work visible. No amount of passing unit tests replaces actual-session rehearsal or prospective economic evidence.
