# RouteBite — Matching Engine

> **Status:** Prototype matching specification
>
> This document defines how the first working RouteBite prototype discovers, filters, ranks, and dispatches delivery requests to partners.
>
> It must remain consistent with `PROJECT_CONTEXT.md`, `DECISIONS.md`, `USER_FLOWS.md`, and `PRODUCT_REQUIREMENTS.md`.
>
> The prototype intentionally uses a **deterministic rule-based engine**. Machine learning, large-scale dispatch optimization, multi-order batching, and demand prediction are deferred until RouteBite has real operational data.

---

# 1. Matching Goal

The matching engine must answer one question:

> **Which currently available or scheduled RouteBite partner can realistically collect the customer's food from pickup X and deliver it to Y within the required time window, with acceptable additional travel?**

Matching must never be based only on geographic closeness.

The system must consider:

```text
Pickup location
Drop location
Customer delivery window
Partner availability mode
Partner current location
Partner planned route
Scheduled departure
Current route progress
Travel direction
Predicted pickup ETA
Predicted delivery ETA
Additional detour
Partner operational status
```

The prototype pipeline is:

```text
ORDER READY FOR MATCHING
          ↓
DISCOVER CANDIDATES
          ↓
HARD ELIGIBILITY FILTERS
          ↓
CALCULATE ETA + DETOUR
          ↓
RANK ELIGIBLE CANDIDATES
          ↓
DISPATCH OFFER BATCH
          ↓
WAIT FOR ACCEPTANCE
     ┌────┴────┐
     ↓         ↓
 ACCEPTED      NO
     ↓         ↓
  ASSIGN    NEXT ROUND
              ↓
        FALLBACK / FAIL
```

Core principle:

> **Filter first, rank second, dispatch third.**

---

# 2. Matching Inputs

Every matching attempt requires an order with at least:

```text
orderId
customerId
pickupLatitude
pickupLongitude
dropLatitude
dropLongitude
pickupDisplayName / vendorDisplayName
orderCreatedAt
deliveryType
requestedDeliveryWindowStart
requestedDeliveryWindowEnd
orderStatus
paymentStatus
```

For an ASAP order, the prototype may derive:

```text
requestedDeliveryWindowStart = now
requestedDeliveryWindowEnd   = now + MAX_ASAP_DELIVERY_MINUTES
```

Initial hypothesis:

```text
MAX_ASAP_DELIVERY_MINUTES = 45
```

For a scheduled order, the customer provides/chooses a future delivery window such as:

```text
6:00 PM – 6:30 PM
```

The matching engine should operate on the actual start/end timestamps rather than labels such as `evening`.

---

# 3. Partner Supply Types

The prototype supports one partner identity with different operational modes.

## 3.1 `AVAILABLE_NOW`

The partner is intentionally online and available to make a delivery now.

Required matching data:

```text
partnerId
verificationStatus
availabilityStatus = AVAILABLE_NOW
currentLatitude
currentLongitude
lastLocationUpdatedAt
activeOrderId or null
partnerRating
completedOrderCount
completionRate (if enough data exists)
```

This partner does not require an existing A → B trip.

The system evaluates whether the partner can travel:

```text
current location → pickup X → drop Y
```

within the customer's delivery window.

---

## 3.2 `TRIP_SCHEDULED`

The partner has declared a future trip from A → B.

Required trip data:

```text
tripId
partnerId
originLatitude
originLongitude
destinationLatitude
destinationLongitude
routePolyline / encoded route reference
scheduledDepartureAt
departureFlexMinutes
tripStatus = TRIP_SCHEDULED
```

Example:

```text
Trip created:          4:00 PM
Scheduled departure:  6:00 PM
Flexibility:           ±15 minutes
```

This does **not** mean the partner is available at 4:00 PM.

The scheduling window is conceptually:

```text
earliestDeparture = scheduledDepartureAt - departureFlexMinutes
latestDeparture   = scheduledDepartureAt + departureFlexMinutes
```

An ASAP order at 4:15 PM should not be offered to this partner if the predicted delivery is outside the customer's acceptable window.

---

## 3.3 `TRIP_ACTIVE`

The partner has started the on-my-way trip.

At this point, matching should rely primarily on:

```text
current location
current route progress
remaining route
current time
```

rather than the original scheduled departure estimate.

