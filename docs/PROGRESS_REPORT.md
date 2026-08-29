# RouteBite — Progress Report

> **Last updated:** 29 August 2026
> **Current branch:** `phase-15-full-rehearsal-hardening`
> **Prototype status:** Phase 0–14 complete and merged. Phase 15 hardening in progress.

This document is the current source of truth for what has been completed, how each milestone was validated, and what remains before the RouteBite prototype can be considered finished.

---

# 1. Product We Have Built

RouteBite is a hyperlocal food-delivery marketplace for local/street-food sellers that may not be registered on a traditional delivery platform.

Core product idea:

> Make the pickup location deliverable, not necessarily the vendor.

The customer can request food from a specific local place, provide the pickup location/pin and instructions, and RouteBite matches the request with either:

1. an **AVAILABLE_NOW** delivery partner, or
2. an **On My Way / scheduled-trip** partner already travelling in a compatible direction.

Vendor registration is not required for the prototype.

---

# 2. Current Technology Stack

The prototype uses a MERN-first architecture with only the additional services required for the product.

- React + Vite
- React Router
- Axios
- Node.js + Express
- MongoDB Atlas + Mongoose
- JWT HttpOnly-cookie authentication
- bcrypt
- express-validator
- Socket.IO
- Razorpay Test Mode
- Cloudinary
- Resend
- Google Maps / route integration where required
- Jest + Supertest
- GitHub Actions CI

Backend structure follows:

```text
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Mongoose Model
```

MongoDB is the authoritative source of truth. Socket.IO is used only for real-time notification/update delivery.

---

# 3. Phase-by-Phase Progress

## Phase 0 — Project Scaffold ✅ COMPLETE

Implemented:

- React/Vite frontend
- Express backend
- MongoDB connection
- environment configuration
- health endpoint
- Socket.IO connection
- base error handling
- initial GitHub Actions checks

How it was completed:

- frontend and backend were started independently
- frontend successfully called backend health API
- MongoDB Atlas connectivity was verified
- Socket.IO connection was verified
- secrets were kept outside Git through `.env`

Merged through PR #1.

---

## Phase 1 — Authentication ✅ COMPLETE

Implemented:

- User model
- register
- login
- logout
- current-user endpoint
- bcrypt password hashing
- JWT HttpOnly cookie
- user/admin authorization
- React AuthContext and protected routes

How it was validated:

- successful registration/login/logout
- duplicate registration rejection
- protected endpoint rejection for anonymous users
- admin authorization checks
- automated backend tests

Merged through PR #2.

---

## Phase 2 — Partner Application and Admin Approval ✅ COMPLETE

Implemented:

- Partner model
- partner application
- email OTP verification
- development OTP fallback
- Cloudinary document/photo upload
- admin pending-partner queue
- approve/reject flow
- approved-partner authorization

Important rule:

A normal customer cannot promote themselves to an approved partner. Approval is an admin operation.

How it was validated:

- user applied as partner
- email verification completed
- admin reviewed and approved partner
- approved partner capability became available
- unapproved partner restrictions were tested

Merged through PR #3 / subsequent partner phase work.

---

## Phase 3 — Partner Availability and Trips ✅ COMPLETE

Implemented:

### Available Now

```text
OFFLINE ↔ AVAILABLE_NOW
```

- current location stored as GeoJSON
- browser location refresh
- location freshness rules

### On My Way / Trip

- create scheduled trip
- start trip
- cancel trip
- complete trip
- one active trip protection
- destination + route-compatible matching data

Important prototype note:

Manual latitude/longitude controls remain for development testing, but the intended customer/partner UX is map/search/pin based. Users should not need to know coordinates in the final UI.

How it was validated:

- approved-only availability
- location persistence
- schedule/start/cancel/complete trip flow
- single-active-trip invariant
- manual browser testing

---

## Phase 4 — Order Creation ✅ COMPLETE

Implemented:

- customer food request draft
- vendor/display name
- requested items
- pickup/drop GeoJSON
- pickup instructions
- ASAP or scheduled delivery
- estimated food cost
- integer-paise pricing
- owner-scoped CRUD

