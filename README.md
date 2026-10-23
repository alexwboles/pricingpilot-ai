# 🧭 PricingPilot AI

**Price every job right** — a service pricing calculator for trades and small businesses. Enter what a job costs you, get the price you should charge.

## The problem
Small trade businesses price by gut feel: they forget overhead, undercharge for labor, and leave profit on the table — or lose bids by overpricing. Hiring a pricing consultant isn't in the budget.

## The solution
Type in your costs and PricingPilot AI:

1. **Calculates your recommended price** — labor hours × hourly rate + materials + other costs, overhead % applied, then your target margin via `price = totalCost / (1 − margin)`. All rounded to cents; inputs clamped (no negatives, margin < 95%).
2. **Generates 3-tier pricing** — budget (0.85×) / standard (1.0×) / premium (1.35×) tiers with editable multipliers and names, each with auto-generated feature differentiation (budget = essentials, standard = + extras, premium = + white-glove items). Inclusion lists are fully editable.
3. **Shows your margin breakdown** — an SVG stacked bar splitting the price into labor, materials, overhead, and profit, plus a per-tier margin % table so you can see what each tier really earns you.
4. **Checks competitor positioning** — enter 1–3 competitor prices and get a verdict per tier (undercut / aligned / premium) with plain-language positioning advice from local heuristics (e.g. priced 15% above a competitor → "lean on quality guarantees…").
5. **Prints a price-presentation one-pager** — business + service name, the 3 tiers as cards with a highlighted recommended tier, margin table, and a "valid until" date. Print button with clean print CSS.
6. **Saves quotes** — name and save any pricing scenario to localStorage; reload, duplicate, or delete it later. Search saved quotes by name, and export them all to CSV (tier prices + margins) for your books.
7. **Quoted revenue per labor hour** — selling price divided by labor hours. This is gross quoted revenue, not profit or take-home pay; materials, overhead and other costs are not deducted from this metric.
8. **Keyboard shortcut** — Ctrl+Enter (⌘+Enter on Mac) recalculates from anywhere on the estimate step.
9. **Full local backup and restore** — versioned JSON preserves complete current/saved scenarios, inclusions, tax, competitors, what-if settings and outcomes. Review first, then merge (default) or explicitly replace. Pre-restore recovery downloads and an undo journal protect interrupted writes; malformed backups are rejected. Up to 1,000 quotes / 5 MB. Raw recovery snapshots preserve damaged original storage but are not directly importable. These files contain private costs, not just customer-facing prices.
10. **One editing tab** — a browser-level lock makes additional tabs view-only and prevents their temporary calculations from overwriting saved data. Back up a reader draft, close the editor and explicitly reload latest data to transfer access. Unsupported locking fails closed. Tested in Microsoft Edge at the same local app path; not a multi-user database.
11. **Detailed quote printing** — longer names/inclusions switch to a multi-page table layout with tier headings repeated on continuation pages. Customer output still excludes internal margins by default; review every PDF before sharing.

Everything runs **locally in the browser** (localStorage). No account, no network, no fees. Pricing and positioning use deterministic calculations and local templates, not an AI model. The OpenAI polish function is an unimplemented extension hook; setting an API key does not enable AI generation.

## Run it
See [USER-GUIDE.txt](USER-GUIDE.txt) for opening, customer-quote privacy,
local storage and export limitations. This remains a testing candidate until
recipient-side installation, onboarding and commercial delivery are accepted.

A native per-user Windows review installer and GUI launcher are built with
existing developer compilers. Customers need no Node/Python setup, API key or
commands. Edge must already be installed. The unsigned candidate has passed an
isolated QA installation, installed app workflow and file-preserving uninstall
on the development PC, not a separate clean Windows machine or the normal
Desktop/registry integration. See [SETUP-NOTICE.txt](SETUP-NOTICE.txt) and
[packaging/README.md](packaging/README.md). No artifact is published for purchase.

For a source/developer review, no build step: open `index.html` in Edge, or serve it:

```bash
npx serve .          # or: python3 -m http.server 8080
```

## Future pricing ideas - not implemented or available for purchase
Free for up to 10 saved quotes · **Pro $19/mo** — unlimited quotes, quote history + win-rate tracking, custom tier templates · **Team $49/mo** — multi-user, branded one-pagers, competitor watch.

## Tests
```bash
bash test/smoke.sh   # 25 checks
bash test/e2e.sh     # 21 core/asset checks
node test/qa-blocked-storage.cjs # headless Edge: blocked storage, synthetic data
```

The review branch incorporates main's blocked-storage startup handling. If saved
quotes cannot be read, the calculator remains usable for temporary estimates,
but scenario autosave, quote saving and restore are disabled until storage is
resolved and the page is reloaded. The library explicitly says unavailable,
not empty; unseen quotes are never replaced with an empty list. Synthetic Edge
tests cover both quote-only and complete read blocking, unchanged original
storage, and no startup errors. This newer source is not included in the earlier
Windows review installer artifact; rebuilt-package acceptance remains pending.

October 22: a new dated local review candidate now includes these source fixes
and passes isolated installed-payload and blocked-storage browser tests. See
`packaging/README.md` for the artifact checksum and remaining gates. The prior
candidate is preserved; normal Windows integration, clean-machine/recipient and
commercial-delivery acceptance remain pending. Neither artifact is published.

October 23: normal per-user setup, shortcut targets, uninstall registration,
launcher prerequisites and clean removal were verified on the development PC
using that same candidate. The temporary test installation was removed; no
existing app was replaced. Clean recipient-PC, actual shortcut-launch/onboarding
and commercial-delivery acceptance remain open.

## Tech
Pure static HTML/CSS/JS. Core logic lives in `lib/logic.js`, shared between the browser and Node tests (UMD wrapper) — so the math the tests verify is exactly the math the UI runs.
