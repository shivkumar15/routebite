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

## 10. Matching and Dispatch — Product Requirement

RouteBite matching must consider **location, route, time, trip progress, detour, and partner availability**.

A partner should never receive an order merely because they are geographically close or because their route passes near the pickup point.

The real question is:

> **Can this partner reach pickup X and deliver to Y within the customer's required time window, with an acceptable detour and reasonable delivery efficiency?**

---

### 10.1 Customer Request

Every order should contain:

```text
Pickup location = X
Delivery location = Y
Order creation time
Requested items
Vendor/display name
Delivery preference
```

The customer should eventually have two delivery options:

```text
ASAP
Schedule for Later
```

#### ASAP

For an ASAP order, the platform calculates a maximum acceptable delivery window.

Initial MVP hypothesis:

```text
Maximum ASAP delivery time ≈ 45 minutes
```

Example:

```text
Order created: 4:15 PM
Latest acceptable delivery: approximately 5:00 PM
```

This value must remain configurable and should later be adjusted using real pilot data.

#### Schedule for Later

A customer may request food for a future time window.

Example:

```text
Requested delivery:
6:00 PM – 6:30 PM
```

This makes scheduled on-my-way travellers useful even when they are not leaving immediately.

---

## 10.2 Partner Availability Types

RouteBite must distinguish between two fundamentally different states.

### A. `AVAILABLE_NOW`

This partner is currently available specifically to perform deliveries.

Matching uses:

* current location,
* distance/time to pickup,
* estimated pickup time,
* estimated delivery time,
* active order status.

Example:

```text
AVAILABLE_NOW
Current location: 1.2 km from pickup
```

---

### B. `TRIP_SCHEDULED`

This partner already knows they will travel from A → B at a future time.

Example:

```text
Route:
Civil Lines → College Campus

Trip created:
4:00 PM

Scheduled departure:
6:00 PM

Departure flexibility:
±15 minutes
```

Creating this trip at 4:00 PM does **not** mean the partner is available immediately.

A customer requesting ASAP delivery at 4:15 PM should not be matched with this partner if the partner cannot satisfy the customer's delivery window.

However, the same partner may be suitable for an order scheduled around 6:30 PM.

Once the partner actually starts travelling:

```text
TRIP_SCHEDULED
      ↓
TRIP_ACTIVE
```

Current location and route progress become more important than the originally scheduled departure time.

---

## 10.3 Hard Eligibility Filtering

Before ranking partners, the platform must first determine whether a partner is actually capable of fulfilling the request.

For an **On-My-Way / Trip Active partner**, eligibility should consider:

```text
Route compatibility
+
Travel direction
+
Scheduled/actual departure
+
Current location
+
Current route progress
+
Pickup reachability
+
Predicted pickup time
+
Predicted delivery time
+
Additional detour
+
Customer delivery window
```

Conceptually:

```text
eligible =
    routeCompatible
    AND directionCompatible
    AND pickupReachable
    AND detourAcceptable
    AND deliveryWithinCustomerWindow
```

A partner failing any critical eligibility condition should not receive the order.

---

## 10.4 Route Direction and Progress

The route should be represented using route geometry/polyline data from the mapping system.

For a route:

```text
A ───── Partner ───── X ───── Y ───── B
```

where:

* Partner = current location,
* X = pickup,
* Y = customer destination,

this is generally a good directional match.

But:

```text
A ───── X ───── Partner ───── Y ───── B
```

means the partner may already have passed the pickup point.

If fulfilling the order requires significant backward travel, the request should normally be rejected.

The system should therefore track:

```text
routeId
currentLocation
progressAlongRoute
tripStatus
lastLocationUpdate
```

---

## 10.5 Acceptable Detour

Detour should not be judged only by distance.

A 1 km detour may take:

```text
3 minutes on an empty road
```

or:

```text
15 minutes in a crowded market
```

