# Incremental dispatcher — operating contract

Installed 24 October 2026. Manual engineering capability only. Scheduled reviews remain paused; no paper pilot or real orders are activated by this release. This replaces the sequential refresh chain, not the analytical or investment policy.

## Entry points

Use the installed Node 24 executable (shown as `node` below).

```text
node app/workflow-agent.mjs plan baseline
node app/workflow-agent.mjs plan screen
node app/workflow-agent.mjs plan checkpoint
node app/workflow-agent.mjs status
node app/workflow-agent.mjs run baseline
node app/workflow-agent.mjs run screen
node app/workflow-agent.mjs run checkpoint --planned-at=2026-10-26T08:00:00Z
```

`plan` reads compact retained inputs without collectors, migrations, decisions or ledger writes. `run` performs the named workload and may write observations, monitoring notes, research queue transitions, numeric screens and evidence receipts. It does not create orders, fill orders or settle exits. Supplying an earlier planned time records lateness; it never creates historical observations. Future planned timestamps are rejected. `refresh-market.mjs` is now a compatibility entry point for `run baseline`; do not follow it with a second complete refresh.

| Workload | Target / deadline | Work |
|---|---|---|
| baseline | 25 / 30 minutes | Mandatory obligations first, then due catalog, facts, relevant sources and history, numeric screening and field manifest |
| screen | 2 / 5 minutes | Retained-data obligations and numeric screening; external refresh work is explicitly deferred |
| checkpoint | 5 / 8 minutes | Health, positions, all recorded-decision obligations, existing queue, minute observations and due relevant sources/history |

Targets are configured engineering limits, not demonstrated live-session performance. At deadline the report preserves unfinished work and actual times. Node timers cannot promise on-time delivery while the PC sleeps or a synchronous operation stalls. Those cases must report lateness. A blocked prerequisite never becomes successful just to meet the deadline.

The dispatcher does not invoke an LLM. Model, provider and token usage are null/unmeasured. There is no token cap and no permission to weaken research. Analysts still inspect substantive evidence for selected or changed theses; a numerical match or completed checkpoint grants no Watch or entry approval.

## State, receipts and source cadence

- Sidecar: `data/operations/workflow.sqlite`. Original market and experiment databases retain their own identities.
- Reports: `data/operations/workflow-reports/<run-id>.json`, checkpointed after stages; the Operations API exposes the saved current progress.
- Inputs, results and full child logs: `data/operations/workflow-artifacts/`. Full histories and source bodies remain in their existing archives.
- Each job is keyed by kind, target and evidence revision. A successful receipt is reused after restart. Separate sources retain separate results; a failed source does not discard other completed components.
- Health runs once per invocation. Position checks repeat within the invocation only if ledger/journal exposure changes. Source replanning does not repeat unchanged health checks.
- Catalog refresh is weekly/Sunday; a separate local catalog-import applies its version. Official identity/action-triggered refresh remains a W3 integration dependency; the dispatcher does not infer a listing change from an ambiguous headline.
- Facts use completed Cairo-date component receipts; omitted names have targeted reconciliation. Missing members remain gaps even when a scan itself completed. No fake fundamental values are substituted.
- History follows the shared confirmed-session freshness contract. Unavailable baseline charts retry on Sunday; held names, candidates and recorded decisions remain visible as critical or relevant obligations, with explicit backoff.
- Public exchange feed checks use overlapping day windows and a 30-minute freshness bucket. Every retained page must satisfy the cutoff. Completed pagination is requested-category coverage, not complete news/action clearance.
- Cited document routes are inventoried once per changed report, fetched only when their own next-check is due, and versioned by content hash. Changed content reopens affected decision review even when scores are unchanged. Unmapped events remain visible; association is not issuer/event clearance.
- Minute targets come from actual holdings, journal positions, pending exits, valid unexpired entries/setups and active research candidates. The old six-stock setup list is not a universe. Captures are observation-only, preserve the chart checkpoint and report stale/invalid evidence. They never imply execution.

