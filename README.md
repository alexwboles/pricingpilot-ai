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
6. **Saves quotes** — name and save any pricing scenario to localStorage; reload or delete it later.

Everything runs **locally in the browser** (localStorage). No account, no network, no fees. If you set `OPENAI_API_KEY`, tier copy can optionally be polished by a model — never required.

## Run it
No build step. Open `index.html` in a browser, or serve it:

```bash
npx serve .          # or: python3 -m http.server 8080
```

## Pricing vision
Free for up to 10 saved quotes · **Pro $19/mo** — unlimited quotes, quote history + win-rate tracking, custom tier templates · **Team $49/mo** — multi-user, branded one-pagers, competitor watch.

## Tests
```bash
bash test/smoke.sh   # 11 checks
bash test/e2e.sh     # 7 flows
```

## Tech
Pure static HTML/CSS/JS. Core logic lives in `lib/logic.js`, shared between the browser and Node tests (UMD wrapper) — so the math the tests verify is exactly the math the UI runs.
