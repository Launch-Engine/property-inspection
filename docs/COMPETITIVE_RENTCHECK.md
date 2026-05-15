# Property Inspection vs. RentCheck

> Companion to [PRODUCT.md](./PRODUCT.md) and [COMPETITIVE_SNAPINSPECT.md](./COMPETITIVE_SNAPINSPECT.md). RentCheck is the closest direct competitor to what we're building — same buyer (residential PM), same approach to tenant self-inspection — so the comparison matters more than SnapInspect.

## Quick frame

RentCheck is the **incumbent in our exact lane**: tenant-guided inspections for residential PM companies, mobile-first, with workflow integration into AppFolio / RentVine / Rent Manager. They're priced at **$1.00/unit/month** ("Grow") or **$1.25/unit/month** ("Accelerate"), so a 200-unit PM is paying ~$200/mo and a 1,000-unit PM is paying ~$1,000–1,250/mo.

That pricing model is the real story. RentCheck makes money on **passive seat density** — every unit, every month, whether or not it's inspected — which is fantastic for them and brittle for their customers. That's the wedge we should drive through.

---

## Where RentCheck wins today

1. **Tenant-guided self-inspection at scale** — their core product is *"80% of inspections are completed by tenants"*. Automated invites, reminders, scheduling, real-time dashboards. Ours is built for one inspector at a time; we don't automate tenant outreach yet.
2. **AI damage detection** — flags critical issues to prioritize review. We don't have this.
3. **PMS integrations already shipped** — AppFolio, Rent Manager, RentVine (Buildium notably absent). We only have Monday today; PMS adapters are architected but unshipped.
4. **Mature feature set** — 14 pre-built templates, 360° camera, asset capture, work orders, Zapier, public API, signature acknowledgements. We have one template and no signatures.
5. **Brand presence in the PM industry** — they get listed on PM software comparison sites, have NARPM/PM-tech conference presence, customer testimonials. We have none of that yet.
6. **Built-in automation** — auto-scheduled inspections vs. manually triggered. We send no reminders.
7. **Multi-user team accounts** — they have proper account/permission tiers; we have a shared API key.

---

## Where we beat RentCheck

1. **No per-unit tax** — at $1/unit/month, a 500-door PM is paying $6,000/year **whether they do one inspection or a thousand**. Our cost-to-operate is genuinely <$20/mo for a pilot, leaving massive room for either flat SaaS or per-inspection pricing.
2. **No app store install** — RentCheck pushes tenants to the App Store/Play Store. Friction. Tenants ignore. We're a link → home screen → done.
3. **Monday.com integration** — RentCheck's integration list is AppFolio / Rent Manager / RentVine. Anyone running operations on Monday (which is a huge slice of the LaunchEngine ICP) has no direct path. We write directly into the PM's Monday workspace.
4. **White-label per client** — every RentCheck report is RentCheck-branded with the PM as a sub-brand. Ours puts the PM's logo and colors on every page; RentCheck doesn't appear anywhere. For PMs who care about owner-facing polish, this matters.
5. **Architectural simplicity** — our config-driven model means a new PM client is ~5 minutes. RentCheck's onboarding is "14-day trial → import data → train tenants" with their Data Import Hub.
6. **No vendor lock-in dynamic** — RentCheck owns the inspection workflow and the customer relationship to the tenant ("the average resident satisfaction rating with RentCheck inspections is 4.8/5"). PMs effectively rent their tenant communication channel from RentCheck. Ours leaves the PM owning the tenant experience.

---

## Feature matrix

✓ shipped today · ◐ partial / config-only · ✗ not built today

| Feature | Property Inspection | RentCheck |
|---|:-:|:-:|
| **Capture** | | |
| Mobile photo capture | ✓ | ✓ |
| Time-stamped photos | ◐ (server-side) | ✓ |
| 360° / panorama capture | ✗ | ✓ (Accelerate) |
| Video capture | ✗ | ✓ |
| Offline capture | ✓ | ✓ |
| **Workflow / Automation** | | |
| Inspector-led inspection | ✓ | ✓ |
| Tenant-led self-inspection | ◐ (works if you send link, no automation) | ✓ (their headline feature) |
| Automated tenant invites + reminders | ✗ | ✓ |
| Automated scheduling | ✗ | ✓ (Accelerate) |
| Move-in/move-out comparison reports | ✗ | ✓ |
| AI damage detection | ✗ | ✓ |
| Maintenance flagging / work orders | ✗ | ✓ |
| Latchel integration | ✗ | ✓ (Accelerate) |
| **Templates** | | |
| Pre-built template library | ✗ (one template per client config) | ✓ (14 base + 6 advanced) |
| Custom templates | ◐ (config edit) | ✓ (Accelerate) |
| **Output** | | |
| Branded PDF report | ✓ (per-PM brand) | ✓ (RentCheck-branded; Accelerate adds branded options) |
| eSignature on report | ✗ | ✓ (Accelerate) |
| Time-stamped in-app photos | ✓ | ✓ |
| **Integrations** | | |
| Monday.com | ✓ | ✗ |
| AppFolio | ◐ (architecture ready) | ✓ |
| Rent Manager | ✗ | ✓ |
| RentVine | ◐ (architecture ready) | ✓ |
| Buildium | ◐ (architecture ready) | ✗ |
| Yardi | ✗ | ✗ |
| Zapier | ✗ | ✓ (Accelerate) |
| Public REST API | ✗ | ✓ (Accelerate) |
| **Admin** | | |
| Multi-user accounts | ✗ (shared link) | ✓ |
| Real-time dashboard | ✗ (Monday IS the dashboard) | ✓ |
| Role-based permissions | ✗ | ✓ |
| **Pricing** | | |
| Public pricing | $0–10/mo to operate today | $1/unit/mo (Grow), $1.25/unit/mo (Accelerate) |
| Pricing model | TBD | Per-unit-per-month |
| Free trial | Live link any time | 14 days |