A trip that started earlier can still receive a new request **only if the pickup remains ahead/reachable and the delivery still satisfies the customer's time window**.

---

# 4. Candidate Discovery

Candidate discovery should be cheap and broad. Expensive route calculations should only be performed for a limited shortlist.

The prototype should discover candidates from two pools.

## Pool A — On-My-Way Candidates

Include partners with:

```text
TRIP_SCHEDULED
or
TRIP_ACTIVE
```

whose trip corridor is geographically relevant to the pickup/drop area and whose time window could plausibly satisfy the order.

A coarse filter may use:

- bounding boxes,
- approximate radius from route/origin,
- route corridor distance,
- scheduled departure range,
- current trip state.

The exact database/geospatial implementation will be selected during architecture/database design.

## Pool B — Available-Now Candidates

Include verified `AVAILABLE_NOW` partners within an initial pickup search radius.

Initial hypothesis:

```text
AVAILABLE_NOW_INITIAL_RADIUS_KM = 3
```

If no useful candidates exist, this may be broadened during fallback.

**Important:** This is only a coarse discovery radius. Actual eligibility is determined using travel time/route calculations, not straight-line distance alone.

---

# 5. Pre-Matching Preconditions

The matching engine must not run unless all mandatory conditions are satisfied.

An order is matchable only when:

```text
order exists
AND customer is valid
AND pickup coordinates exist
AND drop coordinates exist
AND delivery window exists
AND order is not already assigned
AND payment state allows matching
AND order is not cancelled/completed
```

For the prototype payment flow:

```text
TEST_PAYMENT_SUCCESS
```

must be recorded before matching begins.

If preconditions fail, matching should stop with an explicit reason rather than silently returning no candidates.

---

# 6. Hard Partner Eligibility Filters

A partner failing a hard filter must not enter ranking.

## 6.1 Partner Verification

Require:

```text
partnerVerificationStatus = APPROVED
```

Unverified/pending/rejected partners must never receive live delivery offers.

---

## 6.2 Partner Availability

Reject when the partner:

- is offline,
- already has an incompatible active order,
- has paused availability,
- has stale/unusable location data for `AVAILABLE_NOW`,
- has a cancelled/completed scheduled trip,
- is administratively suspended.

For the prototype, one partner should normally handle **one active order at a time**.

Multi-order batching is deferred.

---

## 6.3 Location Freshness

`AVAILABLE_NOW` and `TRIP_ACTIVE` location data must not be indefinitely trusted.

Initial configurable hypothesis:

```text
MAX_LOCATION_AGE_SECONDS = 60
```

If the latest location is older than this, the system should either request a fresh location or temporarily exclude the partner.

This value can be adjusted during testing.

---

## 6.4 Customer Delivery Window

Every candidate must satisfy:

```text
predictedDeliveryAt <= requestedDeliveryWindowEnd
```

For scheduled deliveries, the engine should also avoid delivering unreasonably early.

Conceptually:

```text
predictedDeliveryAt >= requestedDeliveryWindowStart - EARLY_DELIVERY_TOLERANCE
```

Initial hypothesis:

```text
EARLY_DELIVERY_TOLERANCE_MINUTES = 10
```

Example:

```text
Customer window: 6:00–6:30 PM
Predicted delivery: 4:50 PM
Result: reject
```

The partner should not be matched simply because they *can* deliver before the deadline if the customer explicitly scheduled the order much later.

---

# 7. Time Compatibility for Scheduled Trips

This section handles the earlier problem where a partner creates a future trip hours before departure.

Example:

```text
4:00 PM
Partner schedules:
Civil Lines → Campus
Departure around 6:00 PM

4:15 PM
Customer places ASAP order
Latest acceptable delivery = 5:00 PM
```

The partner must **not** receive the order.

For `TRIP_SCHEDULED`, estimate whether any departure inside the allowed partner departure window can produce a delivery that overlaps the customer's delivery window.

Conceptually:

```text
partnerDepartureWindow =
[scheduledDeparture - flexibility,
 scheduledDeparture + flexibility]
```

Then compute a realistic candidate departure time.

For the prototype:

- For an ASAP customer request, use the earliest realistic departure time available to the partner, but never before `now`.
- For a scheduled customer request, choose a departure within the partner's flexibility window that best fits the requested delivery window.

If no feasible departure produces an acceptable pickup/delivery time, reject the candidate.

