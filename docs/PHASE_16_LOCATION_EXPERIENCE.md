# Phase 16 — Location Experience Foundation

> **Status:** CONFIRMED — implementation active
>
> **Branch:** `phase-16-location-experience`
>
> **Protected baseline:** `c16c338e5246b5c0ac5529b299d4cbeef31aa277`

## Goal

Let customers and partners choose reliable locations by name, device position or map pin without understanding latitude/longitude, while preserving the proven order, trip, matching and GeoJSON contracts.

Phase 16 improves **location selection**. It does not redesign every screen and does not change matching logic.

## Decision checkpoint

Approved implementation contract:

```text
Provider: Google Maps Platform behind a RouteBite adapter
Normal input: search + current location + draggable pin
Stored contract: existing label/latitude/longitude payload and GeoJSON
Fallback: development-only raw coordinates until map rehearsal passes
```

Approved by the product owner on 29 August 2026. The product owner never sends API keys through chat or commits them. They are placed only in local/deployment environment configuration.

## Problem being solved

The current frontend exposes raw coordinate fields in:

- customer pickup and drop selection;
- partner scheduled-trip origin and destination;
- some tracking/status presentation.

This works for engineering rehearsal but contradicts the documented product requirement that users should select places and pins. It also creates avoidable entry mistakes and makes RouteBite look unfinished.

## Product principles

1. A user recognizes a place by name, landmark and pin—not decimal coordinates.
2. Search must not be the only path because many local/street-food vendors are unlisted.
3. Current location must be optional and permission-aware.
4. The user confirms the exact pin before RouteBite stores it.
5. A provider outage must produce a useful error/retry state, not an indefinite loader.
6. Existing saved data and APIs stay compatible.

## In scope

### Reusable location picker

One shared component supports:

```text
pickup
drop
trip origin
trip destination
```

Required capabilities:

- place/address autocomplete;
- current-device-location action;
- map preview;
- draggable or click-to-place pin;
- selected-place label;
- optional context/instructions outside the picker;
- explicit confirm action;
- loading, permission-denied, unavailable and retry states;
- keyboard and touch operation;
- mobile and desktop layout.

### Customer integration

The food-request form uses the picker twice:

```text
Pickup: vendor / landmark / manual pin
Drop: delivery destination
```

Pickup instructions remain a separate field because a map pin does not explain details such as stall color, gate number or floor.

### Partner integration

The scheduled-trip form uses the picker for:

```text
Origin
Destination
```

`AVAILABLE_NOW` continues to use current foreground geolocation. Its established 15-second refresh and freshness behavior remain unchanged unless a Phase 16 defect requires a focused fix.

## Out of scope

- changing order or trip schemas;
- changing matching radius, direction, ETA, detour or ranking rules;
- live-delivery map redesign (Phase 17);
- global copy cleanup (Phase 18);
- global typography/card redesign (Phase 19);
- background GPS tracking;
- turn-by-turn navigation;
- multiple map providers active at the same time;
- address validation as proof of vendor identity;
- production public launch.

## User flows

### Search flow

```text
Open picker
  -> type place/address
  -> choose suggestion
  -> map centers on selected result
  -> adjust pin if required
  -> confirm human-readable location
```

### Current-location flow

```text
Choose Use my location
  -> browser permission request
  -> success: center map and place pin
  -> reverse-geocode label when available
  -> user confirms or adjusts
```

Permission denial does not trap the user. The picker explains how to retry and keeps search/pin alternatives available.

### Unlisted-vendor flow

```text
Search nearby landmark or use current location
  -> move pin to exact vendor position
  -> enter vendor display name
  -> add pickup instructions
  -> confirm
```

## Component contract

The normal frontend value remains provider-neutral:

```js
{
  label: 'Campus Gate 2, Muzaffarpur',
  latitude: 26.123456,
  longitude: 85.123456,
  providerPlaceId: 'optional-provider-reference'
}
```

Only `label`, `latitude` and `longitude` are required by the existing order/trip APIs. `providerPlaceId` stays frontend/provider metadata unless a later measured need justifies persistence.

The component should accept conceptually:

```js
<LocationPicker
  value={location}
  onChange={setLocation}
  purpose="pickup"
  required
/>
```

Exact React props may change during implementation, but provider-specific objects must not leak into page/business code.

## Provider boundary

Frontend provider responsibilities:

```text
load browser map SDK once
return normalized autocomplete suggestions
resolve selected place geometry
reverse-geocode a confirmed pin where useful
render map and marker
```

Backend route responsibilities remain in the existing route-estimate service:

```text
road distance / duration
route availability
matching shortlist evaluation
```

Place search must never be allowed to mutate order/matching state directly.

## Environment contract

Expected public browser configuration:

```env
VITE_GOOGLE_MAPS_BROWSER_KEY=
```

Keep the current server configuration name to avoid an unnecessary deployment migration:

```env
GOOGLE_MAPS_API_KEY=
```

The implementation must update both `.env.example` files and startup/provider error messages. Browser configuration is public by nature but the key must be referrer/API restricted. Server credentials never enter the frontend bundle.