Canonical fulfillment lifecycle was defined separately from payment state.

How it was validated:

- customer could create/view/edit their own draft
- invalid ownership was blocked
- invalid scheduled windows were rejected
- coordinates were persisted correctly
- money was stored as integer paise

Merged through PR #5.

---

## Phase 5 — Razorpay Test Payment ✅ COMPLETE

Implemented:

- separate Payment model
- Razorpay Test order creation
- server-side signature verification
- payment idempotency key
- webhook support
- duplicate webhook protection
- payment confirmation transaction
- automatic transition into matching
- customer checkout UI

Pricing prototype:

```text
Estimated food cost
+ ₹40 delivery charge
+ ₹10 platform fee
= estimated customer total
```

Partner base earning remains separate from customer total accounting.

How it was validated:

- successful Razorpay Test payment
- backend-confirmed payment persisted after refresh
- closing checkout left payment retryable
- matching started only after confirmed payment
- webhook/idempotency logic was tested

Merged through PR #6.

---

## Phase 6 — Matching Engine V1 ✅ COMPLETE

Implemented matching pipeline:

```text
Eligibility
   ↓
Ranking
   ↓
Dispatch
```

Available Now rules include:

- approved partner
- operational availability
- fresh location
- no incompatible active order
- pickup radius check
- delivery-window feasibility

On My Way rules include:

- route compatibility
- trip direction
- time compatibility
- detour limits

Prototype assumptions include:

- ASAP target window: 45 minutes
- Available Now discovery radius: about 3 km
- On My Way departure flexibility: ±15 minutes
- detour target: about +10 minutes / 1.5 km
- deterministic ranking, no ML

How it was validated:

- no eligible partner → explicit `MATCHING_FAILED`
- eligible partner → candidate/offer-ready attempt
- stale/offline/busy partners excluded
- route-direction failure surfaced
- matching diagnostics built for investigation

---

## Phase 7 — Offer Dispatch and Atomic Assignment ✅ COMPLETE

Implemented:

- persistent Offer model
- offer rounds
- expiration
- accept/reject
- Socket.IO offer delivery
- partner offer inbox
- losing-offer invalidation
- atomic order assignment
- partner `activeOrderId` locking

Critical invariant:

> Exactly one partner may win an order.

How it was validated originally:

- manual multi-partner acceptance testing
- transaction/conditional-write logic

How it was revalidated in Phase 15:

```text
npm run hardening:accept-race -- --confirm-dev-db
```

Result:

```text
Partner 1 → fulfilled / ACCEPTED
Partner 2 → rejected / OFFER_NOT_PENDING
Accepted offers → 1
Active assigned partners → 1
PASS
```

---

## Phase 8 — Pickup and Price Confirmation ✅ COMPLETE

Implemented:

```text
ASSIGNED
  ↓
PARTNER_TO_PICKUP
```

Partner can report actual food amount.

Rules:

```text
actual == estimate → continue
actual < estimate  → auto downward demo adjustment
actual > estimate  → PRICE_CONFIRMATION_REQUIRED
```

Customer can approve/reject the increase.

Optional receipt/proof upload is supported.

How it was validated:

- partner pickup flow
- higher-price approval flow
- lower-price adjustment flow
- pickup blocked until price issue resolved
- price-confirmation timeout and recovery path

---

## Phase 9 — Live Delivery Tracking ✅ COMPLETE

Implemented:

```text
PICKED_UP → OUT_FOR_DELIVERY
```

- partner foreground geolocation updates about every 10–15 seconds
- authoritative REST location persistence
- Socket.IO location broadcast
- customer tracking endpoint/page
- stale-location detection
- browser refresh recovery via REST
- GPS accuracy displayed as uncertainty radius

Important architecture rule:

Google Routes is not called on every GPS update.

How it was validated:

- customer saw partner location updates
- refresh recovered correct state
- stale tracking was surfaced
- tracking stopped outside active delivery states

Merged through PR #10.

---

