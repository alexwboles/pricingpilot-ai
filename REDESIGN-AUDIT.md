# REDESIGN-AUDIT — pricingpilot-ai (2026-10-13)

Competitors referenced: **Jobber** (Good/Better/Best tier cards with a highlighted recommended tier, quote-to-job flow, margin visibility per option), **QuoteWerks** (line-item quote builder, margin columns), **Joist** (customer-facing quote document with status tracking).

## Visual gaps vs competitors
- The estimate readout ("Your estimate" card with the price-big hero) scrolls away; on a long step-1 page the headline number should stay visible like a register readout.
- Tier editor cards show name/multiplier/textarea but no live price hero per tier — Jobber's tier cards always show the price. No "most popular" flag on Standard in the editor (the one-pager has it, the editor doesn't).
- Saved quote rows show status only as a `<select>`; no at-a-glance status pill.

## Functional gaps vs competitors
1. **Tier prices aren't visible while editing tiers** — multiplier × base is computed but never shown in the editor.
2. No margin chip per tier in the editor (margin table is a separate card below).

## What this redesign does (bounded)
- **Sticky estimate readout**: the "Your estimate" card sticks under the topbar on desktop so the recommended price stays in view while stress-testing what-ifs.
- **Tier editor price heroes**: each tier card shows its live computed price (multiplier × recommended price) + a "MOST POPULAR" flag on the Standard tier; prices recompute live as multipliers are edited.
- **Status pills on saved quote rows**: won (green) / lost (red) / open (neutral) pill next to the quote name; the select remains for changing status.
- Identity stays "Estimate Ledger" — dark forest-ink topbar, warm paper, emerald accent, serif price numerals.
- All existing features preserved: cost calculator, margin ladder, what-if (discount + break-even), tax-inclusive toggle, competitor positioning, tier inclusions editing, one-pager with recommended tier + internal margins, win/loss tracking + stats, CSV export, copy-as-text.