Therefore both **additional travel time and additional distance** should be considered.

Initial configurable MVP hypothesis:

```text
MAX_ROUTE_DETOUR_MINUTES = 10
MAX_ROUTE_DETOUR_KM = 1.5
```

Example:

```text
Normal trip:
25 minutes

Trip with order:
32 minutes

Additional detour:
7 minutes

Result:
Eligible
```

But:

```text
Normal trip:
20 minutes

Trip with order:
38 minutes

Additional detour:
18 minutes

Result:
Not eligible
```

These values are hypotheses and must be validated using real pilot data.

---

## 10.6 Predicted Pickup and Delivery Time

RouteBite should not build its own navigation engine for the MVP.

A mapping/routing provider should provide travel-time estimates.

For an `AVAILABLE_NOW` partner:

```text
Current time
+
ETA(current location → pickup)
+
Estimated vendor waiting/pickup time
+
ETA(pickup → customer)
=
Predicted Delivery Time
```

Example:

```text
Current time          4:15 PM
Reach pickup          +6 min
Pickup/wait           +8 min
Pickup → customer     +12 min

Predicted delivery    4:41 PM
```

For scheduled travellers:

```text
Scheduled/actual departure
+
ETA to pickup
+
Estimated pickup wait
+
ETA to customer
=
Predicted Delivery Time
```

Initially, vendor waiting time may use a simple configurable estimate.

Later, RouteBite can learn average pickup times by area/vendor/time-of-day from real order data.

---

## 10.7 Closest Departure Time Is Not Enough

The system should **not simply choose the traveller whose departure time is closest to the customer's order time**.

Example:

```text
Partner A
Departure: 4:20 PM
20 minutes away from pickup

Partner B
Departure: 4:25 PM
3 minutes away from pickup
```

Partner B may reach the pickup and customer earlier even though they depart later.

Therefore, matching should prioritize:

```text
Predicted Pickup Time
Predicted Delivery Time
```

rather than only:

```text
Departure Time Difference
```

---

## 10.8 Candidate Types

After eligibility filtering, potential candidates can come from two supply groups.

### Candidate Type 1 — On-My-Way Partner

A partner whose existing journey:

* passes sufficiently close to pickup,
* moves in the correct direction,
* has not significantly passed the pickup point,
* produces an acceptable detour,
* and can satisfy the customer's delivery window.

Because this partner is already travelling toward the destination, this may be the most efficient fulfilment option.

---

### Candidate Type 2 — Available-Now Partner

A partner who is actively online for delivery work and:

* is sufficiently close to the pickup,
* can reach it quickly,
* and can deliver within the customer's required time window.

This supply type acts as an important fallback when no suitable on-my-way traveller exists.

---

## 10.9 Ranking Eligible Partners

Only eligible partners should enter the ranking stage.

The MVP should initially use **deterministic rule-based ranking**, not machine learning.

Candidate ranking should consider factors such as:

1. ability to satisfy the delivery SLA,
2. predicted delivery ETA,
3. additional route detour,
4. partner reliability/completion history,
5. partner rating,
6. delivery economics.

Rating should not automatically dominate the ranking.

For example:

```text
Partner A
Rating: 4.9
Delivery ETA: 70 minutes

Partner B
Rating: 4.7
Delivery ETA: 28 minutes
```

If both are trusted and reliable, Partner B is likely the better operational choice.

The exact scoring formula will be designed later.

---

## 10.10 Dispatch Strategy

RouteBite should **not broadcast every order to every nearby partner**.

Doing so would create notification spam and poor partner experience.

Instead, eligible partners should be ranked and contacted in controlled batches.

Initial MVP hypothesis:

```text
Round 1
Send request to top 3 candidates

Wait approximately 20 seconds
```

If nobody accepts:

```text
Round 2
Send request to next candidates
```

If the request is still unaccepted:

```text
Round 3
Broaden matching constraints slightly
and/or consider additional incentive
```

