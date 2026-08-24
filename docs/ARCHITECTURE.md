# RouteBite — System Architecture

> **Status:** CONFIRMED FOR PROTOTYPE
>
> This document defines the architecture for the first working RouteBite prototype after simplifying the implementation to a **MERN+ architecture**.
>
> The architecture goal remains the same: **correctness, low bug surface, easy debugging and fast iteration before scale.**

---

# 1. Architecture Goal

RouteBite must reliably support:

```text
Customer creates request
        ↓
Pickup + drop + delivery time
        ↓
Backend validates request
        ↓
Razorpay test payment confirmed
        ↓
Matching begins
        ↓
Eligible partners receive offers
        ↓
Exactly one partner accepts
        ↓
Partner goes to pickup
        ↓
Actual food price confirmed
        ↓
Food picked up
        ↓
Foreground tracking
        ↓
Delivery OTP verified
        ↓
Order completed
        ↓
Demo earning recorded
```

It must also fail safely when:

- payment fails,
- Google Maps fails,
- no partner accepts,
- an offer expires,
- two partners accept simultaneously,
- a partner already has another active order,
- Socket.IO disconnects,
- partner location becomes stale,
- price confirmation expires,
- wrong OTP is entered,
- Razorpay callback is duplicated,
- Node restarts while an offer is waiting.

---

# 2. Main Architecture Decision

RouteBite will use a **single MERN modular monolith**.

```text
ONE React application
        ↓
ONE Node.js + Express.js backend
        ↓
ONE MongoDB Atlas database
```

The Express process also hosts:

```text
REST API
Socket.IO
small periodic background jobs
React production build
```

External capabilities are used only where required:

```text
Google Maps Platform
Razorpay Test Mode
Cloudinary
Optional SMS/OTP provider later
```

No microservices are required for the prototype.

---

# 3. High-Level Architecture

```text
┌─────────────────────────────────────────────┐
│                 Browser                     │
│                                             │
│            React + React Router             │
│                                             │
│     Customer / Partner / Admin UI           │
└───────────────────┬─────────────────────────┘
                    │
              REST  │  Socket.IO
                    │
                    ▼
┌─────────────────────────────────────────────┐
│          Node.js + Express.js Server         │
│                                             │
│  Routes → Middleware → Controllers          │
│                       ↓                     │
│                    Services                 │
│                       ↓                     │
│                 Mongoose Models             │
│                                             │
│  Socket.IO                                  │
│  Matching services                          │
│  Payment services                           │
│  Background expiry scans                    │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│              MongoDB Atlas                  │
│                                             │
│       Authoritative business state          │
└─────────────────────────────────────────────┘

External:
Google Maps | Razorpay | Cloudinary
```

---

# 4. Why One Backend Process

Splitting the prototype into multiple services would create more possible failures:

```text
service-to-service network failures
multiple deployments
cross-service transactions
event synchronization
duplicate configuration
harder local debugging
```

One Express backend allows a developer to trace a request from HTTP input to MongoDB in one codebase.

For prototype traffic, one Node process is sufficient.

The architecture can later be split if real scale proves a need.

---

# 5. Production Deployment Shape

The preferred prototype deployment is one origin.

```text
https://routebite.example.com

/                 → React build
/api/*            → Express REST API
/socket.io/*      → Socket.IO
```

Benefits:

- simpler HttpOnly cookies,
- fewer CORS mistakes,
- fewer Socket.IO connection issues,
- one deployment to debug,
- frontend/backend versions stay aligned.

MongoDB Atlas and Cloudinary remain managed external services.

---

# 6. Local Development Shape

Local development may use two processes:

```text
Vite   → localhost:5173
Express → localhost:5000
```

Vite should proxy API/socket requests to Express.

This keeps development fast while preserving a production architecture with one logical backend.

---

# 7. Backend Layering

