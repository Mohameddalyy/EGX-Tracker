# W7 case curation

Curator and numerical truth actor: `/root/w7_case_curator`.

## Temporal-context development supplement

The current manifest contains **26 cases and 64 numerical items**. W7-23 through W7-26 are new, expressly synthetic development-validation cases authored after the observed reuse of another case's cutoff. They are not untouched generalization holdouts. Each input has its own actual recorded cutoff, after the actual creation of its source file, and tasks explicitly request the current case ID and exact cutoff. Numerical targets use timestamp differences; raw sources contain scenario timestamp facts and missingness, without numerical answers or correction annotations.

W7-23 tests a captured notice and an action scheduled within seconds of its cutoff. W7-24 distinguishes same-calendar-date financial period, publication, capture and hypothetical original decision. W7-25 distinguishes an already announced meeting from its future proceedings. W7-26 evaluates evidence captured after a hypothetical earlier decision while preserving unknown first public availability. Sources are `temporal-case-23.json` through `temporal-case-26.json`. All nine added numbers require independent checking before freezing new CLI artifacts. The existing 22 input cases and frozen artifacts were not edited. No analyst received source truth or a correction message from the curator.

## Supplemental FULL cases, 2026-10-25 23:04 UTC

Before freeze, the independent reviewer identified that the original W7-21 fixture added to an existing A holding, violating frozen no-pyramiding. It is corrected to existing B exposure of EGP15,000 plus cash of EGP85,000 and a first A purchase of EGP70,000. The source explicitly preserves the mandatory no-pyramiding/no-averaging rule; discretion has no permission to override it. All four numerical answers are unchanged. The original source and both affected case drafts are retained with `before-no-pyramiding-repair` names; cases 21 and 22 both bind the updated shared source hash and actual correction timestamp.

The current manifest now contains **22 cases and 55 numerical items**. Cases W7-21 and W7-22 add explicit paper-only FULL discretionary reasoning with no fixed concentration or cash cap. W7-21 presents supportive fictional business evidence, funded concentration, shared exposure and a joint adverse valuation, while requiring material challenges and smaller/zero-allocation alternatives. W7-22 presents a fully funded technical opportunity with cleared mechanical entry assumptions but weak substantive evidence and adverse valuation asymmetry, testing justified abstention without a fabricated cap or cash constraint. Arithmetic is adjudicated; allocation choice has no predetermined numerical truth answer or automatic qualitative pass threshold. The authored source is `full-discretion-scenarios.json`. These assumptions do not modify any live policy or constitute issuer facts.

The independent reviewer requested neutral `Orascom Construction PLC` entity metadata for W7-13's exchange ratio because physical page 68 is a separate-parent note. That pre-freeze correction is applied in the task and truth, with no numerical change; the superseded input is retained as `W7-13.pre-entity-correction.json`. The original manifest remains in `case-manifest.before-full-supplement.json`. All original case inputs except this documented pre-freeze correction remain as delivered.

The section below records the original twenty-case curation. Its backlog limitations remain applicable to the expanded suite.

Twenty input cases with 46 numerical items cover all ten registered categories. Read the exact input paths from `case-manifest.json`; do not include the two `pre-capture-repair.json` records as current cases. These files are supplied adjudication inputs, not final independent-review findings, model runs, or claims of analytical validation. The parent should create frozen CLI artifacts and blind packets before the analyst starts. Only blind packets should reach the analyst.

The actual clock at preparation was 2026-10-25 22:55–22:56 UTC (2026-10-26 in Africa/Cairo). All evaluation cutoffs and check times use that actual clock. Existing capture times come from the retained document library index. New source availability uses the local file capture or recorded web-tool capture. No release date, period end, or hypothetical historical decision is represented as verified first public availability. These are retrospective reading/reasoning tasks, not untouched point-in-time strategy evidence.

## Primary evidence and checks

