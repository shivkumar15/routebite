# RouteBite — Decision Log

> This document records important product and architecture decisions so implementation does not silently contradict previously agreed assumptions.
>
> `PROJECT_CONTEXT.md` explains the product in detail. Specialized implementation contracts live in `USER_FLOWS.md`, `PRODUCT_REQUIREMENTS.md`, `PAYMENT_FLOW.md`, `MATCHING_ENGINE.md`, `ARCHITECTURE.md`, `TECH_STACK.md`, and `DATABASE_DESIGN.md`.

## Status values

- **CONFIRMED** — accepted as current product truth.
- **CONFIRMED FOR PROTOTYPE** — must be implemented in the working prototype; production implementation may later change.
- **PROTOTYPE HYPOTHESIS** — initial configurable rule/value selected so the prototype can work; must be validated.
- **PROPOSED** — preferred direction but not yet locked.
- **DEFERRED** — intentionally postponed.
- **OPEN** — a decision is still required.
- **SUPERSEDED** — replaced by a later decision.

---

## ADR-001 — Initial product category

**Status:** CONFIRMED

**Decision:** RouteBite initially focuses on **food delivery**. Broader hyperlocal delivery is future scope.

---

## ADR-002 — Campus-first launch

**Status:** CONFIRMED

**Decision:** Start with one college campus and nearby high-demand food areas/routes rather than an entire city.

---

## ADR-003 — Vendor registration is not required

**Status:** CONFIRMED

**Decision:** A street-food/local vendor does not need to register with RouteBite before a customer can request pickup from that location.

---

## ADR-004 — Coordinates are the logistical source of truth

**Status:** CONFIRMED

**Decision:** Matching relies primarily on pickup/drop coordinates, route/current location and time. Vendor name is descriptive information.

---

## ADR-005 — Manual pickup location must be supported

**Status:** CONFIRMED

**Decision:** If place search cannot find a vendor, customer can manually drop/select a pickup pin and provide landmarks/instructions.

---

## ADR-006 — One partner identity, two supply modes

**Status:** CONFIRMED

**Decision:** One partner identity supports:

1. **On My Way** — existing A → B journey.
2. **Available to Deliver** — intentionally online for dedicated delivery work.

---

## ADR-007 — Casual and regular partners share one network

**Status:** CONFIRMED

**Decision:** Occasional travellers and more frequent delivery partners participate in the same supply network.

---

## ADR-008 — Automatic platform-assisted matching

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Customer creates a request and RouteBite automatically discovers/ranks compatible partners and dispatches offers. Manual partner browsing is not the primary flow.

---

## ADR-009 — Chat/call is for clarification, not matching

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Communication may be available after assignment for pickup clarification, but matching must work without a conversation.

---

## ADR-010 — Matching is spatial and temporal

**Status:** CONFIRMED

**Decision:** Geographic compatibility alone is insufficient. Eligibility includes route/direction, time, progress, pickup reachability, ETA, detour and customer delivery window.

---

## ADR-011 — Future trip and immediate availability are different states

**Status:** CONFIRMED

**Decision:** Distinguish:

```text
AVAILABLE_NOW
TRIP_SCHEDULED
TRIP_ACTIVE
```

A future trip must not be treated as immediate supply.

---

## ADR-012 — ASAP and scheduled delivery modes

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Customer supports **ASAP** and **Schedule for Later** delivery windows.

---

## ADR-013 — Deterministic matching before ML

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Use transparent deterministic matching:

```text
Discover → Hard Filter → Rank → Dispatch
```

ML matching is deferred until useful real data exists.

---

## ADR-014 — Initial matching configuration

**Status:** PROTOTYPE HYPOTHESIS

```text
MAX_ASAP_DELIVERY_MINUTES = 45
MAX_ROUTE_DETOUR_MINUTES = 10
MAX_ROUTE_DETOUR_KM = 1.5
OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20
DEFAULT_DEPARTURE_FLEX_MINUTES = 15
```

Values remain configurable.

---

## ADR-015 — Detour uses time and distance

**Status:** CONFIRMED

**Decision:** On-my-way compatibility evaluates extra time **and** extra distance.

---

## ADR-016 — Route progress matters after trip start

**Status:** CONFIRMED

**Decision:** Active-trip matching uses current location/progress and should reject pickups already substantially passed.

---

## ADR-017 — Batched offer dispatch

**Status:** PROTOTYPE HYPOTHESIS

**Decision:** Rank candidates, offer approximately the top 3, wait about 20 seconds, then continue to later candidates/fallback.

---

## ADR-018 — Exactly one partner can win an order

**Status:** CONFIRMED

**Decision:** Acceptance must be atomic/transactional. Concurrent accept attempts produce one assignment.

