# v5 signal and research runtime

Installed by remediation batch 3, 24 October 2026. Version `v5-signal-research-1.0`. This is a manually callable numerical/research component; scheduled reviews remain paused. It has no order, fill, reservation or risk-certificate acceptance path.

## Version boundary

`app/v5/plan.json` and `decision-schema.json` are byte-identical runtime copies of the frozen Phase 3 artifacts. `contract.mjs` checks their pinned SHA-256 values before use. Historical modules and their median-based RV20 remain unchanged. Never mix historical indicator values into a v5 calculation without recomputing the versioned features.

Current capability is **daily trend-confirmation**. Early-warning predictive lead time and profitable edge are untested. Correlated momentum conditions are one related explanatory family; screen conditions and qualitative confidence are not calibrated probabilities.

## Manual interfaces

Use installed Node 24, shown as `node` below. Every artifact output path must be new; commands never overwrite a saved evaluation/review.

```text
node app/v5-agent.mjs status
node app/v5-agent.mjs evaluate INPUT.json EVALUATION.json
node app/v5-agent.mjs packet EVALUATION.json ISIN FULL EVIDENCE.json PACKET.json
node app/v5-agent.mjs review PACKET.json REVIEW.json DISPOSITION.json
```

The CLI returns a compact summary and artifact hash; full evidence stays in files. `review` uses actual wall-clock time. A historical fixture cannot be presented as a current approval by refreshing its timestamp. Automated comparisons, model calls and production data admission are separate dependencies. The immutable fixtures in `verification/remediation-batch3-20261024/fixtures-final/` show the exact input structures; they are explicitly synthetic, not genuine research.

## Data admission

Input version is `v5-signal-input-1`. Supply the full accounted-for universe, cutoff, signal day, verified session calendar, dated hashed source records, EGX30 history and individual instrument series. `universeComplete` is a supplied admission assertion, not something the parser independently certifies. W3 still must produce an authoritative prospective manifest.

- Each source has an ID, SHA-256 and actual availability timestamp. Every relied-on source must be available by the cutoff.
- Calendar rows contain ordered days, verified close timestamps and source IDs. A missing calendar retains per-name/per-variant blocked records rather than claiming no opportunities.
- Instruments carry ticker, ISIN, native currency, kind, exchange, verified tradability, effective dates, source and sector. Research also needs an explicit sourced `companyModel` (`bank`, `property` or `industrial`). A broad provider sector named Finance cannot silently choose bank or industrial accounting. Other company models need an explicit extension before Watch, not guessed ratios.
- Tick rules contain effective dates, source and contiguous bands `{from,to,tick}` on zero-origin decimal grids. `to:null` is the open upper band. Unknown/invalid rules block dependent calculation; these fixtures are not claims about current EGX tick rules.
- Adjustment metadata names a verified coherent basis, review-through day, source and unresolved-action status. Each bar binds that basis, capture time, source, confirmed flag, adjusted OHLCV, raw OHLCV and positive price/share conversion factors. Adjusted values must reconcile to raw values times those factors.
- Signal calculations need 261 consecutive verified sessions. Capture must be after session close + actual feed delay + 30 minutes, and before the supplied cutoff. Missing sessions, null volume and future/provisional captures do not become zero or interpolated bars.
- Zero volume needs explicit official no-trade evidence and an unchanged adjusted close. At least 18 of the latest 20 volumes must be positive. The parser validates supplied evidence assertions; it cannot authenticate the official source by itself.
- Optional actual traded EGP value has its own source ID. Without a complete 20-session actual-value window, turnover is a labeled typical-price proxy; the lower-price bound must clear the floor. Straddling bounds mean data review, not optimistic eligibility.

## Calculations and variants

ATR uses the fixed last 260 true ranges and Wilder14 seed. H20 and RV20 denominators exclude the signal day. SMAs include the signal day. R63 and benchmark conditions use the same verified session sequence. Piecewise tick rounding uses decimal rational arithmetic, including the strictly-next tick above H20. Entry zone and stop convert coherent history into current raw price units. No fixed take-profit is invented.

