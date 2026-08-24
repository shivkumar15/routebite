# RouteBite — Project Context

> **Status:** Living source-of-truth document
>
> **Working name:** RouteBite (temporary)
>
> This document explains the product, current prototype scope, major engineering direction, confirmed assumptions and remaining open questions. Detailed implementation rules live in the specialized documents under `docs/`.

---

# 1. Origin Story

The idea started on **15 August**.

There was a craving for jalebi from a particular local place roughly **4–5 km away**. A friend was already travelling toward that side, so the natural thought was to ask the friend to bring the food while returning. Because of the Independence Day crowd, the friend could not bring it.

The available alternative was to order a more expensive option from a restaurant already available on an online delivery platform.

That exposed the underlying problem:

> A customer may know exactly which local food they want and where it is sold, but that food may still be difficult or impossible to order because the seller is not digitally available on a delivery marketplace.

The seller exists. The demand exists. The missing piece is a flexible delivery path between pickup and customer.

---

# 2. Product Thesis

> **Make a pickup location deliverable even when the vendor itself is not registered on the platform.**

RouteBite connects a customer who wants food from a pickup point with a delivery partner capable of bringing that food to the customer.

The product is not initially dependent on onboarding every street-food vendor.

Core logistical entities are:

```text
pickup location
customer delivery location
customer request
partner current location / planned route
time window
```

Vendor name helps the human partner identify the seller, but coordinates and route/time information drive matching.

---

# 3. Initial Target Market

Launch deliberately small:

```text
one college campus
+
nearby food zones
+
repeated high-density routes
```

Do not begin city-wide.

RouteBite is a two-sided marketplace, so concentrating demand and supply improves the probability of a useful match.

---

# 4. Initial Scope

## Category

**Food only.**

Groceries, documents, parcels and other hyperlocal items are future possibilities, not V1 requirements.

## Vendor registration

Vendor registration is **not required**.

Customer may provide:

- vendor/display name,
- requested items,
- pickup pin/location,
- delivery location,
- landmarks/instructions.

If Google Places knows the vendor, customer can select it. Otherwise customer manually drops the pickup pin.

---

# 5. Users and Roles

RouteBite uses **one core user account**.

A normal account can order food.

The same account may apply to become a partner.

Conceptually:

```text
USER
 ├── Customer capability
 │
 └── Optional Partner Profile
          ↓
 PENDING_VERIFICATION
          ↓
       APPROVED
```

Admin is a protected system role.

---

# 6. Partner Supply Modes

One approved partner identity supports two modes.

## 6.1 Available to Deliver

```text
OFFLINE → AVAILABLE_NOW
```

The partner is intentionally online and willing to perform a dedicated delivery.

Matching uses current location, location freshness, ETA to pickup and customer delivery window.

## 6.2 On My Way

Partner declares a planned trip:

```text
Origin A
Destination B
Scheduled departure
Departure flexibility
```

Lifecycle:

```text
TRIP_SCHEDULED
      ↓
TRIP_ACTIVE
      ↓
TRIP_COMPLETED
```

A future scheduled trip is **not** immediate availability.

Once the trip starts, current location and route progress become more important than the original schedule.

---

# 7. Customer Order Flow

The working prototype must support this complete flow:

```text
Customer signs in
      ↓
Creates food request
      ↓
Searches vendor OR drops pickup pin
      ↓
Selects delivery location
      ↓
Enters requested items
      ↓
Chooses ASAP / Schedule for Later
      ↓
Sees estimated price
      ↓
Completes Razorpay test checkout
      ↓
Automatic matching starts
      ↓
Partner receives offer
      ↓
Exactly one partner accepts
      ↓
Partner goes to pickup
      ↓
Actual food bill entered
      ↓
Customer approves increase if required
      ↓
Food picked up
      ↓
Foreground live delivery tracking
      ↓
Delivery OTP
      ↓
Order completed
      ↓
Demo partner earning recorded
      ↓
Customer rating
```