---

# 8. Route Direction Compatibility

An on-my-way trip must not be considered compatible simply because pickup and drop points are geographically near the route.

The requested movement must follow the partner's route direction.

Suppose:

```text
A = partner trip origin
B = partner trip destination
X = order pickup
Y = order drop
P = partner current position
```

Good direction:

```text
A ───── P ───── X ───── Y ───── B
```

Usually bad direction:

```text
A ───── Y ───── X ───── B
```

or, for an active trip:

```text
A ───── X ───── P ───── Y ───── B
```

where the pickup has already been passed substantially.

## Prototype Approach

Use the partner's route polyline and project relevant points onto that route.

Represent approximate progress as distance along route:

```text
currentProgress
pickupProgress
dropProgress
```

For an active trip, require approximately:

```text
currentProgress <= pickupProgress < dropProgress
```

with a small configurable tolerance for GPS noise/nearby road geometry.

For a scheduled trip before departure:

```text
pickupProgress < dropProgress
```

must hold.

Exact polyline projection implementation will be decided during coding, but the product rule is fixed: **pickup must occur before drop in the partner's direction of travel**.

---

# 9. Pickup Reachability

Even if pickup lies near the route, it may require an unreasonable diversion.

The engine must evaluate the route with and without the order.

For an on-my-way trip:

```text
Base trip:
P/A → B

Trip with order:
P/A → X → Y → B
```

For scheduled trips not yet started, use the selected feasible departure origin/time.

For active trips, use the partner's current location as the starting point.

If pickup or drop cannot be routed by the mapping provider, reject the candidate.

---

# 10. Detour Calculation

Detour must consider both time and distance.

For an on-my-way partner:

```text
baseDuration = ETA(start → original destination)
baseDistance = distance(start → original destination)

orderDuration = ETA(start → pickup → drop → original destination)
orderDistance = distance(start → pickup → drop → original destination)

extraDuration = orderDuration - baseDuration
extraDistance = orderDistance - baseDistance
```

Initial configurable hypothesis:

```text
MAX_ROUTE_DETOUR_MINUTES = 10
MAX_ROUTE_DETOUR_KM = 1.5
```

Require:

```text
extraDuration <= MAX_ROUTE_DETOUR_MINUTES
AND
extraDistance <= MAX_ROUTE_DETOUR_KM
```

unless the engine enters a later explicitly broadened fallback round.

Example:

```text
Base trip              25 min
With delivery          32 min
Extra                   7 min
Result                  eligible (time criterion)
```

Example:

```text
Base trip              20 min
With delivery          38 min
Extra                  18 min
Result                  reject
```

For `AVAILABLE_NOW`, there is no pre-existing trip whose detour can be compared. Instead, measure:

```text
ETA(current → pickup)
ETA(pickup → drop)
Total dedicated delivery time
```

and evaluate it against the customer's delivery window and prototype radius/operational constraints.

---

# 11. Pickup and Delivery ETA

RouteBite should use the map/routing provider for road travel estimates rather than implementing its own navigation engine.

## 11.1 Available-Now Partner

Conceptual ETA:

```text
predictedPickupAt =
now
+ travelTime(current → pickup)

predictedDeliveryAt =
predictedPickupAt
+ estimatedVendorWaitTime
+ travelTime(pickup → drop)
```

## 11.2 Scheduled On-My-Way Partner

```text
predictedPickupAt =
selectedDepartureAt
+ travelTime(origin/start → pickup)

predictedDeliveryAt =
predictedPickupAt
+ estimatedVendorWaitTime
+ travelTime(pickup → drop)
```

## 11.3 Active On-My-Way Partner

```text
predictedPickupAt =
now
+ travelTime(currentLocation → pickup)

predictedDeliveryAt =
predictedPickupAt
+ estimatedVendorWaitTime
+ travelTime(pickup → drop)
```

Initial vendor wait-time hypothesis:

```text
DEFAULT_VENDOR_WAIT_MINUTES = 8
```

This must remain configurable.

Later, RouteBite may learn wait time by vendor, area, weekday, and time of day, but this is explicitly not required for the prototype.

---

# 12. Mapping Provider Usage

Prototype provider:

> **Google Maps Platform**

Potential capabilities used by the matching engine:

