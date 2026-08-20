# RouteBite — Decision Log

> This document records important product and architecture decisions so that future implementation work does not silently contradict previously agreed assumptions.
>
> `PROJECT_CONTEXT.md` explains the product in detail. This file intentionally does **not** repeat every workflow or explanation. It records only decisions, hypotheses, deferred areas, and unresolved decisions.

## Status values

- **CONFIRMED** — accepted as current product truth.
- **CONFIRMED FOR PROTOTYPE** — must be implemented in the working prototype; production implementation may later change.
- **PROTOTYPE HYPOTHESIS** — initial configurable value/rule chosen so the prototype can work; must be validated with real usage.
- **PROPOSED** — preferred engineering direction, but detailed design may still change it.
- **DEFERRED** — intentionally postponed so it does not block the prototype.
- **OPEN** — a decision is still required.
- **SUPERSEDED** — replaced by a later ADR.

---

## ADR-001 — Initial product category

**Status:** CONFIRMED

**Decision:** RouteBite will initially focus on **food delivery**.

**Reasoning:** The original problem and strongest user story are food-specific. Keeping the first category narrow reduces product, trust, operational, and compliance complexity.

**Future:** The network may later support other hyperlocal items, but that is not current prototype scope.

---

## ADR-002 — Campus-first launch

**Status:** CONFIRMED

**Decision:** The initial pilot will target a **college campus and nearby high-demand food areas**, not an entire city.

**Reasoning:** RouteBite is a two-sided marketplace. Concentrating demand and supply geographically improves the probability of useful matches and makes the first prototype easier to validate.

---

## ADR-003 — Vendor registration is not required

**Status:** CONFIRMED

**Decision:** A street-food vendor or local shop does **not** need to register with RouteBite before a customer can request food from that location.

**Reasoning:** The product's core opportunity is enabling delivery from local/offline places that may not participate in existing delivery marketplaces.

---

## ADR-004 — Coordinates are the logistical source of truth

**Status:** CONFIRMED

**Decision:** Matching will rely primarily on **pickup coordinates, drop coordinates, partner route, current location, and time**, not vendor name alone.

**Implication:** Vendor/shop name remains descriptive information that helps the delivery partner locate the seller.

---

## ADR-005 — Manual pickup location must be supported

**Status:** CONFIRMED

**Decision:** If a vendor cannot be found through place search, the customer must still be able to **select/drop a pickup pin manually** and provide landmarks/instructions.

**Reasoning:** Requiring every vendor to exist in RouteBite or a third-party catalogue would recreate the catalogue limitation RouteBite is intended to avoid.

---

## ADR-006 — One partner identity, two supply modes

**Status:** CONFIRMED

**Decision:** One RouteBite delivery-partner identity supports:

1. **On My Way** — already travelling A → B and willing to carry compatible orders.
2. **Available to Deliver** — intentionally online and willing to make dedicated delivery trips.

**Reasoning:** The first mode monetizes existing movement; the second provides fallback supply and supports frequent/professional delivery work.

---

## ADR-007 — Casual and professional partners share the same network

**Status:** CONFIRMED

**Decision:** RouteBite will support both occasional/casual partners and partners who want to work more regularly in the same supply network.

**Reasoning:** Splitting them into separate networks would reduce liquidity without providing a clear prototype benefit.

---

## ADR-008 — Automatic platform-assisted matching

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** The customer will create an order request and **RouteBite will automatically discover/rank compatible partners and dispatch offers**.

The customer will not be required to manually browse and contact multiple travellers.

**Reasoning:** Manual partner hunting creates friction, inconsistent response times, and does not scale into a reliable product workflow.

---

## ADR-009 — Chat/call is for clarification, not matching

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Customer-partner communication can be available after assignment for ambiguous landmarks, substitutions, or pickup instructions, but basic matching must work without a phone conversation.

---

## ADR-010 — Matching is spatial and temporal

**Status:** CONFIRMED

**Decision:** Geographic route compatibility alone is insufficient.

A partner should only be eligible when they can realistically reach pickup X and deliver to Y within the customer's required time window with an acceptable detour.

**Eligibility dimensions include:**

- route compatibility,
- travel direction,
- scheduled/actual departure,
- current location,
- route progress,
- pickup reachability,
- predicted pickup time,
- predicted delivery time,
- detour,
- customer delivery window.

---

## ADR-011 — Partner trip states must distinguish future and immediate availability

