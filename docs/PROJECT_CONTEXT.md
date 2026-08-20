# RouteBite — Project Context

> **Status:** Living source-of-truth document
>
> **Working name:** RouteBite (temporary; not a final brand decision)
>
> This file captures the product idea, problem, users, confirmed decisions, current hypotheses, and unresolved questions. Before making a major product or architecture change, read this document together with `DECISIONS.md`.

---

## 1. Origin Story

The idea started on **15 August**.

There was a craving for jalebi from a particular local place roughly **4–5 km away**. A friend was already travelling toward that side, so the natural thought was to ask the friend to bring jalebi while returning. Because of the Independence Day crowd, the friend could not bring it.

The craving still existed, so the available alternative was to order a more expensive option from a restaurant listed on an existing food-delivery platform.

That exposed the underlying problem:

> A customer may know exactly which local food they want and where it is sold, but that food may still be impossible or inconvenient to order because the seller is not digitally available on a delivery platform.

The seller exists. The demand exists. The missing piece is a flexible delivery path between the pickup point and the customer.

---

## 2. Problem Statement

Existing food-delivery marketplaces are built primarily around sellers/restaurants that are available in their marketplace/catalogue.

However, consumers often want food from:

- street-food vendors,
- carts and stalls,
- small local shops,
- hyperlocal favourites,
- sellers that do not offer delivery,
- or locations that are not conveniently orderable through mainstream apps.

Even if the food is only a few kilometres away, the customer may not want or be able to travel there because of:

- traffic or crowds,
- lack of a bike/cycle/car,
- poor availability of local transport,
- weather,
- time constraints,
- or simple convenience.

The result is that the customer either gives up the craving, chooses an unwanted substitute, or pays more for another option.

---

## 3. Product Thesis

> **Make a pickup location deliverable even when the vendor itself is not registered on the platform.**

RouteBite is intended to connect a customer who wants food from a pickup point with a delivery partner capable of bringing that food toward the customer's destination.

The platform is **not initially dependent on onboarding every street-food vendor**.

In V1, the important logistical entities are:

1. pickup location,
2. delivery location,
3. customer request,
4. available delivery partner,
5. partner route/current location.

The vendor name is useful to the human partner, but the platform should not require that every vendor already exist in RouteBite's own catalogue.

---

## 4. Initial Target Market

The first launch should be deliberately small and geographically dense:

- one college campus,
- the surrounding area,
- and a small number of nearby high-demand food zones/routes.

The goal is **not** to launch across an entire city immediately.

The campus-first approach is intended to increase the probability that demand and available delivery partners overlap geographically and repeatedly.

---

## 5. Initial Product Scope

### V1 category

**Food only.**

The underlying network may later support other hyperlocal items, but groceries, documents, medicines, parcels, and other categories are future possibilities rather than current scope.

### V1 vendor model

A street-food vendor or local food seller **does not need to register with RouteBite** for a customer to request food from that location.

The customer can provide:

- vendor/shop/cart name,
- requested food/items,
- pickup location or map pin,
- delivery location,
- special instructions or landmarks.

If a mapping/place provider already knows the vendor, the user may select it from search. If it does not, the customer should still be able to manually choose/drop the pickup location.

---

## 6. Users

### 6.1 Consumer

A person who wants food from a specific local place and wants it delivered to their current or chosen location.

### 6.2 Delivery Partner

RouteBite supports one delivery-partner identity with two different availability modes.

#### Mode A — On My Way

A person is already travelling from **A → B**.

They activate that route and indicate that they are willing to carry a compatible food order along the way.

Example:

`Civil Lines → College Campus`

The partner can earn money from a trip they were already planning to make.

#### Mode B — Available to Deliver

A person is currently free and intentionally wants to work as a delivery partner.

They go **Online** from their current location and can receive nearby delivery requests even when the delivery requires a dedicated trip.

This can support both occasional gig workers and people who want to work more professionally.

---

## 7. Vendor and Location Model

### Core rule

**Vendor name is not the primary matching key. Coordinates are.**

Example request:

- Food: `2 pav bhaji`
- Vendor: `Verma Chaat`
- Pickup: map pin near Civil Lines
- Drop: college hostel
- Note: `Opposite Hanuman Mandir, red cart`

Even if `Verma Chaat` does not exist in the RouteBite database, the order can still be represented because the pickup location is known.

The backend should ultimately work with data such as:

- `pickup_latitude`
- `pickup_longitude`
- `drop_latitude`
- `drop_longitude`
- vendor/display name
- food request/instructions

The vendor/display name helps the partner identify the seller. The coordinates allow the platform to reason about routes and matching.

---