- route computation,
- travel time,
- route distance,
- route matrix for multiple candidates,
- route polyline/geometry,
- geocoding/place coordinates elsewhere in the product.

## Cost/Quota Rule

Do not make expensive route API calls for every partner in the database.

Use a two-stage process:

```text
CHEAP COARSE FILTER
      ↓
small candidate shortlist
      ↓
GOOGLE ROUTE / MATRIX CALCULATION
```

Example:

```text
100 online partners
       ↓
coarse distance/time/route filter
       ↓
12 plausible candidates
       ↓
route calculations for those 12
```

Cache reusable route/ETA results briefly where appropriate, but never let stale cached results override materially changed partner location/trip data.

---

# 13. Candidate Ranking

Only partners that pass every required hard eligibility condition enter ranking.

The prototype uses deterministic ordering, not ML.

## 13.1 Ranking Principle

Customer usefulness comes first.

Recommended prototype ordering:

1. **earliest predicted delivery time**, provided all candidates satisfy the SLA/window,
2. **lower incremental detour** for on-my-way candidates,
3. **lower pickup ETA**,
4. **higher reliability/completion history** when meaningful data exists,
5. **higher rating** when enough ratings exist,
6. **lower operational cost / better route efficiency** as a final tie-breaker.

If candidates are effectively equal on delivery performance, prefer an efficient on-my-way partner because the delivery creates less incremental travel.

## 13.2 New Partner Neutrality

New partners should not be automatically ranked at the bottom simply because they have no history.

For the prototype:

- no history = neutral reliability,
- verified status remains mandatory,
- repeated successful/failed deliveries may later influence reliability.

## 13.3 No ML Score Yet

Do not introduce an opaque formula such as:

```text
0.37 * rating + 0.24 * distance + ...
```

unless real pilot data justifies those weights.

A transparent sort/priority system is easier to debug and explain during the prototype.

---

# 14. Candidate Record Produced by Matching

For each eligible candidate, the engine should be able to produce a normalized result similar to:

```text
candidateId
partnerId
partnerMode
tripId (nullable)
predictedPickupAt
predictedDeliveryAt
pickupTravelMinutes
additionalDetourMinutes (nullable for AVAILABLE_NOW)
additionalDetourKm (nullable for AVAILABLE_NOW)
totalDeliveryTravelMinutes
reliabilityValue
rating
rankPosition
eligibilityReason = ELIGIBLE
```

Rejected candidates should ideally capture a machine-readable reason for debugging/analytics, such as:

```text
PARTNER_NOT_VERIFIED
PARTNER_BUSY
STALE_LOCATION
PICKUP_ALREADY_PASSED
WRONG_ROUTE_DIRECTION
DELIVERY_WINDOW_MISSED
DETOUR_TOO_HIGH
PICKUP_TOO_FAR
NO_ROUTE_AVAILABLE
TRIP_TIME_INCOMPATIBLE
```

This will be extremely useful while testing the prototype.

---

# 15. Dispatch Strategy

Do not broadcast every request to every eligible partner.

The prototype should dispatch in batches.

Initial configurable hypotheses:

```text
OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20
```

## Round 1

```text
Rank all eligible candidates
        ↓
Offer to candidates 1–3
        ↓
Wait ~20 seconds
```

## Round 2

If nobody accepts:

```text
Offer to next eligible candidates
        ↓
Wait ~20 seconds
```

Partners who explicitly reject the order should not receive the same unchanged offer again in the same matching attempt.

Expired offers should become inactive.

---

# 16. Offer Contents

A delivery offer should contain enough information for the partner to make a quick decision.

Prototype offer should show approximately:

```text
Pickup location / vendor name
Drop area
Requested food summary
Estimated pickup ETA
Estimated delivery duration
Additional detour (for on-my-way partner)
Expected earning
Offer expiry countdown
Accept
Reject
```

Sensitive customer information should not be exposed unnecessarily before assignment.

Exact privacy fields will be finalized during API/UI design.

---

# 17. Atomic Order Acceptance

Multiple partners may receive the same order in one dispatch batch.

Two partners can therefore press `Accept` almost simultaneously.

Only one may win.

Required behavior:

```text
Order = MATCHING

P1 accepts
P2 accepts 50 ms later

P1 → SUCCESS
Order → ASSIGNED_TO_P1

P2 → FAILURE
Reason: ORDER_ALREADY_ASSIGNED
```