Raw Express must still be structured.

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
Mongoose / MongoDB
```

## Routes

Define endpoint method/path only.

## Middleware

Handles cross-cutting concerns:

- authentication,
- authorization,
- request validation,
- rate limiting,
- request ID,
- upload parsing.

## Controllers

Translate HTTP input/output.

Controllers should not contain large business workflows.

## Services

Business rules live here.

Examples:

```text
OrderService
MatchingService
PartnerService
PaymentService
TripService
DeliveryService
AdminService
```

## Models

Mongoose models define persistent data and database indexes.

---

# 8. Recommended Backend Modules

Even though Express does not enforce modules, organize code by domain.

```text
auth
users
partners
trips
orders
matching
offers
payments
uploads
realtime
admin
```

Do not make one giant `orderController.js` responsible for the entire system.

---

# 9. Source of Truth

MongoDB is authoritative for business state.

Examples:

```text
order status
assigned partner
payment status
partner active order
offer status
offer expiry
price confirmation expiry
delivery OTP state
```

React state and Socket.IO events are not authoritative.

Core rule:

> **Persist truth first, notify clients second.**

---

# 10. Command Flow

Any operation that changes business state should use REST.

Example partner acceptance:

```text
Partner React UI
       ↓
POST /api/offers/:offerId/accept
       ↓
Express authentication
       ↓
request validation
       ↓
Matching/Assignment service
       ↓
MongoDB transaction
       ↓
commit succeeds
       ↓
HTTP response
       ↓
Socket.IO notifications
```

This keeps commands explicit and testable.

---

# 11. Read Flow

Authoritative reads use REST.

Example:

```text
GET /api/orders/:orderId
```

The response should contain the current persisted order representation the caller is allowed to see.

If the frontend suspects it missed a socket event, it refetches this endpoint.

---

# 12. Socket.IO Architecture

Socket.IO is used for fast realtime UX, not business truth.

Recommended rooms:

```text
user:{userId}
order:{orderId}
partner:{partnerId}
```

Possible events:

```text
NEW_DELIVERY_OFFER
OFFER_EXPIRED
PARTNER_ASSIGNED
ORDER_STATUS_UPDATED
PRICE_CONFIRMATION_REQUIRED
PRICE_APPROVED
PARTNER_LOCATION_UPDATED
ORDER_CANCELLED
```

The server should authenticate the socket connection.

A user must not be allowed to join arbitrary order rooms.

---

# 13. Lost Socket Events

Sockets disconnect in real systems.

RouteBite should expect this.

When a client reconnects:

```text
socket reconnects
       ↓
client refetches current active order / offers
       ↓
UI rebuilds from MongoDB truth
```

Never design a workflow where receiving one particular socket event is the only way to know the correct state.

---

# 14. Atomic Assignment

One of the highest-risk bugs is double assignment.

Wrong approach:

```text
read order
if no partner assigned
write partner
```

Two concurrent requests may both pass the check.

Correct approach uses a MongoDB transaction with conditional writes.

Conceptually:

```text
Transaction starts

1. Update partner only if:
   activeOrderId == null
   verification == APPROVED

2. Update order only if:
   status == MATCHING
   assignedPartnerId == null

3. Mark accepted offer

4. Expire/cancel competing pending offers

Commit
```

If any conditional update fails, abort the transaction.

Result:

- one order has one active partner,
- one partner has at most one active order in the prototype.

---

# 15. MongoDB Transactions

Use a transaction only when multiple documents must change as one business operation.

Good transaction candidates:

```text
partner acceptance
order cancellation + partner release
order completion + earning creation
partner cancellation + rematch state
```

Do not wrap every simple read/write in a transaction.

MongoDB Atlas supports the replica-set requirement for transactions.

---

# 16. Conditional Atomic Updates

For single-document state changes, prefer atomic conditional queries.

Example concept:

```text
update order
WHERE
  _id = orderId
  status = OUT_FOR_DELIVERY
  deliveryOtpVerified = true
SET
  status = DELIVERED
```

If the condition no longer matches, the operation fails cleanly instead of overwriting a newer state.

---

# 17. State Machine Architecture

All order transitions must pass through centralized service logic.

Do not allow controllers to set arbitrary statuses.

Example:

```text
transitionOrder(order, PICKED_UP)
```

The transition service checks:

- current status,
- caller role,
- required conditions,
- payment state,
- assignment state,
- price confirmation state.

This is more important than which framework is used.

---

# 18. Offer Expiry Architecture

Offer expiry should use persisted timestamps.

Offer document contains:

```text
status = PENDING
expiresAt = timestamp
```

A small background scan can mark expired offers.

But acceptance itself must require:

```text
status == PENDING
expiresAt > now
```

Therefore a delayed background scan cannot allow an expired offer to be accepted.

This removes the need for Redis/job queues during the prototype.

---

# 19. Background Jobs

The same Express process may run lightweight periodic jobs.

Examples:

```text
expire delivery offers
expire price confirmations
clean stale partner availability
reconcile obvious unfinished demo states
```

Job properties:

- idempotent,
- based on MongoDB state,
- safe to rerun,
- no critical data only in process memory.

If the server restarts, the next scan catches missed deadlines.

---

# 20. Matching Architecture

Matching follows the existing rule:

```text
Filter first
   ↓
