# RouteBite — Decision Log

> This document records important product and architecture decisions so that future implementation work does not silently contradict previously agreed assumptions.
>
> Status values:
> - **CONFIRMED** — accepted and should be treated as current truth.
> - **PROPOSED** — preferred direction but not yet locked.
> - **OPEN** — decision still required.
> - **SUPERSEDED** — replaced by a later ADR.

---

## ADR-001 — Initial product category

**Status:** CONFIRMED

**Decision:**
RouteBite will initially focus on **food delivery**.

**Reasoning:**
The original problem and strongest user story are food-specific. Keeping the first category narrow reduces product, trust, operations and compliance complexity.

**Future:**
The underlying network may later support other hyperlocal items, but that is not V1 scope.

---

## ADR-002 — Campus-first launch

**Status:** CONFIRMED

**Decision:**
The initial pilot will target a **college campus and nearby high-demand food areas**, not an entire city.

**Reasoning:**
RouteBite is a two-sided marketplace. Concentrating demand and supply geographically improves the chance that users can find a compatible delivery partner quickly enough.

---

## ADR-003 — Vendor registration is not required in V1

**Status:** CONFIRMED

**Decision:**
A street-food vendor or local shop does **not** need to register with RouteBite before a customer can request food from that location.

**Reasoning:**
The core opportunity is enabling delivery from local/offline places that may not participate in digital marketplaces.

**Implication:**
The customer must be able to provide enough pickup information for the partner to locate the seller.

---

## ADR-004 — Coordinates are fundamental to matching

**Status:** CONFIRMED

**Decision:**
Matching should rely on **pickup coordinates, drop coordinates and partner route/current location**, rather than depending on vendor name as the primary key.

**Reasoning:**
A vendor may be absent from RouteBite's own database. Coordinates still allow the platform to reason about route compatibility and distance.

**Implication:**
Vendor/shop name remains useful descriptive metadata for the partner.

---

## ADR-005 — Manual pickup location must be supported

**Status:** CONFIRMED

**Decision:**
If a vendor cannot be found through place search, the customer must still be able to **drop/select a pickup pin manually** and provide landmarks/instructions.

**Reasoning:**
Requiring every vendor to exist in a third-party places database would recreate the same catalogue limitation RouteBite is intended to avoid.

---

## ADR-006 — One partner identity, two availability modes

**Status:** CONFIRMED

**Decision:**
A RouteBite delivery partner can participate in two modes:

1. **On My Way** — already travelling A → B and willing to carry a compatible order.
2. **Available to Deliver** — intentionally goes online and is willing to make a dedicated delivery trip.

**Reasoning:**
The first mode monetizes existing movement; the second provides fallback supply and supports professional or frequent gig workers.

---

## ADR-007 — Casual and professional partners use the same network

**Status:** CONFIRMED

**Decision:**
RouteBite should support both occasional/casual delivery partners and people who want to work more professionally.

**Reasoning:**
Artificially splitting these users into different supply networks would reduce liquidity without providing a clear V1 benefit.

---

## ADR-008 — Platform-assisted matching preferred over manual partner hunting

**Status:** PROPOSED

**Decision:**
Prefer a flow where the platform identifies compatible partners and offers the request to them instead of requiring the consumer to manually contact multiple travellers.

**Reasoning:**
Manual partner hunting creates friction, poor response times and weak scalability.

**Why not confirmed yet:**
The original concept was consumer-led browsing/contact, so this product interaction needs explicit confirmation before implementation.

---

## ADR-009 — Chat/call is a clarification channel, not the core matching mechanism

**Status:** PROPOSED

**Decision:**
Customer-partner communication should remain available for ambiguous pickup instructions, substitutions or landmarks, but basic order creation and matching should not depend on a phone conversation.

**Reasoning:**
A scalable transaction should work without requiring humans to negotiate every order manually.

---

## ADR-010 — Prepaid/committed payment direction

**Status:** PROPOSED

**Decision:**
The preferred V1 direction is for the customer to commit/prepay the required amount through the platform payment flow before the partner purchases the food.

**Reasoning:**
This reduces the chance that a partner purchases food and the customer later refuses to pay or disappears.

**Not yet finalized:**
Authorization/capture, settlement, refund and price-adjustment mechanics require payment-provider and compliance design.

