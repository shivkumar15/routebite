# RouteBite — System Architecture

> **Status:** Prototype architecture specification
>
> This document defines the architecture for the first working RouteBite prototype. It is derived from `PROJECT_CONTEXT.md`, `DECISIONS.md`, `USER_FLOWS.md`, `PRODUCT_REQUIREMENTS.md`, `PAYMENT_FLOW.md`, and `MATCHING_ENGINE.md`.
>
> The primary architecture goal is **correctness and debuggability before scale**. The prototype should contain as few moving parts as possible while still supporting the full customer → matching → pickup → delivery → completion flow.

---

# 1. Architecture Goal

RouteBite must support this end-to-end flow reliably:

```text
Customer creates request
        ↓
Pickup + drop + time selected
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
Partner travels to pickup
        ↓
Actual price confirmed
        ↓
Food picked up
        ↓
Foreground delivery tracking
        ↓
Delivery OTP verified
        ↓
Order completed
        ↓
Demo earning/ledger recorded
```

The architecture must also fail safely when:

- payment fails,
- maps/routing fails,
- no partner exists,
- an offer expires,
- two partners accept simultaneously,
- a partner disconnects,
- a WebSocket disconnects,
- location becomes stale,
- price approval times out,
- the wrong OTP is entered,
- a server/worker restarts,
- an external callback is delivered twice.

---

# 2. Primary Architecture Principle

> **Use the smallest architecture that can enforce the business rules correctly.**

For the prototype RouteBite will use a **modular monolith**, not microservices.

The system should initially contain:

```text
ONE role-aware Web Application

ONE Backend Codebase
 ├── HTTP API process
 └── Background Worker process

ONE Authoritative Relational Database

ONE Private Object/File Storage

External Providers
 ├── Google Maps Platform
 ├── Razorpay Test Mode
 └── OTP/SMS provider or development OTP adapter
```

The API and worker use the **same domain/application code** and the **same database**.

They are separate runtime processes only because long-running tasks such as offer expiry must not block HTTP requests.

For local development, they may be started together if that makes development easier.

---

# 3. What We Deliberately Do NOT Use

The prototype should not introduce infrastructure unless a measured requirement demands it.

Do **not** add initially:

```text
Microservices
Kafka
RabbitMQ
Distributed event buses
Multiple databases
Elasticsearch
Kubernetes
Service mesh
Distributed caches as a correctness dependency
Complex CQRS
Event sourcing
ML matching services
Separate payment microservice
Separate matching microservice
```

These systems can solve real scale problems later, but they increase deployment, consistency, debugging, and failure complexity today.

---

# 4. High-Level Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                  ROUTEBITE WEB APPLICATION               │
│                                                          │
│ Customer UI │ Partner UI │ Admin UI                      │
└───────────────┬───────────────────────┬──────────────────┘
                │ HTTPS REST            │ WebSocket
                │ commands/queries      │ event hints
                ▼                       ▼
┌──────────────────────────────────────────────────────────┐
│              MODULAR MONOLITH BACKEND                   │
│                                                          │
│  API / Application Layer                                 │
│                                                          │
│  ┌───────────────┐  ┌────────────────┐                  │
│  │ Auth & Users  │  │ Partner        │                  │
│  └───────────────┘  └────────────────┘                  │
│                                                          │
│  ┌───────────────┐  ┌────────────────┐                  │
│  │ Orders        │  │ Trips &        │                  │
│  │               │  │ Availability   │                  │
│  └───────────────┘  └────────────────┘                  │
│                                                          │
│  ┌───────────────┐  ┌────────────────┐                  │
│  │ Matching &    │  │ Payments &     │                  │
│  │ Dispatch      │  │ Demo Ledger    │                  │
│  └───────────────┘  └────────────────┘                  │
│                                                          │
│  ┌───────────────┐  ┌────────────────┐                  │
│  │ Tracking      │  │ Notifications  │                  │
│  └───────────────┘  └────────────────┘                  │
│                                                          │
│  ┌───────────────┐  ┌────────────────┐                  │
│  │ Files         │  │ Admin / Audit  │                  │
│  └───────────────┘  └────────────────┘                  │
└──────────────┬──────────────────────────────┬────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐      ┌─────────────────────────┐
│ Authoritative Relational │      │ Background Worker       │
│ Database                 │◄────►│ same code/domain rules  │
└──────────────────────────┘      └─────────────────────────┘
               │
               ▼
┌──────────────────────────┐
│ Private Object Storage   │
│ IDs / photos / receipts  │
└──────────────────────────┘

External adapters:
Google Maps │ Razorpay │ OTP/SMS
```

---

# 5. One Role-Aware Web Application

The prototype uses **one web application**.

A user has one account and may additionally acquire partner capability.

Conceptually:

```text
USER
 ├── Customer capability
 ├── Optional approved Partner Profile
 └── Optional Admin role