Rank second
   ↓
Dispatch third
```

Implementation pipeline:

```text
Order becomes MATCHING
        ↓
MongoDB coarse candidate discovery
        ↓
Google Maps calculations for shortlist
        ↓
hard eligibility
        ↓
rank candidates
        ↓
create Offer documents
        ↓
emit NEW_DELIVERY_OFFER
```

MongoDB should perform cheap discovery.

Google Maps performs expensive road travel calculations only for a small set.

---

# 21. Available-Now Discovery

Partner current location is stored as GeoJSON with a MongoDB `2dsphere` index.

Candidate discovery can use `$near` / `$geoNear` to find approved `AVAILABLE_NOW` partners near pickup.

This is only a coarse shortlist.

Final eligibility still uses road ETA and customer time window.

---

# 22. Scheduled/Active Trip Discovery

Trip documents store:

```text
origin
destination
scheduled departure
departure flexibility
route polyline/route metadata
trip status
```

For the small prototype, scheduled trip discovery can first filter by:

- trip status,
- departure window,
- rough geographic relevance.

Then application logic + Google Maps checks route direction, pickup/drop sequence and detour.

There is no need for an advanced geospatial routing database in V1.

---

# 23. Payment Architecture

Razorpay is accessed only through the backend for authoritative payment operations.

Flow:

```text
React asks Express to create test checkout
        ↓
Express creates Razorpay test order
        ↓
React opens Razorpay checkout
        ↓
provider returns payment information
        ↓
React sends result to Express
        ↓
Express verifies signature/state
        ↓
MongoDB payment confirmed
        ↓
Order can enter MATCHING
```

Webhook callbacks must also be supported/idempotent where used.

Never trust a frontend payment-success flag by itself.

---

# 24. Duplicate Payment/Webhook Protection

Store external provider identifiers with unique indexes.

Webhook processing pattern:

```text
receive provider event
       ↓
insert eventId with unique index
       ↓
if duplicate → return success/no-op
       ↓
process state transition idempotently
```

This prevents repeated provider callbacks from repeating ledger changes.

---

# 25. Demo Ledger Architecture

The demo ledger is internal application data.

It must be independent from the Razorpay provider object.

Example entries:

```text
CUSTOMER_TEST_PAYMENT
FOOD_PRICE_ADJUSTMENT
FOOD_REIMBURSEMENT
PARTNER_EARNING
PLATFORM_FEE
PLATFORM_SUBSIDY
```

Every financial effect should have an idempotency key so the same business event cannot create the same earning twice.

---

# 26. Authentication Architecture

Use JWT stored in an HttpOnly cookie.

Request flow:

```text
browser cookie
      ↓
auth middleware
      ↓
JWT verification
      ↓
user loaded/validated
      ↓
role/capability authorization
```

Important distinction:

```text
Authenticated user
≠
Approved partner
≠
Admin
```

Every privileged endpoint must verify the required capability.

---

# 27. Partner Verification Files

Cloudinary stores uploaded files.

MongoDB stores metadata/references.

Sensitive college ID documents must not be public assets.

Admin access flow:

```text
Admin authenticated
      ↓
backend verifies admin role
      ↓