Detailed behavior lives in `USER_FLOWS.md` and `PRODUCT_REQUIREMENTS.md`.

---

# 8. Matching Principle

Matching must consider **space and time together**.

The key question is:

> Can this partner realistically reach pickup X and deliver to Y within the customer's required time window with acceptable detour?

Core pipeline:

```text
Discover candidates
      ↓
Hard eligibility filters
      ↓
Google Maps ETA / route calculations
      ↓
Rank eligible candidates
      ↓
Dispatch controlled offer batch
      ↓
Atomic acceptance
      ↓
Next batch / fallback / failure
```

Core rule:

> **Filter first, rank second, dispatch third.**

The prototype uses deterministic matching, not machine learning.

Detailed rules live in `MATCHING_ENGINE.md`.

---

# 9. Matching Inputs

Order matching uses:

```text
pickup coordinates
customer coordinates
delivery window
partner mode
partner current location
partner route
scheduled/actual departure
route direction
route progress
predicted pickup ETA
predicted delivery ETA
detour
partner operational state
```

Vendor name is never sufficient by itself.

---

# 10. Initial Matching Hypotheses

These are configurable starting values, not validated business rules:

```text
MAX_ASAP_DELIVERY_MINUTES = 45
MAX_ROUTE_DETOUR_MINUTES = 10
MAX_ROUTE_DETOUR_KM = 1.5
OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20
DEFAULT_DEPARTURE_FLEX_MINUTES = 15
DEFAULT_VENDOR_WAIT_MINUTES ≈ 8
ACTIVE_DELIVERY_LOCATION_UPDATE_SECONDS ≈ 10–15
```

Pilot data should replace incorrect assumptions.

---

# 11. Candidate Types

## On-My-Way Candidate

Eligible only when:

- route is compatible,
- pickup occurs before drop in travel direction,
- active partner has not substantially passed pickup,
- detour is acceptable,
- delivery window can be satisfied.

## Available-Now Candidate

Eligible when:

- partner is approved,
- partner is online,
- location is fresh,
- partner is not already committed,
- pickup/customer can be reached within the time window.

---

# 12. Matching Technology Direction

The confirmed prototype implementation is:

```text
MongoDB geospatial/coarse filtering
        ↓
small candidate shortlist
        ↓
Google Maps road ETA/routes
        ↓
RouteBite eligibility/ranking
```

MongoDB straight-line proximity does not replace Google Maps road routing for final eligibility.

---

# 13. Offer Dispatch

Initial strategy:

```text
Round 1 → top 3 candidates
        → wait about 20 seconds

No acceptance
        ↓
Round 2 → next candidates

Still no acceptance
        ↓
Broaden acceptable constraints and/or incentive
        ↓
Fail clearly if no feasible supply
```

Do not broadcast every request to every partner.

---

# 14. Atomic Assignment

If multiple partners accept at nearly the same time, exactly one may win.

The prototype uses MongoDB transactions/conditional writes so:

```text
one order → one active assigned partner
one partner → at most one active order
```

All later competing acceptance attempts fail cleanly.

---

# 15. Payment Prototype

Production-grade settlement is intentionally deferred.

Use:

```text
Razorpay Test Mode
+
RouteBite internal demo ledger
```

Customer completes test payment before matching.

Illustrative pricing:

```text
customer-entered food estimate
partner earning ≈ ₹40
platform fee ≈ ₹10
```

These are hypotheses, not validated economics.

Detailed behavior lives in `PAYMENT_FLOW.md`.

---

# 16. Price Changes

Because local vendors may not have digital menus, actual price may differ from the estimate.

Flow:

```text
Partner enters actual bill
        ↓
price equal → continue
price lower → demo total decreases
price higher → customer approval required
```

Partner should not silently increase the bill.

---

# 17. Cancellation

Prototype rules:

- customer can cancel before food purchase under allowed states,
- after pickup/purchase there is no unrestricted one-click cancellation,
- partner cancellation before purchase attempts rematching,
- post-purchase failure moves to admin review.

Production refund/penalty/liability automation is deferred.

---

# 18. Trust and Partner Verification

Campus prototype verification uses:

```text
phone verification
profile photo
college identity/enrollment information
college ID upload where applicable
manual admin approval
```

Approved label may be:

```text
Campus Partner Verified
```

Do not call this government-backed KYC.

Do not require full Aadhaar collection for the campus prototype.

---

# 19. Delivery Verification

Delivery completion requires an OTP/equivalent handoff code.

Raw OTP is never stored.

The backend stores a hash, expiry, attempt count and verification timestamp.

---

# 20. Realtime Tracking

The prototype uses foreground browser location.

Before assignment, `AVAILABLE_NOW` partner location updates periodically.

During active delivery:

```text
partner browser
      ↓
location approximately every 10–15 seconds
      ↓
Express/Socket.IO
      ↓
customer tracking UI
```

MongoDB/backend remains authoritative.

Reliable mobile background GPS is deferred.

---

# 21. Notifications

Prototype starts with:

```text
in-app realtime/status updates
+
OTP
```

WhatsApp, email, production push and full SMS status systems do not block V1.

---

# 22. Admin Operations

The prototype requires a basic admin area capable of:

```text
view pending partner applications
approve/reject partner
view active/failed orders
review receipts
review uploaded verification documents
handle manual cancellation/problem states
mark admin review resolved
```

Early-stage manual operations are acceptable.

---

# 23. Confirmed Technology Architecture — MERN+

The first prototype is now confirmed as **MERN-first**.

Core stack:

```text
Frontend:
React + Vite
React Router
Axios
Context API/local state

Backend:
Node.js
Express.js
JavaScript

Database:
MongoDB Atlas
Mongoose

Realtime:
Socket.IO

Authentication:
JWT HttpOnly cookie
bcrypt

External capabilities:
Google Maps Platform
Razorpay Test Mode
Cloudinary private/authenticated storage
```

Detailed explanations live in `TECH_STACK.md`.

---

# 24. Architecture Shape

The prototype uses a **modular monolith**.

```text
ONE React application
        ↓
ONE Express backend
        ↓
ONE MongoDB Atlas database
```

The Express deployment also hosts:

```text
REST API
Socket.IO
React production build
lightweight periodic expiry jobs
```

No microservices are required.

Detailed design lives in `ARCHITECTURE.md`.

---

# 25. Backend Structure

Even with Express, business logic should not be mixed into routes.

Use:

```text
Route
 ↓
Middleware
 ↓
Controller
 ↓
Service
 ↓
Mongoose/MongoDB
```

Business rules such as order transitions, assignment, completion and price approval belong in service functions.

---

# 26. Database Correctness Principles

MongoDB's flexible document model does not mean flexible business rules.

Critical protections include:

```text
Mongoose validation
unique indexes
conditional atomic updates
MongoDB transactions
idempotency keys
persisted expiry timestamps
centralized state transitions
```

Detailed collection/index design lives in `DATABASE_DESIGN.md`.

---

# 27. Realtime Reliability Principle

Socket.IO is a notification channel, not source of truth.

Correct order:

```text
validate
   ↓
persist MongoDB change
   ↓
commit
   ↓
emit Socket.IO event
```

A reconnecting client can always refetch current state from REST.

---

# 28. Background Expiry Principle

The prototype does not require Redis, BullMQ, pg-boss, RabbitMQ or Kafka.

Deadlines are stored in MongoDB:

```text
offer.expiresAt
price confirmation expiresAt
OTP expiresAt
```

A lightweight periodic job updates expired records.

Critical APIs also check `expiresAt` directly, so a delayed job does not break correctness.

---