```

The frontend may expose areas such as:

```text
/order
/orders
/partner
/partner/trips
/partner/offers
/admin
/profile
```

## Important Security Rule

Frontend route hiding is **not authorization**.

Even if `/admin` is hidden from normal users, every admin API endpoint must independently verify the admin role on the backend.

Similarly, partner actions must verify that the partner profile is `APPROVED` on the backend.

---

# 6. Frontend Responsibility Boundary

The frontend is responsible for:

- rendering UI,
- collecting user input,
- requesting browser location permission,
- showing maps,
- submitting commands,
- displaying server state,
- receiving real-time event hints,
- reconnecting/refetching after network failures.

The frontend is **not allowed to decide authoritative business state**.

The frontend must not be trusted to decide:

```text
payment succeeded
partner is verified
order can change state
partner won an assignment
price adjustment is accepted
OTP is valid
partner earning is final
```

Those decisions belong to the backend.

---

# 7. API Style: REST for Commands and Queries

Use normal HTTPS request/response APIs for authoritative actions.

Examples:

```text
POST /orders
POST /orders/{id}/payment-attempt
POST /offers/{id}/accept
POST /orders/{id}/actual-price
POST /orders/{id}/approve-price
POST /orders/{id}/pickup
POST /orders/{id}/location
POST /orders/{id}/verify-delivery-otp
POST /orders/{id}/cancel
```

Exact routes belong in `API_DESIGN.md`.

## Why REST owns commands

Critical commands should not depend on a persistent socket connection.

If a WebSocket reconnects or drops, the user must still be able to perform authoritative operations through normal HTTP requests.

---

# 8. WebSocket Responsibility

WebSockets are used for **real-time event notification**, not as the database/source of truth.

Examples:

```text
ORDER_STATUS_CHANGED
NEW_DELIVERY_OFFER
OFFER_EXPIRED
ORDER_ASSIGNED
PRICE_CONFIRMATION_REQUIRED
PRICE_APPROVED
PARTNER_LOCATION_UPDATED
ORDER_COMPLETED
```

Recommended event payload shape:

```text
{
  eventType,
  entityType,
  entityId,
  entityVersion,
  occurredAt
}
```

The event should generally tell the client:

> "Something changed. Fetch the latest authoritative entity state."

rather than trying to reproduce the full database state inside the event.

## Reconnection Rule

When WebSocket connectivity is restored:

```text
reconnect
   ↓
GET active order / active offers
   ↓
render canonical server state
```

This prevents missed WebSocket events from permanently corrupting the UI.

## Fallback

For critical screens, short REST polling may be used as a fallback while disconnected.

---

# 9. Backend Layering

Every backend module should follow a predictable structure.

```text
Controller / Transport
        ↓
Application / Use Case
        ↓
Domain Rules
        ↓
Repository / External Adapter
```

Example:

```text
AcceptOfferController
       ↓
AcceptOfferUseCase
       ↓
OrderAssignmentDomainRules
       ↓
Database Transaction
```

Controllers must remain thin.

Avoid placing business rules directly in HTTP route handlers.

---

# 10. Backend Modules

The modular monolith should contain clear ownership boundaries.

## 10.1 Identity and Access

Owns:

- user account,
- authentication/session,
- phone verification,
- roles/permissions,
- OTP request/verification controls.

Must not own order/matching business logic.

---

## 10.2 Partner Module

Owns:

- partner profile,
- verification status,
- profile/college identity metadata,
- availability status,
- basic partner reputation data.

Only `APPROVED` partners may enter delivery modes.

---

## 10.3 Trips and Availability Module

Owns:

```text
OFFLINE
AVAILABLE_NOW
TRIP_SCHEDULED
TRIP_ACTIVE
TRIP_COMPLETED
TRIP_CANCELLED
```

Owns:

- planned origin/destination,
- scheduled departure,
- departure flexibility,
- current trip status,
- latest usable partner location,
- active trip route reference/progress.

A scheduled future trip must never be represented as `AVAILABLE_NOW`.

---

## 10.4 Orders Module

Orders is the central transaction/domain module.

Owns:

- requested items,
- vendor/pickup information,
- pickup/drop coordinates,
- delivery window,
- customer,
- assigned partner,
- core order lifecycle,
- cancellation rules,
- order timeline.

No other module should arbitrarily modify order status.

---

## 10.5 Matching and Dispatch Module

Owns:

- match preconditions,
- candidate discovery,
- hard eligibility,
- Maps route/ETA evaluation,
- deterministic candidate ranking,
- offer creation,
- dispatch rounds,
- offer expiry,
- rematching,
- matching failure.

Detailed algorithm rules remain in `MATCHING_ENGINE.md`.

---

## 10.6 Payments and Demo Ledger Module

Owns:

- Razorpay test-order creation,
- provider references,
- provider verification/callback handling,
- payment state,
- price adjustment state,
- demo refund state,
- partner demo earning,
- internal ledger entries.

Payment state and order state are related but must remain separate concepts.

---

## 10.7 Tracking Module

Owns:

- accepted foreground location updates,
- latest location per partner/order,
- stale-location detection,
- customer tracking feed.

It does not need to permanently retain every 10-second GPS sample.

---

## 10.8 Notifications / Realtime Module

Owns:

- WebSocket subscriptions,
- in-app event delivery,
- user/channel targeting,
- fallback event notification hooks.

It must never be the source of truth for order state.

---

## 10.9 Files Module

Owns private file metadata and access rules for:

- partner profile photos,
- college identity documents,
- purchase receipts/proofs.

File bytes should live in private object storage rather than relational database blobs.

---

## 10.10 Admin Module

Owns admin-facing use cases such as:

- approve/reject partner,
- inspect order timeline,
- view payment/demo ledger state,
- review receipts,
- mark an exceptional case resolved,
- perform allowed manual interventions.

Every admin mutation must be recorded in an audit log.

---

# 11. Single Authoritative Relational Database

Use **one relational database as the authoritative source of truth** for the prototype.

The exact product will be selected/finalized in the technology/database design stage, but the architecture assumes support for:

- ACID transactions,
- foreign keys,
- unique constraints,
- check constraints,
- indexes,
- timestamp comparisons,
- safe row/concurrency locking,
- useful geospatial querying or extensions.

A PostgreSQL-class relational database is a strong fit, but the final technology selection is documented separately.

## Why one database

It prevents distributed transaction problems such as:

```text
Order says ASSIGNED
but matching database says unassigned
```

or:

```text
Payment database succeeds
but order database update fails
```

For this prototype, correctness is more valuable than independent service scaling.

---

# 12. Database Is the Source of Truth

Critical state must survive:

- API restart,
- worker restart,
- browser refresh,
- WebSocket disconnect.

Never keep essential order state only in server memory.

Do not implement critical flow using only:

```text
setTimeout(...)
in-memory maps
in-memory offer lists
browser localStorage state
```

These may assist UX, but durable state must remain in the database.

---

# 13. No Redis Dependency for Prototype Correctness

Redis is **not required initially**.

This intentionally reduces moving parts.

For the initial scale:

- partner latest location may be persisted in the relational store,
- offer expiry uses `expiresAt`,
- dispatch rounds use durable timestamps/status,
- order assignment uses DB transactions,
- sessions/auth should use a design that does not require an in-memory single-server session store.

Redis may later be introduced for:

- high-frequency location presence,
- caching,
- distributed rate limiting,
- faster nearby-partner queries,
- queue workloads,

but business correctness must not depend on it prematurely.

---

# 14. Background Worker

Long-running business timers must be handled by a worker, not by keeping HTTP requests open.

The worker uses the same application/domain code as the API.

Responsibilities include:

```text
expire delivery offers
advance matching rounds
retry matching when appropriate
process scheduled matching work
mark stale availability
handle price-confirmation timeout
process demo refund/settlement jobs if asynchronous
clean expired OTP records if needed
```

## Critical Reliability Rule

Do not implement a 20-second offer timeout only as:

```text
setTimeout(() => expireOffer(), 20000)
```

because the server may restart during those 20 seconds.

Instead store:

```text
offer.status = PENDING
offer.expiresAt = durable timestamp
```

The worker periodically claims expired/pending work from the database.

After restart it continues from database state.

---

# 15. Durable Time-Based Work

Use timestamps rather than process memory for time-sensitive rules.

Examples:

```text
offer.expiresAt
priceApproval.expiresAt
phoneOtp.expiresAt
deliveryOtp.expiresAt
trip.scheduledDepartureAt
order.deliveryWindowStart
order.deliveryWindowEnd
partner.lastLocationUpdatedAt
matching.nextDispatchAt
```

All backend business timestamps should be stored in **UTC**.

The frontend converts them into the user's display timezone.

This prevents bugs caused by server/client timezone differences.

---

# 16. State Machines Are Mandatory

Do not represent lifecycle using arbitrary free-form strings or disconnected booleans.

The backend must have centralized transition rules.

## 16.1 Order State

Recommended architecture-level order states:

```text
DRAFT
AWAITING_PAYMENT
MATCHING
ASSIGNED
PARTNER_TO_PICKUP
PRICE_CONFIRMATION_REQUIRED
PICKED_UP
OUT_FOR_DELIVERY
DELIVERY_OTP_REQUIRED
DELIVERED
COMPLETED

