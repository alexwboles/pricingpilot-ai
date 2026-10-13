# Targeted PricingPilot fixes — October 12, 2026

## October 13 reconciliation and release checks

Reconciled the QA branch with GitHub main `7c2057e`, preserving the new discount, break-even, plain-text quote, margin ladder, tax and win/loss features. Resolved the tax-column/revenue-label conflict without discarding either feature.

Additional fixes and evidence:

- Boolean tax toggles persist across reload; shared scenario normalization also safely loads older partial saved quotes without missing-field crashes.
- Clipboard denial/unavailability no longer reports Copied. The UI warns and provides selectable, read-only quote text for manual copying. The customer text omits internal margins by default.
- Unsupported saved prices no longer crash quote statistics. Invalid won-quote prices are disclosed and excluded from the estimated total; original records remain intact.
- Won quotes are labeled estimated quoted value, not verified payments or collected revenue. Failed outcome writes restore the visible selector instead of displaying an unsaved Won status.
- Default customer and internal quote outputs now fit one Letter page. Print CSS excludes editor headings/controls, preserves three tier columns and avoids splitting a tier. Actual PDF pages were rendered and visually inspected, not just checked through print-media selectors. Customer output omits margins; the internal copy is explicitly labeled.
- Current smoke: 23 passed, 0 failed. Current core/asset e2e: 20 passed, 0 failed. Edge checks cover desktop/phone workflows, tax persistence, clipboard denial, unsafe/corrupt records, write failures, default quote privacy, tier acknowledgment and ordinary file launch using fresh synthetic profiles with network blocked.
- The extracted storage-handler fixture was updated to supply the newly introduced recovery flag; this was a fixture failure, not a reason to disable the recovery guard.

Still not commercially cleared: complete recoverable backup/import, concurrent-tab conflict handling, long-content print stress cases, customer packaging/onboarding, approved commercial offer and payment/fulfillment. The subscription prices in README are future ideas, not an implemented service. QA artifacts live under ignored `output/`; no customer data or paid APIs were used.

This remains an isolated review branch. Uploading it to its existing GitHub repository does not merge main, install it in Project HQ's review snapshot, deploy it, approve marketing or prove revenue.

Verified the reviewed snapshot matches GitHub HEAD b88c925229a835566f3ffceef2d780a1d0d49f19 before creating this separate checkout. The original Project HQ review clone and its approval state were not modified.

Implemented locally:

- Reject unsafe/non-finite calculated costs and prices instead of showing Infinity/NaN.
- Show an accessible calculation error, clear stale quote results, and recover after correcting inputs.
- Generate unique saved/duplicated quote IDs against existing records even within the same millisecond.
- Require explicit acknowledgment before rendering a quote containing below-cost tiers; declining removes the printable quote rather than leaving a stale sheet.
- Label the hourly metric as quoted revenue, not take-home pay, in the calculator, tier table and README.
- Invalid saved scenarios now show a recovery warning, retain the original stored record, disable scenario autosave for that session, and allow calculation using safe defaults. Partial valid field objects retain defaults for missing fields.

Passed checks:

- Baseline: $100 cost at 40 percent margin gives $166.67.
- Extreme inputs are rejected, including multiplication and overhead overflow.
- Fifty duplicates under a fixed clock retain distinct IDs.
- Edge file-launch in a fresh synthetic profile displays the overflow error and successfully recalculates after correction. External network requests blocked.
- JavaScript syntax and whitespace checks.
- Additional Edge checks at desktop and phone widths: save/reload/load/duplicate/delete scenarios, neutralized formula-like CSV names, default omission of internal profit margins from customer quotes, and hiding print controls in print media. All used synthetic data in fresh profiles with network requests blocked.

- Below-cost acknowledgment acceptance/rejection verified in Edge with synthetic costs; clear calculator revenue terminology checked. This is an acknowledgment safeguard, not a prohibition on deliberately below-cost quotes.
- Malformed JSON and invalid inputs/competitor containers tested in fresh Edge profiles: original scenario bytes preserved, normal calculations still work, and no startup exceptions occurred. This is damage containment, not a complete recovery/import tool.

Not claimed: actual PDF/paper layout verification, full recovery/import, multi-tab conflict safety, checkout/onboarding or overall commercial readiness. Print-media visibility checks are not a complete printed-output review.

These changes are on a separate local QA branch. They are not pushed, merged, deployed or installed into Project HQ's source preview. No outreach, advertising, paid calls or spending occurred.