---

## ADR-019 — Graceful matching failure

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Matching must terminate with a clear customer outcome if no partner accepts rather than search indefinitely.

---

## ADR-020 — Simple prototype pricing

**Status:** PROTOTYPE HYPOTHESIS

Initial illustrative values:

```text
customer-entered food estimate
partner earning = ₹40
platform fee = ₹10
```

Possible incentive tiers such as ₹40 → ₹50 → ₹60 remain configurable hypotheses.

---

## ADR-021 — Razorpay Test Mode + internal demo ledger

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** No real marketplace settlement is required for the presentation prototype. Use Razorpay Test Mode for checkout and an internal ledger to demonstrate financial outcomes.

---

## ADR-022 — Partner should not carry permanent customer payment risk

**Status:** CONFIRMED

**Decision:** Production design should avoid requiring the partner to permanently finance the customer's food purchase and hope for reimbursement.

---

## ADR-023 — Price-change approval

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Partner enters actual food price/receipt. Higher price requires customer approval; lower price updates the demo financial outcome.

---

## ADR-024 — Prototype cancellation rules

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Cancellation is relatively simple before purchase. After pickup/purchase, unrestricted customer cancellation is removed and exceptional cases go to admin review. Partner cancellation before purchase attempts rematching.

---

## ADR-025 — Delivery OTP

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** OTP/equivalent verification is required before successful handoff completion.

---

## ADR-026 — Campus partner identity model

**Status:** CONFIRMED FOR CAMPUS PROTOTYPE

**Decision:** Use phone verification, profile photo, college identity/ID where applicable, and manual admin approval. Do not claim government-backed KYC and do not require full Aadhaar collection.

---

## ADR-027 — Trust is first-class

**Status:** CONFIRMED

**Decision:** Identity, reputation, history, verification and abuse controls are product requirements from the beginning.

---

## ADR-028 — Google Maps Platform

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Use Google Maps Platform for map UI, place search, pins, geocoding, routes, distance, ETA and route matrix where needed.

---

## ADR-029 — Foreground location tracking

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Do not continuously track everyone. `AVAILABLE_NOW` partners update periodically; active delivery location updates approximately every 10–15 seconds in foreground; stop after completion.

---

## ADR-030 — Simple prototype notifications

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Start with in-app realtime/status updates and OTP. WhatsApp/email/full push infrastructure does not block V1.

---

## ADR-031 — Admin dashboard required

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Admin can approve/reject partners, inspect orders/receipts, monitor failed states and handle manual prototype intervention.

---

## ADR-032 — Liquidity is the primary marketplace business risk

**Status:** CONFIRMED

**Decision:** Pilot metrics must track match rate, time to acceptance, completion, partner acceptance, cancellation and repeat usage.

---

## ADR-033 — RouteBite is a temporary working name

**Status:** CONFIRMED

---

## ADR-034 — “Anything from A to B” is not V1 scope

**Status:** CONFIRMED

---

## ADR-035 — Technology follows product requirements

**Status:** CONFIRMED

**Decision:** Add technology only when it solves a concrete requirement.

---

## ADR-036 — Modular monolith, not microservices

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** The first implementation is a modular monolith. Microservices are deferred until there is measured scaling/team/reliability justification.

---

## ADR-037 — Working prototype before production-scale sophistication

**Status:** CONFIRMED

**Decision:** The first milestone is a coherent end-to-end prototype. Production settlements, government-grade KYC, ML matching, advanced fraud, city-scale dispatch and similar systems do not block it.

---

## ADR-038 — One role-aware web application

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Customer, partner and admin experiences live in one React web application. A normal user can order food and may later gain partner capability after approval.

**Reasoning:** Casual travellers should not require a second RouteBite account/application to become supply.

---

## ADR-039 — MERN+ is the prototype technology direction

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** The prototype will be built primarily with technologies familiar to a MERN developer:

```text
MongoDB Atlas
Express.js
React
Node.js
Mongoose
```

Specialized external additions are limited to:

```text
Socket.IO
Google Maps Platform
Razorpay Test Mode
Cloudinary
```

**Reasoning:** Developer familiarity reduces learning overhead, debugging time and implementation risk. A heavier stack was judged unnecessary for the first prototype.

---

## ADR-040 — Express.js replaces NestJS for the prototype

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Use Node.js + Express.js rather than NestJS.

**Structure requirement:** Raw Express must remain layered:

```text
Route → Middleware → Controller → Service → Mongoose
```

Business logic belongs in services, not large route/controller handlers.

---

## ADR-041 — MongoDB Atlas + Mongoose replace PostgreSQL + Prisma

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** MongoDB Atlas is the authoritative durable database and Mongoose is the ODM.

