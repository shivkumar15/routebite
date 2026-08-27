# RouteBite — Phase 7 Offer Dispatch and Atomic Acceptance

> **Status:** IMPLEMENTED — MANUAL END-TO-END VERIFICATION REQUIRED

Phase 7 turns the ranked candidates from Phase 6 into short-lived partner offers and atomically assigns exactly one partner.

## Flow

```text
PAYMENT_CONFIRMED
        ↓
MATCHING
        ↓
Phase 6 CANDIDATES_READY
        ↓
create offer batch (max 3)
        ↓
Socket.IO offer:new + REST recovery
        ↓
20 second response window
   ┌────┴───────────────┐
   ↓                    ↓
ACCEPT                REJECT / EXPIRE
   ↓                    ↓
Mongo transaction     next batch
   ↓                    ↓
ASSIGNED          exhausted → MATCHING_FAILED
```

## Offer states

```text
PENDING
ACCEPTED
REJECTED
EXPIRED
CANCELLED
```

An offer is historical data. Expired/rejected/cancelled offers are retained instead of being deleted.

## Partner endpoints

```text
GET  /api/v1/partner/offers
POST /api/v1/partner/offers/:offerId/accept
POST /api/v1/partner/offers/:offerId/reject
```

All require:

```text
authenticated user
approved partner profile
```

A partner can only read/respond to their own offers.

## Offer contents before assignment

The partner sees enough to decide quickly:

```text
vendor / pickup label
requested food summary
drop area
predicted pickup time
predicted delivery time
route impact / detour
expected earning
offer countdown
```

Customer identity and unrelated private data are not exposed before assignment.

## Dispatch rules

- offer TTL: 20 seconds
- initial batch: up to 3 ranked partners
- each partner receives the same matching attempt at most once
- reject/expiry advances only when the current batch has no remaining pending offer
- next batch uses the next ranked candidates
- partners are re-checked for operational availability before a new offer is created
- no remaining operational candidate transitions the order to `MATCHING_FAILED`
- a short Mongo dispatch lease prevents two expiry/rejection workers from opening overlapping batches

## Durable expiry/recovery

Offer timeout does not depend on a browser timer.

The backend runs a lightweight maintenance job every 5 seconds:

```text
expire due PENDING offers
        ↓
advance next batch when required
        ↓
resume CANDIDATES_READY dispatch after process restart
```

The frontend countdown is display-only.

## Realtime model

Socket.IO is notification-only.

Authenticated sockets join:

```text
user:<userId>
partner:<partnerId>
```

Important events:

```text
offer:new
offer:expired
offer:cancelled
offer:accepted
matching:offers-dispatched
matching:failed
order:assigned
```

REST/MongoDB remain authoritative. Refreshing the page must recover the same truth without Socket.IO history.

## Atomic acceptance invariant

Two partners may press Accept nearly simultaneously.

The winning transaction requires:

```text
offer.status = PENDING
AND offer not expired
AND partner approved
AND partner.activeOrderId = null
AND order.status = MATCHING
AND order.assignedPartnerId = null
```

The transaction then performs:

```text
order.status = ASSIGNED
order.assignedPartnerId = winner
order.assignedTripId = candidate trip or null
partner.activeOrderId = order
partner.availabilityStatus = OFFLINE
winning offer = ACCEPTED
other PENDING offers = CANCELLED
```

Database safeguards also include:

- unique offer per `(matchingAttemptId, partnerId)`
- unique partial index allowing only one `ACCEPTED` offer per order

Frontend checks are never used as the assignment authority.

## Partner becomes unavailable

`AVAILABLE_NOW -> OFFLINE` is transactional with cancellation of that partner's pending nearby offers. This intentionally conflicts with a simultaneous acceptance transaction so only one state wins.

Cancelling/completing an On My Way trip also cancels pending offers tied to that trip and advances fallback.

While an approved partner remains `AVAILABLE_NOW`, the protected partner UI refreshes foreground browser location approximately every 15 seconds. This keeps the Phase 6 60-second location-freshness rule practical during offer dispatch.

## Manual exit criteria

```text
[ ] eligible partner receives an offer in /partner/offers
[ ] Delivery offers badge updates without page refresh
[ ] offer displays roughly 20 second countdown
[ ] partner can reject; offer disappears and order remains unassigned while fallback exists
[ ] expired offer disappears and cannot be accepted
[ ] partner can accept a fresh offer
[ ] accepted partner becomes OFFLINE with an active order
[ ] customer changes from MATCHING to ASSIGNED
[ ] customer receives assignment without manual refresh when checkout page is open
[ ] refreshing both browsers preserves the same ASSIGNED truth
[ ] second/losing offer cannot accept after assignment
[ ] going offline before acceptance invalidates AVAILABLE_NOW offer
```

## Phase boundary

Phase 7 ends at:

```text
ASSIGNED
```

Phase 8 owns partner-to-pickup operations, actual food price/receipt handling, and customer approval when the purchase price exceeds the estimate.
