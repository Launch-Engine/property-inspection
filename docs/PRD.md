# Product Requirements — Property Inspection App

> Single rolling PRD. Newest features at the top. Each feature carries: **Status**, **Problem**, **User stories**, **Acceptance criteria**, **In scope**, **Out of scope**, **Success metrics**.
>
> Status values: `Planned` · `In development` · `Shipped` · `Sunset`
>
> See also: [PRODUCT.md](./PRODUCT.md) for product overview, [COMPETITIVE_RENTCHECK.md](./COMPETITIVE_RENTCHECK.md), [COMPETITIVE_SNAPINSPECT.md](./COMPETITIVE_SNAPINSPECT.md).

---

## Board-Initiated Workflow

**Status:** In development

### Problem

Today every PWA submission creates a brand-new Monday row, which means the property manager has no way to assign a specific inspection to a specific person ahead of time. They can't see "this property is waiting on an inspection" until after the inspector hits Submit. Inspectors who lose the link have no way to find it again, and inspections completed for the wrong unit can't be tied back to a known assignment.

We need to flip the flow: the Monday item exists first (PM creates it, optionally via an upstream automation), the inspector receives a link tied to that item, and their submission **updates** that row instead of creating a new one. The PM regains the ability to triage, assign, and track inspections before they happen.

### User stories

- As a property manager, I create an item on the Inspections board with the property address, then trigger an email to the inspector with a link that opens the inspection form pre-filled for that property.
- As an inspector, I tap the link in my email and the inspection form opens with the address already filled in — I never type it.
- As an inspector, if I lose the email I can ask the PM to resend the same link, and submitting still updates the same row instead of creating a duplicate.
- As a property manager, when an inspection comes in, I see the same row I created update with the photo count, the PDF, the walkthrough video link, and a status of Submitted.

### Acceptance criteria

- The PWA only accepts inspections tied to an existing Monday item ID (provided as `?item={id}` in the URL).
- Visiting the inspection URL without a valid item ID shows an explanatory message and does not start a draft.
- The property address field is read-only and pre-populated from the Monday item.
- On submit, the existing Monday item is updated in place — no new row is created.
- A re-submission against the same item is idempotent (status stays Submitted, columns and PDF refresh).
- TEST MODE (`?test=1`) continues to allow internal testing without a Monday item.

### In scope

- New backend endpoint that returns the property address (and other context fields) for a given Monday item ID.
- Inspection form pre-fills the address and locks it.
- Submission updates the existing Monday item (status, photo count, submitted_at, PDF, walkthrough URL).
- Home page replaces "Start New Inspection" with an "Open the link from your inspection email" message.

### Out of scope (this release)

- Signed/expiring URL tokens.
- Per-inspector login.
- Reminder emails for unfinished inspections (Make.com or Monday automations own this).
- Bulk import of inspections from CSV (Make.com can already do this).

### Success metrics

- Zero duplicate Monday rows created during pilot use.
- Pilot inspectors complete inspections without ever re-typing the property address.
- PMs can see the status of pending inspections directly on the board (Pending → Submitted) without leaving Monday.

### Operational notes

- **URL format for emails:** `https://cfpm-inspection.netlify.app/inspect?item={pulse_id}`. Make.com substitutes the Monday `pulse_id` directly into the `item` query parameter and sends the email. No webhook is required on our side.
- No additional Monday columns are required for this release. PMs use existing columns to set the property address (item name) and any email recipient field they want.

---

## Walkthrough Video

**Status:** Shipped

### Problem

Property managers running move-in, move-out, and initial inspections expect a single short video walkthrough of the property alongside the photo evidence. Our pilot reference customer relies on this in their current tool, capped at 5 minutes per video, and has built their workflow around it. Today our app supports photos only, leaving a clear capability gap versus RentCheck, SnapInspect, and even some Google-Forms-based workflows that ask inspectors to drop a YouTube link.

Adding video makes our app viable for move-in / move-out / initial inspections — the inspection types that carry the most operational and legal weight, and the ones owners are most likely to look at.

### User stories

- As an inspector on a move-in, I record one ~5-minute walkthrough video on my phone and attach it to the inspection without leaving the app.
- As an inspector, I can see the duration of the video I just recorded and re-record before submitting if I made a mistake.
- As an inspector working in a basement or out of signal, my video persists across app closure and uploads when I'm back online.
- As a property manager reviewing the inspection in Monday, I click a "Walkthrough Video" link on the row and play the video in my browser.
- As a property manager forwarding the inspection report to an owner, I see the walkthrough referenced inside the PDF so the owner can find it without going back to me.

### Acceptance criteria

- A **Record Walkthrough** button is visible on the inspection page, positioned before the photo sections.
- Tapping the button opens the device's native camera in video mode.
- A recording longer than **5 minutes** is rejected with a clear message before any upload begins.
- A successful recording shows a thumbnail and the duration ("4:32") and can be replaced or removed.
- A recording captured while offline persists across PWA close/reopen.
- On submit, the video uploads with a visible progress indicator, separate from the photo upload progress.
- The resulting Monday item carries a **Walkthrough Video** link column populated with a working URL.
- The generated PDF report includes a Walkthrough Video page with a thumbnail and the clickable URL.
- Re-submitting the same inspection does not re-upload the video or create a duplicate Monday item.

### In scope

- One whole-property walkthrough video per inspection (not per-section).
- 5-minute hard cap enforced at capture time.
- iOS Safari PWA + Android Chrome.
- Cloudinary for video storage and CDN delivery.

### Out of scope (this release)

- Per-section videos (one short clip per room).
- Video annotation, trimming, or in-app playback.
- Multiple form templates (Move-In / Move-Out / Periodic).
- Per-section reminder text ("make sure all sink stoppers are not engaged").
- End-of-inspection signature.
- Migration of video storage to Cloudflare Stream — documented as future work, trigger is monthly Cloudinary credit usage crossing 50.

### Success metrics

- A 5-minute walkthrough video uploads successfully within 60 seconds on LTE from an iPhone.
- Pilot customer completes a full move-in inspection end-to-end on the new flow without a support question.
- Function execution stays under Netlify's 10-second ceiling for an inspection containing 100 photos plus one walkthrough video.
- Per-customer operating cost stays under the SaaS pricing floor (target: $89/month worst case for 1,000-door customer at 120 inspections/month).

### Operational notes

- Cloudinary upload preset must allow the `video` resource type. One-time setting in the Cloudinary dashboard.
- The CFL pilot Monday board needs a new **Walkthrough Video** link column. New customers onboarded after this release receive it automatically via the existing `setup-board` flow.

---

## Roadmap (queued, not yet specified)

Each will get its own PRD entry above when it moves into planning.

- **Form templates** — Move-In / Move-Out / Periodic / Initial. Different section lists and required fields per template.
- **Per-section reminders** — Short configurable text per section ("make sure all sink stoppers are not engaged") shown to the inspector during the walkthrough.
- **End-of-inspection signature** — Canvas-drawn signature embedded in the PDF, optional or required depending on template.
- **Tenant-driven self-inspection** — Automated SMS/email invite, scheduled reminders, tenant submits, PM gets the report. Closes the largest feature gap with RentCheck.
- **AppFolio + Rent Manager + RentVine adapters** — Replicate the Monday write-back path for the three top SMB PMS platforms.
- **Cloudflare Stream migration** — Triggered when monthly Cloudinary credit usage crosses 50. No user-visible change.
