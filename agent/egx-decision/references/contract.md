# Decision contract and learning history

Commands: `node app/decision-agent.mjs queue`, `save FILE`, `monitor`, `export`, `note ID KIND TEXT`, `recheck DECISION_ID REASON`. Recheck creates a new analyst candidate tied to the original decision and a review note, with no duplicate while work is pending and at most one recheck per ticker/Cairo day. Use a new immutable research context and report, then save a superseding final decision. Notes use kinds process, outcome, data or review-trigger. `import-reviewed` routes existing saved analyst reports into the new inbox once; repeat calls are idempotent.

Draft example (replace every placeholder with actual evidence; use the actual current ISO timestamp):

```json
{
  "id": "decision-unique-id",
  "queueId": "candidate-actual-id",
  "reportId": "report-actual-id",
  "ticker": "ACTUAL",
  "createdAt": "2026-10-08T12:00:00Z",
  "policyVersion": "decision-1.1",
  "action": "Wait",
  "horizon": "Medium term",
  "rationale": "Why the evidence supports this action now",
  "thesis": "Main investment hypothesis",
  "counterargument": "Strongest evidence against it",
  "invalidation": "What would invalidate the thesis",
  "reviewConditions": "Specific new evidence or conditions requiring reassessment",
  "processAssessment": "Research quality, contradictions and missing checks",
  "uncertainties": ["Material unresolved item"],
  "prediction": {"horizonSessions": 20, "direction": "uncertain", "hurdlePercent": 0, "rationale": "Insufficient basis for a directional forecast"}
}
```

`riskPlan` is optional for Wait/Avoid (omit unusable plans); required for Watch and must exactly equal the analyst's validated plan. Optional `supersedes` names the current earlier decision for this stock. New research uses a new candidate/report so provenance is explicit. Old decisions continue tracking even after supersession. Additional independent source checks use `sourceReferences: [{url, accessedAt, verification}]`, with HTTP(S) links, actual access times and a specific account of what was verified or remains missing.

Data: `decision_inbox`, `agent_decisions`, `decision_outcomes`, `decision_notes` in `data/egx.sqlite`; JSON exports in `data/learning`. Frozen decisions include complete analyst report, stock context, screening evidence, policy and evidence hash. Observations append; revised provider history does not erase earlier observations. Dashboard `/#decisions`; export `/api/decisions/export` includes all actions.

Outcomes use the first confirmed observed session open strictly after the Cairo decision date. This conservative baseline excludes same-day information, including on pre-open runs; it is a diagnostic price comparison, not an execution simulation. 5/20/60 count observed sessions. Missing expected sessions block forecast scoring; unavailable matched-period benchmark and total-return adjustments prevent alpha claims. No synthetic backfilled outcomes. Uncertain forecasts are not scored. Stocks never shortlisted are outside this cohort, so it cannot establish an unbiased market-wide edge.

Methodological references: [Federal Reserve model risk guidance, updated April 2026](https://www.federalreserve.gov/frrs/guidance/supervisory-guidance-on-model-risk-management.htm) motivates independent challenge, ongoing monitoring and comparison of forecasts with outcomes; this personal tool is not a claim of regulatory compliance. [AQR on replication](https://www.aqr.com/insights/perspectives/the-replication-crisis-that-wasnt) motivates testing robustness and avoiding selective evidence. These sources do not validate this local strategy or its thresholds. The future fourth reviewer should distinguish data, process, calibration and execution issues, propose a versioned change, and evaluate it on a later untouched sample with costs and benchmark consistency.

New Watch decisions must include the full calculated `priced-plan-1.0` riskPlan, not only three numbers. See the research skill priced-plans reference. Decision policy is now decision-1.1; older decisions retain their original policy. `decision_journal` links approved decisions to actual-fill journals without inventing any fills.