The backend/database must enforce this atomically/transactionally.

Frontend checks are not sufficient.

After assignment:

- all outstanding offers for that order become invalid,
- non-winning partners are informed that the request is no longer available,
- customer sees the assigned partner,
- order progresses to the partner-to-pickup stage.

---

# 18. Partner Rejection / Offer Expiration

Partner responses may be:

```text
ACCEPTED
REJECTED
EXPIRED
```

Optional rejection reasons may later include:

```text
Too far
Not enough earning
Leaving later
Route inconvenient
Vendor issue
Other
```

The prototype does not require the partner to provide a reason to reject.

However, recording rejection data later can improve incentive and matching decisions.

---

# 19. Fallback Strategy

The customer should not wait indefinitely.

If strict matching fails, broaden gradually.

Prototype concept:

```text
ROUND 1
Strict compatible on-my-way + nearby AVAILABLE_NOW
        ↓ no acceptance
ROUND 2
Next ranked strict candidates
        ↓ no acceptance
ROUND 3
Slightly broaden pickup radius / detour tolerance
        ↓ no acceptance
ROUND 4
Optional increased partner incentive
        ↓ no acceptance
MATCHING_FAILED
```

Broadening must still preserve safety and time feasibility.

Never broaden so far that predicted delivery exceeds the customer's acceptable window.

## Example Broadened Values

Strict:

```text
MAX_ROUTE_DETOUR_MINUTES = 10
MAX_ROUTE_DETOUR_KM = 1.5
AVAILABLE_NOW_RADIUS_KM = 3
```

Possible fallback hypothesis:

```text
MAX_ROUTE_DETOUR_MINUTES = 15
MAX_ROUTE_DETOUR_KM = 2.5
AVAILABLE_NOW_RADIUS_KM = 5
```

These fallback values are hypotheses and should be configurable.

---

# 20. Incentive Escalation

If suitable candidates repeatedly reject an order, the prototype may increase expected partner earning.

Illustrative hypothesis:

```text
₹40 → ₹50 → ₹60
```

The matching engine should not silently change customer economics.

It must know whether additional incentive is funded by:

```text
customer
platform subsidy
combination
```

For the prototype, platform subsidy can be represented in the internal demo ledger.

Complex surge pricing is deferred.

---

# 21. No-Match Behavior

If no feasible partner can satisfy the request, matching should terminate clearly.

Order may transition to:

```text
MATCHING_FAILED
```

Customer experience may offer:

```text
Try Again
Schedule for Later
Edit Delivery Time
Edit Pickup
```

A future feature may support:

```text
Notify me when a partner becomes available
```

but this does not need to block the prototype.

The payment flow must then follow the prototype no-match refund/reversal simulation defined in `PAYMENT_FLOW.md`.

---

# 22. Scheduled Order Matching Timing

A scheduled customer order does not necessarily need to spam partners hours in advance.

For the prototype, matching may occur when the order enters a configurable **matching horizon** before the requested delivery window.

Initial hypothesis:

```text
SCHEDULED_MATCHING_LEAD_MINUTES = 60
```

Example:

```text
Delivery window: 6:00–6:30 PM
Matching can begin around: 5:00 PM
```

However, `TRIP_SCHEDULED` supply can be discovered earlier to show that compatible supply may exist.

For the first prototype, it is acceptable to simplify implementation by triggering actual offer dispatch at a fixed lead time before scheduled delivery.

The exact value must remain configurable.

---

# 23. Scheduled Trip Lifecycle

Conceptual trip lifecycle:

```text
TRIP_SCHEDULED
      ↓
TRIP_ACTIVE
      ↓
TRIP_COMPLETED
```

Alternate states:

```text
TRIP_CANCELLED
TRIP_EXPIRED
```

## Trip Scheduled

Partner has created route + departure window.

## Trip Active

Partner confirms/starts the trip. Current GPS position becomes authoritative.

## Trip Completed

Partner reaches destination or explicitly completes trip.

## Trip Expired

If the latest allowed departure time passes without activation, the trip should no longer be treated as valid supply.

Initial grace-period hypothesis:

```text
TRIP_START_GRACE_MINUTES = 15
```

A scheduled trip may expire after:

```text
latestDeparture + grace
```

unless partner updates it.

---

# 24. Order Matching State Lifecycle

