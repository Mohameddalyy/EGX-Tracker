# Evening operations protocol

The authoritative target is 22:00 Africa/Cairo, Sunday through Thursday, including daylight-saving changes. The Codex heartbeat wakes hourly to check the local due guard; it does not run research hourly. This avoids depending on an unverified interpretation of the scheduler's time zone. Local PC and Codex must be running. Review the first actual scheduled delivery before claiming reliability.

Use the installed Node 24 executable. Run `app/operations-agent.mjs begin` before research. If `started:false`, do not run the research pipeline. A current owner must not be stolen. For an apparently interrupted owner, inspect active imports, analyst claims and running agents first. Only after proving the owner is stopped, use `finish ID interrupted - "reason"`; retry after the 30-minute cooldown. Stalled means no progress recorded for 30 minutes, not permission to launch a duplicate.

For `started:true`, retain the ID. Late work uses actual timestamps. Catch up only the latest evening slot within 12 hours; never fabricate observations for missed slots. Pulse every major stage with `app/operations-agent.mjs pulse ID "stage and progress"`.

1. Check TradingView health. If disconnected, respect active collector locks, then call `tv_launch` with `kill_existing=false` and check health again. Never kill another importer or change its chart. Record the actual result with `app/operations-agent.mjs check TradingView healthy|failed|unknown "observed evidence"`. A launcher success is not verified chart health and neither is valid market data.
2. Read agent/efficient-market-workflow.md; use its compact plan, bulk refresh and screen commands without dumping full market data into model context. Follow the existing scout/research/decision workflow, saved policies and calendar checks. Resume queues and verify data. Keep every original decision and forecast. Do not reopen the October paper experiment or extend its entry dates.
3. Save an operations report explaining coverage, unfinished queues, decisions, blockers and links to evidence. Mark `finish ID completed REPORT_PATH "summary"` only after required stages finish. Use `blocked` if required stages cannot finish, and `skipped` only for a verified calendar closure, with evidence. Record failure before returning. If interrupted before recording failure, the dashboard shows stalled.
4. Notify only meaningful decisions, changed risks, failures, missed reviews or required action. A wakeup with nothing due stays quiet. No trade is implied by scheduling or chart connectivity.

Dashboard `/api/operations` is read-only except initializing its audit tables. It shows explicit due/actual times, run outcomes and historical source timestamps; it cannot prove the computer will remain awake or all market data is complete.

## Worker continuity amendment — 19 October 2026

After dispatching or resuming analyst/final-decision workers, inspect their actual execution status with `collaboration.list_agents`. A queued or `pending_init` worker is not actively researching. Resume the same worker with `collaboration.followup_task` and verify that it becomes running or returns a completed result; do not create duplicate candidates, steal active claims, or wait indefinitely on an unstarted worker. If execution cannot resume, record the precise blocker and unfinished queue in the operations report. Use the skill's disclosed sequential fallback only when separate delegation is unavailable.

After a device sleep or a large wall-clock gap, the original owner must recheck actual UTC/Africa-Cairo time, importer ownership, saved claims, worker execution status and evidence age before continuing. Preserve actual capture/publication dates and do not describe the prior session's prices as current intraday quotes. Check intervening material news/actions for a proposed Watch. Record observed sleep/resume evidence when available; an app or chart health check alone does not prove that agent work resumed. Do not backfill observations, reopen the expired paper experiment, or change device power settings as part of this check.

This amendment addresses the observed 18–19 October interruption: Windows reported Battery sleep, and later both workers were observed in `pending_init`, explicitly resumed, and verified running. It changes execution verification, not investment gates, risk budgets, model rules, original decisions or forecasts.