# 29. File Storage

Do not store large/sensitive files directly inside MongoDB documents.

Cloudinary stores:

```text
profile photos
college verification images
receipts
```

MongoDB stores file reference metadata.

Identity documents use private/authenticated access rather than permanent public URLs.

---

# 30. Deployment Principle

Prefer one production Node origin:

```text
/              React
/api/*         Express REST
/socket.io/*   Socket.IO
```

This reduces CORS, cookie and deployment mismatch bugs.

MongoDB Atlas, Cloudinary, Google Maps and Razorpay remain managed external services.

Final Node hosting provider can be selected during deployment (for example Render or Railway).

---

# 31. Security Basics

Even for the prototype:

- secrets stay in environment variables,
- passwords use bcrypt,
- JWT uses HttpOnly cookie,
- APIs validate input,
- admin/partner authorization is server-side,
- OTPs are hashed,
- uploads have type/size restrictions,
- sensitive documents are private,
- external callback signatures/IDs are verified,
- critical endpoints are rate-limited where appropriate.

---

# 32. Product Validation Goals

The pilot should answer:

1. Do users repeatedly request food from local/unlisted places?
2. Can RouteBite find a useful partner quickly enough?
3. Will casual/on-route partners accept deliveries?
4. Is dedicated online supply viable?
5. What delivery fee will customers pay?
6. What earning makes the trip worthwhile?
7. What percentage of requests complete successfully?
8. How often do price changes/cancellations/disputes happen?
9. Do customers repeat?

Candidate metrics:

```text
match rate
time to acceptance
pickup ETA
completion rate
cancellation rate
refund/dispute rate
repeat usage
partner acceptance rate
partner earnings per active hour
average on-my-way detour
```

---

# 33. Marketplace Risk

The largest business risk remains **liquidity**.

At order time, sufficient relevant supply must exist.

The dual supply model reduces but does not remove this risk.

Campus-first concentration is intended to validate whether enough recurring density can be created.

---

# 34. Explicitly Deferred

The following do **not** block the prototype:

```text
real marketplace settlement
production payouts
production KYC
government-backed identity verification
advanced fraud detection
automated disputes
complex surge pricing
ML matching
multi-order batching
city-scale optimization
native mobile background GPS
microservices
Redis/message brokers
Kubernetes
```

These become relevant only after product validation or measured technical need.

---

# 35. Remaining Open Decisions

Major product flow, architecture, database and core stack decisions are now largely resolved.

Remaining meaningful items include:

```text
exact REST API contracts
exact error codes
partner reliability formula
rating aggregation details
final admin permission matrix
development OTP provider details
final deployment hosting provider
final product/brand name
```

None of these prevent writing `API_DESIGN.md`.

---

# 36. Documentation Map

Use documents for these responsibilities:

```text
PROJECT_CONTEXT.md      → overall product/source of truth
DECISIONS.md            → ADR/decision log
USER_FLOWS.md           → exact user journeys
PRODUCT_REQUIREMENTS.md → build requirements/acceptance criteria
PAYMENT_FLOW.md         → payment/demo ledger rules
MATCHING_ENGINE.md      → matching algorithm
ARCHITECTURE.md         → system boundaries/reliability
TECH_STACK.md           → technology choices and learning notes
DATABASE_DESIGN.md      → MongoDB collections/indexes/concurrency
API_DESIGN.md           → REST + Socket.IO contracts (next)
```

---

# 37. Current Engineering Principle

> **Build the simplest system that correctly proves the RouteBite product.**

For this prototype, familiarity with MERN is an engineering advantage.

The system should remain understandable enough that a developer can trace a bug from React → Express → service → Mongoose → MongoDB without navigating unnecessary infrastructure.

When a future technology is proposed, the first question should be:

> **What concrete problem does this solve that the current MERN+ architecture cannot solve cleanly?**

If that question has no strong answer, do not add the technology yet.