Tier membership is computed from **prior-session** base eligibility and prior-session turnover. This requires one extra session beyond the 261-bar signal window. A missing prior member makes the tier cohort incomplete; fixed-RV comparators retain their independent result. The percentile uses the nearest rank of 126 prior valid RV20 observations, excluding the signal day; older admitted history can supply valid observations without changing the fixed ATR window. Missing samples never trigger a silent fixed-volume fallback.

All nine frozen variants remain present. B0 is cash-only. B1 has no volume gate, B2/B3 use fixed RV, and the FULL family uses tier-aware RV. FULL and FULL-BOUNDED share mechanical eligibility and rank; allocation controls are W6. Rank is relative R63, turnover, then ISIN. Every instrument/variant receives a gate record. Data-blocked, threshold-rejected, research-pending and control-validation-pending are distinct. `noOpportunity:null` means insufficient data to conclude, not an empty signal set.

Sector strength uses aligned 20-session peer returns, excludes the target, requires five peers and at least 80% coverage, and subtracts aligned EGX30 return. Unresolved potentially eligible peers remain in the denominator. Negative strength blocks the applicable Watch; unknown strength is an important gap. FULL-NO-SECTOR removes that gate while retaining sector identity for later concentration analysis.

## Research packets and disposition

Evidence items explicitly distinguish OBSERVED, DERIVED, JUDGMENT and UNCERTAINTY. Sources are dated and hashed; excluded domains are rejected. Derived items require a method and calculation hash. Statements retain issuer, currency, scale, scope, publication/period, page and quote per number, and use the existing numerical reconciliation engine. PARTIAL/NOT_EVALUABLE is not PASSED; contradictory arithmetic blocks Watch.

Packets remove only the registered peer/macro/sector overlay for each ablation. Critical safety evidence must remain core. A retained item cannot depend on an omitted overlay. Mechanical variants do not acquire invented discretionary approvals. Genuine ablation model outputs and shared FULL/FULL-BOUNDED research timing still require W7 orchestration; constructing packets is not evidence that those model runs occurred.

A review binds the packet, instrument, variant, actor/model and actual creation time. It records thesis, falsifiable hypothesis, invalidation, three pillars, uncertainties, strongest countercase, alternative explanation, next review and a forecast or explicit uncertainty. A numerical probability needs a precommitted, packet-linked derived method artifact and uncertainty; its empirical calibration remains unproven until W7.

The final challenge binds the analyst record hash, is later than the analyst commit, and has a different actor, objections, response, remaining dissent and critical-defect status. Different roles using one model are explicitly disclosed. Recorded actor/model strings are not authentication or proof of external execution.

For Watch, mechanical gates, substantive area coverage and the existing `egx-field-evidence-2` contract must pass. Sourced valuation cannot omit its value-claim dependencies. Banks require capital, asset quality, funding and margin evidence. Other supported models require earnings quality, cash conversion and refinancing analysis. Peer comparisons need five comparable, consistently dated, positive-denominator peers. Macro review must connect company revenue, costs, financing and valuation. Important gaps retain attempted fallbacks, consequences, review timing and independent treatment; the default 50% gap treatment is applied once and is not a quantity calculation. W6 owns any authorized FULL exception.

Wait and Avoid can preserve unfinished evidence without creating an entry. Watch returns `AWAITING_RISK_AND_EXECUTION_CONTROLS`, a setup with quantity null and entryAuthorization false. String/schema checks cannot judge whether the thesis is economically sound or whether a cited passage proves a claim. The independent analytical evaluation remains mandatory.

## Remaining boundary

This batch does not run full Draft 2020-12 validation of the frozen **execution** decision schema, accept Risk Agent certificates, compute funded share quantities, resolve actual next-session entry deadlines, reserve cash or simulate fills. W6 must do those before an independently executable paper intent exists. W1/W3 source permissions and authoritative rule/calendar/action coverage remain unresolved. Actual-session rehearsal, model comparisons, user comprehension and explicit activation gates remain open. None of these commands resumes a schedule or authorizes real trading.
