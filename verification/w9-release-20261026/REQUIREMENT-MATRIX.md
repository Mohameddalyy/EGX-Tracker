# W9 requirement and evidence map

All statuses below concern offline engineering. Launch is BLOCKED; a synthetic fixture does not satisfy an actual-session requirement. Full exact test names and modules are in requirement-matrix.json.

| Frozen test group | Current tests | Status |
|---|---:|---|
| Identity/catalog | 3 mapped assertions | PASS_ENGINEERING |
| Sessions/finality | 4 mapped assertions | PASS_ENGINEERING |
| Missing data | 3 mapped assertions | PASS_ENGINEERING |
| Signal math | 4 mapped assertions | PASS_ENGINEERING |
| Event timing | 4 mapped assertions | PASS_ENGINEERING |
| Critical/optional | 3 mapped assertions | PASS_ENGINEERING |
| Price/cost | 3 mapped assertions | PASS_ENGINEERING |
| Cash/settlement | 3 mapped assertions | PASS_ENGINEERING |
| Delayed fills | 4 mapped assertions | PASS_ENGINEERING |
| Liquidity/exits | 3 mapped assertions | PASS_ENGINEERING |
| Risk discretion | 3 mapped assertions | PASS_ENGINEERING |
| Overrides | 3 mapped assertions | PASS_ENGINEERING |
| Portfolio risk | 3 mapped assertions | PASS_ENGINEERING |
| Lifecycle | 4 mapped assertions | PASS_ENGINEERING |
| Deadline | 5 mapped assertions | PASS_ENGINEERING |
| Coverage | 4 mapped assertions | PASS_ENGINEERING |
| Isolation | 3 mapped assertions | PASS_ENGINEERING |
| Accounting | 5 mapped assertions | PASS_ENGINEERING |

## Additional semantic contracts

- TP13-1: reconciliation window — passing tests mapped.
- TP13-2: own/other reservation, revalidation and cancellation — passing tests mapped.
- TP13-3: cash versus loss budget — passing tests mapped.
- TP13-4: B0/B1/B2/FULL authority — passing tests mapped.
- TP13-5: risk exit versus mandatory exit — passing tests mapped.
- TP13-6: semantic validation beyond schema — passing tests mapped.

## Faults and limits

| Fault | Evidence | Limit |
|---|---|---|
| process crash | final-sessions-1/sessions/crash-recovery.json | Real child killed before transaction commit and after committed event; replay/idempotency asserted |
| PC sleep/late wake | full-suite-3/suite.tap | Clock-jump test plus missed/stalled operations tests; simulated sleep, not a physical host endurance claim |
| missing permission | final-sessions-1/sessions/session-2-outage-blocked-exit/dispatcher-result.json | Production adapter denied source and launched no collector |
| model timeout | full-suite-3/suite.tap | Hung deep-review adapter/cancellation contract; actual provider availability remains unverified |
| corrupt/partial/provider outage | final-sessions-1/sessions/session-2-outage-blocked-exit-dispatcher/w9-faults/fault-results.json | Real production process adapter with deliberately local provider stub; retained holdings, explicit failure |
| lost collector owner | full-suite-3/suite.tap | Exact-owner recovery and live-child fencing; no TTL takeover |
| report destination | full-suite-3/suite.tap | Actual CLI obstructed directory, throwing sink and hanging sink; durable SQLite fallback |
| clock/session mismatch | full-suite-3/suite.tap | Off-session/DST/midnight and client earlier-than-ledger negative; actual versus labeled synthetic clocks retained |

## Launch prerequisites retained

- **L1 BLOCKED** — Applicable automated-source permissions and verified official sessions/rules/settlement bundle. agent/source-access.json absent; W1 source approval must not be inferred from connection success.
- **L2 BLOCKED** — Current W3 full-universe identity/event/action/data admission and monitoring readiness. Retained historical verification is not current-session admission.
- **L3 BLOCKED** — W8 genuine client comprehension acceptance or separately approved protocol amendment. verification/w8-client-20261026/RESULTS.md; placeholder answers explicitly excluded.
- **L4 BLOCKED** — Separate authorization and two actual verified no-order sessions meeting frozen coverage/timing/throughput gates. No schedules resumed; synthetic session equivalents cannot satisfy W10.1.
- **L5 BLOCKED_FOR_ECONOMIC_COMPARISON** — Approved attainable five-name basket runtime/entitlements and same-period observations before economic comparison. W7 approved amendment is specified, not an operational basket. This W9 scope admits no prospective economic comparison; no waiver or deletion of the mandate.
- **L6 NOT_AUTHORIZED** — Separately authorized five-session pilot, later cohorts, and independent live-capital gates. Engineering run cannot activate any of these.
