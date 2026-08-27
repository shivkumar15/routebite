# RouteBite — Phase 6 Matching Engine V1

> **Status:** IMPLEMENTED — MANUAL END-TO-END VERIFICATION REQUIRED

Phase 6 turns a backend-confirmed paid order into a deterministic matching attempt.

## Automatic handoff

```text
payment.status = PAYMENT_CONFIRMED
        ↓
order.status = MATCHING
        ↓
startOrDeferMatching(orderId)
```

For ASAP requests, matching runs immediately.

For scheduled requests more than 60 minutes before their delivery window, a durable matching attempt is stored as:

```text
WAITING_FOR_HORIZON
```

with `resumeAt = deliveryWindowStart - 60 minutes`.

A lightweight backend job checks due scheduled attempts once per minute so matching survives browser refreshes and server restarts.

## Candidate pools

### AVAILABLE_NOW

MongoDB performs a coarse GeoJSON pickup-radius shortlist.

Hard requirements include:

- partner verification = APPROVED,
- availability = AVAILABLE_NOW,
- fresh location <= 60 seconds,
- no active order,
- pickup within the initial 3 km discovery radius,
- partner is not the customer placing the order.

### On My Way

Both are supported:

```text
TRIP_SCHEDULED
TRIP_ACTIVE
```

The V1 coarse geometry check uses stored trip origin/destination and direction before spending routing calls.

For active trips, current location must be fresh and the pickup cannot have already been substantially passed.

## Routing

When `GOOGLE_MAPS_API_KEY` is configured, the backend calls Google Routes API for road distance and duration.

Without the key in development/test, RouteBite uses a clearly-labelled deterministic approximation so Phase 6 can still be exercised locally:

```text
routeSource = DEV_APPROXIMATION
```

Production does not silently fall back when routing is unconfigured.

## Eligibility and ranking

Hard filters happen before ranking.

V1 rejects candidates for reasons including:

```text
PARTNER_NOT_VERIFIED
PARTNER_BUSY
STALE_LOCATION
SELF_DELIVERY_NOT_ALLOWED
PICKUP_ALREADY_PASSED
WRONG_ROUTE_DIRECTION
DELIVERY_WINDOW_MISSED
DELIVERY_TOO_EARLY
TRIP_TIME_INCOMPATIBLE
DETOUR_TOO_HIGH
NO_ROUTE_AVAILABLE
```

Ranking remains deterministic:

1. materially earlier predicted delivery,
2. efficient on-my-way supply when delivery outcomes are near-equal,
3. lower detour,
4. lower pickup ETA,
5. completion history,
6. rating,
7. stable partner-id tie break.

No ML score is used.

## Persisted matching attempt

The matching attempt stores:

```text
orderId
attemptNumber
status
resumeAt
candidate counts
ranked internal candidates
rejection summary
offer-ready top partner ids
route source
completedAt
```

Pre-assignment partner IDs remain server-side. The customer API exposes counts, modes, ETA-style summary data and matching state, not internal partner identities.

## Phase 6 / Phase 7 boundary

Phase 6 prepares the top candidate batch.

```text
CANDIDATES_READY
```

Phase 7 will add durable `Offer` documents, Socket.IO offer delivery, accept/reject/expiry and atomic assignment. Keeping acceptance out of Phase 6 avoids building a temporary non-atomic assignment flow that would immediately need replacement.

## No-match behavior

If no candidate survives the hard filters and route checks:

```text
matching.status = NO_CANDIDATES
order.status = MATCHING_FAILED
```

The order does not wait indefinitely.

Demo refund/reversal handling remains a later payment/ledger lifecycle concern.

## Manual exit criteria

```text
[ ] confirmed ASAP payment starts matching automatically
[ ] approved fresh AVAILABLE_NOW partner near pickup can become eligible
[ ] customer does not see partner ids before assignment
[ ] offline partner is excluded
[ ] stale AVAILABLE_NOW location is excluded
[ ] partner with activeOrderId is excluded
[ ] customer cannot match their own partner profile
[ ] compatible scheduled/active trip can be considered in route direction
[ ] no eligible candidates becomes MATCHING_FAILED
[ ] scheduled request outside 60-minute horizon shows WAITING_FOR_HORIZON
[ ] refresh preserves matching outcome
```
