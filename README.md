# Property Inspection

Mobile inspection walkthrough PWA. Inspectors fill in property details, capture photos from their phone camera, work offline, and sync to a Monday board with a generated PDF report when back online.

**Pilot client:** Central Florida Property Management

## Stack

- **Frontend:** Vue 3 + TypeScript + Vite + `vite-plugin-pwa`
- **State:** Pinia, VueUse
- **Storage:** IndexedDB (Dexie — coming day 3)
- **Photos:** Cloudinary direct upload (coming day 3)
- **Backend:** New endpoint on `launchengine-api` (Rails 8) — generates PDF and creates Monday item
- **Hosting:** Netlify (PWA), Heroku (Rails)

## Local development

```sh
npm install
npm run dev
```

Open the URL printed by Vite. To test on a real device, use the network URL (Vite prints both).

## Build

```sh
npm run build      # type-checks then builds to dist/
npm run preview    # serve dist/ locally
```

## Project layout

```
src/
  components/        # Reusable UI components (InspectionSection, etc.)
  config/            # Static configuration (sections.ts — the 19 form sections)
  router/            # Vue Router setup
  types/             # Shared TypeScript types
  views/             # Top-level route components (HomeView, InspectionView)
  App.vue            # Root component
  main.ts            # App entry point
  style.css          # Global styles + design tokens (CSS custom properties)
```

`sections.ts` is the single source of truth for the inspection form structure. Add or remove a section there — the UI updates automatically.

## Deployment

Deploys to Netlify on `git push origin main`. Never deploy directly with the Netlify CLI.

## Monday board

- **Workspace:** Inspections (`15486047`)
- **Board:** Property Inspections — Central Florida PM (`18413167973`)