All recorded decisions, including Wait, Avoid and superseded records, appear in each obligation inventory. Identical completed checks may reuse their receipt, while new dates/prices/content create a new revision. New thesis content requests independent reassessment. Unstructured historical review conditions are displayed for human/analyst interpretation; the dispatcher does not claim to have evaluated them semantically.

## Sources and permissions

External adapters read `agent/source-access.json`. Missing/unresolved/expired permission blocks that adapter before spawning a collector, while independent local obligations continue. No approval file was created by this batch. The required structure per source (`tradingview`, `egx-exchange`, `issuer-documents`) is:

```json
{
  "status": "approved",
  "purpose": "personal-automated-analysis",
  "evidencePath": "path/to/reviewed-applicable-permission-record.md",
  "effectiveAt": "actual ISO timestamp",
  "expiresAt": "actual ISO timestamp",
  "allowedHosts": ["exact-document-host-if-applicable"]
}
```

This is a configuration schema, not permission evidence or a suggested approval. The referenced record must exist and actually cover the adapter/use. Document permissions cover every selected hostname. W1 still requires substantive rights/capability review. Do not bypass this control by calling collectors directly. An exit code of zero is checked against component receipts/coverage; it is not sufficient proof of valid data.

## Ownership, waiting and recovery

Running resource claims are exclusive. Every child PID is recorded. No expiry automatically steals an owner; a hung child remains visible until verified stopped and explicitly recovered. Successful receipts are never cleared by recovery.

```text
node app/workflow-agent.mjs recover JOB_ID recovery.json
node app/workflow-agent.mjs recover-run RUN_ID recovery.json
```

Both records require `owner` exactly as recorded, `actor` and a concrete `reason`. The CLI checks that the owner/child processes are dead. Run recovery marks an orphan run interrupted; its owned jobs still require their own recovery. A completed/partial run with a retained running job needs job recovery, not a new owner takeover.

```text
node app/workflow-agent.mjs recover-lock library recovery.json
node app/workflow-agent.mjs recover-lock exchange recovery.json
node app/workflow-agent.mjs recover-lock library-inventory recovery.json
```

Lock records require exact `token`, `actor`, `reason`; only the named lock is removed after its PID is verified dead. Chart restoration has its existing separate recovery protocol. PID reuse is conservatively treated as alive; do not kill an unrelated process to unlock a claim.

Unsuccessful source jobs back off across revisions, including new news windows. Three consecutive scope failures are marked persistent. `invalidate-retry JOB_ID record.json` requires `actor`, `reason` and `evidenceId` for independently observed new evidence. It cannot clear a running owner or a completed receipt.

```text
node app/scout-handoff.mjs claim QUEUE_ID ANALYST_OWNER
node app/scout-handoff.mjs wait QUEUE_ID wait.json
node app/scout-handoff.mjs recover QUEUE_ID recovery.json
```

Claim returns a token; retain it. An owner can voluntarily wait with `actor`, `token`, `reason` and either `resumeAt` or `eventFingerprint`. Waiting states are `waiting_event`, `retry_not_due`, `waiting_capacity`. They retain evidence without consuming the five active handoff slots. Due existing waits resume before new candidates, within the same cap. A pending research claim has a 24-hour lease; explicit recovery requires `actor`, `reason`, exact `previousOwner`, `abandonedConfirmed:true` and an expired lease. An expiry alone is not evidence of abandonment. Legacy claims use the explicit owner name `legacy-unrecorded-owner` after inspection. Final decisions remain a separate independent review.

## Remaining release gates

This component does not implement the new v5 signal/risk/execution engine, certify source rights, clear official corporate actions, settle exits, prove model reasoning quality, or prove latency on a real exchange session. Complete the applicable W1/W3/W5–W10 gates before prospective activation. Four paused automations stay paused until separately authorized. Original policies, forecasts and the closed experiment must remain unchanged.