Matching-related order states may conceptually include:

```text
PAYMENT_CONFIRMED
      ↓
MATCHING
      ↓
ASSIGNED
```

Failure branch:

```text
MATCHING
   ↓
MATCHING_FAILED
```

Cancellation branch:

```text
MATCHING
   ↓
CANCELLED
```

The exact global order state machine is defined in `USER_FLOWS.md` and will later be normalized during database/API design.

Matching must not invent inconsistent parallel state semantics.

---

# 25. Partner Becomes Unavailable During Matching

A partner can go offline while an offer is outstanding.

If they become unavailable before acceptance:

```text
offer → invalid/expired
```

If they accepted successfully first:

```text
order remains assigned
```

and normal cancellation/support rules apply if they later cannot perform the delivery.

---

# 26. Partner Cancels After Assignment

## Before Food Purchase

If assigned partner cancels before pickup/purchase:

```text
ASSIGNED
   ↓
partner cancellation
   ↓
REMATCHING
```

The engine should exclude the cancelling partner from the immediate rematch unless an admin explicitly overrides it.

Reuse remaining customer delivery time rather than resetting a fresh 45-minute SLA.

Example:

```text
Customer deadline = 5:00 PM
Partner cancels at = 4:35 PM

New candidate must still target delivery by 5:00 PM
```

## After Food Purchase

Automatic rematching is not sufficient because food/payment responsibility already exists.

Move to admin/support handling according to `PAYMENT_FLOW.md` and `USER_FLOWS.md`.

---

# 27. Matching Retry Rules

A matching attempt should have an identifier:

```text
matchingAttemptId
```

Useful fields:

```text
orderId
attemptNumber
startedAt
endedAt
result
candidateCount
offersSent
acceptedPartnerId
failureReason
```

This makes retries observable and avoids confusing separate dispatch rounds with separate customer orders.

---

# 28. Prototype Ranking Reliability

Initially, partner history may be sparse.

Use reliability only when data exists.

Potential later reliability inputs:

```text
completed deliveries
partner cancellations
accept-then-cancel rate
on-time delivery rate
customer ratings
```

For a brand-new verified partner:

```text
reliability = neutral
```

Do not prevent new supply from ever receiving orders.

---

# 29. What the Matching Engine Must NOT Do in V1

The first prototype should not attempt:

- ML candidate ranking,
- reinforcement learning,
- demand forecasting,
- multi-order batching,
- multiple pickups in one trip,
- multiple customer drops in one trip,
- automated surge pricing,
- city-wide fleet repositioning,
- advanced driver heat maps,
- complex marketplace auctions,
- route optimization across hundreds of stops,
- predictive vendor wait models.

These are potential future systems, not prototype requirements.

---

# 30. Configurable Prototype Parameters

All major threshold values must live in centralized configuration rather than being scattered as magic constants.

Initial hypotheses:

```text
MAX_ASAP_DELIVERY_MINUTES = 45

MAX_ROUTE_DETOUR_MINUTES = 10
MAX_ROUTE_DETOUR_KM = 1.5

FALLBACK_MAX_ROUTE_DETOUR_MINUTES = 15
FALLBACK_MAX_ROUTE_DETOUR_KM = 2.5

AVAILABLE_NOW_INITIAL_RADIUS_KM = 3
AVAILABLE_NOW_FALLBACK_RADIUS_KM = 5

OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20

DEFAULT_DEPARTURE_FLEX_MINUTES = 15
DEFAULT_VENDOR_WAIT_MINUTES = 8

MAX_LOCATION_AGE_SECONDS = 60
EARLY_DELIVERY_TOLERANCE_MINUTES = 10

SCHEDULED_MATCHING_LEAD_MINUTES = 60
TRIP_START_GRACE_MINUTES = 15
```

These values must be treated as **prototype hypotheses**, not validated product truths.

---

# 31. Matching Pseudocode

Conceptual prototype pseudocode:

