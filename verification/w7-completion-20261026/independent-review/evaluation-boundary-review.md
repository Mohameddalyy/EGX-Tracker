# Independent evaluation boundary and scoring review

Reviewer: `/root/w7_independent_review`, separate AI actor, not human-independent validation. Review performed after numerical source checks recorded at 2026-10-25T22:59:00.147Z. No model identity is invented. This record is an initial review; subsequent fixes require linked verification.

## Statistical reporting boundary

The CLI `statistics` path now calls `boundStatisticalReport`, which reads hash-bound trial artifacts and semantically replays matching-release engineering ledgers. Returns, closed-position counts and variant/scenario identity are derived from those ledgers. The resulting scope is always SOURCE_BOUND_ENGINEERING. A caller-supplied prospective string cannot open the statistical gate. `diagnostic-statistics` also forces engineering scope. All 16 hypotheses remain visible and inconclusive without registered prospective evidence. These are sound restrictions.

Two actionable issues were reported to the parent:

1. **P2: arbitrary baseline can misstate first daily return.** `boundComparisonInput` initializes `previous=10000000` while accepting any caller-selected baseline day. If ledger activity precedes that baseline, the first reported return includes pre-window performance. Bind baseline before ledger inception with no earlier activity, or require an actual verified baseline valuation. Intermediate omitted sessions also need rejection or explicit gap treatment; an ordered arbitrary subset does not prove a full calendar.
2. **P2: frozen evaluator release not enforced.** The bound path checks the registered execution release but does not compare the trial's evaluationReleaseHash to the current evaluator. The frozen trial contains that binding. An evaluator amendment must produce a new registered version or explicit mismatch, not silently reuse the old trial.

The present forced-engineering scope prevents a superiority claim from these defects; it does not make incorrect reported returns acceptable.

## Scoring and identity

The scorer binds exact frozen case, blind packet, complete output, reviewer, timestamps and numerical metadata. Missing extracted items stay in the denominator. Every fixed rubric dimension requires a score and reason. Critical errors block the factual gate, and the suite explicitly declines an aggregate qualitative pass threshold. Separate actor IDs are acknowledged as provenance rather than proof of independent humans. These are useful checks.

Limits that require honest run reporting:

- Nonempty model IDs and syntactically valid configuration/prompt/tool hashes are assertions, not authenticated model provenance. The session's exact inherited model/configuration is unavailable. An actual observed AI output can be assessed for task accuracy, but this cannot become a verified named-model comparison or satisfy the frozen actual-model/configuration prerequisite without further evidence.
- `modelSuite` groups by promptHash. If this means the full per-case prompt, varying task/evidence produces 20 incomplete groups. If it means common instruction/template hash, document that and retain the actual per-case prompt separately; otherwise use a distinct template hash for grouping.
- Source passages, ground truth and critical-error counters require actual reviewer adjudication. Hash equality does not prove source authenticity, independent sourcing, or absence of fabricated extra facts in prose. I independently checked all 46 numerical targets and their retained passages; later output review must also inspect substantive prose.
- The fixed rubric has no frozen aggregate analytical-quality pass threshold. High factual accuracy alone cannot be labeled analytical value, universal reliability, or trading edge.

## Case coverage limitation

The twenty cases cover the registered categories and selected extraction pitfalls, but section 10's justified-concentration requirement is not established by an unapproved 15% fixture cap/headroom calculation. Existing risk cases test funding, correlated exposure, capacity and abstention. No case in the initial set supplies a justified higher-concentration FULL decision and substantive independent challenge. Exact substituted backlog subtopics also remain untested as stated in CURATION-REPORT.md. Preserve these distinctions in W7 completion claims.
