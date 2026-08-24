# RouteBite — Implementation Plan

> **Status:** CONFIRMED FOR PROTOTYPE
>
> This document defines the build order for the first working RouteBite prototype. It assumes the product behavior and technical contracts already documented in `PRODUCT_REQUIREMENTS.md`, `PAYMENT_FLOW.md`, `MATCHING_ENGINE.md`, `ARCHITECTURE.md`, `TECH_STACK.md`, `DATABASE_DESIGN.md`, and `API_DESIGN.md`.
>
> The goal is to build a working end-to-end prototype with the **smallest possible bug surface**. The project should become usable early and stay usable after every phase.

---

# 1. Implementation Principle

The implementation rule is:

> **Build one complete vertical slice at a time instead of building many disconnected modules in parallel.**

A feature is not considered complete because the UI exists or because an API endpoint exists. It is complete only when:

```text
Frontend
  +
Express API
  +
MongoDB persistence
  +
Authorization
  +
Validation
  +
Error handling
  +
Tests
```

work together.

Avoid this pattern:

```text
Week 1: all frontend
Week 2: all backend
Week 3: connect everything
```

That approach hides integration bugs until late.

Prefer:

```text
Auth end-to-end
Partner verification end-to-end
Order creation end-to-end
Payment end-to-end
Matching end-to-end
Delivery end-to-end
```

---

# 2. Final Prototype Milestone

The prototype is ready when this complete path works without manually changing MongoDB records:

```text
Admin ready
   ↓
Customer registers
   ↓
Partner registers
   ↓
Partner applies
   ↓
Admin approves partner
   ↓
Partner becomes AVAILABLE_NOW
   ↓
Customer creates food request
   ↓
Customer selects pickup/drop
   ↓
Customer completes Razorpay test payment
   ↓
Matching starts
   ↓
Partner receives offer
   ↓
Partner accepts
   ↓
Partner reaches pickup
   ↓
Actual food amount entered
   ↓
Customer approves increase if needed
   ↓
Partner marks PICKED_UP
   ↓
Customer sees live partner location
   ↓
Delivery OTP verified
   ↓
Order COMPLETED
   ↓
Demo earning recorded
```

At least one failure scenario must also work cleanly:

```text
No partner accepts
or
Wrong OTP
or
Duplicate accept race
```

---

# 3. Repository Structure

Recommended structure:

```text
routebite/
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── socket/
│   │   ├── utils/
│   │   └── main.jsx
│   ├── public/
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── constants/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── socket/
│   │   ├── jobs/
│   │   ├── utils/
│   │   └── app.js
│   ├── tests/
│   ├── server.js
│   └── package.json
│
├── docs/
├── .env.example
├── .gitignore
└── README.md
```

Do not create deeply nested architecture without need.

---

# 4. Backend Layer Rule

Express code should follow:

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

Responsibilities:

## Route

Only path + middleware + controller binding.

## Middleware

Authentication, authorization, validation, upload handling, rate limiting.

## Controller

Read request, call service, send response.

Controllers should remain thin.

## Service

Business rules live here.

Examples:

```text
Can this order transition?
Can this partner accept?
Should matching restart?
Should customer approve price change?
Should demo earning be created?
```

## Model

Schema, indexes, document validation, query helpers where appropriate.

---

# 5. Central Constants First

Before feature work, create central constants for business states.

Examples:

```js
ORDER_STATUS
PAYMENT_STATUS
PARTNER_VERIFICATION_STATUS
PARTNER_AVAILABILITY_STATUS
TRIP_STATUS
OFFER_STATUS
PRICE_ADJUSTMENT_STATUS
```

Do not scatter strings such as:

```js
"MATCHING"
"matching"
"Matching"
```

throughout the codebase.

Also centralize prototype configuration:

```text
MAX_ASAP_DELIVERY_MINUTES = 45
MAX_ROUTE_DETOUR_MINUTES = 10
MAX_ROUTE_DETOUR_KM = 1.5
OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20
DEFAULT_DEPARTURE_FLEX_MINUTES = 15
DEFAULT_PARTNER_EARNING_PAISE = 4000
DEFAULT_PLATFORM_FEE_PAISE = 1000
MAX_LOCATION_AGE_SECONDS = 60
PRICE_CONFIRMATION_TIMEOUT_MINUTES = 3
```