**Status:** CONFIRMED

**Decision:** A scheduled future trip must not be represented as immediate availability.

Core states include:

- `AVAILABLE_NOW` — partner is currently available for delivery work.
- `TRIP_SCHEDULED` — partner has declared a future A → B trip.
- `TRIP_ACTIVE` — the scheduled/on-my-way trip has started and current location/progress becomes authoritative.

**Reasoning:** A traveller who creates a 6 PM trip at 4 PM must not receive an ASAP 4:15 PM order simply because the route is geographically compatible.

---

## ADR-012 — ASAP and scheduled delivery modes

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** The product direction supports:

- **ASAP** delivery,
- **Schedule for Later** delivery windows.

**Reasoning:** Scheduled delivery allows RouteBite to use travellers who know in advance that they will travel along a useful route later in the day.

---

## ADR-013 — Deterministic matching before machine learning

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** The prototype will use transparent deterministic matching rather than ML ranking.

Pipeline:

`Discover → Hard Eligibility Filter → Rank → Dispatch`

**Reasoning:** We currently have no meaningful historical dataset that would justify ML, and deterministic logic is easier to debug and explain during validation.

---

## ADR-014 — Initial matching configuration values

**Status:** PROTOTYPE HYPOTHESIS

**Decision:** Start with configurable values approximately equal to:

```text
MAX_ASAP_DELIVERY_MINUTES = 45
MAX_ROUTE_DETOUR_MINUTES = 10
MAX_ROUTE_DETOUR_KM = 1.5
OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20
DEFAULT_DEPARTURE_FLEX_MINUTES = 15
```

**Important:** These are not validated business rules. They must remain configurable and should change based on pilot data.

---

## ADR-015 — Detour is measured by time and distance

**Status:** CONFIRMED

**Decision:** On-my-way route compatibility will consider **additional travel time as well as additional distance**.

**Reasoning:** The same 1 km detour can have radically different costs depending on traffic and road conditions.

---

## ADR-016 — Route progress matters after a trip starts

**Status:** CONFIRMED

**Decision:** Once a trip becomes active, current route progress must be considered so a partner is not offered pickups they have already substantially passed.

The system should eventually represent data such as:

- route ID,
- current location,
- progress along route,
- trip status,
- last location update.

---

## ADR-017 — Batched offer dispatch

**Status:** PROTOTYPE HYPOTHESIS

**Decision:** Do not broadcast every order to every eligible partner.

Initial strategy:

1. rank eligible candidates,
2. offer to the top batch (initially 3),
3. wait approximately 20 seconds,
4. offer to the next candidates,
5. broaden constraints and/or incentives only when necessary.

**Reasoning:** This reduces partner notification spam while keeping acceptance latency reasonable.

---

## ADR-018 — Only one partner can win an order

**Status:** CONFIRMED

**Decision:** Order acceptance must be atomic/transactional so that if multiple partners attempt to accept simultaneously, only one assignment succeeds.

Conceptual transition:

`REQUESTED → ASSIGNED_TO_PARTNER`

All later acceptance attempts must fail cleanly.

---

## ADR-019 — Graceful matching failure

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** RouteBite must explicitly handle the case where nobody accepts an order.

Fallback may progress through:

`strict match → available-now supply → broader acceptable constraints → optional higher incentive → no feasible partner`

The customer should receive a clear failure/retry/schedule-later experience rather than indefinite waiting.

---

## ADR-020 — Simple prototype pricing

**Status:** PROTOTYPE HYPOTHESIS

**Decision:** Use a simple configurable pricing model for the prototype.

Initial illustrative values:

```text
Customer-entered food estimate
Partner delivery earning = ₹40
Platform fee = ₹10
```

Possible incentive escalation may use values such as `₹40 → ₹50 → ₹60` when an order receives no acceptance.

**Important:** These values are not validated unit economics.

---

## ADR-021 — Test-mode payment for the working prototype

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Use **Razorpay Test Mode + an internal demo ledger** for the prototype.

No real money needs to move during the presentation prototype.

Prototype payment lifecycle may include:

- `PAYMENT_PENDING`
- `TEST_PAYMENT_SUCCESS`
- `ORDER_ACTIVE`
- `DELIVERED`
- `PARTNER_EARNING_RECORDED`
- `DEMO_SETTLED`