## 8. Consumer Journey — Current Product Direction

The exact interaction design is still open, but the intended experience is:

1. Customer opens RouteBite.
2. Customer enters what food they want.
3. Customer enters/selects the vendor name if known.
4. Customer chooses the pickup location or drops a pin.
5. Customer chooses the delivery destination.
6. Platform identifies compatible delivery partners.
7. Customer can see relevant partner information such as rating, verification status and ETA.
8. A partner accepts the request.
9. Customer commits payment using the platform payment flow.
10. Partner reaches the pickup point and purchases/collects the food.
11. Order status is updated during pickup and delivery.
12. Customer and partner can communicate when clarification is required.
13. Customer receives the order.
14. Delivery is verified using an OTP or equivalent handoff confirmation.
15. Order is completed and the partner becomes eligible for payout.
16. Customer can rate the partner.

### Important unresolved UX decision

The original concept allowed customers to browse available travellers and contact one directly.

A stronger proposed direction is for the **platform to perform the matching and send the request to compatible partners**, while chat/call remains available for clarification.

This is **not yet treated as a final product decision** and must be explicitly confirmed before implementation.

---

## 9. Delivery Partner Journey — Current Direction

### On-My-Way Partner

1. Partner opens the partner experience.
2. Chooses `I'm going somewhere`.
3. Enters origin, destination and approximate departure time.
4. Route becomes active.
5. Platform evaluates compatible customer requests near/along that route.
6. Partner sees request details, expected detour, ETA and earning.
7. Partner accepts or rejects.
8. Partner purchases/collects the food.
9. Partner travels toward the customer's destination.
10. Customer verifies handoff.
11. Partner becomes eligible for payout and receives rating/history credit.

### Available-to-Deliver Partner

1. Partner chooses `Go Online`.
2. Platform records current availability/location.
3. Nearby compatible requests can be offered.
4. Partner sees pickup, drop, estimated trip and earning.
5. Partner accepts or rejects.
6. Partner makes the dedicated pickup/delivery trip.
7. Customer verifies handoff.
8. Partner becomes eligible for payout.

---

## 10. Matching — Product Requirement

Matching should reason about **locations and movement**, not only vendor names.

For a request:

- pickup = **X**
- drop = **Y**

Potential supply includes:

### Priority candidate type 1

A partner whose already-planned **A → B route** passes sufficiently close to X and then toward Y in a compatible direction.

### Priority candidate type 2

A partner who is currently **Online** and sufficiently close to X to make a dedicated delivery.

Important matching questions still to be designed:

- What is an acceptable detour from an on-my-way route?
- How is route direction compatibility measured?
- How are candidates ranked?
- How many partners receive an offer at once?
- How long does an offer remain valid?
- What happens if nobody accepts?
- Should incentives increase when supply is low?

Detailed logic will live in `MATCHING_ENGINE.md`.

---

## 11. Payment Model — Initial Proposed Direction

**The payment system is not finalized.**

The current proposed product model is designed to minimize loss for the customer, partner and platform.

Illustrative example:

- estimated food cost: ₹200
- partner delivery earning: ₹40
- platform fee: ₹10
- estimated customer total: ₹250

Proposed flow:

1. Customer commits/prepays the required amount through the platform payment flow before the partner purchases the food.
2. Partner should ideally **not be forced to permanently bear the food cost from their own pocket**.
3. Partner purchases/collects the food.
4. Purchase proof such as a receipt/photo may be captured where appropriate.
5. If the actual price differs from the estimate, the system needs an additional-amount approval or bounded price-adjustment mechanism.
6. Customer receives the order.
7. OTP or equivalent confirmation verifies handoff.
8. Eligible partner reimbursement/earning is settled.
9. Platform retains its applicable fee.

### Payment principles

- Avoid relying on cash for the core flow.
- Avoid making the partner absorb customer cancellation risk after purchase.
- Avoid building an informal self-managed wallet/escrow without legal/payment-provider review.
- Use a compliant payment provider and settlement design appropriate for the market.

### Still unresolved

- exact payment provider,
- authorization vs capture model,
- partner reimbursement mechanics,
- split settlements,
- refund timing,
- cancellation penalties,
- failed delivery rules,
- price-change tolerance,
- dispute handling,
- KYC/payment compliance requirements.

Detailed design will live in `PAYMENT_FLOW.md`.

---

## 12. Trust and Safety — Initial Direction

Because strangers may handle food and money, trust is a core product requirement rather than an optional feature.

Proposed V1 safeguards include:

### Consumer

- verified phone number,
- prepaid/committed order,
- order history,
- ratings/abuse controls where useful.

### Delivery Partner