---

# 6. Phase 0 — Project Scaffold

## Goal

Both frontend and backend start locally and connect successfully.

## Backend setup

- initialize Node.js project,
- install Express,
- install Mongoose,
- install cookie parser,
- install JWT library,
- install bcrypt,
- install express-validator,
- install Socket.IO,
- install Multer,
- add centralized error middleware,
- add request logger,
- add environment loader,
- connect MongoDB Atlas.

## Frontend setup

- React + Vite,
- React Router,
- Axios,
- basic Context API structure,
- Socket.IO client,
- base layout,
- error/loading components.

## Health check

Create:

```text
GET /api/v1/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

## Exit criteria

```text
[ ] React runs
[ ] Express runs
[ ] MongoDB connects
[ ] /health works
[ ] frontend can call backend
[ ] Socket.IO connection succeeds
[ ] .env.example exists
[ ] secrets are ignored by Git
```

---

# 7. Phase 1 — Authentication

## Implement

- user model,
- register endpoint,
- login endpoint,
- logout endpoint,
- current-user endpoint,
- password hashing,
- JWT HttpOnly cookie,
- auth middleware,
- admin authorization middleware.

Endpoints:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

## Phone verification

Implement prototype OTP representation separately from login authentication.

For local development, a development OTP may be printed only in server logs when a real SMS provider is absent.

Store only OTP hash + expiry.

## Frontend

- register page,
- login page,
- protected routes,
- current-user context.

## Exit criteria

```text
[ ] register works
[ ] duplicate phone rejected
[ ] password is hashed
[ ] login sets HttpOnly cookie
[ ] protected endpoint rejects anonymous user
[ ] logout works
[ ] admin middleware works
```

---

# 8. Phase 2 — Partner Application and Admin Approval

## Implement

- partner model,
- partner application endpoint,
- Cloudinary upload flow,
- verification status,
- admin verification queue,
- approve/reject actions.

Endpoints conceptually:

```text
POST /api/v1/partners/apply
GET  /api/v1/partners/me
GET  /api/v1/admin/partners/pending
POST /api/v1/admin/partners/:partnerId/approve
POST /api/v1/admin/partners/:partnerId/reject
```

## Rules

- one partner profile per user,
- only approved partners can receive offers,
- public APIs cannot set `APPROVED`,
- uploaded ID documents must not be exposed publicly through normal customer APIs.

## Exit criteria

```text
[ ] user can apply
[ ] duplicate application rejected
[ ] admin sees pending profile
[ ] admin approves
[ ] approved partner gets partner capability
```

---

# 9. Phase 3 — Partner Availability and Trips

## Available Now

Implement:

```text
OFFLINE → AVAILABLE_NOW
AVAILABLE_NOW → OFFLINE
```

Store current location as GeoJSON.

Endpoint examples:

```text
POST /api/v1/partners/me/availability
POST /api/v1/partners/me/location
```

## Scheduled trip

Implement:

```text
create trip
view own trips
start trip
cancel trip
complete trip
```

Store:

```text
origin
 destination
 route reference/polyline