## Phase 10 — Delivery OTP and Completion ✅ COMPLETE

Implemented:

```text
OUT_FOR_DELIVERY
      ↓
DELIVERY_OTP_REQUIRED
      ↓
DELIVERED
      ↓
COMPLETED
```

OTP design:

- six digits
- five-minute expiry
- maximum five attempts
- hash stored, never plaintext
- regeneration invalidates previous OTP

Completion transaction ensures:

- OTP consumed once
- order completed once
- partner released
- partner switched offline
- `completedOrderCount` incremented once
- one PartnerEarning record

How it was validated originally:

- wrong OTP rejected
- real OTP succeeded
- completion visible to customer/partner

How it was revalidated in Phase 15:

```text
npm run hardening:completion-idempotency -- --confirm-dev-db
```

Result:

```text
Attempt 1 → COMPLETED
Attempt 2 → ACTIVE_ORDER_REQUIRED
Order → COMPLETED
OTP used → true
Partner activeOrderId → null
completedOrderCount → 1
PartnerEarning count → 1
PASS
```

---

## Phase 11 — Demo Ledger and Partner Earnings ✅ COMPLETE

Implemented deterministic accounting projection from existing authoritative documents rather than introducing a second mutable ledger database.

Tracks concepts such as:

- customer test payment
- food amount
- delivery charge
- platform fee
- partner earning
- incentive
- adjustment
- refund representation

Important limitation:

This is prototype/demo accounting. It does not claim that real settlement/refund/payout money movement occurred.

How it was validated:

- completed-order financial breakdown
- matching-failed refund representation
- partner base/incentive/total earning display
- wording was corrected so refund and adjustment are not presented as two independent cash movements

Merged through PR #12.

---

## Phase 12 — Cancellation and Failure Recovery ✅ COMPLETE

Implemented explicit recovery paths for:

- customer cancellation before purchase/pickup
- paid cancellation → demo refund representation
- partner unable to continue before pickup → release + rematch
- partner failure after pickup → `ADMIN_REVIEW_REQUIRED`
- matching failure
- price confirmation timeout
- wrong/expired OTP
- persistent recovery metadata

Recovery metadata includes:

- event
- actor
- reason
- time
- rematch count
- excluded partner IDs

Available Now location freshness was hardened to 300 seconds while the UI continues refreshing frequently.

How it was validated:

- full manual cancellation/recovery test
- matching diagnostics
- user confirmed all tested Phase 12 flows were working

Merged through PR #13.

---

## Phase 13 — Admin Operations ✅ COMPLETE

Implemented admin operational investigation without arbitrary database editing.

Admin can inspect:

- order list
- attention/review queues
- customer
- assigned partner
- payment attempts
- demo accounting
- matching attempts
- rejection reasons
- offer history
- price adjustment
- receipt/proof
- recovery metadata
- partner earning
- derived operational timeline

Added a direct queue-level reason box for stopped orders:

- cancellation reason
- matching failure reason
- rejection summary
- offer expiry
- admin-review reason

Important safety decision:

There is no generic "force order status" control.

Admin actions must respect service-layer business rules.

How it was validated:

- admin dashboard/manual inspection
- existing failed and completed orders inspected
- backend tests + frontend build
- user confirmed the admin UI was working

Merged through PR #14.

---

## Phase 14 — Ratings and Reviews ✅ COMPLETE

Implemented:

- one customer rating per completed order
- score 1–5
- optional text feedback
- immutable unique order rating
- transactional partner aggregate update
- partner `ratingAverage`
- partner `ratingCount`

Customer sees whom they are rating:

- partner full name
- partner short ID
- partner rating
- exact completed order/vendor/route

Partner sees:

- score
- written feedback
- exact completed order
- vendor/route/date
- customer first name only

Partner does not receive customer email or phone through the review API.

How it was validated:

- customer rating submission
- refresh persistence
- duplicate rating prevention
- partner aggregate display
- dedicated customer reviews page
- privacy behavior manually checked

Merged through PR #15.

Phase 14 merge commit:

```text
5102cb4a588e7aab3aca0ddae6e828f0ddb33428
```

---

# 4. Phase 15 — Full Rehearsal and Hardening 🚧 IN PROGRESS

Phase 15 is the final prototype phase.

The goal is not to add another large product feature. The goal is to repeatedly attempt to break the complete system and fix any path that still requires manual MongoDB editing.

Current branch:

```text
phase-15-full-rehearsal-hardening
```

## Hardening completed so far

### A. Development DB invariant audit ✅ PASSED

Command:

```powershell
npm run hardening:audit
```

Actual result on the current development DB:

```text
RouteBite Phase 15 invariant audit · latest 15 order(s)
Errors: 0
Warnings: 0
PASS: no invariant issues found in the audited orders.
```

The audit checks conditions including:

- MATCHING order must not already have an assigned partner
- active fulfillment order must have an assigned partner
- partner `activeOrderId` must point back to active assignment
- terminal/released order must not lock a partner
- maximum one ACCEPTED offer per order
- accepted offer partner must equal assigned partner
- completed order must have completion timestamp
- earning cardinality must remain valid
- confirmed payment/order-state consistency

The audit is read-only.

### B. Offer acceptance concurrency ✅ PASSED

Command:

```powershell
npm run hardening:accept-race -- --confirm-dev-db
```

Actual result:

```text
one fulfilled
one rejected
one ACCEPTED offer
one CANCELLED losing offer
exactly one partner assigned
PASS
```

Temporary fixtures were automatically cleaned up.

### C. Server restart / pending offer persistence ✅ PASSED

Command:

```powershell
npm run hardening:restart-offer -- --confirm-dev-db
```

Actual result:

```text
PASS 1: valid pending offer survived restart maintenance.
PASS 2: expired persisted offer advanced to explicit MATCHING_FAILED without DB editing.
PASS: server restart / pending-offer persistence rehearsal succeeded.
```

This confirms offers are persisted in MongoDB and do not depend on Node/Socket process memory.

### D. Delivery completion idempotency ✅ PASSED

Command:

```powershell
npm run hardening:completion-idempotency -- --confirm-dev-db
```

Actual result:

```text
first completion → fulfilled / COMPLETED
second concurrent completion → rejected / ACTIVE_ORDER_REQUIRED
orderStatus → COMPLETED
otpUsed → true
partnerActiveOrderId → null
completedOrderCount → 1
earningCount → 1
PASS
```

### E. Razorpay webhook idempotency ✅ PASSED

Command:

```powershell
npm run hardening:webhook-idempotency -- --confirm-dev-db
```

The rehearsal was improved so it uses an isolated synthetic webhook secret instead of requiring the developer's real Razorpay webhook secret.

Actual result:

```text
first delivery:
  duplicate = false
  processed = true

second delivery:
  duplicate = true
  processed = true

paymentStatus = PAYMENT_CONFIRMED
webhookEventCount = 1
matchingAttemptCount = 1
PASS
```

The synthetic fixture naturally reached `MATCHING_FAILED` because it intentionally did not create a real matching partner; this does not affect the webhook idempotency assertion.

### F. CI ✅ GREEN

Throughout Phase 15, GitHub Actions continues checking:

- hardening script syntax
- backend test suite
- frontend production build

Latest hardening commits have remained green before local rehearsal commands were handed off.

---

# 5. Known Non-Blocking Cleanup

## Mongoose deprecation warnings

Some older code still uses:

```js
{ new: true }
```

with `findOneAndUpdate()`.

Current Mongoose versions prefer:

```js
{ returnDocument: 'after' }
```

The warnings did not invalidate any hardening test, but Phase 15 should clean remaining occurrences before final merge where practical.

---

# 6. What Is Left

The backend race/idempotency block is essentially complete.

The remaining Phase 15 work is primarily full browser rehearsal and final cleanup.

## Remaining manual/full-system rehearsal

### 1. AVAILABLE_NOW happy path

Run one complete request without DB editing:

```text
customer creates request
→ Razorpay Test payment
→ matching
→ AVAILABLE_NOW partner gets offer
→ partner accepts
→ pickup
→ actual food price
→ pickup confirmed
→ live delivery tracking
→ delivery OTP
→ COMPLETED
→ earning
→ customer rating/review
```

### 2. On My Way happy path

Repeat the complete delivery using a compatible scheduled/active trip partner.

Verify:

- route direction compatibility
- detour behavior
- offer delivery
- accepted trip partner assignment
- complete delivery path

### 3. Price increase path

Verify:

```text
actual food cost > estimate
→ PRICE_CONFIRMATION_REQUIRED
→ customer approves
→ pickup continues
```

### 4. Price decrease path

Verify:

```text
actual food cost < estimate
→ automatic downward demo adjustment
→ no unnecessary approval
```

### 5. Failure paths

Rehearse at least:

- no partner available
- partner rejects offer
- offer expires
- customer cancels before pickup
- partner cancels before purchase and order rematches
- wrong OTP
- expired/regenerated OTP where practical
- partner post-pickup failure → admin review

### 6. Browser/network resilience

Verify:

- refresh customer page during active delivery
- refresh partner page during active delivery
- Socket.IO disconnect/reconnect
- partner offer page resynchronizes from REST after reconnect
- current order remains correct after refresh

### 7. Admin final inspection

After the rehearsal, inspect generated orders through Admin Operations and verify:

- successful timeline
- failed/cancelled reason box
- payment state
- matching attempts/offers
- recovery details
- accounting projection
- receipt/proof when present

### 8. Final invariant audit

After all manual rehearsal scenarios:

```powershell
npm run hardening:audit
```

Expected final result:

```text
Errors: 0
Warnings: 0
```

### 9. Final CI + PR + merge

When all final rehearsals pass:

```text
Phase 15 branch
   ↓
GitHub Actions green
   ↓
Phase 15 PR
   ↓
PR-triggered CI green
   ↓
merge to main
```

At that point the planned RouteBite prototype is complete.

---

# 7. Prototype Completion Definition

The prototype is considered complete when this can happen without manually editing MongoDB:

```text
Admin ready
   ↓
Customer account
   ↓
Approved partner
   ↓
Partner supply available
   ↓
Customer request
   ↓
Razorpay Test payment
   ↓
Automatic matching
   ↓
Persistent offer
   ↓
Atomic partner acceptance
   ↓
Pickup
   ↓
Price handling
   ↓
Live delivery tracking
   ↓
Delivery OTP
   ↓
COMPLETED
   ↓
Demo earning/accounting
   ↓
Customer rating/review
   ↓
Admin can investigate the complete lifecycle
```

And the system must recover cleanly from the tested failure/race cases without direct database intervention.

---

# 8. Current Overall Status

```text
Phase 0   Scaffold                         ✅
Phase 1   Authentication                   ✅
Phase 2   Partner verification             ✅
Phase 3   Availability / trips             ✅
Phase 4   Order creation                   ✅
Phase 5   Razorpay Test payment            ✅
Phase 6   Matching engine                  ✅
Phase 7   Offer dispatch / atomic accept   ✅
Phase 8   Pickup / price adjustment        ✅
Phase 9   Live tracking                    ✅
Phase 10  Delivery OTP / completion        ✅
Phase 11  Demo ledger / earnings           ✅
Phase 12  Cancellation / recovery          ✅
Phase 13  Admin operations                 ✅
Phase 14  Ratings / reviews                ✅
Phase 15  Full rehearsal / hardening       🚧
```

Approximate project state:

> **Feature implementation is essentially complete. The remaining work is final end-to-end rehearsal, resilience/failure validation, cleanup of any issues discovered, final invariant audit, CI, and Phase 15 merge.**

---

# 9. Rule for Future Work

Until Phase 15 is merged:

> Do not call the prototype finished merely because a UI screen works. Any discovered failure that requires manually changing MongoDB records must be treated as a bug and fixed through the normal service/API flow.

After Phase 15 passes and merges, future work should be treated as post-prototype product evolution rather than part of the original prototype milestone.