Initial configurable values:

```text
OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20
```

These must be validated through pilot behaviour.

---

## 10.11 Order Acceptance

If multiple partners attempt to accept an order at nearly the same time, only **one partner may win the assignment**.

The transition must behave atomically:

```text
REQUESTED
    ↓
PARTNER ACCEPTS
    ↓
ASSIGNED
```

Once assigned:

```text
ASSIGNED_TO_PARTNER_P1
```

another partner attempting acceptance should receive:

```text
Order already assigned
```

The exact concurrency implementation will be defined during backend/database design.

---

## 10.12 What Happens If Nobody Accepts?

The system should degrade gracefully rather than leaving the customer waiting indefinitely.

Conceptual fallback flow:

```text
Strict on-route matching
        ↓
AVAILABLE_NOW partners
        ↓
Broader acceptable radius/detour
        ↓
Higher delivery incentive
        ↓
No feasible partner
```

If no suitable partner can fulfil the request, the customer should receive a clear response such as:

```text
No partner is currently available for immediate delivery.
```

Possible options:

```text
Try Again
Schedule for Later
Notify Me When a Partner Is Available
```

The platform should never pretend that supply is guaranteed when it is not.

---

## 10.13 Supply-Based Incentives

If eligible partners repeatedly reject an order, RouteBite may increase the partner incentive.

Simple MVP example:

```text
Initial partner earning: ₹40

No acceptance:
₹50

Still no acceptance:
₹60
```

The system must explicitly track who funds the additional incentive:

```text
Customer
Platform subsidy
or
Combination
```

Any company-funded subsidy must be measured separately so that pilot economics are not mistaken for sustainable unit economics.

Complex surge-pricing algorithms are **not required for V1**.

---

## 10.14 Scheduled Traveller Flexibility

Scheduled travellers should not be forced to provide an unrealistically exact departure time.

Example UI:

```text
Leaving around:
6:00 PM

Departure flexibility:
±10 min
±15 min
±30 min
```

Initial default hypothesis:

```text
DEFAULT_DEPARTURE_FLEX_MINUTES = 15
```

Internally:

```text
scheduledDeparture = 6:00 PM

earliestDeparture = 5:45 PM
latestDeparture = 6:15 PM
```

Matching can use this interval when evaluating scheduled orders.

---

## 10.15 Complete Matching Pipeline

Conceptually, the matching system should operate as:

```text
CUSTOMER REQUEST
      │
      ▼
Pickup X + Drop Y
+ Delivery Time Window
      │
      ▼
DISCOVER POSSIBLE PARTNERS
      │
 ┌────┴───────────────┐
 ▼                    ▼
ON-MY-WAY        AVAILABLE_NOW
PARTNERS             PARTNERS
 │                    │
 └─────────┬──────────┘
           ▼
    HARD ELIGIBILITY
           │
      route valid?
      direction valid?
      pickup reachable?
      time compatible?
      detour acceptable?
           │
           ▼
         RANK
           │
     Delivery ETA
     Detour
     Reliability
     Rating
     Economics
           │
           ▼
       OFFER BATCH
           │
     Wait for acceptance
           │
      ┌────┴────┐
      ▼         ▼
   ACCEPTED     NO
      │         │
      ▼         ▼
 ASSIGN      NEXT BATCH
 ORDER           │
                 ▼
          BROADEN / INCENTIVE
                 │
                 ▼
          FAIL GRACEFULLY
```

---

## 10.16 Initial Configurable MVP Hypotheses

The following values are **starting hypotheses, not finalized business rules**:

```text
MAX_ASAP_DELIVERY_MINUTES = 45

MAX_ROUTE_DETOUR_MINUTES = 10

MAX_ROUTE_DETOUR_KM = 1.5

OFFER_BATCH_SIZE = 3

OFFER_TIMEOUT_SECONDS = 20

DEFAULT_DEPARTURE_FLEX_MINUTES = 15
```