scheduledDepartureAt
departureFlexMinutes
tripStatus
```

## Exit criteria

```text
[ ] unapproved partner cannot go online
[ ] location uses [longitude, latitude]
[ ] scheduled trip is not treated as AVAILABLE_NOW
[ ] partner can start/cancel trip
```

---

# 10. Phase 4 — Order Creation

Implement order draft creation before payment.

Customer enters:

```text
vendor/display name
requested items
pickup
pickup instructions
drop
delivery type
scheduled window if applicable
estimated food cost
```

Use Google Maps on frontend/backend where needed for:

- place search,
- pickup/drop coordinates,
- route preview,
- simple ETA estimate.

Manual pickup pin remains mandatory fallback.

## Important

Do not start matching yet.

Initial order lifecycle:

```text
DRAFT
```

until checkout begins.

## Exit criteria

```text
[ ] customer creates order
[ ] manual pin works
[ ] coordinates stored correctly
[ ] money stored as integer paise
[ ] invalid scheduled time rejected
[ ] customer cannot edit another user's order
```

---

# 11. Phase 5 — Razorpay Test Payment

Implement:

```text
create Razorpay test order/payment attempt
customer completes test checkout
backend verifies payment result
payment state persists
matching starts only after confirmed payment
```

Never trust frontend payment success alone.

Persist provider IDs and idempotency references.

Protect webhook/event processing against duplicates.

Order/payment concepts stay separate.

## Exit criteria

```text
[ ] unpaid order cannot match
[ ] successful test payment is backend-confirmed
[ ] duplicate callback does not duplicate state transition
[ ] failed payment is retryable
[ ] payment attempt belongs to correct customer/order
```

---

# 12. Phase 6 — Matching Engine V1

Implement matching in this order:

```text
1. validate order matchability
2. discover coarse candidates
3. hard-filter candidates
4. request Google route/ETA for shortlist
5. rank
6. create offer batch
7. emit Socket.IO offers
```

## Candidate discovery

Use MongoDB geospatial shortlist for `AVAILABLE_NOW` partners.

For scheduled/on-my-way trips, start with a simple route/time-compatible shortlist based on stored trip information.

Do not over-optimize route geometry in the first coding pass.

## Hard filters

Must include:

```text
partner approved
partner operationally available
location fresh
order not already assigned
customer delivery window feasible
route/direction feasible where applicable
partner not handling incompatible active order
```

## Exit criteria

```text
[ ] matching begins automatically after payment
[ ] unapproved/offline partner excluded
[ ] stale location excluded
[ ] partner already handling active order excluded
[ ] no candidates becomes explicit MATCHING_FAILED
```

---

# 13. Phase 7 — Offer Dispatch and Atomic Acceptance

This is one of the most critical phases.

Implement offer document with:

```text
orderId
partnerId
round
status
expiresAt
createdAt
respondedAt
```

Statuses:

```text
PENDING
ACCEPTED
REJECTED
EXPIRED
CANCELLED
```

## Accept flow

Acceptance must never be:

```text
read order
if free
save assignment later
```

Use atomic conditional update and/or MongoDB transaction.

Exactly one partner wins.

## Test concurrency manually and automatically

Send two accept requests almost simultaneously.

Expected:

```text
one 200 success
one 409 already assigned/offer no longer valid
```

## Exit criteria

```text
[ ] offer arrives over Socket.IO
[ ] partner can reject
[ ] expired offer cannot be accepted
[ ] exactly one partner can accept
[ ] customer receives assignment event
[ ] losing partners receive invalidation/expiry event
```

---

# 14. Phase 8 — Pickup and Price Confirmation

After assignment:

```text
ASSIGNED
  ↓
PARTNER_TO_PICKUP
```

Partner can enter actual food amount and upload receipt/proof.

Rules:

```text
actual == estimate → continue
actual < estimate  → auto-adjust demo amount downward
actual > estimate  → customer approval required
```

When increase is required:

```text
PRICE_CONFIRMATION_REQUIRED
```

Customer can approve.

If customer rejects/times out before purchase, order can move toward cancellation/admin flow.

## Exit criteria

```text
[ ] partner cannot change another order
[ ] increase requires customer approval
[ ] decrease auto-adjusts demo ledger
[ ] price approval has durable expiresAt
[ ] picked-up state blocked until price issue resolved
```

---

# 15. Phase 9 — Active Delivery and Live Location

Implement foreground tracking only.

Partner sends location roughly every 10–15 seconds while active.

REST updates authoritative current location.

Socket.IO broadcasts lightweight location events to the customer room.

Do not call Google Routes API on every GPS tick.

## Exit criteria

```text
[ ] tracking starts only for active delivery
[ ] customer sees partner movement
[ ] socket loss does not lose order truth
[ ] refreshing page reloads correct order from REST
[ ] tracking stops after terminal state
```

---

# 16. Phase 10 — Delivery OTP and Completion

Create delivery OTP when appropriate.

Store only hash.

Verify using backend.

Correct OTP allows:

```text
OUT_FOR_DELIVERY
  ↓
DELIVERY_OTP_REQUIRED
  ↓
DELIVERED
  ↓