**Reasoning:** This demonstrates a realistic checkout and accounting flow without prematurely building production settlement/compliance infrastructure.

**Production:** Real settlements, payouts, refunds, reconciliation, authorization/capture, and payment compliance are deferred.

---

## ADR-022 — Partner should not carry customer payment risk

**Status:** CONFIRMED PRODUCT PRINCIPLE

**Decision:** Production payment design should avoid forcing the partner to permanently finance the customer's food purchase and hope to be reimbursed later.

**Reasoning:** This creates partner-side fraud/cancellation exposure and makes supply harder to acquire.

The prototype will represent reimbursement through the internal demo ledger rather than real settlement.

---

## ADR-023 — Price-change approval flow

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** If actual food price differs from the customer's estimate:

1. partner enters actual bill amount,
2. partner may upload receipt/proof,
3. customer sees the difference,
4. customer approves or contacts the partner,
5. prototype updates the internal/demo amount.

Production authorization/capture mechanics remain deferred.

---

## ADR-024 — Prototype cancellation rules

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:**

- Before food purchase (`REQUESTED`, `MATCHING`, `ASSIGNED`), customer cancellation can be allowed.
- After `PICKED_UP`, unrestricted cancellation is not allowed; manual admin/support handling is used.
- Partner cancellation before pickup should trigger rematching when possible.
- Partner cancellation after purchase moves to admin intervention.

Production refunds, penalties, and liability policies are deferred.

---

## ADR-025 — OTP/equivalent delivery verification

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Use an OTP or equivalent handoff confirmation before marking an order successfully delivered.

**Reasoning:** It creates basic evidence of customer-partner handoff and reduces simple non-delivery disputes.

---

## ADR-026 — Campus partner identity model

**Status:** CONFIRMED FOR CAMPUS PROTOTYPE

**Decision:** Production-grade KYC will not block the prototype.

Initial partner verification will use:

- phone OTP,
- profile photo,
- college identity/enrollment information,
- college ID upload where applicable,
- manual admin approval.

Possible states:

`PENDING_VERIFICATION → APPROVED`

**Important:** RouteBite must not represent this as government-backed KYC.

**Reasoning:** Collecting full Aadhaar documents is unnecessary for the campus prototype and creates avoidable sensitive-data/security burden.

---

## ADR-027 — Trust is a first-class requirement

**Status:** CONFIRMED

**Decision:** Identity, reputation, order history, verification, and abuse controls must be considered from the beginning rather than only after scale.

**Reasoning:** RouteBite places strangers between food, money, and physical delivery. Trust failures can destroy marketplace adoption even when matching works correctly.

---

## ADR-028 — Google Maps Platform for the prototype

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Use Google Maps Platform for prototype mapping/navigation capabilities including:

- interactive map,
- pickup/drop pins,
- place search,
- geocoding,
- routes,
- distances,
- ETA,
- route matrix where needed.

If a vendor cannot be found through place search, the manual pickup pin remains available.

**Operational rule:** Restrict API keys, configure quotas/billing alerts, and avoid unnecessary route API calls.

---

## ADR-029 — Foreground real-time location tracking for the prototype

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Do not continuously track every partner at high frequency.

- `AVAILABLE_NOW` partners update location periodically for matching.
- During an active delivery, foreground location can be updated approximately every **10–15 seconds**.
- Active delivery tracking stops after completion.

Reliable mobile background tracking is deferred until a stronger native/mobile implementation is required.

---

## ADR-030 — Prototype notifications remain simple

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Start with:

- in-app notifications/status updates,
- phone OTP where required.

Do not block the prototype on WhatsApp, email, SMS status updates, or full push-notification infrastructure.

---

## ADR-031 — Admin dashboard is required for the prototype

**Status:** CONFIRMED FOR PROTOTYPE

**Decision:** Build a basic admin/operations experience capable of manually handling early-stage tasks such as:

- pending partner verification,
- approve/reject partner,
- active/failed orders,
- order state review,
- purchase receipt review,
- basic dispute/problem handling,
- manual cancellation/intervention.

**Reasoning:** Early-stage manual operations are acceptable and prevent unnecessary automation from blocking validation.

---

## ADR-032 — Marketplace liquidity is the primary business risk

**Status:** CONFIRMED

**Decision:** Supply-demand liquidity must be treated as a core validation problem.

Pilot metrics should include at least:

- match rate,
- time to acceptance,
- completion rate,
- partner acceptance rate,
- cancellation rate,
- repeat customer usage.