backend generates/returns authorized access
```

Do not expose identity files through predictable public URLs.

---

# 28. Location Architecture

Three location concepts should remain separate:

```text
Saved order pickup/drop
Partner operational current location
Active delivery live location
```

Order pickup/drop are durable.

Partner current location is operational and overwritten as newer updates arrive.

Full GPS history is not required for the prototype.

---

# 29. Location Freshness

A partner's last location update includes:

```text
currentLocation
locationUpdatedAt
```

Matching rejects stale locations according to configured rules.

Socket/location update arrival alone does not make a partner eligible.

Eligibility service checks freshness.

---

# 30. Google Maps Failure Handling

External routing can fail or time out.

The matching service should distinguish:

```text
NO_CANDIDATES
MAPS_TEMPORARILY_FAILED
INVALID_ROUTE
```

Do not convert every Maps error into `No partner available`.

For a demo, the UI should provide a retryable failure rather than an indefinite loader.

---

# 31. API Error Architecture

Use one Express error middleware.

Recommended response shape:

```json
{
  "success": false,
  "error": {
    "code": "ORDER_ALREADY_ASSIGNED",
    "message": "This order has already been assigned."
  }
}
```

Business error codes are more stable than parsing human-readable messages.

---

# 32. Idempotency

Retrying a request after network failure must not create duplicate business effects.

Idempotency is especially important for:

```text
payment confirmation
webhooks
order completion
partner earning creation
manual admin financial actions
```

Where necessary, APIs accept/store an idempotency key or use a naturally unique external/business event identifier.

---

# 33. Money and Time

Money:

```text
integer paise
```

Time:

```text
MongoDB Date / UTC timestamps
```

Never use floating-point rupees as authoritative financial values.

Never use ambiguous display strings as authoritative schedule times.

---

# 34. Security Boundaries

Backend must validate:

- authentication,
- authorization,
- input shape,
- state transition,
- ownership,
- file restrictions,
- provider callbacks.

Frontend validation is never considered a security boundary.

Use:

```text
helmet
rate limiting for sensitive endpoints
upload size/type limits
HttpOnly auth cookie
bcrypt password hashing
hashed OTPs
restricted external API keys
```

---

# 35. Configuration

Prototype hypotheses belong in one configuration module/environment layer.

Examples:

```text
MAX_ASAP_DELIVERY_MINUTES
MAX_ROUTE_DETOUR_MINUTES
MAX_ROUTE_DETOUR_KM
OFFER_BATCH_SIZE
OFFER_TIMEOUT_SECONDS
DEFAULT_DEPARTURE_FLEX_MINUTES
DEFAULT_VENDOR_WAIT_MINUTES
DEFAULT_PARTNER_EARNING_PAISE
DEFAULT_PLATFORM_FEE_PAISE
MAX_LOCATION_AGE_SECONDS
```

Do not scatter these constants across controllers/components.

---

# 36. Testing Architecture

Prioritize tests around business invariants, not only route coverage.

Critical tests:

```text
concurrent acceptance → one winner
partner already busy → second acceptance rejected
expired offer → acceptance rejected
duplicate webhook → one financial effect
wrong OTP → no completion
invalid state transition → rejected
unapproved partner → no offers
cancellation during assignment race → one valid final state
```

Use Jest + Supertest for backend API/service tests.

---

# 37. Observability

The prototype needs enough logs to debug failures.

Important events:

```text
ORDER_CREATED
PAYMENT_CONFIRMED
MATCHING_STARTED
OFFER_CREATED
OFFER_ACCEPTED
ASSIGNMENT_FAILED
PRICE_CONFIRMATION_REQUESTED
PICKED_UP
OTP_VERIFIED
ORDER_COMPLETED
ORDER_CANCELLED
```

Include IDs but never sensitive data.

---

# 38. Explicit Non-Goals

The first prototype does not require:

```text
microservices
Redis
message broker
Kafka
RabbitMQ
Kubernetes
multiple databases
Elasticsearch
CQRS infrastructure
event sourcing
ML matching
production payment settlement
native background GPS
```

---

# 39. Extraction Path Later

A modular monolith does not mean RouteBite is permanently locked into one service.

If scale later proves a need, modules can be extracted in roughly this order:

```text
realtime/location
matching/dispatch
payments/ledger
notifications
```

Extraction should happen because of measured load/team/reliability problems—not because microservices look more advanced.

---

# 40. Final Reliability Principles

The architecture should obey these rules throughout implementation:

1. **MongoDB owns business truth.**
2. **REST performs business commands.**
3. **Socket.IO notifies; it does not decide.**
4. **Critical writes are conditional/atomic.**
5. **Multi-document invariants use transactions.**
6. **External callbacks are idempotent.**
7. **Critical deadlines are persisted.**
8. **A server restart must not corrupt an order.**
9. **Controllers stay thin; services own business rules.**
10. **The simplest correct implementation wins.**

This architecture keeps RouteBite understandable to a MERN developer while preserving the protections required for the project's most dangerous race conditions and state-management bugs.