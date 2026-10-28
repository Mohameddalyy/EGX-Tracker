import json
from pathlib import Path
r=Path.cwd();e=r/'verification/w9-release-20261026'
rows=[
(1,'Closed for offline engineering','app/v5/{signals,research,risk,execution,execution-store}.mjs; app/v5-release-sessions.mjs','full-suite-3/result.json; final-sessions-1/result.json','Actual-session activation excluded; integration scenarios use synthetic evidence.'),
(2,'Closed for tested promotion contracts','app/evidence-policy.mjs; app/audit-remediation.test.mjs','full-suite-3/suite.tap; requirement-matrix.json','Collectors cannot authenticate an official source by asserting verified=true; source admission still required.'),
(3,'BLOCKED; collection excluded','app/workflow-adapters.mjs; app/workflow-runner.mjs','final-sessions-1/result.json; retained-verification.json','Automated-source rights and official rule bundle absent. No launch permission implied.'),
(4,'Engineering repaired; actual readiness BLOCKED','app/workflow-{planner,runner,checkpoint}.mjs','full-suite-3/suite.tap; final-sessions-1/result.json','Short fixture timing is not host endurance or actual-session throughput. W10 rehearsal required.'),
(5,'Routing repaired; current event admission BLOCKED','app/exchange-evidence.mjs; app/workflow-v5.mjs','retained-verification.json; full-suite-3/suite.tap','Historical 23 notices/11 tickers recovered; unresolved identities stay visible and quarantined. Current event-through coverage required.'),
(6,'Closed for tested freshness contracts','app/finality.mjs; app/refresh-selection.mjs; app/evidence-policy.mjs','full-suite-3/suite.tap; requirement-matrix.json','Historical verification cutoff is not current data admission.'),
(7,'Historical alpha capability excluded','app/v5/signals.mjs; app/v5/evaluation-{cohorts,provenance}.mjs','full-suite-3/suite.tap','Merged old history is exploratory; no untouched out-of-sample claim. Prospective vintages remain necessary.'),
(8,'Controlled cases completed; economic inference excluded','app/v5/evaluation-*.mjs; app/v5-w7.test.mjs','../w7-completion-20261026/RESULTS.md; full-suite-3/result.json','Same configured model, separate analyst/reviewer; no model-superiority or trading-edge claim. Five-name comparator runtime still absent.'),
(9,'Closed for tested queue capacity','app/scout-efficient.mjs','full-suite-3/suite.tap; requirement-matrix.json','Preserved claims resumed; available capacity capped at five unfinished handoffs. Actual throughput unproved.'),
(10,'Closed for packaged same-host engineering release','app/contracts/evidence-dictionary.json; package-release.py; source-manifest.json','source-manifest.json; reconstruction-files.json; independent-review/baseline-restore-migration-result.json; rollback-2/result.json','Installed dependencies not vendored; approved amendment retains absolute original path. Old code replay only; no safe operational downgrade claim.'),
(11,'Paper scope retained; live capability excluded','app/v5/{risk,execution,execution-rules}.mjs','generated-1000-expanded.json; final-sessions-1/result.json','FULL discretionary funded risk has no hidden cap. All-or-none exit can remain blocked. No real order connector or live mandate.'),
(12,'Completeness/math contracts repaired; unavailable entitlements excluded','app/analysis.mjs; app/v5/{math,money,evaluation-ledger}.mjs','full-suite-3/suite.tap; requirement-matrix.json','Unavailable dividends/actions/marks remain unavailable; economic comparison blocked until adequate basis.'),
(13,'Interface implemented; human acceptance BLOCKED','app/v5/client-{cards,service}.mjs; app/v5-client.test.mjs','../w8-client-20261026/RESULTS.md; final-sessions-1/result.json','User classified original responses as placeholders. No genuine comprehension pass or waiver recorded.'),
(14,'Timing/checkpoint instrumentation implemented; provider cost unavailable','app/workflow-{runner,checkpoint,worker}.mjs; app/v5-release-agent.mjs','full-suite-3/result.json; final-sessions-1/result.json','No measured live provider token/cost or session endurance. Unavailable is not zero; 18 trial arms retained.')]
lines=['# W9 audit finding dispositions','', 'Closure date: 28 October 2026 (Africa/Cairo). Historical test artifacts retain their actual 26 October timestamps.','', 'Every disposition below is [VERIFIED] as an artifact/code disposition, not proof of prospective trading quality. Original finding severity and evidence remain in ../independent-audit-20261024/AUDIT.md. No original report is rewritten.','', '| Finding | Disposition | Changed implementation / closure files | Evidence | Residual limitation |','|---|---|---|---|---|']
for n,d,f,a,l in rows: lines.append(f'| {n} | {d} | {f} | {a} | {l} |')
lines+=['','Critical/high findings requiring actual source permissions, current admission, human acceptance or economic validation remain open for launch. The released capability is isolated offline verification only. Live collection, prospective comparisons and operational downgrade are explicitly outside this release scope.','', 'W9-specific repairs: preserve registered v5 exposure despite legacy failures or ambiguous identities; retain expired reconciliation obligations; finalize a durable checkpoint even when report delivery fails; reserve reporting time; validate actual minute receipts; keep user-intervened ledgers separate from policy comparisons. See app/v5-release.test.mjs and requirement-matrix.json.']
(e/'AUDIT-CLOSURE.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
(e/'RESULTS.md').write_text('''# W9 integrated release verification

Closure assembled on 28 October 2026 (Africa/Cairo). Execution evidence was recorded on 26 October; timestamps have not been backfilled.

**Offline engineering verification: PASS, subject to final separate closure review. Operational release / Phase 4 activation: BLOCKED.** W9 cannot truthfully be marked as an unrestricted launch pass while its W0-W8 dependencies remain open.

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

source-release.zip contains exact source and required frozen test resources. source-manifest.json lists every byte hash; reconstruction-files.json verifies extraction. The reconstructed source suite is run separately and saved under reconstructed-suite. Use Node 24.22.1 and the pinned lock with installed dependencies. From reconstructed-source run `node app/v5-release-agent.mjs tests ../reconstructed-suite-NEW`, and use `generated` / `sessions` with distinct new isolated output directories to regenerate those scenarios. The archive omits production databases and credentials. This is same-host reproduction: node_modules is not vendored and the approved comparison amendment contains its original absolute document path. Cross-host hermetic reproduction is not claimed.

## Scope and remaining launch gates

Schedules remain paused and no pilot or real trade is authorized. Applicable source permissions and official rules (W1), current universe/action/data admission (W3), actual client comprehension (W8), and separately authorized two-session observed rehearsal (W10) remain blocked. The approved five-stock buy-and-hold comparator lacks integrated runtime/entitlements and same-period observations; economic comparisons remain blocked. Further cohorts and real capital need separate authorization and evidence.

The separate reviewer is an AI subagent with access to the same repository, not a human consultancy or independent organization. Its scope and unresolved objections must be read with closure-review/FINAL-REVIEW.md. Software test success establishes tested behavior, not a predictive edge, acceptable FULL risk, or real-market fill accuracy.
''',encoding='utf8')
print('Closure draft created')