MATCHING_FAILED
CANCELLED
ADMIN_REVIEW_REQUIRED
FAILED
```

`PAYMENT_CONFIRMED` is **not duplicated as an order success state**; payment has its own state machine.

Example legal transition:

```text
AWAITING_PAYMENT
      ↓ payment confirmed
MATCHING
```

Example illegal transition:

```text
DRAFT → PICKED_UP
```

must be rejected by the backend.

---

## 16.2 Payment State

Keep payment state separate:

```text
CREATED
PENDING
CONFIRMED
FAILED
DEMO_REFUND_PENDING
DEMO_REFUNDED
DEMO_SETTLEMENT_PENDING
DEMO_SETTLED
```

Example:

```text
Order   = MATCHING_FAILED
Payment = DEMO_REFUNDED
```

This is valid and understandable.

---

## 16.3 Price Adjustment State

```text
NONE
PENDING_CUSTOMER_APPROVAL
APPROVED
REJECTED
TIMED_OUT
AUTO_DECREASED
```

---

## 16.4 Offer State

```text
PENDING
ACCEPTED
REJECTED
EXPIRED
CANCELLED
```

---

## 16.5 Partner Verification

```text
NOT_APPLIED
PENDING_VERIFICATION
APPROVED
REJECTED
```

---

## 16.6 Availability / Trip State

Availability:

```text
OFFLINE
AVAILABLE_NOW
```

Trip:

```text
TRIP_SCHEDULED
TRIP_ACTIVE
TRIP_COMPLETED
TRIP_CANCELLED
```

These must not be collapsed into one ambiguous `ONLINE` boolean.

---

# 17. Never Expose a Generic Status-Update API

Avoid an endpoint like:

```text
PATCH /orders/{id}
{
  "status": "COMPLETED"
}
```

This allows invalid state transitions and is difficult to secure.

Prefer intention-specific commands:

```text
POST /offers/{id}/accept
POST /orders/{id}/confirm-pickup
POST /orders/{id}/approve-price
POST /orders/{id}/verify-delivery-otp
POST /orders/{id}/cancel
```

Each command validates:

- actor,
- current state,
- prerequisites,
- allowed transition.

---

# 18. Transaction Boundaries

A business operation that must succeed together should happen inside **one database transaction**.

Examples:

## Partner accepts offer

Atomically:

```text
verify offer still PENDING
verify offer not expired
verify order still MATCHING
verify partner still eligible/available
assign partner to order
mark order ASSIGNED
mark winning offer ACCEPTED
cancel remaining active offers
mark partner occupied
commit
```

If any step fails, roll back all of them.

---

## Delivery completion

Atomically:

```text
verify OTP
mark OTP consumed
mark order DELIVERED / COMPLETED
confirm demo earning
update partner completion counters
write timeline/audit event
commit
```

This prevents partial completion states.

---

# 19. Atomic Partner Assignment

The highest-risk concurrency bug is two partners accepting the same order simultaneously.

The database must be the final referee.

Conceptually:

```text
Partner A → Accept ─┐
                    ├→ DB transaction → only one wins
