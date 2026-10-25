# Twenty-case analytical review backlog

Status: **NOT ADJUDICATED; NO ACTUAL MODEL RUNS.** These are test specifications, not invented issuer facts or an evaluation result. Select eligible dated issuer/exchange/regulator evidence, save the original files and passages, establish availability at cutoff, and have a separate reviewer verify numerical answers before freezing each case. Do not use excluded sources. Previously inspected cases can test task accuracy, not untouched out-of-sample trading performance.

| Slot | Categories | Exact challenge and numerical ground truth to obtain |
|---|---|---|
| 01 | banks | Reconcile net interest income and cost of risk; period, currency and consolidated scope |
| 02 | banks, incompleteFinancials | Missing loan-quality schedule; distinguish unknown credit quality from zero losses |
| 03 | nonfinancials | Reconcile operating profit, operating cash flow and working-capital movements |
| 04 | nonfinancials, conflictingDocuments | Restated versus originally published earnings; record both vintages and availability |
| 05 | property | Contract sales versus recognized revenue and collections; prevent revenue double counting |
| 06 | property, incompleteFinancials | Customer advances and debt maturity missingness; identify what valuation cannot support |
| 07 | conflictingDocuments | Parent-only versus consolidated statement; quantify difference and reject mixed ratios |
| 08 | conflictingDocuments | EGP versus USD and thousands versus millions; critical unit/identity checks |
| 09 | delayedEvents | Material disclosure observed after decision cutoff; exclude it from original thesis |
| 10 | delayedEvents, noTrade | Stale financial release paired with new price; explain permitted and prohibited inference |
| 11 | corporateActions | Split factor and share adjustment; no manufactured return from unadjusted price change |
| 12 | corporateActions | Cash dividend entitlement and ex-date; separate price return from shareholder return |
| 13 | corporateActions, riskExceptions | Rights issue/dilution with unresolved entitlement; quantify known terms and block unsupported sizing |
| 14 | thinLiquidity | Whole-order size versus observed minute and daily participation ceilings |
| 15 | thinLiquidity, noTrade | All-or-none exit capacity failure; retain exposure rather than report a fictitious sale |
| 16 | riskExceptions | Concentration exception with competing cash/liquidity scenarios and counterevidence |
| 17 | riskExceptions | Correlated holdings and common macro/FX exposure; no zero-correlation assumption from missing returns |
| 18 | riskExceptions, noTrade | High-confidence narrative with unfunded desired allocation; reject unsupported budget/quantity |
| 19 | nonfinancials, noTrade | Technical trigger passes but substantive thesis fails; preserve mechanical opportunity denominator |
| 20 | incompleteFinancials, noTrade | Noncritical missing item with a justified fallback versus a critical identity/action gap |

For each slot save: case ID/category, exact task, cutoff/freeze times, evidence files/hashes/passages, checked numerical items with tolerance/unit/period/entity/source, adjudicator identity/date, blind packet hash, actual model/config/prompt/tool permissions and original run output, separate review and disagreements. Missing reliable truth remains unscored and keeps the suite incomplete. Do not fill 20 slots with synthetic companies and call that real analytical validation.

The executable contract is in `app/v5/evaluation-models.mjs`; the frozen five-dimension rubric is used unchanged. The engineering tests validate failure handling and arithmetic using explicitly synthetic test records. They do not evaluate the named model's factual accuracy.