These values must be kept configurable rather than scattered as hardcoded constants throughout the system.

The campus pilot should collect enough operational data to determine whether these assumptions are correct.

---

## 10.17 Matching Principle

The core matching principle is:

> **Filter first, rank second, dispatch third.**

RouteBite should first remove partners who cannot realistically fulfil the order, then rank the remaining candidates, and only then send controlled delivery offers.

The MVP should begin with a transparent deterministic matching system.

Machine-learning-based ranking should only be considered later when RouteBite has enough real-world order, acceptance, ETA, cancellation, and partner-behaviour data to justify it.

Detailed implementation will live in `MATCHING_ENGINE.md`.


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

## 19. Prototype Decisions, Deferred Decisions, and Remaining Open Questions

RouteBite is currently being designed as a **working prototype for idea validation and presentation**, not as a fully production-ready commercial platform.

Therefore, decisions that are necessary to demonstrate the complete product workflow should be fixed now using simple, configurable approaches.

Problems involving production-grade payments, regulatory compliance, government-backed KYC, advanced fraud prevention, large-scale optimization, and legal liability can be handled after the idea is validated or selected.

The principle for the prototype is:

> **Build enough real functionality to prove that the complete RouteBite workflow works, while avoiding premature production complexity.**

---

### 19.1 Automatic Matching vs Customer Browsing Partners

**Prototype Decision: Automatic Matching**

The customer should not manually browse multiple travellers and contact them individually.

The customer creates a request containing:

```text
Requested food
Vendor/display name
Pickup location
Delivery location
ASAP / Scheduled delivery
```

The platform then:

```text
Creates request
      ↓
Finds eligible partners
      ↓
Ranks candidates
      ↓
Sends delivery offer
      ↓
Partner accepts
      ↓
Customer sees assigned partner
```

Chat/call can still be available after assignment when clarification is required.

**Status: CONFIRMED FOR PROTOTYPE**

---

### 19.2 Matching Algorithm

**Prototype Decision: Deterministic Rule-Based Matching**

Machine learning is not required initially.

Matching should use:

```text
Location
Route
Travel direction
Time compatibility
Current trip progress
Pickup ETA
Delivery ETA
Detour
Partner availability
```

The system should follow:

```text
Filter
  ↓
Rank
  ↓
Dispatch
```

Detailed logic is documented in Point 10 and will later be expanded in `MATCHING_ENGINE.md`.

**Status: CONFIRMED FOR PROTOTYPE**

---

### 19.3 Maximum Acceptable On-Route Detour

Initial configurable hypothesis:

```text
MAX_ROUTE_DETOUR_MINUTES = 10
MAX_ROUTE_DETOUR_KM = 1.5
```

A partner should normally not receive an on-my-way request when fulfilling it creates a significantly larger detour.

These values are not permanent business rules. They must be validated using pilot data.

**Status: PROTOTYPE HYPOTHESIS**

---

### 19.4 Partner Offer / Fanout Strategy

Orders should not be broadcast to every available partner.

Initial dispatch strategy:

```text
Round 1:
Send offer to top 3 eligible partners

Wait approximately 20 seconds

Round 2:
Send to next eligible candidates

If still unaccepted:
Broaden matching constraints slightly
and/or increase partner incentive
```

Initial configuration:

```text
OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20
```

**Status: PROTOTYPE HYPOTHESIS**

---

### 19.5 ASAP Delivery Window

For the prototype:

```text
MAX_ASAP_DELIVERY_MINUTES = 45
```

Example:

```text
Order created: 4:15 PM

Latest expected delivery:
approximately 5:00 PM
```

Partners predicted to deliver after the acceptable window should not receive the request.

This value must remain configurable.

**Status: PROTOTYPE HYPOTHESIS**

---

### 19.6 Scheduled Orders