## Cost and abuse controls

- debounce autocomplete input;
- do not request suggestions for empty/too-short input;
- use a session token per search/selection session;
- request only the fields needed for label and geometry;
- bias results toward the operating/campus region without silently blocking other valid results;
- cap retry loops;
- configure Cloud quotas/budget alerts;
- never call route calculation merely because the pin moves one pixel;
- never call Routes on every delivery GPS heartbeat.

## Error and fallback behavior

| Failure | Product response |
| --- | --- |
| Maps script cannot load | Explain location search is unavailable; offer retry and development fallback only in development |
| Search request fails | Keep current selection, show inline retry |
| Geolocation permission denied | Explain permission and keep search/pin route available |
| Geolocation times out | Offer retry and manual search |
| Reverse geocode fails | Keep the pin/coordinates internally and ask the user for a short display label |
| No route exists | Selection may be saved, but matching/route layer returns its existing explicit failure |
| Invalid coordinates | Block confirmation with validation message |

No error path may clear a previously confirmed location without the user's action.

## Security and privacy

- do not expose exact live partner locations outside authorized active-order APIs;
- do not trust provider labels as authorization or identity proof;
- validate latitude/longitude on the backend exactly as today;
- keep browser and server keys separated;
- do not log credentials or full sensitive location histories unnecessarily;
- preserve current owner-scoped order/trip authorization;
- load only the provider libraries RouteBite actually needs.

## Accessibility and responsive requirements

- every search field and map action has a visible label;
- keyboard users can search, choose a result and confirm;
- map-only information has a text equivalent;
- permission/errors are announced and remain visible;
- focus returns predictably after modal/sheet close;
- controls meet touch-target and contrast requirements;
- reduced-motion preference is respected;
- mobile picker uses available viewport height without hiding confirm/cancel actions.

## Implementation sequence

1. Record approved decisions in `DECISIONS.md` and confirm roadmap status.
2. Add environment contract and provider-loader boundary.
3. Add normalized location types/helpers and validation tests.
4. Build provider adapter with mocked automated tests.
5. Build `LocationPicker` states and responsive styling.
6. Integrate customer pickup/drop without removing fallback.
7. Integrate partner trip origin/destination.
8. Add useful provider/permission error handling.
9. Run automated tests and frontend build.
10. Rehearse search, current location and unlisted-vendor pin on real devices.
11. Confirm stored GeoJSON and matching results.
12. Hide coordinate controls from normal UI; retain development fallback until the phase merges.
13. Update progress report with exact evidence and PR/merge reference.

## Automated verification

Required unit/component coverage:

```text
normalizes a selected place
normalizes current device position
rejects invalid latitude/longitude
keeps longitude/latitude order correct at API/GeoJSON boundary
handles provider load failure
handles search failure/retry
handles denied and timed-out geolocation
keeps previous confirmed value on failure
supports pin-only selection with user-entered label
does not expose provider object through page payload
```

Required regression:

```powershell
cd backend
npm ci
npm test

cd ..\frontend
npm ci
npm run build
```

The existing backend state/matching tests must remain green. Add frontend test tooling only as narrowly needed; do not introduce a large unrelated framework migration.

## Manual rehearsal requiring product-owner involvement

Use at least one desktop browser and one phone on the same safe test environment.

Customer:

1. Search and select a known vendor/landmark.
2. Move the pickup pin to an unlisted vendor.
3. Add pickup instructions.
4. Use current location for drop, then adjust it.
5. Save and reopen the draft; labels/locations must persist.

Partner:

1. Search/select trip origin and destination.
2. Save a scheduled trip.
3. Confirm the offer/matching path still works with those stored points.

Failure:

1. Deny location permission; search/manual pin must remain usable.
2. Temporarily block/offline the provider; the UI must show retry/recovery rather than spin forever.

Data check:

1. Confirm displayed labels are understandable.
2. Confirm backend GeoJSON uses `[longitude, latitude]`.
3. Confirm a nearby request still matches the expected partner.

## Rollback plan

Phase 16 keeps the current API and database representation. If provider integration fails:

1. redeploy the known-good baseline or revert the Phase 16 merge;
2. no database rollback is required;
3. existing orders/trips remain compatible;
4. development coordinate controls can be temporarily re-enabled through the explicit fallback while the defect is fixed.

## Exit criteria

```text
[ ] decisions approved and recorded
[ ] provider adapter does not leak Google objects into page/business code
[ ] customer pickup/drop works without coordinate knowledge
[ ] partner trip origin/destination works without coordinate knowledge
[ ] unlisted vendor pin works
[ ] permission/provider failures have explicit recovery
[ ] existing API and GeoJSON contract unchanged
[ ] backend suite green
[ ] frontend production build green
[ ] GitHub Actions green
[ ] real-device customer and partner rehearsal passes
[ ] one ASAP matching flow passes
[ ] one scheduled/on-my-way flow passes
[ ] no manual MongoDB editing required
[ ] progress report records evidence and merge reference
```