Partner B → Accept ─┘
```

A valid implementation may use:

- row locking,
- conditional atomic update,
- optimistic version check,
- unique constraint,

or a combination appropriate for the chosen relational database.

The important invariant is:

> **An order has at most one active assigned partner.**

And for the prototype:

> **A partner has at most one active delivery order.**

These invariants should be enforced at the database level where practical, not only by application `if` statements.

---

# 20. Optimistic Versioning

Mutable core aggregates such as orders should have a version/update mechanism.

Example:

```text
order.version = 12
```

A state-changing request can verify that it is acting on a current row/version.

This helps detect stale writes such as:

```text
Browser tab A: order ASSIGNED
Browser tab B: stale order still MATCHING
```

The exact ORM/database implementation will be chosen later.

---

# 21. Idempotency

Network retries are normal.

The backend must make critical operations safe to repeat.

Idempotency is especially important for:

```text
payment attempt creation
payment confirmation/webhook
partner offer acceptance
price approval
pickup confirmation
delivery completion
cancellation
admin financial resolution
```

Example problem:

```text
Client sends Accept
Server succeeds
Response is lost
Client retries Accept
```

Correct behavior:

```text
same logical result returned
NO second assignment
NO duplicate earning
```

External provider event IDs and/or application idempotency keys should be stored where appropriate.

---

# 22. Order Timeline / Audit Trail

Every important lifecycle mutation should produce a lightweight durable timeline record.

Example:

```text
ORDER_CREATED
PAYMENT_CONFIRMED
MATCHING_STARTED
OFFER_CREATED
PARTNER_ASSIGNED
PRICE_CONFIRMATION_REQUESTED
PRICE_APPROVED
PICKUP_CONFIRMED
DELIVERY_OTP_VERIFIED
ORDER_COMPLETED
```

Each record should contain at least:

```text
orderId
eventType
actorType
actorId when applicable
occurredAt
safe metadata
```

This is extremely valuable during prototype debugging.

Do not store secrets, OTP plaintext, or identity-document contents in logs/timeline metadata.

---

# 23. Matching Architecture

Matching has two stages.

## Stage A — Cheap Candidate Discovery

Use database/local calculations to reduce the candidate set using:

- partner approval,
- availability/trip state,
- location freshness,
- approximate spatial relevance,
- delivery/scheduled time relevance,
- no incompatible active order.

Do not call Google Routes for every partner in the database.

---

## Stage B — Expensive Route Evaluation

For the shortlist, the Maps adapter calculates what matching needs:

```text
travel time to pickup
pickup → drop travel time
route direction/progress data
base route duration/distance
route with order duration/distance
predicted pickup time
predicted delivery time
extra detour
```

The matching domain then applies deterministic filters/ranking.

Google Maps provides routing data; **Google Maps does not decide who wins the order**.

---

# 24. Matching Dispatch Does Not Block HTTP

After payment confirmation:

```text
HTTP request
   ↓
transition order to MATCHING
persist matching attempt / nextDispatchAt
commit
   ↓
return to client quickly
```

The worker then performs dispatch rounds.

Do not keep a customer HTTP request open for 60 seconds while waiting for partner acceptance.

The matching screen gets updates through WebSocket/polling.

---

# 25. Offer Dispatch Model

Each partner offer should be a durable record with fields conceptually similar to:

```text
offerId
orderId
partnerId
tripId nullable
roundNumber
rankPosition
offeredAt
expiresAt
status
acceptedAt nullable
rejectionReason nullable
```

This allows debugging questions such as:

> Why did Partner B never receive the order?

or:

> Did this offer expire before they accepted?

Offer status is checked on every acceptance request; the browser countdown is only visual.

---

# 26. Partner Location Architecture

Partner location updates should use normal authenticated backend requests.

Example:

```text
Partner browser
   ↓ every ~10–15 sec during active delivery
POST location update
   ↓
Backend validates
   ↓
Store/update latest location
   ↓
Notify subscribed customer via WebSocket
```

Do not make the partner browser send location directly to the customer browser.

## Location validation

At minimum validate:

- latitude range,
- longitude range,
- authenticated partner identity,
- relevant availability/order state,
- server receipt timestamp.

Matching should reject stale location based on configured age, e.g. `MAX_LOCATION_AGE_SECONDS`.

The client-provided timestamp may be stored for diagnostics but should not override trusted server time for security-sensitive expiry rules.

---

# 27. Avoid Google API Calls on Every Location Update

A new GPS coordinate does **not** automatically mean a new Google route calculation.

Location updates may happen every 10–15 seconds while route recalculation happens less frequently or only after meaningful movement/state changes.

This reduces:

- API cost,
- quota usage,
- latency,
- external-provider failure surface.

The customer can still see the latest coordinate on the map between ETA recalculations.

---

# 28. Google Maps Adapter

All business-critical Maps calls should be isolated behind one backend interface.

Conceptual interface:

```text
MapsProvider
  search/resolve where backend-side needed
  calculateRoute
  calculateRouteMatrix
  calculateTravelTime
  obtainRouteGeometry