The customer should eventually have:

```text
ASAP
Schedule for Later
```

Scheduled delivery is particularly valuable because RouteBite supports travellers who know in advance that they will travel from A → B later.

Example:

```text
Customer wants delivery:
6:00 PM – 6:30 PM

Partner trip:
Civil Lines → Campus
Leaving around 5:45 PM
```

This can become a valid match.

**Status: CONFIRMED PRODUCT DIRECTION**

---

### 19.7 Scheduled Traveller Flexibility

A traveller should not be forced to provide an exact departure time.

Example:

```text
Leaving around:
6:00 PM

Flexibility:
±15 minutes
```

Initial default:

```text
DEFAULT_DEPARTURE_FLEX_MINUTES = 15
```

Possible UI options:

```text
±10 min
±15 min
±30 min
```

**Status: PROTOTYPE HYPOTHESIS**

---

## 19.8 Prototype Pricing

The pricing system should remain deliberately simple during the prototype.

Illustrative initial model:

```text
Food estimated cost: entered by customer

Partner delivery earning: ₹40

Platform fee: ₹10
```

Example:

```text
Food estimate        ₹200
Delivery earning      ₹40
Platform fee          ₹10
--------------------------
Estimated total      ₹250
```

The actual values must remain configurable.

The prototype should not yet implement:

```text
Complex surge pricing
Demand forecasting
ML pricing
Advanced distance-based optimization
```

**Status: PROTOTYPE HYPOTHESIS**

---

## 19.9 Minimum Partner Earning

Initial prototype hypothesis:

```text
DEFAULT_PARTNER_EARNING = ₹40
```

If an order repeatedly fails to receive acceptance, incentive tiers may be simulated:

```text
₹40
 ↓
₹50
 ↓
₹60
```

The platform must record whether additional incentive is funded by:

```text
Customer
Platform subsidy
Combination
```

These values are not considered validated economics.

**Status: PROTOTYPE HYPOTHESIS**

---

## 19.10 Payment System

Production-grade payment settlement is intentionally deferred.

For the working prototype, RouteBite should use:

```text
Razorpay Test Mode
+
Internal Demo Ledger
```

No real money needs to move during the demonstration.

Prototype payment flow:

```text
Customer Checkout
      ↓
Test Payment Successful
      ↓
Order Activated
      ↓
Partner Assigned
      ↓
Pickup
      ↓
Delivery
      ↓
OTP Verification
      ↓
Partner Earning Recorded
      ↓
Demo Settlement
```

Example internal ledger:

```text
Food reimbursement = ₹200

Partner earning = ₹40

Platform fee = ₹10
```

Possible prototype states:

```text
PAYMENT_PENDING

TEST_PAYMENT_SUCCESS

ORDER_ACTIVE

DELIVERED

PARTNER_EARNING_RECORDED

DEMO_SETTLED
```

This allows the prototype to demonstrate the complete payment experience without introducing real settlement complexity.

Production payment design will later require proper marketplace settlement, refunds, payouts, compliance, and payment-provider review.

**Status: CONFIRMED FOR PROTOTYPE**

---

## 19.11 Price Change Approval

Because unregistered/local vendors may not have fixed digital menus, actual food cost may differ from the customer's estimate.

Example:

```text
Estimated food cost:
₹200

Actual vendor bill:
₹220
```

The partner should enter the actual bill and may upload purchase proof.

Customer receives:

```text
Estimated: ₹200
Actual: ₹220

Additional amount: ₹20

[Approve]
[Contact Partner]
```

During the prototype, approval updates the internal/demo payment value.

Production authorization/capture logic can be designed later.

**Status: CONFIRMED FOR PROTOTYPE**

---

## 19.12 Cancellation Rules

Prototype cancellation should remain simple.

### Before Food Purchase

States such as:

```text
REQUESTED
MATCHING
ASSIGNED
```

Customer cancellation can be allowed.