```text
match(order):

    validateOrderIsMatchable(order)

    pools = discoverCandidates(order)

    candidates = []

    for partner in pools:

        if !partnerApproved(partner):
            reject(PARTNER_NOT_VERIFIED)
            continue

        if !partnerOperationallyAvailable(partner):
            reject(PARTNER_BUSY_OR_OFFLINE)
            continue

        if partnerNeedsFreshLocation(partner):
            reject(STALE_LOCATION)
            continue

        if partner.mode is TRIP_SCHEDULED or TRIP_ACTIVE:
            if !timeCompatible(partner, order):
                reject(TRIP_TIME_INCOMPATIBLE)
                continue

            if !directionCompatible(partner, order):
                reject(WRONG_ROUTE_DIRECTION)
                continue

            if pickupAlreadyPassed(partner, order):
                reject(PICKUP_ALREADY_PASSED)
                continue

        routeMetrics = calculateRouteMetrics(partner, order)

        if routeMetrics unavailable:
            reject(NO_ROUTE_AVAILABLE)
            continue

        if partner is on-my-way:
            if routeMetrics.detour > configured limits:
                reject(DETOUR_TOO_HIGH)
                continue

        if routeMetrics.predictedDeliveryAt outside customer window:
            reject(DELIVERY_WINDOW_MISSED)
            continue

        candidates.add(normalize(partner, routeMetrics))

    ranked = sortDeterministically(candidates)

    if ranked empty:
        runFallbackOrFail(order)
        return

    dispatchInBatches(order, ranked)
```

Dispatch:

```text
dispatchInBatches(order, ranked):

    for batch in chunks(ranked, OFFER_BATCH_SIZE):

        createOffers(batch, expiresIn = OFFER_TIMEOUT_SECONDS)

        winner = waitForAtomicAcceptance(batch)

        if winner exists:
            atomicallyAssign(order, winner)
            invalidateRemainingOffers(order)
            return ASSIGNED

    return FALLBACK_OR_FAILED
```

This pseudocode defines behavior, not the final code structure.

---

# 32. Example Scenario — ASAP + Scheduled Traveller

Current time:

```text
4:15 PM
```

Customer:

```text
Pickup X
Drop Y
ASAP
Latest delivery = 5:00 PM
```

Partner P1:

```text
TRIP_SCHEDULED
Departure: 6:00 PM ±15 min
Predicted delivery: 6:35 PM
```

Result:

```text
REJECT
TRIP_TIME_INCOMPATIBLE / DELIVERY_WINDOW_MISSED
```

Partner P2:

```text
TRIP_SCHEDULED
Departure: 4:20 PM
Predicted pickup: 4:28 PM
Predicted delivery: 4:44 PM
Detour: 6 min
```

Result:

```text
ELIGIBLE
```

Partner P3:

```text
AVAILABLE_NOW
Pickup ETA: 7 min
Predicted delivery: 4:43 PM
```

Result:

```text
ELIGIBLE
```

P2 and P3 enter ranking.

---

# 33. Example Scenario — Scheduled Customer Order

Current time:

```text
4:00 PM
```

Customer requests:

```text
Delivery window = 6:00–6:30 PM
```

Partner P1:

```text
TRIP_SCHEDULED
Departure 5:45 PM ±15 min
Predicted delivery 6:12 PM
```

Result:

```text
ELIGIBLE
```

Partner P2:

```text
AVAILABLE_NOW at 4:00 PM
Could deliver by 4:30 PM
```

This does **not** automatically make P2 better.

Delivering two hours early does not satisfy the customer's scheduled intent.

P2 should only be considered if they are still available at the relevant matching time and can satisfy the requested window.

---

# 34. Example Scenario — Pickup Already Passed

Active route:

```text
A ───── X ───── P ───── Y ───── B
```

P is the partner's current position.

If returning to X adds excessive backward travel:

```text
Result = REJECT
Reason = PICKUP_ALREADY_PASSED
```

If X is only marginally behind because of GPS/road projection noise and actual detour remains within configured tolerance, the implementation may still consider the route.

This tolerance is an engineering detail; the product principle is to avoid unreasonable backtracking.

---

# 35. Example Scenario — Two Partners Accept

Offer batch:

```text
P1
P2
P3
```

P1 and P2 press Accept almost simultaneously.

Backend outcome:

```text
P1 atomic assignment succeeds
P2 assignment fails: ORDER_ALREADY_ASSIGNED
P3 offer invalidated
```

The UI must never show two partners as assigned.

---

# 36. Example Scenario — Assigned Partner Cancels

Customer deadline:

```text
5:00 PM
```

Initial partner assigned:

```text
4:22 PM
```

Partner cancels before purchase:

```text
4:33 PM
```

