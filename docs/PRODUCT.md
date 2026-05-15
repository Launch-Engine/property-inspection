# Property Inspection — Product Description & Spec

> Brief for the marketing/GTM agent. Working internal name: **Property Inspection** (white-labeled per PM client, e.g., "CFL Property Inspection"). Suggested public name candidates: **Walkthru**, **InspectFlow**, or under the LaunchEngine umbrella as **LaunchEngine Inspections**.

---

## TL;DR

A mobile-first, offline-capable web app that lets property managers send a branded inspection link to inspectors, owners, or tenants. They walk the property snapping photos under each section (Living Room, Kitchen, Exterior, etc.) plus optional notes, hit Submit, and a fully-branded PDF report lands as a Monday.com item back on the PM's board — no app store, no native install, ~10–15 minutes per inspection.

**Pilot live:** [https://cfpm-inspection.netlify.app](https://cfpm-inspection.netlify.app) for Central Florida Property Management. End-to-end proven with up to 100 photos per inspection.

---

## The Problem

Most small/mid-size PM companies still run inspections through one of three painful flows:

1. **Google Forms** — Free, but the UX is desktop-grade. Inspectors fumble with `Add file` buttons, the form doesn't work offline, photos arrive disorganized, and there's no branded report.
2. **Manual photos + email** — Photos go to camera roll, get emailed in bulk, someone in the office spends 30+ minutes building a report by hand.
3. **Heavy dedicated inspection software** (HappyCo, zInspector, SnapInspect) — Powerful but expensive ($60–$150+/inspector/month), requires app-store installs, training, and onboarding. Overkill for a 50–500 unit operator.

The gap: **PM-grade output without PM-grade software cost or complexity**.

---

## The Solution

A progressive web app (PWA) that the inspector opens from a link, adds to home screen, and uses like a native app — but with zero app-store friction. The PM company gets a finished, branded PDF report deposited directly into their existing workflow (Monday.com today, AppFolio/Buildium/etc. tomorrow).

### Inspector experience

1. Tap the link / home-screen icon
2. Form opens on phone: Name, Property Address, Date (auto-filled)
3. Walk through ~19 configurable sections; tap **Take Photo**, native camera opens, photo gets resized + saved locally
4. Add an optional **Notes** box per room ("Stain under bathroom sink, leak suspected")
5. Tap **Submit** — photos upload to cloud storage, server generates the PDF, item lands in PM's Monday board
6. Big green **Inspection Submitted** confirmation card

### Property manager experience

1. New row appears on their Monday board: address, inspector, date, photo count, PDF attached
2. Click PDF → fully-branded report with the PM's logo, photos grouped by section, notes alongside
3. Forward, file, or attach to lease record — zero data re-entry

---

## Key Differentiators

| Dimension | Property Inspection | Google Forms | Heavy SaaS (HappyCo etc.) |
|---|---|---|---|
| Mobile-first | ✓ | weak | ✓ |
| Works offline | ✓ (IndexedDB) | ✗ | ✓ |
| No app-store install | ✓ (PWA, "Add to Home Screen") | ✓ | ✗ (requires download) |
| Branded report PDF | ✓ (per PM logo/colors) | ✗ | ✓ |
| Configurable form structure | ✓ (one config file per client) | partial | ✓ |
| Direct write into PM's existing board/system | ✓ (Monday today) | ✗ | partial |
| Cost to operate | < $20/mo at pilot scale | free | $60–$150+/inspector/mo |
| Setup time per new PM client | ~5 minutes | n/a | days |

---

## Target Customer Profile

**Primary ICP:** Residential property management companies, 50–800 units, who currently:
- Use Google Forms, paper checklists, or email for inspections
- Have a Monday.com workspace (or AppFolio/Buildium/Rentvine — Monday integration is shipped; PMS integrations are next-up)
- Charge owners for inspection reports (move-in, move-out, mid-lease, drive-by) and want them to look professional

**Secondary ICP:** PM tech vendors and consultants serving the SMB PM market — could license this as a white-label add-on.

**Buyer:** Owner / Director of Operations / Maintenance Director. ICP rarely has a CTO.

**Trigger to buy:**
- New owner contract requires periodic walkthroughs
- Insurance carrier requires photo evidence
- Want to charge owners for an inspection service
- Embarrassed by a Google Forms PDF in front of a high-value owner

---

## Feature Spec (Current — Pilot Build)

### Form
- 19 configurable photo sections (Living Room, Kitchen, Appliances, Under Kitchen Sink, Primary Bedroom, Bedrooms 2-4, Primary/Second/Third Bathrooms, Under Bathroom Sinks, Utility Room, HVAC Filter, Exterior Front/Rear/Left/Right, Porch/Garage/Misc)
- Per-section optional **Notes** field (free text)
- 3 metadata fields: Inspector Name, Property Address, Inspection Date
- Required/optional flags configurable per section
- All fields autosave to device on every keystroke
- Required-field validation; "test mode" toggle for staging

### Photo capture
- Native camera via `<input type="file" capture="environment">` — no permissions prompt, no custom UI
- Client-side resize to 1600px JPEG quality 80 → ~300–500KB per photo
- Photo gallery thumbnails per section with delete
- Upload status badges per photo (uploading / uploaded / failed)

### Offline + sync
- Full offline operation; up to ~50–100 photos buffer in IndexedDB
- Visible sync progress bar and "X of Y photos uploaded" counter
- Resilient on iOS PWA close/reopen (photos persist as ArrayBuffer)
- Retry-on-failure with exponential backoff (3 attempts per photo)
- Bounded parallel upload (5 concurrent) — 100-photo inspection completes in ~15–25s on LTE
- Idempotent submission: double-tap won't create duplicate Monday items

### Report PDF
- US Letter layout, branded header band with PM's logo, "PROPERTY INSPECTION REPORT" label
- Metadata block: Property, Inspector, Inspection Date (MM/DD/YYYY), Submitted timestamp
- Section headings with brand-color accent bar
- 2-column photo grid per section, fit-to-cell
- "NOTES" callout on each section if a comment was entered
- Page footer with PM brand wordmark + "Page N of M"
- All photos delivered from Cloudinary CDN, transformed on-the-fly to JPG q=78, w=1000 for fast embedding

### White-label / branding
- Per-client config drives:
  - Form sections, labels, required flags, photo limits
  - Brand colors (CSS custom properties)
  - Logo on home screen, form pages, PDF header
  - Favicon, app name, PWA manifest theme color
- New client onboarding is ~5 minutes once the per-client config + Monday workspace exist

### Integration
- Today: Direct write to Monday.com board with PDF attached to a file column
- Architecture: Adapter pattern in the function — adding AppFolio, Buildium, Rentvine, or any HTTP-based PMS is one new module
- Optional: Email PDF to a configurable address (not yet wired but ~30 min to add)

### Security & reliability
- HTTPS everywhere (Netlify CDN + Cloudinary)
- API key auth between client and server function
- Per-inspection client-generated UUIDs prevent double-submissions
- Server-side dedup check before creating a new Monday item
- All sensitive tokens server-side only (Monday API token never reaches the browser)
- 99.9%+ uptime inherited from Netlify Functions on AWS Lambda
- Bug surface kept small: one function, one repo, one Cloudinary account

### What it's NOT (yet)
- No multi-inspector auth (single shared link per PM today; per-user accounts are v2)
- No in-app report viewer for PMs (they view the PDF in Monday)
- No revenue/billing (single Stripe hookup is ~1 day if needed)
- No automation triggers ("if X then create work order")
- No video, no signature, no checklists with yes/no — pure photo + comment

---

## Technical Architecture

- **Frontend:** Vue 3 + TypeScript + Vite + Pinia + Dexie (IndexedDB), packaged as a PWA via `vite-plugin-pwa`. Hosted on Netlify.
- **Photo storage:** Cloudinary (direct browser → Cloudinary uploads, no server proxy). Free tier today; predictable cost scaling.
- **Server:** Netlify Functions (Node 20, TypeScript). PDF generation via `pdf-lib`. Monday writes via direct GraphQL fetch.
- **Sink (today):** Monday.com — workspace + board + per-column env vars all configurable. Adapter pattern means swapping to AppFolio/Buildium/Rentvine is module-level work, not architectural.
- **State (today):** Stateless — IndexedDB on the device + Monday as the system of record. No DB on our side. Adding a Postgres + per-PM dashboard is a clear next step but not required to ship.

### Operating cost at pilot scale (1 PM client, ~100 inspections/mo)

| Line item | Cost |
|---|---|
| Netlify (PWA + Functions) | $0 (free tier) |
| Cloudinary (photo storage + CDN) | $0 (free tier 25GB) |
| Monday | Customer-owned, $0 to us |
| Domain (if dedicated) | ~$15/year |
| **Total operating cost / pilot client / month** | **~$0–10** |

At 10 PM clients × 1,000 inspections/month, projected cost is ~$60–120/mo total. Cost is genuinely a rounding error against any reasonable pricing.

---

## Suggested Monetization Angles (for marketing/GTM to evaluate)

### 1. Per-inspection pricing
- Charge $5–$15 per submitted inspection report
- Simple, scales with usage, easy to position vs. "$8 of staff time per manual report"
- Risk: PMs may push back on per-use pricing

### 2. SaaS subscription (per PM company)
- $99–$299/month flat for unlimited inspections + 1 PM client config
- Tiered by inspection volume or inspector seats
- Predictable revenue, simpler to forecast
- Anchor: HappyCo at $60/inspector/month; we undercut + simpler

### 3. White-label / re-seller
- License to PM tech consultants, virtual assistants, BPOs, or PM tech vendors (RentSimple, ManageBuilding)
- $$ /month + revenue share
- Higher leverage, fewer customers to service

### 4. Bundled with LaunchEngine PM Marketing
- Free with any LaunchEngine marketing engagement; positioned as "infrastructure that makes your operations look polished"
- Lead-magnet / stickiness play
- Lower direct revenue but feeds the bigger LaunchEngine bundle

### 5. Vertical bolt-ons
- "Move-In Walkthrough" preset for tenant move-ins (different sections + required signature)
- "Drive-By Inspection" preset (4 exterior shots only, instant report — for asset preservation customers)
- "Tenant Self-Inspection" — owner emails the tenant the link, tenant submits, owner pays $X
- Each bolt-on = same engine, different config, new SKU

### 6. Marketplace / ecosystem play
- Build apps for Monday Marketplace, AppFolio Stack, Buildium App Store
- Distribution-first; each marketplace has 1000s of qualified PM eyeballs
- Already have related Monday Marketplace experience (RentEngine, LaunchEngine integrations)

---

## Competitive Positioning

| Competitor | Strength | Where we beat them |
|---|---|---|
| Google Forms | Free, familiar | Polished output, offline, branded, PMS-integrated |
| HappyCo | Mature, deep features | Cheaper, no app install, faster onboarding |
| zInspector | Inspection-focused | Native PWA, modern UX, Monday/AppFolio direct write |
| SnapInspect | Mature mobile UX | White-label friendly, lower cost, no per-seat |
| In-house custom build | Tailored | We're already tailored per client, ~5min onboard |
| Property Meld / Buildium inspection module | All-in-one PM | Standalone — works alongside any PMS, no platform lock-in |

**One-line positioning:**
> *"A polished inspection app that drops a branded PDF into your existing Monday/PMS workflow — without making your inspectors download yet another app."*

---

## Pilot Status & Proof Points

- **Live:** Central Florida Property Management — branded build at `cfpm-inspection.netlify.app`, writing into their CFL Monday workspace
- **Stress-tested:** 100+ photos per inspection submitted end-to-end inside Netlify Function's 10s ceiling
- **Reliability:** Idempotent submissions, offline-resilient, iOS PWA close/reopen-safe (multiple iOS-specific bugs already debugged and fixed)
- **Time to onboard a new PM client:** ~5 minutes (per-client config + Monday board via included setup endpoint)
- **Photo storage:** Cloudinary free tier handles pilot indefinitely; clear $/GB upgrade path

---

## Roadmap (next 30/60/90 days, if validated)

**30 days**
- Move pilot inspectors onto the live build, gather feedback
- Add 2–3 additional PM clients on the same engine (validates the ~5-min onboard claim)
- Add optional email-the-PDF feature for clients who don't use Monday
- Lock the brand config schema (CSS variables + sections + logo)

**60 days**
- AppFolio + Buildium adapters in the function (no-code config swap per client)
- Per-inspector accounts + email magic links (replaces shared API key)
- Photo annotations / circles / arrows on report
- Dashboard for PMs to view inspection history without leaving Monday/AppFolio

**90 days**
- Monday Marketplace listing
- Optional Stripe billing layer (per-inspection or subscription)
- Multi-language PDF (Spanish first — large overlap with FL/TX PM market)
- API for owners/insurance carriers to pull inspection history

---

## Open Questions for the Marketing Agent

1. **Naming & positioning:** Keep client-specific names (CFL Property Inspection) or anchor a master brand (Walkthru, InspectFlow, LaunchEngine Inspections)?
2. **Pricing model preference:** Per-inspection vs. SaaS vs. bundled — which fits the LaunchEngine GTM motion best?
3. **Lead magnet potential:** Free "1 inspection / month" tier? Or never offer free because it commoditizes?
4. **Distribution strategy:** Direct sales vs. Monday Marketplace vs. white-label re-sellers — which gets us to 10 clients fastest?
5. **Adjacent SKUs:** Which bolt-on (move-in, drive-by, tenant self-inspect) carries the most pricing power?

---

*Document maintainer: Rob Lowry. Tech lead: Claude Code. Pilot client: Central Florida Property Management.*
