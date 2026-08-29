# RouteBite — Product Evolution Roadmap

> **Status:** ACTIVE DRAFT — joint product approval required before Phase 16 implementation
>
> **Stable baseline:** `main` at `c16c338e5246b5c0ac5529b299d4cbeef31aa277`
>
> **Baseline evidence:** Phase 15 passed 23 backend suites / 108 tests, the frontend production build, four destructive-isolated hardening rehearsals, two complete browser delivery paths, and the latest-18-order invariant audit with 0 errors / 0 warnings.
>
> **Last updated:** 29 August 2026

This document is the source of truth for RouteBite work after the original Phase 0–15 milestone. It records the product direction, phase order, decision checkpoints, ownership, safety rules and completion gates so future work does not depend on chat history.

The detailed Phase 0–15 documents remain the historical record of how the working system was built. When a historical document uses the word `prototype`, it describes that completed milestone. Current product work should describe RouteBite as a **working MVP/project** while remaining honest about features that are still test-only or not ready for public production use.

---

## 1. Current Product Position

RouteBite already has a proven end-to-end operating loop:

```text
Customer request
  -> Razorpay Test payment
  -> deterministic matching
  -> persistent offer
  -> atomic partner assignment
  -> pickup and price handling
  -> live foreground tracking
  -> delivery OTP
  -> one completion / one earning
  -> rating and admin investigation
```

The next milestone is not to rebuild this core. It is to make the working product easier to use, easier to trust, more visually convincing and safer to pilot.

### Product language rule

- Public product screens should not repeatedly call RouteBite a demo or prototype.
- Buttons and headings should describe the user's action or outcome: `Earnings`, `Payment summary`, `Refund details`, `Adjusted total`.
- Test-only financial behavior must remain truthful. One compact, reusable disclosure should explain that Razorpay Test Mode is active and that settlement, refund and payout entries do not represent bank transfers.
- Internal database statuses such as `DEMO_REFUNDED` and historical documentation do not need risky renaming merely for presentation.

### Product-design rule

RouteBite keeps its coral, burgundy and cream identity and route motif. The redesign corrects density and interaction problems; it does not replace the brand with an unrelated visual style.

Utility screens should use compact typography, restrained radii and shadows, clear hierarchy, meaningful whitespace and responsive layouts. Large marketing-style headings are reserved for true hero moments, not dashboards, forms, order cards or admin tools.

### Dynamic-interface rule

“Dynamic” means that the interface reacts clearly to real product state:

- location search, map pin movement and route previews;
- live status timelines and progress;
- skeleton loading and useful empty states;
- focused sheets/modals for decisions;
- optimistic feedback only where rollback is safe;
- toasts and inline recovery actions;
- subtle transitions that explain a state change.

Decorative motion must never obscure order truth, slow an operational action, or replace accessible text.

---

## 2. CTO Recommendation — Location Experience

### Recommended decision

Use **Google Maps Platform behind a RouteBite provider adapter** for the first judged and campus-pilot experience.

This matches the existing architecture and product documentation, provides place search and reliable maps/routes in one ecosystem, and minimizes integration risk before judging. The adapter prevents the UI and business services from becoming permanently coupled to one provider.

This recommendation needs joint approval before Phase 16 implementation because Google Cloud billing, quotas and API keys require owner involvement.

### User experience

Customers and partners should never need to remember or type latitude/longitude.

Every location choice uses one reusable `LocationPicker` with three paths:

1. Search for a place or address.
2. Use current device location.
3. Move a map pin to an exact pickup/drop point, especially for an unlisted street-food vendor or campus landmark.

The chosen result displays a human-readable label. Coordinates remain stored and sent through the existing API contract but are hidden from the normal interface.

### Technical boundary

```text
LocationPicker UI
  -> RouteBite map-provider adapter
  -> Google Places / Maps in browser
  -> existing { label, latitude, longitude } API payload
  -> existing GeoJSON [longitude, latitude] persistence
```

Server-side route estimates remain behind the existing route-estimate service. Matching continues to use a cheap MongoDB/geometric shortlist before any paid route calculation.

### Required safeguards