- verified phone number,
- identity/KYC where legally/operationally required,
- profile identity,
- ratings,
- completed-delivery history,
- payout identity/details.

### Order

Proposed order states:

`Requested → Accepted → Picked Up → Arriving → Delivered/OTP Verified → Completed`

Possible supporting evidence:

- receipt/photo,
- timestamped state transitions,
- location events where appropriate,
- delivery OTP,
- chat/order history.

The exact safety and dispute policy is not finalized.

---

## 13. Why the Product Is Different

The intended differentiation is **not** simply “anyone can become a delivery partner.”

The stronger wedge is:

> A customer can request food from a local place that may not itself participate in an online delivery marketplace.

Supply innovation then comes from combining:

- people already travelling toward the customer's direction, and
- nearby delivery partners who are intentionally online for work.

The platform therefore attempts to make local pickup points reachable without requiring every seller to first become a technology participant.

---

## 14. Marketplace Risk

The biggest business risk is **liquidity**.

At the moment a customer creates a request, RouteBite needs enough relevant supply for the order to be accepted within a useful amount of time.

The dual supply model reduces—but does not eliminate—this risk.

The campus-first launch is intended to test whether sufficient density can be created on a limited number of repeated routes.

---

## 15. MVP Validation Goals

Before city-scale expansion, the pilot should answer:

1. Will users repeatedly request food from local/unlisted places?
2. Can RouteBite provide a compatible partner quickly enough?
3. Are casual/on-route partners willing to accept deliveries?
4. Are dedicated online partners economically viable?
5. What delivery fee are customers willing to pay?
6. What earning level makes the trip worthwhile for partners?
7. What percentage of requests complete successfully?
8. How often do price changes/cancellations/disputes occur?
9. Do customers repeat after their first successful order?

Candidate metrics:

- request-to-match rate,
- median time to acceptance,
- pickup ETA,
- completion rate,
- cancellation rate,
- refund/dispute rate,
- repeat order rate,
- partner acceptance rate,
- partner earnings per active hour,
- average detour for on-my-way partners.

---

## 16. Future Possibilities — Not V1 Commitments

Possible future expansion areas include:

- groceries,
- documents,
- small local products,
- other hyperlocal items,
- platform-learned vendor/location suggestions,
- professional merchant tools,
- dynamic incentives,
- advanced route batching,
- city-wide expansion.

These are **future possibilities, not current requirements**.

---

## 17. Engineering Principles — Proposed

These principles should guide technical design unless a later ADR changes them:

- Solve the product problem before optimizing for scale we do not yet have.
- Prefer a simple production-minded MVP over premature distributed-system complexity.
- Do not introduce a technology unless it solves a specific product/engineering requirement.
- Treat transactional records as durable source-of-truth data.
- Treat live location/presence as different from durable business records.
- Design clean module boundaries so parts can later be extracted if scale demands it.
- Security, payments, identity and location privacy must be considered from the beginning.

The exact tech stack has **not yet been selected**.

---

## 18. Confirmed Product Decisions

At the current stage, the following are treated as confirmed:

- Initial category is food.
- Initial launch is small: college campus + nearby city/food areas.
- Delivery supply supports both casual travellers and people who intentionally go online to deliver.
- A single delivery-partner concept can support both `On My Way` and `Available to Deliver` behaviour.
- A vendor does not need to be registered with RouteBite for V1.
- Customer can specify a vendor/location manually when the vendor is not present in a searchable catalogue.
- Pickup and delivery coordinates are fundamental to matching.
- Vendor name is descriptive information and should not be the only matching mechanism.
- Expansion to “anything from A to B” is a future possibility, not initial scope.

---

## 19. Open Product Decisions

These must be resolved before or during detailed design:

- Automatic matching vs customer browsing/selecting partners.
- Exact matching/ranking algorithm.
- Maximum acceptable on-route detour.
- Partner-offer fanout strategy.
- Pricing formula.
- Minimum partner earning.
- Customer delivery/platform fees.
- Exact payment and settlement flow.
- Price-change approval mechanics.
- Cancellation/refund policy.
- Partner KYC requirements.
- Food handling/liability policy.
- Dispute-resolution process.
- Map/navigation provider.
- Real-time tracking granularity.
- Notification channels.
- Admin/operations requirements.
- Final brand/product name.

---

## 20. Documentation Rule

When a major product or technical decision is made:

1. update this file if it changes the project context,
2. add or update the corresponding entry in `DECISIONS.md`,
3. update the specialized design document,
4. do not silently contradict a confirmed decision in code.

This document should remain understandable to a new engineer joining the project without requiring them to read the original ChatGPT conversation.