```

The matching/order modules depend on this interface, not directly on Google SDK classes.

Benefits:

- easier testing with fake Maps responses,
- easier provider replacement later,
- one place for timeouts/retries/quota logging,
- no duplicate route logic across modules.

The frontend may still use the Google Maps browser SDK for map rendering/place UX with a properly restricted browser API key.

Backend routing credentials remain server-side.

---

# 29. External Call Reliability

Every external provider call must have:

- explicit timeout,
- structured error handling,
- safe retry rules,
- request correlation ID/log context.

Do not retry non-idempotent operations blindly.

Example:

```text
Google route timeout
    ↓
mark candidate route evaluation failed
    ↓
continue other candidates / show matching error if provider unavailable
```

The system should not show an infinite spinner.

---

# 30. Razorpay Test Integration Boundary

Payment provider integration must also be isolated behind an adapter.

Conceptually:

```text
PaymentProvider
  createPaymentOrder
  verifyClientConfirmation
  verifyWebhook
  fetchPayment if reconciliation needed
```

Recommended flow:

```text
Frontend requests checkout
       ↓
Backend creates provider payment order
       ↓
Frontend opens Razorpay Test Checkout
       ↓
Provider returns confirmation data
       ↓
Frontend sends confirmation to backend
       ↓
Backend verifies provider signature/reference
       ↓
Backend marks Payment CONFIRMED
       ↓
Order transitions to MATCHING
```

The frontend must never directly set `paymentStatus = CONFIRMED`.

Provider callbacks/webhooks must be idempotent because they may be delivered more than once.

---

# 31. Payment and Ledger Consistency

Financial values must not use floating-point arithmetic.

Store money as integer smallest currency units.

For INR:

```text
₹200.00 = 20000 paise
```

Never use binary `float`/`double` as the authoritative persisted money value.

The demo ledger should be created/updated through the Payments module only.

An order completion retry must not create a second partner earning.

Use uniqueness/idempotency constraints for ledger effects.

---

# 32. Price Confirmation Architecture

Partner submits actual bill:

```text
POST actual price
       ↓
Backend compares with estimate
```

If unchanged:

```text
PriceAdjustment = NONE / resolved
```

If lower:

```text
AUTO_DECREASED
update final demo total
```

If higher:

```text
PENDING_CUSTOMER_APPROVAL
order = PRICE_CONFIRMATION_REQUIRED
expiresAt = durable timestamp
```

Customer approval is an intention-specific backend command.

The worker handles timeout using the durable `expiresAt` value.

---

# 33. File Storage Architecture

Never store uploaded receipt/identity image bytes directly as huge relational DB fields.

Use:

```text
Private Object Storage
        +
