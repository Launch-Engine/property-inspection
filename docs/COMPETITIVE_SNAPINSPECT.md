# Property Inspection vs. SnapInspect

> Companion to [PRODUCT.md](./PRODUCT.md). Honest side-by-side for the marketing/GTM agent. Includes where SnapInspect beats us today, where we beat them, and how to position around the gap.

## Quick frame

SnapInspect is a 10+ year-old, feature-deep, enterprise-style inspection platform with native iOS/Android apps. Our product is a brand-new, focused, **PWA-first** inspection app with a tight write-back integration into Monday.com (and the architecture to add AppFolio/Buildium/Rentvine quickly).

**They are not the same product.** SnapInspect is sold like a SaaS platform; ours is closer to a service offering bundled into a PM's workflow. Picking the right ICP is what makes the matchup useful.

---

## Feature matrix

✓ shipped today · ◐ partial / config-only · ✗ not built · n/a not visible publicly

| Feature | Property Inspection | SnapInspect |
|---|:-:|:-:|
| **Deployment** | | |
| Web app (mobile browser) | ✓ | ✓ |
| Installable to home screen (PWA) | ✓ | ✓ |
| Native iOS app | ✗ (not needed for PWA) | ✓ |
| Native Android app | ✗ | ✓ |
| **Capture** | | |
| Photo capture from device camera | ✓ | ✓ |
| Video capture | ✗ | ✓ |
| Voice-to-text notes | ✗ | n/a (likely in higher tier) |
| Photo annotation (arrows, circles) | ✗ | ✓ (likely in higher tier) |
| Offline mode | ✓ (IndexedDB) | ✓ |
| GPS / geolocation tagging | ✗ | ✓ |
| **Form / Checklist** | | |
| Configurable sections | ✓ (1 config file per client) | ✓ (template editor) |
| Required vs optional fields | ✓ | ✓ |
| Conditional logic (show X if Y) | ✗ | ✓ (Premium tier) |
| Yes/no/N/A toggles | ✗ | ✓ |
| Multi-layer/asset hierarchy | ✗ | ✓ (Premium tier) |
| **Output** | | |
| Branded PDF report | ✓ (per-PM brand) | ✓ |
| MS Word export | ✗ | ✓ |
| Side-by-side comparison reports | ✗ | ✓ |
| Multi-language reports | ✗ | ✓ |
| eSignature on report | ✗ | ✓ |
| **Integration into PM systems** | | |
| Monday.com write-back (item + PDF attachment) | ✓ | ✗ (no clear listing) |
| AppFolio / Buildium / Rentvine | ◐ (architecture ready, not yet wired) | ✗ (no clear listing) |
| Email PDF | ◐ (~30 min to wire) | ✓ |
| Google Drive / Dropbox sync | ✗ | ✓ |
| Public API | ✗ | ✓ (Premium tier) |
| **Workflow** | | |
| Auto-messaging contractors/tenants | ✗ | ✓ |
| Work order / maintenance task creation | ✗ | ✓ (Premium tier) |
| Cost calculations / invoicing | ✗ | ✓ (Premium tier) |
| Schedule / calendar | ✗ | ✓ |
| Auto reminders | ✗ | ✓ |
| **Admin** | | |
| Multi-inspector accounts | ✗ (single shared link today) | ✓ |
| Role / permission tiers | ✗ | ✓ (Premium / Enterprise) |
| Custom dashboards | ✗ | ✓ (Premium tier) |
| Franchise / multi-tenant hierarchy | ◐ (white-label per client) | ✓ (Enterprise tier) |
| **Brand & polish** | | |
| Per-client white-label | ✓ (logo, colors, sections) | ✓ (custom branded reports) |
| **Pricing & onboarding** | | |
| Public pricing | $0–$10/mo to operate (cost-only today) | Not public — quote-based |
| Free trial / onboarding | Live link, ~5 min per client | 14-day trial |
| App store install required | No | Yes |
| Setup-to-first-inspection time | ~5 minutes | "Within 5 minutes" claim |

---

## Where SnapInspect clearly beats us today

1. **Feature depth** — conditional logic, work orders, invoicing, asset hierarchy, expiry notifications, automation. They've been compounding features for a decade.
2. **eSignature + Word export** — table-stakes for move-in/move-out reports going to property owners or legal disputes.
3. **Video, GPS, photo annotation** — richer capture than photos + text alone.
4. **Multi-inspector accounts with role-based permissions** — we run on one shared link today.
5. **Vertical breadth** — they sell into commercial PM, vacation rental, student housing, real estate, building inspection. We're focused on residential PM only.
6. **Sales muscle and industry credibility** — they show up on PM software comparison sites and have customer testimonials.
7. **Native apps** — for inspectors doing 10 properties a day, native apps feel snappier and integrate with system-level features (background uploads, etc.).