### After Food Purchase

Once:

```text
PICKED_UP
```

is reached, unrestricted cancellation should no longer be available.

The order may require admin/support intervention.

### Partner Cancellation Before Pickup

The platform should attempt rematching.

### Partner Cancellation After Purchase

The case should move to manual admin intervention.

Production-grade refund/penalty rules are deferred.

**Status: CONFIRMED FOR PROTOTYPE**

---

# 19.13 Partner Identity Verification

Production-grade KYC is intentionally deferred.

For the campus prototype, RouteBite should use:

```text
Phone OTP verification
+
Profile photo
+
College identity
+
Manual admin approval
```

Possible registration information:

```text
Name
Phone number
College email / enrollment information
College ID upload
Profile photo
```

Partner states:

```text
PENDING_VERIFICATION
        ↓
APPROVED
```

Approved campus partners may display:

```text
Campus Partner Verified
```

RouteBite should **not claim that this is government-backed KYC**.

Full Aadhaar document collection should not be necessary for the campus prototype.

For future city/professional-partner deployment, RouteBite should evaluate compliant identity/KYC providers or officially supported verification mechanisms.

**Status: CONFIRMED FOR CAMPUS PROTOTYPE**

---

## 19.14 Map and Navigation Provider

**Prototype Decision: Google Maps Platform**

The prototype requires:

```text
Interactive map
Pickup pin
Drop pin
Place search
Geocoding
Routes
Distance
ETA
Route Matrix
```

Vendor search behaviour:

```text
Search vendor/place
       ↓
Found?
 ├── Yes → select location
 │
 └── No → manually drop pickup pin
```

This preserves RouteBite's core rule that a vendor does not need to exist in RouteBite's own database.

Google Maps usage should be protected using:

```text
Restricted API keys
Billing alerts
API quotas
Controlled route calculations
```

**Status: CONFIRMED FOR PROTOTYPE**

---

## 19.15 Real-Time Location Tracking

RouteBite should not continuously track every partner at high frequency.

### Before Assignment

For an `AVAILABLE_NOW` partner, location can be updated periodically for matching.

### During Active Delivery

After accepting an order:

```text
ORDER_ACTIVE
```

the partner's foreground location may be sent approximately every:

```text
10–15 seconds
```

The customer may see:

```text
Current partner location
Order state
Estimated arrival
```

After delivery:

```text
Stop active tracking
```

For the web prototype, foreground location tracking is sufficient.

Reliable background tracking on mobile devices can be solved later using a native/mobile application strategy.

**Status: CONFIRMED FOR PROTOTYPE**

---

## 19.16 Notifications

The prototype should begin with:

```text
In-app notifications
+
Phone OTP
```

Examples for partners:

```text
New delivery request
Earn ₹40
Accept / Reject
```

Examples for customers:

```text
Partner found

Partner reached pickup

Food picked up

Partner arriving

Order delivered
```

The prototype does not initially require:

```text
WhatsApp notifications
SMS status notifications
Email notifications
Full push-notification infrastructure
```

These may be added later.

**Status: CONFIRMED FOR PROTOTYPE**

---

## 19.17 Admin / Operations Dashboard

A basic admin dashboard is required even for the prototype.

The admin should be able to view:

```text
Pending partner verification
Approved/rejected partners
Active partners
Orders
Order states
Failed orders
Uploaded identity documents
Purchase receipts
Reported problems
```

Possible actions:

```text
Approve partner
Reject partner
Review order
Cancel order
Mark dispute
Review purchase proof
```

During early-stage validation, manual operations are acceptable and can replace complex automation.

**Status: CONFIRMED FOR PROTOTYPE**

---

# 19.18 Deferred Production Decisions

The following should **not block the working prototype**.

They require deeper legal, financial, security, or operational discussion after the idea is validated.

### Production Payments

Deferred:

```text
Real customer settlement
Partner bank payouts
Marketplace split settlements
Payment authorization/capture
Production refund automation
Settlement reconciliation
Payment compliance
```

---

### Production Identity / KYC

Deferred:

```text
Government-backed KYC
Aadhaar-based verification
Professional partner verification
External KYC providers
Document authenticity verification
Bank-account identity matching
```

---

### Food Handling and Liability

Deferred:

```text
Food tampering liability
Vendor quality responsibility
Packaging standards
Delivery damage
Food safety policy
Legal terms between customer, partner and platform
```

These issues must be solved before a real commercial launch.

---

### Advanced Dispute Resolution

Deferred:

```text
Automated refunds
Fraud scoring
Chargeback handling
Evidence arbitration
Partner/customer penalties
Account suspension algorithms
```

For the prototype, admin intervention is sufficient.

---

### Advanced Pricing

Deferred:

```text
Dynamic surge pricing
Supply-demand prediction
ML pricing
Personalized incentives
Automated subsidy optimization
```

---

### Advanced Matching

Deferred:

```text
Machine-learning ranking
Batch delivery optimization
Multi-order routing
Acceptance prediction
Demand forecasting
Advanced route optimization
```

The prototype will use deterministic matching.

---

## 19.19 Remaining Open Decisions Before Implementation

After the above prototype decisions, only a smaller set of product questions should remain open.

These include:

* exact frontend experience for consumer vs partner,
* whether consumer and partner use one app or separate interfaces,
* exact order status/state machine,
* exact partner rating model,
* exact reliability score definition,
* exact admin dashboard fields,
* exact vendor wait-time assumption,
* exact architecture and tech stack,
* database design,
* API contracts,
* authentication/session architecture,
* real-time communication architecture,
* final product/brand name.

These should be resolved during product-flow, architecture, database, and tech-stack design.

---

## 19.20 Prototype Scope Boundary

The first working RouteBite prototype should be able to demonstrate:

```text
PARTNER

Register
   ↓
Phone verification
   ↓
College ID / profile verification
   ↓
Admin approval
   ↓
Choose:

AVAILABLE_NOW

or

TRIP_SCHEDULED
```

Customer flow:

```text
CUSTOMER

Create food request
   ↓
Search vendor or choose pickup pin
   ↓
Choose destination
   ↓
ASAP / Scheduled
   ↓
See estimated price
   ↓
Complete test payment
   ↓
Automatic matching
   ↓
Partner accepts
   ↓
Customer sees partner
   ↓
Partner reaches pickup
   ↓
Actual food cost confirmed
   ↓
Food picked up
   ↓
Live delivery tracking
   ↓
OTP handoff
   ↓
Order completed
   ↓
Demo partner payout recorded
   ↓
Rating
```

Admin flow:

```text
ADMIN

Verify partners
Monitor orders
Review receipts
Handle failed orders
Resolve prototype disputes manually
```

If these flows work end-to-end, RouteBite has enough functionality to demonstrate the central product thesis.

Production complexity should only be added after the idea is validated.

---

## 19.21 Current Engineering Principle

For the prototype:

> **Working end-to-end behaviour is more important than production-scale sophistication.**

RouteBite should deliberately avoid introducing unnecessary complexity such as:

```text
Microservices
ML matching
Advanced fraud models
Full government KYC
Production settlement infrastructure
Complex surge pricing
City-scale dispatch optimization
```

until real product validation demonstrates that they are necessary.

The prototype should remain simple enough to build quickly, but structured well enough that production-grade systems can later replace the temporary components without redesigning the entire product.

## 20. Documentation Rule

When a major product or technical decision is made:

1. update this file if it changes the project context,
2. add or update the corresponding entry in `DECISIONS.md`,
3. update the specialized design document,
4. do not silently contradict a confirmed decision in code.

This document should remain understandable to a new engineer joining the project without requiring them to read the original ChatGPT conversation.