COMPLETED
```

Completion transaction/service should ensure:

```text
order completed once
partner active-order link cleared
partner earning created once
tracking no longer active
```

## Exit criteria

```text
[ ] wrong OTP rejected
[ ] expired OTP rejected
[ ] correct OTP completes once
[ ] OTP cannot be reused
[ ] duplicate completion does not duplicate earning
```

---

# 17. Phase 11 — Demo Ledger and Earnings

Implement internal accounting representation.

Track:

```text
customer test payment
food reimbursement
partner base earning
partner incentive
platform fee
platform subsidy
refund/adjustment representation
```

Use integer paise.

One earning per completed order.

Customer/payment/provider money movement is not production settlement.

## Exit criteria

```text
[ ] completed order shows demo financial breakdown
[ ] duplicate completion does not duplicate earning
[ ] incentive subsidy visible separately
[ ] matching failure demo-refund state visible
```

---

# 18. Phase 12 — Cancellation and Failure Recovery

Implement explicit recovery cases.

Required:

```text
customer cancels before purchase
partner cancels before purchase → rematch
no partner accepts → matching failure
partner fails after purchase → admin review
price approval timeout
wrong/expired OTP
maps failure
payment failure
```

No indefinite loaders.

Every asynchronous process must end in either:

```text
success
retryable state
explicit failure
admin review
```

---

# 19. Phase 13 — Admin Operations

Admin must be able to inspect prototype problems without database editing.

Views/actions:

```text
pending partners
approve/reject partner
orders list
order timeline
payment demo state
receipt/proof
failed orders
admin review cases
manual issue resolution where appropriate
```

Admin actions must still call service-layer rules.

Admin is not allowed to mutate arbitrary database fields directly from the UI.

---

# 20. Phase 14 — Ratings

After completion:

```text
customer → partner rating 1–5
optional text feedback
```

Prevent duplicate rating for same order/customer.

Rating does not need sophisticated weighting initially.

---

# 21. Phase 15 — Full Rehearsal and Hardening

Run the exact demo scenario repeatedly.

Test at minimum:

```text
happy path with AVAILABLE_NOW partner
happy path with scheduled/on-my-way partner
no partner
partner reject
partner accept race
customer cancel before purchase
price increase approval
price decrease
wrong OTP
duplicate Razorpay callback
browser refresh during active delivery
Socket.IO disconnect/reconnect
server restart while offer is pending
```

Fix any case that requires manual MongoDB editing.

---

# 22. Build Priority

Use this priority order:

```text
P0 correctness
  ↓
P0 complete flow
  ↓
error handling
  ↓
tests
  ↓
admin/debuggability
  ↓
P1 UX
  ↓
visual polish
```

Do not spend several days polishing animations while order acceptance or payment idempotency is incomplete.

---

# 23. Commit Strategy

Prefer small commits that keep the project runnable.

Examples:

```text
feat(auth): add JWT cookie login
feat(partners): add partner application flow
feat(orders): add order draft creation
feat(payments): verify Razorpay test payment
feat(matching): add available-now candidate discovery
fix(offers): make order acceptance atomic
```

Avoid one enormous commit containing the entire prototype.

---

# 24. Definition of Done for a Feature

Before marking a feature complete:

```text
[ ] request validated
[ ] auth/authorization checked
[ ] service rule implemented
[ ] database state persisted correctly
[ ] invalid state transition rejected
[ ] duplicate/retry behavior considered
[ ] useful error returned
[ ] frontend handles success
[ ] frontend handles failure
[ ] critical test exists
[ ] no secret committed
```

---

# 25. What Not to Build Yet

Do not block implementation on:

```text
native mobile apps
Redis
Kafka/RabbitMQ
microservices
ML matching
surge-pricing engine
advanced fraud ML
full chat platform
vendor merchant portal
real partner payouts
production KYC
background GPS tracking
multi-order batching
multi-city support
```

---

# 26. Recommended First Coding Session

The first implementation session should produce only:

```text
client React/Vite project
server Express project
MongoDB connection
health endpoint
base error middleware
auth model skeleton
central constants
environment configuration
```

Do not begin matching logic before the project foundation and authentication are working.

---

# 27. Implementation Completion Rule

Once Phases 0–15 are complete and the acceptance scenarios pass, stop adding architecture and prototype features.

At that point the next activity is:

> **Pilot usage, feedback collection, bug fixing and validation of the product hypotheses.**