**Correctness requirement:** MongoDB must still enforce critical behavior through:

- atomic conditional updates,
- unique indexes,
- transactions for multi-document invariants,
- explicit status enums,
- idempotency keys.

The previous PostgreSQL/Prisma-specific design is superseded.

---

## ADR-042 — MongoDB geospatial shortlist + Google Maps final route checks

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Use MongoDB `2dsphere`/GeoJSON queries for inexpensive nearby candidate discovery, then Google Maps for road ETA/distance/route compatibility on a small shortlist.

**Reasoning:** MongoDB proximity is cheap but straight-line distance must not become final eligibility.

---

## ADR-043 — Socket.IO for realtime UI communication

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Use Socket.IO on the Express HTTP server for partner offers, order status events and live location updates.

**Reliability rule:** MongoDB is authoritative; socket events are notifications only.

---

## ADR-044 — Same-origin single Node deployment

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Prefer one production Node/Express deployment that serves:

```text
React static build
REST API
Socket.IO
lightweight periodic jobs
```

**Reasoning:** This reduces CORS, cookie, deployment and socket configuration bugs.

---

## ADR-045 — JWT HttpOnly cookie authentication

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Use familiar MERN authentication with password hashing via bcrypt and JWT stored in an HttpOnly cookie. Phone OTP verification remains a separate product verification flow.

**Security rule:** Authorization is always checked server-side; frontend route hiding is not security.

---

## ADR-046 — No Redis/message queue dependency initially

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Do not add Redis, BullMQ, pg-boss, RabbitMQ or Kafka for V1.

Offer/price/OTP deadlines are persisted in MongoDB. Lightweight periodic jobs may scan expired records.

**Correctness rule:** APIs themselves check `expiresAt`, so correctness does not depend on the periodic job firing exactly on time.

---

## ADR-047 — Cloudinary for prototype file storage

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Store profile photos, college verification files and receipts in Cloudinary; MongoDB stores metadata/reference IDs.

**Privacy rule:** Identity documents must use private/authenticated access and must not be exposed as permanent public URLs.

---

## ADR-048 — JavaScript remains the implementation language for V1

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Use modern JavaScript for React and Node/Express rather than requiring a TypeScript migration before the prototype.

**Reasoning:** Familiarity is currently more valuable than introducing another language/tooling migration.

**Bug controls:** express-validator, Mongoose schemas, centralized constants/state transitions, ESLint and critical tests compensate for JavaScript's dynamic typing.

TypeScript may be reconsidered later.

---

# Deferred Production Decisions

The following remain intentionally deferred.

## Payments

- real settlement,
- bank payouts,
- split settlement,
- production authorization/capture,
- automated refunds,
- reconciliation,
- payment compliance.

## Identity / KYC

- government-backed identity verification,
- professional-partner KYC,
- Aadhaar/offline verification strategy if appropriate,
- document authenticity providers,
- bank-account identity matching.

## Food safety / liability

- food tampering liability,
- vendor quality responsibility,
- packaging standards,
- food safety/legal terms.

## Disputes / fraud

- automated refund decisions,
- fraud scoring,
- chargebacks,
- evidence arbitration,
- automated suspension/penalty systems.

## Advanced pricing

- surge pricing,
- demand forecasting,
- automated subsidy optimization,
- ML pricing.

## Advanced matching

- ML candidate ranking,
- multi-order batching,
- acceptance prediction,
- demand forecasting,
- city-scale optimization.

## Infrastructure scaling

- Redis/job queues,
- message brokers,
- microservices,
- Kubernetes,
- multiple specialized databases.

These should be introduced only when measured requirements justify them.

---

# Remaining Open Decisions Before Coding

Many earlier open questions have now been resolved by `USER_FLOWS.md`, `ARCHITECTURE.md`, `TECH_STACK.md`, and `DATABASE_DESIGN.md`.

Remaining meaningful decisions include:

1. exact partner reliability score formula,
2. exact rating aggregation/display rules,
3. final detailed admin permission matrix,
4. final vendor wait-time starting value if not already fixed in configuration,
5. exact REST API contracts and error codes,
6. exact development OTP implementation/provider boundary,
7. final deployment provider (Render/Railway/etc.),
8. final brand/product name.

These do not prevent writing `API_DESIGN.md` and scaffolding the application.

---

# Decision Maintenance Rule

Whenever a major decision changes:

1. do not silently contradict an existing ADR,
2. mark replaced decisions `SUPERSEDED` when applicable,
3. update the specialized document,
4. update project context when the overall project definition materially changes,
5. keep prototype hypotheses configurable,
6. prefer the smallest correct implementation that the developer can confidently understand and debug.