- ADIB original retained PDF SHA256 `81ab810f9c38f68a84782589c7b010ec114d03c982ec8860bc4553b3225ef5cc`: physical page 4 rendered and independently read, including six-month versus quarterly columns, EGP thousands, signs, scope and shareholder attribution.
- ORAS original retained PDF SHA256 `28c5d26067780ad79a837c346c2e1b23195c1c130a07883a3999018ffb3fb533`: physical pages 8, 10, 41 and 68 rendered and independently read. Consolidated USD millions differ from separate-parent USD; the separate EPS footnote is material. Corporate action remains proposed at the statement date.
- CIRA original retained PDF SHA256 `aac74e7ffdb2195cf01f5ef4566bb272bfed60497d4b873dd640faeff0f1365e`: physical page 4 rendered and read. Management allocation changes segment profit while leaving group total unchanged. The retained source's unresolved issuer-to-IR-service link caveat is explicitly in every supplied passage. This is not cleared source provenance or a statutory restatement.
- Palm Hills original PDF SHA256 `9ec3cd062d3706eac97b4b76399964c31143c926e7fb796d028ee5a43829e5b8`: downloaded from the issuer Results Center Q3 2025 earnings link. The referring index HTML is retained. Physical pages 1, 2 and 4 rendered and independently read. Rounded highlights and exact selected statements are distinguished. Internal inconsistencies are preserved, including comparative EBITDA and headline revenue rounding; no silent correction was made.
- CIB official dividend page: raw web-tool rendered response retained as `cib-dividends-web-capture.json`, SHA256 `559495e3e2dc167f0688ac8cd7b43528f0f123bcc803c8fe39fa32f1dc5ba8f5`. Rows at source lines 71–76 support the selected terms. The direct HTTP response was a 212-byte Incapsula challenge, retained as a failed attempt; it does not support facts. Inputs 11 and 12 were repaired before delivery to bind the actual web capture and later current timestamps. Superseded drafts remain visible.

All raw sources and selected page PNGs are under `data/research/evidence/w7-evaluation/`. No excluded sources, old Notion records, original ledgers, schedules, app code, source rules or frozen thresholds were modified.

## Truth method

Direct items were read from the saved issuer pages above. Derived items use deterministic arithmetic on those values: funds income minus deposit cost; group minus shareholder profit; gross profit divided by revenue; currency-scale conversion only (no FX rate guessed); consolidated minus separate profit after unit alignment; current assets minus current liabilities; calendar-date differences; actual corporate-action ratio applied to expressly hypothetical holdings. Fixture items use the recorded scenario's explicit amounts and formulas. Numerical tolerances are zero for exact integer/extracted values and tiny stated absolute tolerances for decimal arithmetic.

The build source contains these calculations and the requested output metadata. The independent reviewer must verify the original images, signs, units, periods, identities and source binding; distinct actors alone do not establish independent human review. Numerical truth must not be forwarded to the analyst.

## Scope and backlog substitutions

Cases 01–08 use genuine issuer disclosures. Cases 09–13 use genuine issuer evidence with explicitly hypothetical decision timing or holdings. Cases 14–18 are wholly synthetic recorded operational scenarios, authored for this evaluation; they are neither observed executions nor market-liquidity evidence. Cases 19–20 combine genuine statements with transparent synthetic decision contexts. Every local scenario carries that label in the blind evidence itself.

This suite covers the frozen registered categories but does not reproduce every proposed backlog scenario:

- Slot 04 uses simultaneous segment-allocation presentations; no paired original/revised statutory earnings vintages were independently sourced.
- Slot 11 uses an actual stock dividend rather than a split.
- Slot 12 deliberately tests missing ex-date rather than asserting an ex-date from the record or payment date.
- Slot 13 uses an actual proposed share-exchange combination rather than a rights issue; current completion and dilution remain unresolved.
- Slot 09 tests document-date lag and the prohibition on hindsight inclusion, not proven exchange publication latency.

Those specific original backlog subtopics remain untested and must not be claimed closed merely because the category contract accepts these twenty cases. Repeated issuers and purposive excerpts limit generalization. Incomplete schedules are withheld at packet level and do not assert that the issuer never published them. Factual accuracy on these cases cannot establish trading edge, prospective benefit, universal model superiority, or an aggregate analytical-quality pass threshold.

The current inputs pass `freezeCase` contract validation. That is structural validation, not independent source adjudication. The build script is exclusive-create and should not be rerun against these outputs.