---

## ADR-011 — Do not force partners to permanently finance food orders

**Status:** PROPOSED

**Decision:**
The payment design should avoid making the delivery partner carry the economic risk of purchasing the customer's food with personal funds and then hoping to be reimbursed.

**Reasoning:**
That model creates a major barrier to partner participation and exposes partners to customer cancellation/fraud risk.

---

## ADR-012 — OTP/equivalent delivery verification

**Status:** PROPOSED

**Decision:**
Use an OTP or equivalent handoff confirmation before an order is marked successfully delivered.

**Reasoning:**
This provides evidence of handoff and protects both the consumer and delivery partner from simple non-delivery disputes.

---

## ADR-013 — Trust is a first-class product requirement

**Status:** CONFIRMED

**Decision:**
Partner identity, reputation, order history and abuse controls must be considered from the start rather than added only after scale.

**Reasoning:**
RouteBite places strangers between money, food and physical delivery. Trust failures can destroy adoption even if the matching technology works.

---

## ADR-014 — Marketplace liquidity is the primary business risk

**Status:** CONFIRMED

**Decision:**
RouteBite must treat supply-demand liquidity as a core validation problem.

**Reasoning:**
A technically correct application still fails if a customer cannot get a compatible partner when they want food.

**Implication:**
Pilot metrics must include match rate, time-to-accept and completion rate.

---

## ADR-015 — Working name is temporary

**Status:** CONFIRMED

**Decision:**
`RouteBite` is a **working project name**, not yet a final brand decision.

**Reasoning:**
Engineering documentation needs a stable label, but branding should not block product validation.

---

## ADR-016 — Future “anything from A to B” expansion is not current scope

**Status:** CONFIRMED

**Decision:**
The broader hyperlocal-delivery concept may eventually support items beyond food, but those categories should not influence V1 requirements unless explicitly reconsidered.

**Reasoning:**
Premature expansion would increase operational, safety and product complexity before the initial model is validated.

---

## ADR-017 — Tech stack must follow requirements

**Status:** CONFIRMED

**Decision:**
Technologies will be selected based on the concrete problem each component must solve.

**Examples:**
- maps technology should be justified by geocoding/routing/ETA requirements,
- real-time technology should be justified by live order/location events,
- database choices should be justified by transactional and geospatial requirements.

**Reasoning:**
Avoid technology-driven architecture and unnecessary infrastructure.

---

## ADR-018 — Avoid premature microservices

**Status:** PROPOSED

**Decision:**
Start with a **modular monolith or similarly simple backend architecture** unless detailed design identifies a concrete reason to distribute services from day one.

**Reasoning:**
The initial team/product stage values iteration speed, debuggability and deployment simplicity more than independent service scaling.

**Reconsider when:**
- independent scaling is necessary,
- module ownership/team boundaries emerge,
- deployment coupling becomes a measurable problem,
- reliability requirements justify isolation.

---

# Open Decisions Queue

The following decisions still need dedicated design work:

1. Customer manually selects partner vs platform-assisted automatic matching.
2. Exact route-matching algorithm.
3. Maximum acceptable detour.
4. Offer fanout/broadcast strategy.
5. Partner acceptance timeout.
6. Pricing formula.
7. Minimum partner earning.
8. Platform fee model.
9. Exact customer payment authorization/capture model.
10. Partner reimbursement/payout design.
11. Price-difference approval flow.
12. Cancellation/refund rules.
13. Failed-delivery responsibility.
14. Dispute process.
15. Partner KYC requirements.
16. Food safety/liability policy.
17. Mapping/navigation provider.
18. Real-time location update strategy.
19. Notification channels/provider.
20. Final backend/frontend/mobile technology choices.
21. Database and geospatial technology.
22. Admin/operations tooling.
23. Deployment environment.
24. Final startup/product name.

---

# Decision Maintenance Rule

Every time a major decision changes:

- do not silently overwrite the historical reasoning,
- either update its status or add a new ADR that supersedes it,
- update `PROJECT_CONTEXT.md` when the decision changes the overall product definition,
- update the relevant specialized document (`PAYMENT_FLOW.md`, `MATCHING_ENGINE.md`, `ARCHITECTURE.md`, etc.).