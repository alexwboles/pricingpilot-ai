# Targeted PricingPilot fixes — October 12, 2026

Verified the reviewed snapshot matches GitHub HEAD b88c925229a835566f3ffceef2d780a1d0d49f19 before creating this separate checkout. The original Project HQ review clone and its approval state were not modified.

Implemented locally:

- Reject unsafe/non-finite calculated costs and prices instead of showing Infinity/NaN.
- Show an accessible calculation error, clear stale quote results, and recover after correcting inputs.
- Generate unique saved/duplicated quote IDs against existing records even within the same millisecond.

Passed checks:

- Baseline: $100 cost at 40 percent margin gives $166.67.
- Extreme inputs are rejected, including multiplication and overhead overflow.
- Fifty duplicates under a fixed clock retain distinct IDs.
- Edge file-launch in a fresh synthetic profile displays the overflow error and successfully recalculates after correction. External network requests blocked.
- JavaScript syntax and whitespace checks.
- Additional Edge checks at desktop and phone widths: save/reload/load/duplicate/delete scenarios, neutralized formula-like CSV names, default omission of internal profit margins from customer quotes, and hiding print controls in print media. All used synthetic data in fresh profiles with network requests blocked.

Not claimed: actual PDF/paper layout verification, full recovery/import, multi-tab conflict safety, below-cost-tier prevention, corrected hourly-rate terminology, checkout/onboarding or overall commercial readiness. Print-media visibility checks are not a complete printed-output review.

These changes are on a separate local QA branch. They are not pushed, merged, deployed or installed into Project HQ's source preview. No outreach, advertising, paid calls or spending occurred.