---

## The price-model gap (this is the real wedge)

| PM size | RentCheck Grow ($1/unit/mo) | RentCheck Accelerate ($1.25/unit/mo) |
|---:|---:|---:|
| 50 doors | $50/mo · **$600/yr** | $62.50/mo · $750/yr |
| 200 doors | $200/mo · **$2,400/yr** | $250/mo · $3,000/yr |
| 500 doors | $500/mo · **$6,000/yr** | $625/mo · $7,500/yr |
| 1,000 doors | $1,000/mo · **$12,000/yr** | $1,250/mo · $15,000/yr |
| 2,500 doors | $2,500/mo · **$30,000/yr** | $3,125/mo · $37,500/yr |

That bill arrives every month whether the PM does **zero** inspections or **a thousand**.

Inspection frequency in residential PM is rarely more than:
- 1 move-in per turn (annual or 2-year)
- 1 move-out per turn
- 1–2 mid-lease drive-by/walkthroughs per year

So a typical unit gets **2–4 inspections/year**. A 500-door PM does **1,000–2,000 inspections/year** and pays **$6,000+** under RentCheck. That's **$3–6 per inspection**, sometimes more, sometimes less.

We can charge **per inspection** (say $4–8) and a 500-door PM with 1,500 inspections/year pays **$6,000–12,000** — but **only if they use it.** That's the marketing wedge:

> *"Pay for inspections you complete, not for doors you own."*

We can also undercut with a flat $99–$199/mo and still come out way ahead on margin given our ~$0–10/mo cost.

---

## Positioning recommendation

RentCheck's superpower is *automated tenant self-inspection*. They've earned the right to charge per-door because they save a PM's office team hours of chasing tenants.

We are not going to beat them at automated tenant outreach in a quarter. So **don't compete head-on for the "we'll handle all your inspections" use case** — that's their wheelhouse.

Lead with three positioning angles instead:

### 1. The Monday-native angle
> *"RentCheck for AppFolio. Property Inspection for Monday."*

LaunchEngine's customer base runs operations on Monday. RentCheck doesn't integrate. We're not just another inspection tool; we're the one that drops cleanly into the workspace your team already lives in.

### 2. The pay-as-you-go angle
> *"Stop paying RentCheck for doors you didn't inspect."*

Specifically targets PMs who do mostly turn inspections (move-in / move-out) and are paying $1/unit/month year-round. A 500-door PM doing 2-per-year-per-unit at $5/inspection pays $5,000/yr instead of $6,000. With richer inspection cadences, the math gets even worse for them.

### 3. The white-label angle
> *"Your brand on every report. Not ours."*

For PMs who care about owner relationships and the report being a polished extension of THEIR brand (not RentCheck's). Especially relevant for PMs marketing to high-end owners or institutional clients.

---

## What to build before going head-to-head with RentCheck

If we want to seriously compete, our gaps are clear and ordered:

1. **Automated tenant self-inspection flow** — send link via SMS, scheduled reminders, the PM gets the report when done. ~2 weeks. Without this we can't win the "we'll inspect 80% of your units automatically" sale.
2. **Move-in / move-out comparison reports** — RentCheck's most-cited feature. ~1 week with pdf-lib once we have multi-inspection state.
3. **eSignature on the report** — table-stakes for legal admissibility. ~3 days.
4. **AppFolio + Rent Manager + RentVine adapters** — the three RentCheck wins on. Architecture is ready. ~3 days each.
5. **Template library** — 14 RentCheck-style templates as config files. ~1 week of design + setup.
6. **Real-time dashboard for PMs** — small Pinia + Postgres app, or a Monday view that's good enough. ~2 weeks.

Held intentionally:
- **AI damage detection** — interesting differentiator for marketing copy ("computer vision flags potential issues"), and we can ship a v1 by sending photos through Claude with a structured prompt. ~1 week PoC, ~3 weeks to make it production-quality.
- **360° / video** — feature parity that doesn't drive purchasing decisions for SMB PMs. Hold until customer ask.
- **Latchel integration** — narrow, only Accelerate-tier RentCheck customers care.

---

## Bottom line for the GTM agent

**RentCheck is the right competitor to study, and the right one to undercut on pricing.**

Their model is built around automated tenant self-inspection at scale, which is a real moat. But the per-unit-per-month pricing leaves a gaping wedge: PMs paying for doors they didn't inspect.

We position as:

> *"For PMs whose ops live on Monday. For PMs who want to charge per inspection, not per door. For PMs who want their own brand on every report."*

If your customers already use RentCheck, the most productive conversation isn't "switch to us" — it's:

- **Are there PMs you have where RentCheck doesn't make sense?** (Smaller doors. Monday-based ops. Owners who require PM-branded reports.)
- **Are there inspection types you do where RentCheck is overkill?** (Drive-bys, exterior-only, one-off walkthroughs.)
- **Could a $5-per-inspection tool live alongside RentCheck for one-offs and ad-hocs?** (Add-on, not replacement.)

That third one is interesting. We don't have to displace RentCheck. We can be the *cheap one-off tool* a PM uses for the inspections that don't justify a RentCheck flow. Lower stakes, faster sales cycle, lower churn risk.