- Separate browser-restricted and server-side API keys.
- Restrict browser key by allowed referrer and enabled API.
- Restrict server key by API and infrastructure capability.
- Debounce search and use Places session tokens correctly.
- Request only fields RouteBite uses.
- Configure Google Cloud quotas, budgets and alerts before a public link is shared.
- Never call Routes for every GPS heartbeat.
- Mock the provider in automated tests; do not make CI depend on live Google APIs.
- Show a clear, recoverable error when maps/search is unavailable.
- Keep coordinate controls only as an explicitly labelled development fallback until map behavior is proven; do not expose them as the primary product UX.

### Why not public Nominatim autocomplete

The public OpenStreetMap Nominatim service forbids client-side autocomplete use. MapLibre is a strong open-source renderer, but it does not by itself provide place search, tiles and routing. That stack can reduce provider dependence later, but assembling and operating multiple services now adds avoidable judge-demo risk.

Useful provider references:

- [Google Maps India pricing](https://developers.google.com/maps/billing-and-pricing/pricing-india)
- [Google Places autocomplete guidance](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)
- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
- [MapLibre GL JS documentation](https://www.maplibre.org/maplibre-gl-js/docs/)

---

## 3. Protected Baseline and Non-Regression Policy

The Phase 15 merge is the protected behavioral baseline.

### Git workflow

1. Start each phase from the latest green `main`.
2. Use one named phase branch and one focused pull request.
3. Do not mix unrelated redesign, business-state and database changes.
4. Keep commits small and reversible.
5. Review GitHub Actions before merge.
6. Merge only after the phase exit criteria and relevant manual rehearsal pass.

### Invariants that no redesign may weaken

- MongoDB remains authoritative; Socket.IO remains notification transport.
- REST refresh/reconnect recovers the latest truth.
- Matching begins only after backend-confirmed payment.
- Exactly one partner can accept an order.
- One partner cannot hold incompatible active work.
- Expired offers cannot be accepted.
- Higher price requires customer approval; lower price adjusts automatically.
- Delivery completion requires a valid single-use OTP.
- One completed order creates at most one earning.
- Financial test-mode behavior is not represented as a real bank settlement/refund/payout.
- Admin tools do not provide arbitrary status mutation.
- Coordinates remain GeoJSON `[longitude, latitude]` internally.

### Minimum automated gate for every phase

Run from the repository checkout:

```powershell
cd backend
npm ci
npm test

cd ..\frontend
npm ci
npm run build
```

GitHub Actions must also pass. If a phase changes a protected business flow, run its focused tests and the matching hardening rehearsal(s) relevant to that change.

### Database rehearsal gate

Run only against the configured development database, never production:

```powershell
cd backend
npm run hardening:audit
npm run hardening:accept-race -- --confirm-dev-db
npm run hardening:restart-offer -- --confirm-dev-db
npm run hardening:webhook-idempotency -- --confirm-dev-db
npm run hardening:completion-idempotency -- --confirm-dev-db
```

Not every phase needs all four destructive-isolated rehearsals. Phase 24 requires the complete set. A phase touching matching, payment or completion must run the corresponding script before merge.

### Manual regression principle

The user manually tests only the parts that need a real browser/device, permissions, a third-party checkout, private credentials or human visual judgment. The CTO owns code, automated tests, documentation, branch/PR work and defect fixes.

---

## 4. Phase Roadmap

### Phase 16 — Location Selection Foundation

**Goal:** replace normal raw-coordinate entry with reliable, reusable search/current-location/map-pin selection.

Deliverables:

- map-provider adapter and configuration boundary;
- reusable `LocationPicker` component;
- place search with human-readable selection;
- current-location action with permission/error states;
- draggable/manual pin with reverse-geocoded label where available;
- customer pickup/drop integration;
- partner trip origin/destination integration;
- responsive mobile and desktop behavior;
- provider mocks and component/service tests;
- environment and key-restriction documentation;
- development-only coordinate fallback until browser rehearsal passes.

Compatibility boundary:

- retain the current order/trip API payload and GeoJSON storage;
- no order-state, payment, matching or database migration change;
- an existing saved order/trip remains readable.

Exit criteria:

- customer can choose pickup and drop without typing coordinates;
- partner can choose trip origin and destination without typing coordinates;
- an unlisted vendor can be placed precisely with a pin;
- provider failure produces a useful recovery state;
- backend tests and frontend build pass;
- one ASAP and one scheduled request store correct coordinates;
- user verifies location permission and map interaction on a real browser/device.

Owner involvement required:

- approve Google Maps as the initial provider;
- create/configure the Google Cloud project, billing, quotas and restricted keys;
- place keys in local/deployment environment variables (never send secrets in chat or commit them);
- run the final real-device location rehearsal.

### Phase 17 — Map-Aware Tracking and Route Clarity

**Goal:** make active delivery and planned travel understandable on a map without changing authoritative fulfillment state.

Deliverables:

- customer live-tracking map with partner, pickup and drop markers;
- freshness/accuracy visualization and clear delayed-location recovery;
- route preview where cost and provider response permit;
- partner trip preview before scheduling;
- compact mobile bottom sheet for status/details;
- Socket.IO fast path plus existing REST fallback;
- no route recalculation on every GPS update.

Exit criteria:

- missed socket update recovers automatically from REST;
- stale location is visually distinct from live location;
- refresh retains correct markers and order state;
- route/provider failure does not block status, OTP or completion;
- foreground tracking stops after terminal state.

### Phase 18 — Product Language and Trust

**Goal:** present RouteBite as a credible working product while preserving financial and operational truth.

Deliverables:

- user-facing copy inventory;
- remove repetitive `prototype` and `demo` wording from routine screens;
- centralized `TestEnvironmentNotice` for financial views;
- consistent action/outcome naming;
- display-label mapping for internal demo statuses where appropriate;
- copy tests for high-risk financial statements;
- documentation terminology guide.

Exit criteria:

- normal customer and partner journeys do not repeatedly call the product a prototype;
- every payment/ledger/earning screen remains honest about test-only money movement;
- backend status constants and audit behavior remain unchanged;
- empty/error/recovery copy tells the user what to do next.

### Phase 19 — Compact Design Foundation

**Goal:** correct typography, card scale and spacing globally before redesigning individual pages.

Deliverables:

- audited design tokens for type, spacing, radii, shadows and widths;
- compact form, card, button, badge, table, sheet and feedback primitives;
- responsive application shell and navigation;
- accessibility baseline for focus, contrast, labels, reduced motion and touch targets;
- remove conflicting one-off CSS rules where safe;
- visual QA matrix at mobile, tablet and desktop widths.

Exit criteria:

- utility page titles use a restrained scale;
- cards grow with content rather than arbitrary large minimum heights;
- operational data density improves without cramped touch targets;
- existing routes and actions remain available;
- no horizontal overflow on supported viewport widths.

### Phase 20 — Customer Journey Redesign

**Goal:** make request creation, checkout, matching, delivery and history feel like one coherent journey.

Deliverables:

- guided request flow with location picker;
- compact price and delivery summaries;
- state-driven matching/assignment/pickup/delivery timeline;
- clear price-change decision sheet;
- map-first delivery tracking;
- useful order cards, empty states, retry actions and notifications;
- responsive customer account/history/rating experience.

Exit criteria:

- full customer happy path requires no coordinate knowledge;
- all loading states terminate in success, retry, explicit failure or review;
- refresh/reconnect remains correct;
- Razorpay Test checkout and OTP behavior remain unchanged;
- one full browser delivery path passes.

### Phase 21 — Partner Journey Redesign

**Goal:** make availability, trips, offers, pickup, delivery and earnings fast to operate on a phone.

Deliverables:

- compact live availability/trip control;
- clear location freshness and permission feedback;
- high-signal offer card and countdown;
- focused active-delivery actions;
- route/pickup/drop map context;
- compact earnings and reviews;
- strong unavailable/busy protections.

Exit criteria:

- partner can understand operational status at a glance;
- accepting an offer still locks the partner atomically and makes them unavailable;
- offer expiry/rejection/reconnect behavior remains durable;
- pickup, price and OTP actions remain correctly gated;
- Available Now and Scheduled / On My Way browser paths pass.

### Phase 22 — Admin and Operations Redesign

**Goal:** improve investigation speed without adding unsafe database-control shortcuts.

Deliverables:

- denser attention queue and filters;
- clearer order timeline and related-record grouping;
- responsive financial, offer, matching and recovery panels;
- consistent status and severity system;
- accessible receipt/review handling;
- no generic force-status action.

Exit criteria:

- failed and completed orders are understandable without database access;
- payment, order and settlement concepts remain visually distinct;
- admin authorization and privacy tests pass;
- known complete and failed rehearsal orders remain coherent.

### Phase 23 — Pilot Readiness

**Goal:** close the gap between a strong judged MVP and a controlled real-user pilot.

Deliverables:

- deployment choice and same-origin production build;
- environment separation and secret rotation checklist;
- logging, error monitoring and uptime/readiness checks;
- rate-limit and security review;
- backup/restore and rollback drill;
- Maps/Razorpay/Cloudinary/Resend quota and privacy checks;
- pilot operations, support and incident checklist;
- legal, food-handling, partner identity and real-payment gaps documented as launch blockers where applicable.

Exit criteria:

- deployment is reproducible from a Git commit;
- no secret or development fallback reaches production;
- deep links, secure cookies, WebSockets and maps work over HTTPS;
- restore/rollback steps are proven;
- public claims match actual capabilities.

### Phase 24 — Judge Release Rehearsal and Hardening

**Goal:** freeze a polished, repeatable judge release without weakening any Phase 15 invariant.

Deliverables:

- automated CI and complete hardening rehearsal;
- two-device customer/partner walkthrough;
- Available Now and Scheduled / On My Way paths;
- maps, checkout, price increase/decrease, reconnect, OTP, rating and admin inspection;
- accessibility, responsive, performance and empty/failure-state pass;
- judge narrative and reset/recovery runbook;
- tagged known-good release commit.

Exit criteria:

- full hardening suite passes;
- invariant audit reports 0 unexplained errors/warnings;
- no tested flow requires MongoDB editing;
- the demo can be repeated from documented setup steps;
- a known-good commit can be redeployed or checked out quickly.

---

## 5. Decision Checkpoints

No large product decision should be hidden inside a code commit.

| Decision | CTO recommendation | Status |
| --- | --- | --- |
| Initial map/search provider | Google Maps behind an adapter | Awaiting joint approval |
| Normal location input | Search + current location + draggable pin; hide coordinates | Awaiting joint approval |
| Brand direction | Keep coral/burgundy/cream and route motif | Awaiting joint approval |
| Utility UI density | Compact type/cards; large display type only for true hero content | Awaiting joint approval |
| Product terminology | Remove repetitive prototype/demo UI labels | Awaiting joint approval |
| Financial disclosure | One reusable Test environment notice; never imply real settlement | Awaiting joint approval |
| Delivery order | Phase 16 location first, then tracking, language and UI system | Awaiting joint approval |

Once approved, record the decisions in `DECISIONS.md` and change this roadmap status from active draft to confirmed.

---

## 6. Ownership Model

### CTO / engineering ownership

- repository and documentation audit;
- technical/product recommendation with explicit tradeoffs;
- branch creation, implementation, tests, commits and pull requests;
- GitHub Actions review and fixes;
- compatibility and security review;
- migration/rollback planning;
- updating this roadmap, phase document and progress report;
- explaining exactly what human rehearsal is required.

### Product-owner involvement only where necessary

- approve material product/provider decisions after reviewing the recommendation;
- create and secure third-party accounts, billing and private credentials;
- grant real device/browser permissions;
- complete Razorpay Test checkout or email verification when human interaction is required;
- visually assess judge-facing UI and share product feedback;
- approve merge/release at the agreed checkpoint.

The product owner should not be asked to edit source code, manually repair MongoDB, or run avoidable engineering diagnostics.

---

## 7. Required Documentation Per Phase

Every phase must leave the repository with:

1. a `docs/PHASE_<N>_<NAME>.md` file containing goal, scope, architecture, risks, manual test and exit criteria;
2. updated `PROGRESS_REPORT.md` status and evidence;
3. any new confirmed decision in `DECISIONS.md`;
4. environment/configuration changes in the relevant `.env.example` and deployment documentation;
5. exact commands for automated and human verification;
6. the merge commit or PR reference after completion.

If code and documentation disagree, the discrepancy is a defect. The canonical order-state model and protected business invariants continue to win over visual/UI descriptions.

---

## 8. First Action After Joint Approval

Create/continue branch:

```text
phase-16-location-experience
```

Then implement Phase 16 in small commits, beginning with the provider boundary, environment validation and reusable location model/component tests before replacing existing coordinate controls.

The old controls stay available behind a development fallback until search, current location and pin selection all pass. This gives RouteBite a safe rollback path while the map experience is being introduced.