**Honest read:** if a customer needs work-order automation, signatures on every report, or multi-inspector teams with permission tiers, SnapInspect is the better answer today.

---

## Where we beat SnapInspect

1. **No app store install** — kills friction for any one-off inspector, owner self-inspection, tenant move-in walkthrough. SnapInspect requires a download to use the mobile app. PWA wins for "send a link, get a report" workflows.
2. **PM-system-native write-back** — we put a PDF + structured data **directly into the PM's Monday board** as a row with the right columns. SnapInspect's public integrations list is thin; theirs feels like export-and-import.
3. **White-label per client, by config** — flipping branding from CFL to the next client is a config change, not a sales tier. SnapInspect brands reports per company, not per end client.
4. **Cost structure** — ours runs on Netlify + Cloudinary at ~$0–10/mo per pilot client. SnapInspect's pricing is enterprise-quote — likely $40–150+ per inspector per month based on industry comparables.
5. **Speed to onboard a new PM client** — 5 minutes with a config commit + Monday setup. SnapInspect's "5 minutes to first inspection" is for a single user, not a new tenant company.
6. **Tight focus = clean UX** — fewer features means fewer ways to confuse a non-power-user. A tenant doing a move-in self-walkthrough doesn't need conditional logic, just clear sections.
7. **Modern web architecture** — Vue 3 + TypeScript + Vite + PWA on AWS Lambda underneath. Easier to extend, modern to hire for, modern to integrate with.

---

## Recommended positioning vs. SnapInspect

> *"SnapInspect for the inspection team. Property Inspection for the inspection workflow."*

Or, blunter:

> *"If you have an inspection department, get SnapInspect. If you have one part-time inspector and a Monday board, get us."*

### Where to lead in marketing copy

- **No app store**: every inspector tap is a friction point. "Open a link. Done."
- **Lands in your existing workflow**: not "another platform to log into"; the PDF and a structured row appear on the Monday/AppFolio board the PM already uses.
- **Setup in minutes, not weeks**: live for CFL Property Management in one week of build time.
- **Built around the modern PM stack**: Monday, AppFolio, Buildium, Rentvine — write-back, not just export.

### Where to NOT pick a fight

- **Don't claim feature parity.** We don't have signatures, work orders, conditional logic, or video. Trying to match wide will be a losing race for a long time.
- **Don't sell to large PM organizations with dedicated inspectors.** They're going to want signatures, role permissions, and asset hierarchies. They're SnapInspect's natural customer.
- **Don't sell against SnapInspect on "AI"** — they've already started painting "AI property inspection software" on their site. Different fight, same buyer, dilutes our message.

---

## What we should build next to harden vs. SnapInspect

Feature pickup order, prioritized by what closes the most-asked-for gaps without bloating the product:

1. **eSignature** — table-stakes for any move-in/move-out report. ~3 days work; pdf-lib supports drawn signatures.
2. **Per-inspector accounts** — kills the "shared link" awkwardness. ~5 days with magic-link email auth.
3. **AppFolio + Buildium write-back** — adapter pattern is already there in the function. ~3 days each.
4. **Email PDF** — for PMs who don't run their workflow on Monday. <1 day.
5. **Conditional logic** — "if Bedroom 3 = N/A, skip the photo requirement". Useful but not urgent.

Held intentionally:
- **Video** — heavier on storage, slower on review. Not a clear win until customers ask.
- **Work-order automation** — overlaps with our other LaunchEngine products (Outpost, Maintenance Engine). Different SKU, different sales motion.

---

## Bottom line for the GTM agent

**SnapInspect = sales motion for inspection-heavy operations.** They're priced like enterprise SaaS, sold like enterprise SaaS, and feel like enterprise SaaS.

**We = inspection workflow as a service for SMB PMs.** Pricing should match: per-inspection ($5–15) or low-tier subscription ($99–199/mo flat, unlimited), bundled into LaunchEngine's existing PM engagements.

The SnapInspect comparison should land in a deck like:

> "SnapInspect is the right tool if inspections are 30% of your business. For everyone else, here's the lighter, faster, integrated alternative."