Database File Metadata
```

Metadata may contain:

```text
fileId
ownerUserId
purpose
objectKey
contentType
sizeBytes
createdAt
```

Security requirements:

- private bucket/container,
- restricted file types,
- maximum size,
- generated object names,
- access checked by backend,
- short-lived signed access URL where supported,
- identity files never publicly enumerable.

---

# 34. OTP Architecture

Authentication OTP and delivery OTP are separate use cases.

## Authentication OTP

Used for phone verification/login flows where applicable.

## Delivery OTP

Associated with exactly one order/customer handoff.

Delivery OTP records should contain concepts such as:

```text
orderId
otpHash
expiresAt
attemptCount
maxAttempts
consumedAt
```

Do not store/log delivery OTP plaintext after it is sent/displayed to the intended user if avoidable.

Rules:

- wrong OTP increments attempts,
- expired OTP fails,
- consumed OTP cannot be reused,
- completed order cannot be completed again through OTP retry.

Development/test OTP shortcuts must only work in explicitly configured non-production/demo environments.

---

# 35. Authentication and Session Architecture

The exact auth library/token technology is selected during tech-stack design, but architecture requirements are fixed:

- backend authenticates every protected request,
- server-side authorization on every privileged action,
- user identity comes from trusted auth/session context, not body `userId`,
- secure token/session storage strategy,
- session expiry,
- logout/revocation behavior appropriate for prototype,
- CSRF protection if cookie-based auth is used,
- rate limiting on OTP/auth endpoints.

Do not accept:

```text
POST /admin/approve
{ "admin": true }
```

as authorization.

---

# 36. Data Validation

Validate input at the API boundary and enforce important invariants again in the domain/database.

Examples:

```text
latitude / longitude ranges
future scheduled time
positive money values
reasonable item text length
allowed file content type/size
OTP format
allowed departure flexibility
order ownership
partner approval
legal state transition
```

Client-side validation improves UX but never replaces backend validation.

---

# 37. Database Constraints as a Safety Net

Application checks are necessary but not sufficient.

Use database constraints wherever they express a real invariant.

Examples:

- foreign keys,
- non-null required fields,
- unique payment provider event/reference IDs where appropriate,
- unique one-time rating per customer/order,
- unique earning effect per completed order,
- valid status enum/check values,
- one winning assignment invariant where practical.

The database should reject impossible data even if an application bug reaches it.

---

# 38. Avoid Redundant Truth

Do not persist multiple independent fields that mean the same thing unless there is a strong reason.

Bad example:

```text
order.status = MATCHING
order.isMatching = false
```

Which one is correct?

Prefer one authoritative representation and derive UI booleans from it.

Likewise avoid storing:

```text
isPaid
paymentStatus
paymentCompleted
```

as separately mutable truths.

---

# 39. Error Model

Backend errors should be structured and stable.

Conceptual shape:

```text
{
  code: "ORDER_ALREADY_ASSIGNED",
  message: "This order has already been assigned.",
  requestId: "..."
}
```

Use machine-readable codes such as:

```text
INVALID_STATE_TRANSITION
PAYMENT_NOT_CONFIRMED
ORDER_ALREADY_ASSIGNED
OFFER_EXPIRED
PARTNER_NOT_APPROVED
LOCATION_STALE
NO_MATCH_FOUND
PRICE_APPROVAL_REQUIRED
OTP_INVALID
OTP_EXPIRED
MAP_PROVIDER_UNAVAILABLE
```

Do not make frontend behavior depend on parsing English error strings.

---

# 40. Request Correlation and Logging

Every API request should have a request/correlation ID.

Key logs should include safe identifiers such as:

```text
requestId
userId
orderId
partnerId
offerId
tripId
paymentId
```

Important lifecycle logs:

- order created,
- payment confirmed/failed,
- matching started,
- candidate evaluation summary,
- offers dispatched,
- offer accepted/rejected/expired,
- assignment transaction result,
- price approval requested/resolved,
- pickup confirmed,
- OTP verification success/failure,
- order completed/cancelled,
- background job failure.

Never log:

- OTP plaintext,
- auth secrets,
- full identity document contents,
- payment secrets,
- unrestricted sensitive personal information.

---

# 41. Admin Audit Log

Admin intervention can change important state and therefore must be auditable.

Record:

```text
adminUserId
action
entityType
entityId
reason
previousState where useful
newState where useful
occurredAt
```

Examples:

```text
PARTNER_APPROVED
PARTNER_REJECTED
ORDER_MARKED_ADMIN_REVIEW
ADMIN_CANCELLED_ORDER
DEMO_REFUND_RESOLVED
```

---

# 42. Scheduled Order Architecture

Scheduled delivery introduces time-based work but should not require another service.

Persist:

```text
deliveryWindowStart
deliveryWindowEnd
matchingState
nextMatchingAt where needed
```

A scheduled order can be evaluated against `TRIP_SCHEDULED` supply according to the matching rules.

If matching should occur/retry at a later time, the background worker discovers the order using durable timestamps.

Do not depend on the customer's browser remaining open.

Exact matching horizon/lead-time remains a configurable matching rule rather than an architecture constant.

---

# 43. Rematching Architecture

If the assigned partner cancels before purchase:

```text
ASSIGNED
   ↓ transaction
remove assignment
cancel obsolete offers
restore partner availability if valid
order → MATCHING
create next matching attempt
```

The same order ID and payment record remain associated with the request.

Do not create a duplicate order just because rematching occurs.

If rematching ultimately fails, payment module executes the prototype demo-refund transition.

---

# 44. No-Partner Failure Architecture

Matching attempts must have explicit stopping conditions.

When fallback rounds are exhausted:

```text
order → MATCHING_FAILED
payment → DEMO_REFUND_PENDING → DEMO_REFUNDED
```

Customer receives a stable terminal/retryable view.

The worker must not continue generating offers for an order that is:

```text
MATCHING_FAILED
CANCELLED
COMPLETED
FAILED
```

---

# 45. Partner Availability Consistency

Before creating an offer, matching verifies partner availability.

Before accepting the offer, acceptance verifies it **again**.

This second check is mandatory because availability may change between:

```text
10:00:00 offer created
10:00:08 partner receives another assignment
10:00:12 old offer acceptance attempted
```

Never assume eligibility calculated during candidate ranking remains valid forever.

---

# 46. Failure Handling by Component

## Database unavailable

Return a controlled service error. Do not pretend mutation succeeded.

## Maps unavailable

Do not invent ETA/route data. Candidate evaluation can fail or matching can report temporary provider failure.

## Razorpay unavailable

Order remains unpaid/retryable. Matching does not start.

## WebSocket unavailable

REST remains functional. Client refetches/polls canonical order state.

## Worker restarts

Pending work remains represented by database status/timestamps and resumes.

## Browser refreshes

Client loads current active order/trip/offers from backend.

## Duplicate callback/retry

Idempotency prevents duplicate side effects.

---

# 47. Configuration

Prototype assumptions must be centralized.

Examples:

```text
MAX_ASAP_DELIVERY_MINUTES = 45
MAX_ROUTE_DETOUR_MINUTES = 10
MAX_ROUTE_DETOUR_KM = 1.5
AVAILABLE_NOW_INITIAL_RADIUS_KM = 3
OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20
DEFAULT_DEPARTURE_FLEX_MINUTES = 15
DEFAULT_VENDOR_WAIT_MINUTES = 8
MAX_LOCATION_AGE_SECONDS = 60
EARLY_DELIVERY_TOLERANCE_MINUTES = 10
PRICE_CONFIRMATION_TIMEOUT_MINUTES = 3
DEFAULT_PARTNER_EARNING = 40
DEFAULT_PLATFORM_FEE = 10
ACTIVE_DELIVERY_LOCATION_UPDATE_SECONDS = 10–15
```

Do not scatter these values as magic numbers across controllers/frontend/matching code.

Use one typed/configured settings source per environment.

---

# 48. Secrets and Environment Configuration

Keep secrets outside Git.

Examples:

```text
DATABASE_URL
AUTH_SECRET
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
GOOGLE_MAPS_SERVER_KEY
GOOGLE_MAPS_BROWSER_KEY
OBJECT_STORAGE_CREDENTIALS
OTP_PROVIDER_SECRET
```

Use separate values for:

- local development,
- automated tests,
- demo/staging environment.

Browser-exposed Maps keys must be restricted by domain/API usage and must never be treated like server secrets.

---

# 49. Deployment Shape

The initial hosted prototype should be simple.

```text
Browser
  ↓ HTTPS