Rematching begins using:

```text
remaining window = 4:33 → 5:00 PM
```

Do **not** reset deadline to:

```text
4:33 + 45 min
```

because that would violate the customer's original expectation.

---

# 37. Matching Metrics

The prototype should record enough data to validate whether the matching model works.

Minimum useful metrics:

```text
orders entering matching
candidate count per order
eligible candidate count
rejection reasons by filter
time to first offer
time to assignment
match success rate
matching failure rate
partner acceptance rate
offer expiration rate
number of dispatch rounds per order
average on-my-way detour minutes
average on-my-way detour km
predicted vs actual pickup time
predicted vs actual delivery time
partner cancellation after assignment
```

These metrics matter more than building a sophisticated algorithm early.

---

# 38. Debugging / Explainability Requirement

For prototype development, matching should be explainable.

For an order, an admin/developer should be able to understand:

```text
20 candidates discovered
8 rejected: stale location
4 rejected: wrong direction
3 rejected: detour too high
2 rejected: delivery window missed
3 eligible
```

This is preferable to an opaque score that simply says `no match`.

The matching engine should therefore preserve structured rejection reasons during debugging/testing.

---

# 39. Failure Handling

Matching must fail safely when external dependencies fail.

Examples:

## Maps API temporarily unavailable

Do not guess route compatibility from stale/incorrect data when the order requires route calculations.

Possible prototype behavior:

```text
matching temporarily unavailable
retry limited number of times
then show clear failure/admin status
```

## Location permission denied by partner

`AVAILABLE_NOW` cannot function without usable location.

Partner should be asked to enable location or go offline.

## Scheduled route cannot be calculated

Do not activate it as matchable supply until route data is valid.

---

# 40. Security / Abuse Considerations

Matching endpoints must not allow a customer to query arbitrary live partner locations.

Customer should receive only information required for the order experience.

Before assignment, partner exact personal/location details should be minimized.

After assignment, location sharing should be limited to the active order context.

Rate-limit operations such as:

- repeatedly creating/cancelling orders,
- repeatedly toggling partner online status,
- offer accept attempts,
- location updates beyond reasonable frequency.

Exact security controls will be finalized in architecture/API design.

---

# 41. Prototype Acceptance Criteria

The matching engine is good enough for the first prototype when all of the following are demonstrable:

- An `AVAILABLE_NOW` partner near pickup can receive and accept an ASAP order.
- A scheduled traveller two hours in the future does not receive an incompatible ASAP request.
- A scheduled traveller whose route/time fits a scheduled customer order can receive that order.
- An active traveller who already passed pickup is rejected when backtracking is unreasonable.
- A geographically compatible traveller is rejected if delivery ETA misses the customer window.
- A route-compatible traveller is rejected if detour exceeds the configured limit.
- Multiple eligible partners are deterministically ranked.
- Offers are sent in controlled batches rather than global broadcast.
- Offer expiration/rejection progresses to the next batch.
- Only one partner can atomically accept an order.
- If no partner accepts, the system broadens/fails gracefully.
- A pre-pickup partner cancellation can trigger rematching without resetting the customer's original deadline.
- Matching decisions/rejections can be inspected during development.

---

# 42. Future Evolution

After RouteBite has meaningful real usage data, this deterministic engine can evolve.

Possible later improvements:

```text
learned partner acceptance probability
vendor-specific wait-time prediction
traffic/time-of-day calibration
reliability scoring
ML ranking
supply-demand incentives
multi-order batching
route clustering
professional fleet dispatch
city-scale geospatial indexes
demand forecasting
```

Any future optimization must still respect the fundamental invariant:

> **A candidate must be physically and temporally capable of completing the customer's requested delivery before ranking optimization matters.**

---

# 43. Final Prototype Matching Principle

RouteBite V1 matching is deliberately simple:

```text
Find plausible supply
        ↓
Reject impossible partners
        ↓
Calculate realistic ETA/detour
        ↓
Rank eligible partners transparently
        ↓
Offer in small batches
        ↓
Atomically assign one partner
        ↓
Fallback or fail clearly
```

The goal of the prototype is **not to prove that RouteBite has the world's most advanced dispatch algorithm**.

The goal is to prove that RouteBite can intelligently connect a customer's otherwise-undeliverable local food request with a partner whose location, route, and timing genuinely make the delivery possible.