---

## ADR-033 — Working name is temporary

**Status:** CONFIRMED

**Decision:** `RouteBite` is a working project name, not yet the final brand.

Branding will not block prototype development.

---

## ADR-034 — Future “anything from A to B” expansion is not current scope

**Status:** CONFIRMED

**Decision:** Broader hyperlocal delivery may be explored later, but non-food categories must not expand prototype requirements unless explicitly reconsidered.

---

## ADR-035 — Technology must follow requirements

**Status:** CONFIRMED

**Decision:** Technologies will be selected based on the concrete problem each component must solve.

Examples:

- maps technology must solve geocoding/routing/ETA needs,
- real-time technology must solve location/order events,
- database choices must match transactional/geospatial requirements,
- infrastructure must match prototype deployment needs.

Avoid adding technologies merely because they are popular.

---

## ADR-036 — Avoid premature microservices

**Status:** PROPOSED

**Decision:** Prefer a **modular monolith or similarly simple backend architecture** unless detailed architecture work identifies a concrete reason to distribute services immediately.

**Reasoning:** The prototype values iteration speed, debuggability, low operational overhead, and simple deployment.

**Reconsider when:**

- independent scaling becomes necessary,
- team/module ownership requires isolation,
- deployment coupling becomes a measurable problem,
- reliability requirements justify separate services.

---

## ADR-037 — Working prototype over production-scale sophistication

**Status:** CONFIRMED

**Decision:** The first milestone is a coherent **end-to-end working prototype** suitable for idea demonstration and validation.

Do not block the prototype on:

- production settlement infrastructure,
- government-grade KYC,
- ML matching,
- advanced fraud models,
- complex surge pricing,
- multi-order optimization,
- city-scale dispatch,
- large microservice architecture.

**Reasoning:** These are real future problems, but solving them before product selection/validation would create complexity without evidence that the product itself works.

---

# Deferred Production Decisions

The following are intentionally **DEFERRED** and must be revisited before real commercial deployment.

## Payments

- real customer settlement,
- partner bank payouts,
- marketplace split settlements,
- payment authorization/capture,
- automated refunds,
- reconciliation,
- payment compliance.

## Identity / KYC

- government-backed identity verification,
- Aadhaar/offline verification strategy if legally/product-appropriate,
- professional/non-campus partner KYC,
- external KYC providers,
- document authenticity verification,
- bank-account identity matching.

## Food safety / liability

- food tampering liability,
- vendor quality responsibility,
- packaging standards,
- delivery damage,
- food safety policy,
- customer/partner/platform legal terms.

## Disputes / fraud

- automated refund decisions,
- fraud scoring,
- chargeback handling,
- evidence arbitration,
- suspension/penalty algorithms.

## Advanced pricing

- dynamic surge pricing,
- supply/demand forecasting,
- ML pricing,
- automated subsidy optimization.

## Advanced matching

- ML candidate ranking,
- multi-order/batch routing,
- acceptance prediction,
- demand forecasting,
- city-scale optimization.

---

# Remaining Open Decisions Before Implementation

These still need dedicated product/architecture work:

1. Exact frontend experience for consumer vs partner.
2. One application/interface vs separate consumer and partner applications.
3. Exact order state machine and allowed state transitions.
4. Exact partner rating model.
5. Exact reliability/completion score definition.
6. Exact admin dashboard fields and permissions.
7. Initial vendor/pickup waiting-time assumption.
8. Overall system architecture.
9. Frontend/backend technology choices.
10. Database and geospatial technology.
11. Authentication/session architecture.
12. Real-time communication technology.
13. API contracts.
14. Deployment environment and CI/CD strategy.
15. Logging/monitoring strategy for the prototype.
16. Final startup/product name.

---

# Decision Maintenance Rule

Whenever a major decision changes:

1. Do not silently contradict an existing ADR.
2. If the old decision is no longer valid, mark it **SUPERSEDED** and reference the replacing ADR.
3. Update `PROJECT_CONTEXT.md` if the change affects the overall product definition.
4. Update the relevant specialized document such as `USER_FLOWS.md`, `PAYMENT_FLOW.md`, `MATCHING_ENGINE.md`, `ARCHITECTURE.md`, or `API_DESIGN.md`.
5. Keep prototype hypotheses configurable so real pilot data can replace assumptions without major rewrites.