Frontend static hosting/CDN
  ↓
Backend API instance
  ↓
Managed relational database
  ↓
Private object storage

Background worker
  ↓
same database

External:
Google Maps
Razorpay Test
OTP provider
```

Use platform-managed TLS/HTTPS where possible.

Do not introduce a custom reverse-proxy layer unless the selected hosting platform requires it.

---

# 50. One Backend Codebase, Two Runtime Roles

Suggested deployment/runtime commands conceptually:

```text
start-api
start-worker
```

Both import the same:

```text
domain rules
repositories
provider adapters
validation
configuration
```

This avoids duplicating matching/payment behavior between services.

If the project is deployed on only one small instance for the presentation, API + worker may initially share a process, but the code should preserve the logical separation so blocking timers/jobs do not leak into controllers.

---

# 51. Migration Strategy

Database schema changes must use versioned migrations.

Never manually edit the demo database schema without recording a migration.

Deployment order should conceptually be:

```text
backup/verify environment
      ↓
apply compatible migration
      ↓
deploy backend
      ↓
deploy frontend
      ↓
run smoke test
```

For the prototype, destructive migrations should be avoided close to presentation time.

---

# 52. Testing Architecture

Low-bug architecture depends on tests around business invariants rather than only UI snapshots.

## 52.1 Domain Unit Tests — highest priority

Test:

- legal/illegal order transitions,
- partner verification rules,
- scheduled vs available-now time logic,
- matching filters,
- deterministic ranking,
- price adjustment decisions,
- cancellation rules,
- OTP lifecycle.

---

## 52.2 Database Integration Tests

Test real transactions/constraints for:

- two simultaneous partner accepts,
- one partner cannot receive two incompatible active assignments,
- duplicate payment confirmation,
- duplicate completion request,
- ledger uniqueness,
- cancellation vs acceptance race,
- offer expiry vs acceptance race.

These tests are particularly important because concurrency bugs often do not appear in ordinary unit tests.

---

## 52.3 Provider Adapter Tests

Use fake/stub implementations for:

```text
MapsProvider
PaymentProvider
OtpProvider
FileStorageProvider
```

This makes normal automated tests deterministic and avoids external cost/flakiness.

Keep a small number of real sandbox/test-provider integration checks separately.

---

## 52.4 End-to-End Tests

At minimum automate or repeatedly rehearse:

### Happy path

```text
customer creates order
payment succeeds
partner receives offer
partner accepts
price resolves
pickup
delivery OTP
completion
```

### Required failure paths

```text
payment fails
no partner found
offer expires
wrong OTP
price approval required
customer cancels before pickup
partner cancels before pickup → rematch
```

---

# 53. Concurrency Test Scenarios

The following scenarios should exist before considering matching stable.

## Scenario A — Two partners accept

Expected:

```text
one HTTP request succeeds
one receives ORDER_ALREADY_ASSIGNED
one order assignment in DB
```

## Scenario B — Offer expires while acceptance arrives

Expected:

transaction/server time decides outcome; browser countdown is not authoritative.

## Scenario C — Customer cancels while partner accepts

Expected:

only one legal final transaction wins according to row/state locking; no `CANCELLED + ASSIGNED` impossible combination.

## Scenario D — Payment callback delivered twice

Expected:

one logical payment confirmation and one matching start.

## Scenario E — Delivery completion retried

Expected:

one completion and one partner earning.

---

# 54. Frontend State Strategy

The frontend may cache server responses for UX, but server state remains authoritative.

Rules:

- mutation succeeds only after backend response,
- optimistic UI should be avoided for irreversible/high-risk actions,
- on real-time event, refetch authoritative entity,
- on page refresh, reload active workflow from backend,
- do not rely on browser localStorage to reconstruct order truth.

Suitable optimistic UI examples may include harmless visual interactions.

Do **not** optimistically display:

```text
Payment Successful
Order Assigned
Order Completed
Partner Verified
```

before backend confirmation.

---

# 55. API Response Consistency

Use a consistent representation for important entities.

The frontend should not need five different interpretations of the same order state.

The API should expose stable fields and machine-readable enums.

Avoid business calculations separately duplicated in frontend and backend.

For example, final payable/demo amount should be calculated authoritatively on the backend and rendered by the frontend.

---

# 56. Data Privacy Architecture

Apply least-data exposure.

Before assignment, a partner should only receive information needed to decide whether to accept.

After assignment, expose the necessary pickup/drop/order details.

Never expose to ordinary users:

- another partner's identity documents,
- admin notes,
- payment secrets,
- private verification files.

Stop/reduce location processing after the order/trip no longer requires it.

---

# 57. Prototype Security Baseline

Required even for a demo:

- HTTPS in hosted environment,
- server-side authorization,
- input validation,
- secure auth/session/token handling,
- rate-limit OTP/login attempts,
- no secrets committed,
- private uploaded documents,
- provider signature verification,
- restricted Google API keys,
- safe CORS configuration,
- security headers where applicable,
- dependency vulnerability checks where practical.

Do not postpone all security merely because real money is not moving.

---

# 58. Architecture-Level Invariants

The implementation must preserve these invariants:

1. **Only an approved partner can receive/accept an offer.**
2. **A scheduled future trip is not immediate availability.**
3. **Matching cannot begin before test payment is confirmed.**
4. **One order has at most one active assigned partner.**
5. **One prototype partner handles at most one active delivery order.**
6. **Pickup cannot occur before assignment.**
7. **Higher actual price cannot silently proceed without required customer approval.**
8. **Normal self-service cancellation is not allowed after purchase/pickup.**
9. **Order completion requires delivery verification.**
10. **Delivery OTP can be consumed only once.**
11. **One completed order creates at most one partner earning effect.**
12. **Critical timers survive process restart because deadlines are persisted.**
13. **WebSocket state is never authoritative.**
14. **External provider retries cannot duplicate critical side effects.**
15. **Admin mutations are authorized and auditable.**

These invariants should guide `DATABASE_DESIGN.md`, `API_DESIGN.md`, and tests.

---

# 59. Architecture Review Against Common Bug Sources

## Duplicate assignment

Prevented through DB transaction + assignment invariant.

## Stale browser status

WebSocket events trigger canonical refetch; backend rejects stale/invalid commands.

## Lost timer after restart

Offer/OTP/price deadlines stored in DB; worker resumes.

## Duplicate payment callback

Provider event/reference idempotency.

## Duplicate partner earning

Unique/idempotent ledger effect per completed order.

## Invalid order status

Centralized state transition commands; no generic status mutation.

## Client fakes payment/role

Backend verification and authorization.

## Scheduled traveller receives immediate order incorrectly

Matching uses delivery window + scheduled departure/flexibility, not `online` boolean.

## Customer misses socket event

REST canonical state + reconnect/refetch/poll fallback.

## Google outage creates fake ETA

Provider error is explicit; never fabricate route results.

## Map bill explodes

Coarse filtering before route calls; no route API call on every GPS update.

## Sensitive uploads leaked

Private object storage + authenticated access.

## Timezone bugs

UTC persisted timestamps; local conversion at UI boundary.

## Money rounding bugs

Integer paise, not floating-point persisted money.

---

# 60. Architecture Decisions That Are Now Fixed for Prototype

The architecture establishes these prototype decisions:

```text
Architecture style          Modular monolith
Frontend                    One role-aware web application
Backend                     One codebase
Runtime                     API + background worker
Authoritative data store    One relational database
Critical timers             Durable DB timestamps + worker
Realtime                    WebSocket notifications + REST truth
Commands                    REST/HTTPS
Critical state              Backend/database authoritative
External APIs               Adapter boundaries
Maps                         Google Maps Platform
Payments                     Razorpay Test + internal demo ledger
File storage                 Private object/object-storage layer
Matching                     Deterministic in backend
Assignment                   Atomic DB transaction
Money                        Integer smallest currency units
Time                         UTC internally
Microservices                Not used for prototype
Redis                        Not required for prototype correctness
Message broker               Not required
```

---

# 61. Decisions Intentionally Left for Tech-Stack Design

This architecture deliberately does **not yet lock**:

- frontend framework,
- backend programming language/framework,
- ORM/query library,
- exact relational database product/version,
- WebSocket library,
- auth library,
- validation library,
- object storage vendor,
- hosting platform,
- test framework,
- CI/CD provider configuration.

Those should be selected next based on this architecture rather than forcing the architecture to fit a preferred framework.

---

# 62. Next Design Documents

With this architecture fixed, the next technical documents should be:

```text
1. TECH_STACK / technology decision
2. DATABASE_DESIGN.md
3. API_DESIGN.md
4. DEPLOYMENT / environment plan
5. TESTING_STRATEGY.md (if created separately)
```

`DATABASE_DESIGN.md` must encode the invariants from this document using tables, relationships, constraints, indexes, and concurrency strategy.

`API_DESIGN.md` must expose intention-specific commands instead of generic status mutation.

---

# 63. Architecture Change Rule

If implementation reveals that the architecture needs to change:

1. identify the concrete problem,
2. do not add infrastructure merely to follow a trend,
3. update `DECISIONS.md` if the architectural decision changes,
4. update this document,
5. update database/API documents affected by the change,
6. add tests that reproduce the failure or limitation that caused the change.

The prototype should evolve through **evidence-driven complexity**, not speculative complexity.

---

# 64. Final Prototype Architecture Summary

RouteBite should initially behave as one coherent transactional system.

```text
                    ┌─────────────────────┐
                    │   RouteBite Web     │
                    │ Customer/Partner/   │
                    │ Admin               │
                    └──────────┬──────────┘
                               │
                     REST + WebSocket
                               │
                    ┌──────────▼──────────┐
                    │ Modular Monolith    │
                    │ Backend             │
                    └──────┬───────┬──────┘
                           │       │
                  ┌────────▼──┐ ┌──▼───────────┐
                  │ Relational│ │ Worker       │
                  │ Database  │ │ Durable jobs │
                  └──────┬────┘ └──────────────┘
                         │
                 ┌───────▼────────┐
                 │ Private Files  │
                 └────────────────┘

 External adapters:
 Google Maps | Razorpay Test | OTP/SMS
```

The central reliability rule is:

> **Persist truth first, publish UI updates second.**

If the browser, socket, worker, or external provider fails temporarily, the database should still contain enough durable state for RouteBite to recover and continue safely.
