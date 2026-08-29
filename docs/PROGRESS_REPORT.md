# RouteBite — Progress Report

> **Last updated:** 29 August 2026
> **Stable branch:** `main`
> **Project status:** Phase 0–15 complete and merged. Post-MVP product evolution is planned in `PRODUCT_EVOLUTION_ROADMAP.md`; Phase 16 awaits joint product approval.

This document records what has been completed and how each milestone was validated. `PRODUCT_EVOLUTION_ROADMAP.md` is the current source of truth for the next product phases, decision checkpoints and non-regression gates.

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

# 4. Phase 15 — Full Rehearsal and Hardening ✅ COMPLETE

Phase 15 proved the complete development prototype and its critical race/recovery invariants
without manual MongoDB editing.

Completed branch:

```text
phase-15-full-rehearsal-hardening
```

Merged through PR #16. Stable merge commit:

```text
c16c338e5246b5c0ac5529b299d4cbeef31aa277
```

## Final evidence

- Mongoose `new: true` / synchronous validation deprecations removed.
- Partner Available Now location refreshes every 15 seconds while eligible.
- Customer active-delivery tracking has a 30-second REST fallback in addition to Socket.IO.
- AVAILABLE_NOW browser flow passed payment, matching, atomic assignment, pickup, higher-price
  approval, tracking/reconnect, wrong-OTP protection, completion, one earning, rating and admin
  inspection.
- Scheduled / On My Way browser flow passed compatible route matching while the partner was
  offline for Available Now work, offer acceptance, automatic ₹200 → ₹180 downward adjustment,
  pickup, delivery OTP, completion, one earning and admin inspection.
- An intentionally unaccepted offer advanced to explicit `MATCHING_FAILED` with no assignment
  or earning.
- Existing cancellation and failure-recovery behavior remained explicit and inspectable through
  Admin Operations.

Final development-database rehearsals:

```text
hardening:accept-race            PASS · exactly one acceptance winner
hardening:restart-offer          PASS · persisted offer recovered and expired explicitly
hardening:webhook-idempotency    PASS · one event / one matching attempt
hardening:completion-idempotency PASS · one completion / one earning
hardening:audit                  PASS · latest 18 orders · 0 errors / 0 warnings
```

CI installs from committed backend/frontend lockfiles with `npm ci` and passes:

```text
hardening syntax checks
backend Jest · 23 suites / 108 tests
frontend production build
```

Phase 15 exit criteria are satisfied on the development prototype.

---

# 5. Completed Compatibility Cleanup

## Mongoose deprecation warnings

The remaining runtime calls that used:

```js
{ new: true }
```

with `findOneAndUpdate()` now use:

```js
{ returnDocument: 'after' }
```

The model tests were also migrated from deprecated `validateSync()` calls to asynchronous `validate()` assertions. Verification after the cleanup:

```text
backend source/test deprecation scan: clean
backend Jest: 23 suites / 108 tests passed
Mongoose deprecation warnings: none
```

Node's experimental VM-modules notice remains a Jest runtime notice, not a Mongoose warning or application failure.

---

# 6. What Is Left

No Phase 15 engineering, rehearsal or merge blocker remains. The original working-MVP milestone
is complete.

The next work is deliberately separated into product-evolution phases:

```text
Phase 16  Location selection foundation
Phase 17  Map-aware tracking and route clarity
Phase 18  Product language and trust
Phase 19  Compact design foundation
Phase 20  Customer journey redesign
Phase 21  Partner journey redesign
Phase 22  Admin and operations redesign
Phase 23  Pilot readiness
Phase 24  Judge release rehearsal and hardening
```

See `PRODUCT_EVOLUTION_ROADMAP.md` for scope, order, ownership, decision checkpoints and exit
criteria. Phase 16 does not begin implementation until the initial map provider and experience
decisions are jointly approved.

Public-production gaps remain explicit: live marketplace settlement/refunds, production
deployment and monitoring, security review, load/failure testing, backup/restore drills, legal
and food-handling policy, partner KYC and real operational support.

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
Phase 15  Full rehearsal / hardening       ✅
```

Approximate project state:

> **The working MVP and Phase 15 verification are complete and merged. RouteBite is entering controlled product evolution; it is not yet approved for an uncontrolled public-production launch.**

---

# 9. Rule for Future Work

Future work is governed by `PRODUCT_EVOLUTION_ROADMAP.md`:

> Preserve `c16c338e5246b5c0ac5529b299d4cbeef31aa277` as the known-good behavioral baseline. Build one focused phase per branch/PR, keep MongoDB and REST authoritative, and treat any flow that requires manual database repair as a blocker bug.

Product-facing language should present RouteBite as a working project/MVP without making false
claims about test-only payments, simulated settlement or public-production readiness.
