# EGX alert receiver — deployment on hold for TradingView Basic

Update, 9 October 2026: the user confirmed the free Basic plan, which has no webhooks. Do not deploy this receiver for the current account. The user chose to investigate local monitoring while the PC is on. Preserve this package only as an optional future route if the user changes their plan. See `research/tradingview-plan.json`.

The user chose to prepare cloud deployment and select hosting together. No cloud account, subscription, public endpoint or TradingView webhook has been created. The local dashboard is at `http://127.0.0.1:4317/#intraday`.

## What runs where

TradingView's servers detect configured price/volume conditions. This small Node 24 service receives the webhook, validates a per-rule token and saves a durable receipt immediately. It does not call an AI model, receive broker credentials or place orders. The local tracker uploads only rule IDs, ticker symbols, conditions and token hashes; its portfolio, fills and research stay local. The tracker polls the relay inbox every 10 seconds using a separate admin token. This is a lightweight inbox poll, not market polling or a model invocation.

While the PC is off, cloud receipts remain stored and TradingView can deliver its own phone notifications. Local processing and research resume when the tracker starts. An always-on AI workflow would require a separate hosted research runtime and data/tool access; this package does not silently claim that capability.

## Hosting requirements

Choose a host that runs one continuously available Node 24 process or this Docker image, terminates HTTPS on port 443, and mounts a persistent writable disk at `/data`. Do not deploy this SQLite version to ephemeral/serverless storage or multiple replicas. Keep the service awake during trading; a cold start may exceed TradingView's three-second webhook deadline. Back up the disk with a SQLite-aware backup/snapshot, including WAL consistency. The relay never prunes records automatically.

The root `.dockerignore` and Dockerfile include only this service and its shared validation module, not the user's database, source integrations, reports, credentials or screenshots. From the repository root:

```powershell
docker build -f cloud/alert-relay/Dockerfile -t egx-alert-relay .
```

Set a fresh random `EGX_RELAY_ADMIN_TOKEN` with at least 40 characters in the hosting provider's secret manager. Do not put it in source control, image build arguments, URLs or TradingView. Mount persistent storage and expose the process's internal port 8080 through the host's HTTPS ingress. `/health` is an anonymous readiness probe that reveals no data. For a VPS, the included Compose file binds port 4318 to loopback; place your HTTPS reverse proxy in front of it. The default standalone process binds loopback as well. No development tunnel is installed.

## Connect after selecting and deploying the host

1. In the tracker's **Intraday monitoring → Connect the cloud receiver**, enter the deployed HTTPS origin and its admin token. The local ignored `data/intraday-config.json` stores them. Windows user-file permissions apply; protect your user account and backups. Never paste the token into chat.
2. The tracker registers current rules, then reads the durable inbox. Green **Connected** means relay transport works; it does not establish TradingView alert coverage. Setup instructions expose only the one rule's token, through a protected local POST; general state and event endpoints exclude secrets.
3. Open each rule's **Setup instructions**. Create the matching TradingView alert, use the supplied JSON message and `<relay origin>/webhook`, match its ticker/threshold/direction/expiry, and enable TradingView mobile notifications. Select an appropriate once-per-bar or once-per-bar-close frequency to prevent floods; entry conditions based on daily candles still require daily confirmation. Volume rules refer to the explicitly selected chart interval's volume, not exchange trade count or a full-day RV20 comparison.
4. Confirm TradingView account webhook availability, 2FA and EGX data entitlement. The current connector only creates basic price alerts with `web_hook: null`; it cannot provision these webhook settings. Configure them in TradingView's alert UI. Existing tools have not verified current EGX real-time entitlement. Stored metadata previously reported 900 seconds of delay.
5. Verify one real delivery in TradingView's alert log and this dashboard. Isolated test fixtures are not proof of live TradingView delivery. Stop/target alerts are notifications, not broker stop orders.

## Automatic local research

`start-tracker.ps1` discovers `codex` and supplies its executable path. Enable automatic research in the connection form only when ready. Direct server launch can set `EGX_CODEX_PATH` first. The runner uses `codex exec --sandbox workspace-write`; it inherits the configured model and permissions, without a sandbox bypass or account changes. It passes a fixed trusted prompt containing only a validated local candidate ID, never raw alert instructions.

One agent job runs at a time, waiting for active imports/research to finish. The job delegates a thorough analyst and a separate final decision agent. All approval gates remain in the existing code. Exit status alone is not success: a final recorded decision must exist. A failed/interrupted job remains visible with a local log in `data/intraday-jobs`; it is not retried endlessly. Inspect the candidate and log before manually resuming via the existing Scout workflow. The 22:00 full-market schedule remains unchanged and can resume persisted queues.

The cloud receiver, local tracker and CLI are separate processes. Browser closure does not stop a running tracker server, but shutdown does. Research requires the local tracker, Codex login, needed tools and TradingView Desktop. Queueing an event does not prove research has run.

## Reliability and data meaning

- Webhook acknowledgement follows the SQLite commit and performs no research work. Duplicate retries return the original receipt. An admin-authenticated inbox uses ordered cursors; the local cursor advances only after durable import. A relay instance ID detects storage replacement and resets cursor traversal safely.
- Replay/duplicate event IDs do not create duplicate notifications, fills or candidates. Repeated events during active research share the same candidate. Distinct rules can trigger new reviews after a completed one. Same-rule repetitions after a completed review are retained without repeatedly spending model calls that day.
- Paused, superseded, closed-holding, out-of-order and obsolete entry events cannot become current entry recommendations. Delivery delay and known feed delay remain explicit. Observations over 24 hours old are audit-only; daily decision monitoring still covers every recorded decision.
- Alert quotes never replace daily OHLCV or mark daily bars final. No execution or share quantity is inferred. Holdings remain monitored after setup expiry or watchlist pause, until recorded sell fills close them or the user pauses their receiver rule.
- Failed transport stays visible on the dashboard. Silence alone cannot establish health. Alert renewal, plan changes, expiry, account alert quotas and actual TradingView delivery must be checked at activation and after changes.

Official references checked during implementation: [TradingView webhook configuration](https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/), [server-side alerts](https://www.tradingview.com/support/solutions/43000548327-will-alerts-work-if-tradingview-is-not-open-on-the-computer/), [market data coverage](https://www.tradingview.com/data-coverage/), [Codex non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode).
