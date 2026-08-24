# RouteBite — Database Design

> **Status:** CONFIRMED FOR PROTOTYPE
>
> RouteBite will use **MongoDB Atlas + Mongoose** as the durable database layer for the first working prototype.
>
> The goal is not merely to store documents. The database design must make the most dangerous bugs difficult: double assignment, partner accepting two active orders, duplicate payment processing, duplicate earnings, accepting expired offers, invalid status values, lost deadlines and stale geolocation data.

---

# 1. Database Principle

> **MongoDB is the authoritative source of business truth.**

If losing a value after a Node.js restart would make an order incorrect, persist it.

Durable data includes:

```text
users
partner profiles
trips
orders
offers
payments
provider webhook events
ledger entries
```

Operational current location is also stored, but the prototype does not need permanent second-by-second GPS history.

---

# 2. Why MongoDB Fits the Prototype

MongoDB fits the MERN-first implementation because it provides:

- familiar JavaScript document access,
- atomic single-document updates,
- multi-document transactions,
- unique indexes,
- geospatial `2dsphere` indexes,
- flexible nested order data,
- managed Atlas hosting.

The project will not treat MongoDB as an excuse to avoid schema design.

Mongoose schemas, enums, indexes and service-level invariants are mandatory.

---

# 3. Core Collections

The prototype should start with these collections:

```text
users
partners
trips
orders
offers
payments
webhookEvents
ledgerEntries
```

This is intentionally smaller than a highly normalized relational design.

Data that belongs tightly to one order can be embedded inside the order document.

---

# 4. IDs

Use MongoDB `ObjectId` for internal document identifiers.

API responses may expose IDs as strings.

Do not use user-provided values as primary identifiers.

External provider IDs such as Razorpay payment IDs are stored separately and indexed uniquely where required.

---

# 5. Money Type

All monetary values use **integer paise**.

Examples:

```text
₹200.00 → 20000
₹40.00  → 4000
₹10.00  → 1000
```

Mongoose money fields should validate:

```text
Number.isSafeInteger(value)
value >= 0
```

Do not store authoritative money as floating-point rupees.

---

# 6. Time Type

Use MongoDB/Mongoose `Date` values representing UTC timestamps.

Examples:

```text
createdAt
updatedAt
expiresAt
scheduledDepartureAt
deliveryWindowStart
deliveryWindowEnd
pickedUpAt
completedAt
```

The frontend converts timestamps to local display time.

---

# 7. Location Type

Use GeoJSON for important points.

```js
{
  type: "Point",
  coordinates: [longitude, latitude]
}
```

**Longitude comes first.**

This is a common source of bugs and should be documented in code.

Create `2dsphere` indexes where nearby queries are required.

---

# 8. User Collection

Conceptual `users` document:

```js
{
  _id,
  name,
  phone,
  phoneVerified,
  email,
  passwordHash,
  role: "USER" | "ADMIN",
  tokenVersion,

  phoneVerification: {
    otpHash,
    expiresAt,
    attempts
  },

  createdAt,
  updatedAt
}
```

## Indexes

```text
phone unique
email unique sparse/partial when present
```

## Rules

- raw password never stored,
- raw OTP never stored,
- admin role cannot be self-selected through public APIs.

---

# 9. Partner Collection

A user becomes a partner by creating a separate partner profile.

Conceptual document:

```js
{
  _id,
  userId,

  verificationStatus:
    "PENDING_VERIFICATION" |
    "APPROVED" |
    "REJECTED",

  profilePhoto: {
    publicId,
    resourceType
  },

  collegeIdentity: {
    enrollmentNumber,
    collegeName,
    documentPublicId,
    reviewedAt,
    reviewedBy
  },

  availabilityStatus:
    "OFFLINE" |
    "AVAILABLE_NOW",

  currentLocation: {
    type: "Point",
    coordinates: [lng, lat]
  },

  locationUpdatedAt,

  activeOrderId,

  ratingAverage,
  ratingCount,
  completedOrderCount,
  cancelledOrderCount,

  createdAt,
  updatedAt
}
```

## Indexes

```text
userId unique
currentLocation 2dsphere
verificationStatus + availabilityStatus
activeOrderId
```

## Important invariant

For the prototype:

> A partner may have at most one active assigned order.

This is enforced through conditional partner updates inside assignment transactions.

---

# 10. Trip Collection

Conceptual scheduled/on-my-way trip:

```js
{
  _id,
  partnerId,

  status:
    "TRIP_SCHEDULED" |
    "TRIP_ACTIVE" |
    "TRIP_COMPLETED" |
    "TRIP_CANCELLED",

  origin: GeoJSONPoint,
  destination: GeoJSONPoint,

  originText,
  destinationText,

  scheduledDepartureAt,
  departureFlexMinutes,

  routePolyline,
  routeDistanceMeters,
  routeDurationSeconds,

  startedAt,
  completedAt,

  currentProgressMeters,

  createdAt,
  updatedAt
}
```

## Indexes

```text
partnerId + status
status + scheduledDepartureAt
origin 2dsphere (optional but useful)
destination 2dsphere (optional but useful)
```

For V1, route compatibility is primarily application/Google Maps logic after coarse filtering.

Do not over-engineer route geospatial storage.

---

# 11. Order Collection

The order is the central business document.

Conceptual structure:

```js
{
  _id,
  customerId,

  status:
    "DRAFT" |
    "PAYMENT_PENDING" |
    "TEST_PAYMENT_SUCCESS" |
    "MATCHING" |
    "ASSIGNED" |
    "PARTNER_TO_PICKUP" |
    "PRICE_CONFIRMATION_REQUIRED" |
    "PICKED_UP" |
    "OUT_FOR_DELIVERY" |
    "DELIVERY_OTP_REQUIRED" |
    "DELIVERED" |
    "COMPLETED" |
    "PAYMENT_FAILED" |
    "MATCHING_FAILED" |
    "CANCELLED" |
    "FAILED" |
    "ADMIN_REVIEW_REQUIRED",

  vendorDisplayName,
  pickupInstructions,
  requestedItems,

  pickup: GeoJSONPoint,
  pickupText,

  drop: GeoJSONPoint,
  dropText,

  deliveryType: "ASAP" | "SCHEDULED",
  deliveryWindowStart,
  deliveryWindowEnd,

  assignedPartnerId,
  assignedTripId,

  pricing: {
    estimatedFoodCostPaise,
    actualFoodCostPaise,
    customerDeliveryChargePaise,
    partnerBaseEarningPaise,
    partnerIncentivePaise,
    platformFeePaise,
    platformSubsidyPaise,
    estimatedCustomerTotalPaise,
    finalCustomerTotalPaise
  },

  priceAdjustment: {
    status:
      "NONE" |
      "PENDING_CUSTOMER_APPROVAL" |
      "APPROVED" |
      "REJECTED" |
      "TIMED_OUT" |
      "AUTO_DECREASED",
    differencePaise,
    expiresAt,
    approvedAt
  },

  receipt: {
    cloudinaryPublicId,
    uploadedAt
  },

  deliveryVerification: {
    otpHash,
    expiresAt,
    attempts,
    verifiedAt
  },

  liveDelivery: {
    partnerLocation: GeoJSONPoint,
    locationUpdatedAt
  },

  rating: {
    stars,
    feedback,
    createdAt
  },

  adminReview: {
    required,
    reason,
    resolved,
    resolutionNote,
    resolvedAt,
    resolvedBy
  },

  timeline: [
    {
      type,
      at,
      actorType,
      actorId,
      metadata
    }
  ],

  createdAt,
  updatedAt,
  completedAt
}
```

---

# 12. Order Indexes

Recommended indexes:

```text
customerId + createdAt desc
status + createdAt
assignedPartnerId + status
deliveryWindowEnd + status
pickup 2dsphere (optional for operations/admin analytics)
```

Do not create indexes without a query use case because every index has write/storage cost.

---

# 13. Order Timeline

For the prototype, a small embedded timeline is acceptable because an order has a bounded number of state events.

Examples:

```text
ORDER_CREATED
PAYMENT_CONFIRMED
MATCHING_STARTED
PARTNER_ASSIGNED
PRICE_CONFIRMATION_REQUESTED
PICKED_UP
OUT_FOR_DELIVERY
OTP_VERIFIED
ORDER_COMPLETED
```

The timeline improves debugging and admin support.

Do not store secrets or sensitive payloads in timeline metadata.

---

# 14. Offer Collection

Offers require their own collection because they are queried by partner/status/expiry.

Conceptual document:

```js
{
  _id,
  orderId,
  partnerId,
  tripId,

  matchingRound,
  rankPosition,

  status:
    "PENDING" |
    "ACCEPTED" |
    "REJECTED" |
    "EXPIRED" |
    "CANCELLED",

  expiresAt,

  candidateSnapshot: {
    predictedPickupAt,
    predictedDeliveryAt,
    pickupTravelMinutes,
    additionalDetourMinutes,
    additionalDetourKm,
    expectedEarningPaise
  },

  respondedAt,
  createdAt,
  updatedAt
}
```

---

# 15. Offer Indexes

Recommended:

```text
partnerId + status + expiresAt
orderId + status
status + expiresAt
```

Unique compound index:

```text
orderId + partnerId + matchingRound
```

This prevents accidental duplicate offers to the same partner within one round.

---

# 16. Offer Acceptance Condition

An offer can be accepted only when:

```text
offer.status == PENDING
AND offer.expiresAt > now
AND order.status == MATCHING
AND order.assignedPartnerId == null
AND partner.activeOrderId == null
AND partner.verificationStatus == APPROVED
```

Do not perform these as independent read-then-write operations.

Use a MongoDB transaction with conditional updates.

---

# 17. Atomic Partner Assignment Transaction

Conceptual algorithm:

```text
start session + transaction

1. find/update offer
   condition:
     PENDING
     expiresAt > now
   set:
     ACCEPTED

2. find/update partner
   condition:
     APPROVED
     activeOrderId == null
   set:
     activeOrderId = orderId
     availabilityStatus = OFFLINE

3. find/update order
   condition:
     status == MATCHING
     assignedPartnerId == null
   set:
     assignedPartnerId = partnerId
     status = ASSIGNED

4. update competing PENDING offers for order → CANCELLED

commit
```

If any required update matches zero documents, abort.

This is the primary protection against double assignment.

---

# 18. Payment Collection

Payment state is separate from order state.

Conceptual payment document:

```js
{
  _id,
  orderId,
  userId,

  provider: "RAZORPAY",
  mode: "TEST",

  providerOrderId,
  providerPaymentId,

  status:
    "CREATED" |
    "PAYMENT_PENDING" |
    "PAYMENT_CONFIRMED" |
    "PAYMENT_FAILED" |
    "DEMO_REFUND_PENDING" |
    "DEMO_REFUNDED" |
    "DEMO_SETTLEMENT_PENDING" |
    "DEMO_SETTLED",

  amountPaise,
  currency: "INR",

  confirmedAt,
  failedAt,
  createdAt,
  updatedAt
}
```

---

# 19. Payment Indexes

Recommended:

```text
orderId
providerOrderId unique when present
providerPaymentId unique sparse when present
status + createdAt
```

Provider IDs must not be reused across logical successful payment records.

---

# 20. Webhook Event Collection

External providers may send the same webhook multiple times.

Conceptual document:

```js
{
  _id,
  provider,
  providerEventId,
  eventType,
  receivedAt,
  processedAt,
  processingStatus,
  relatedOrderId
}
```

Unique index:

```text
provider + providerEventId
```

Processing pattern:

```text
insert event identity
        ↓
duplicate key?
        ↓
yes → already processed/being processed; safe no-op
```

This is mandatory idempotency protection.

---

# 21. Ledger Entry Collection

Conceptual document:

```js
{
  _id,
  orderId,
  partnerId,
  userId,

  type:
    "CUSTOMER_TEST_PAYMENT" |
    "FOOD_PRICE_ADJUSTMENT" |
    "DEMO_REFUND" |
    "FOOD_REIMBURSEMENT" |
    "PARTNER_EARNING" |
    "PLATFORM_FEE" |
    "PLATFORM_SUBSIDY",

  amountPaise,
  direction: "CREDIT" | "DEBIT",

  idempotencyKey,
  createdAt
}
```

Unique index:

```text
idempotencyKey unique
```

Example:

```text
partner-earning:{orderId}
```

This prevents duplicate earning creation if order completion is retried.

---

# 22. Completion Transaction

Successful completion may require:

```text
order → COMPLETED
partner.activeOrderId → null
partner.completedOrderCount +1
ledger PARTNER_EARNING inserted
payment/demo settlement state updated
```

These related effects should happen in one MongoDB transaction where practical.

Use a unique ledger idempotency key as a second safety layer.

---

# 23. Cancellation Transaction

When an assigned order is cancelled before purchase:

```text
order → CANCELLED
partner.activeOrderId → null
pending offers → CANCELLED
payment → DEMO_REFUND_PENDING/DEMO_REFUNDED
```

The order and partner release should be transactionally consistent.

---

# 24. Partner Cancellation Before Purchase

If partner cancels before purchase:

```text
transaction:
partner.activeOrderId → null
order.assignedPartnerId → null
order.status → MATCHING
assignment-related offer state updated
```

Then matching is restarted after commit.

Do not perform external Google Maps calls inside the database transaction.

---

# 25. Transaction Rule

Transactions should be short.

Inside a transaction:

```text
MongoDB reads/writes only
```

Do not wait for:

```text
Google Maps
Razorpay
Cloudinary
SMS
Socket.IO client acknowledgement
```

External calls can be slow and unreliable.

Persist the business result, commit, then notify/call downstream where appropriate.

---

# 26. Price Confirmation Data

Price confirmation deadline must be persisted:

```text
priceAdjustment.status
priceAdjustment.expiresAt
```

Customer approval API must require:

```text
status == PENDING_CUSTOMER_APPROVAL
expiresAt > now
```

A periodic job may mark old requests as `TIMED_OUT`, but the approval query itself prevents late approval.

---

# 27. Delivery OTP

Never store raw delivery OTP.

Store:

```text
otpHash
expiresAt
attempts
verifiedAt
```

Verification checks:

```text
order is in allowed delivery state
OTP not already verified
expiresAt > now
attempts below limit
hash matches
```

Successful verification should atomically mark `verifiedAt` so the same code cannot be reused.

---

# 28. Phone Verification OTP

Use the same principles for phone verification:

- secure random code,
- hashed storage,
- expiry,
- attempt limit,
- one-time success.

Do not store OTP history indefinitely.

---

# 29. Geospatial Partner Discovery

Partner document uses:

```js
currentLocation: {
  type: "Point",
  coordinates: [lng, lat]
}
```

`2dsphere` index enables coarse discovery.

Example query logic:

```text
APPROVED
AVAILABLE_NOW
locationUpdatedAt fresh
within initial search distance
```

Then Google Maps determines road ETA and final eligibility.

---

# 30. Stale Location Protection

Do not match a partner based on an old location.

Persist:

```text
locationUpdatedAt
```

Eligibility service compares it to:

```text
MAX_LOCATION_AGE_SECONDS
```

If stale, exclude or request refresh.

---

# 31. Scheduled Trip Candidate Data

Trips should retain routing metadata needed to avoid unnecessary recalculation:

```text
routePolyline
routeDistanceMeters
routeDurationSeconds
```

However, traffic-sensitive ETA may need recalculation through Google Maps when actually matching.

Do not treat an old route duration as permanent truth.

---

# 32. Mongoose Enum Validation

State fields must use allowed-value lists.

Example:

```js
status: {
  type: String,
  enum: ORDER_STATUSES,
  required: true
}
```

Keep shared backend constants such as:

```text
ORDER_STATUSES
OFFER_STATUSES
TRIP_STATUSES
PAYMENT_STATUSES
PARTNER_VERIFICATION_STATUSES
```

Do not scatter manually typed strings across the codebase.

---

# 33. Database Validation vs Business Validation

Mongoose ensures document shape.

Services enforce cross-field/business meaning.

Example:

Mongoose can ensure:

```text
status is a valid string
amount is nonnegative
```

Service must ensure:

```text
PICKED_UP cannot happen before assignment
COMPLETED requires verified delivery OTP
MATCHING requires confirmed test payment
```

Both layers are required.

---

# 34. Optimistic/Conditional Writes

Avoid this for critical state:

```js
const order = await Order.findById(id);
order.status = "ASSIGNED";
await order.save();
```

Prefer:

```text
findOneAndUpdate with expected current state
```

For example:

```text
_id = orderId
status = MATCHING
assignedPartnerId = null
```

This prevents stale code from overwriting a newer state.

---

# 35. Mongoose Versioning

Mongoose's `__v` may be kept for optimistic concurrency where useful.

However, do not rely only on `__v` for the assignment/payment invariants.

Critical paths should have explicit query conditions and transactions.

---

# 36. Background Expiry Queries

Jobs may query:

```text
offers:
status = PENDING
expiresAt <= now

orders:
priceAdjustment.status = PENDING_CUSTOMER_APPROVAL
priceAdjustment.expiresAt <= now

partners:
availabilityStatus = AVAILABLE_NOW
locationUpdatedAt too old
```

Jobs must update conditionally so rerunning them is safe.

---

# 37. Do Not Use TTL Indexes for Business History

MongoDB TTL indexes physically delete documents and run asynchronously.

Do not use TTL deletion for:

```text
offers
payments
orders
ledger entries
```

We need those records for debugging/audit.

Expiry should normally change a status rather than delete the record.

---

# 38. Cloudinary File References

MongoDB stores references, not image bytes.

Examples:

```text
profilePhoto.publicId
collegeIdentity.documentPublicId
order.receipt.cloudinaryPublicId
```

Sensitive documents must not store a permanently public URL.

Access should be authorized by backend logic.

---

# 39. Data Minimization

Do not collect unnecessary identity data.

For the campus prototype, do not store full Aadhaar documents/numbers.

Only store the college/profile information required by the approved product flow.

---

# 40. Delete Behavior

Business records should usually not be physically deleted during normal operation.

Examples:

```text
order → CANCELLED
trip → TRIP_CANCELLED
offer → EXPIRED
partner application → REJECTED
```

Keeping records helps debugging and demonstration history.

Hard deletion may be implemented later for privacy/account-deletion obligations.

---

# 41. Recommended Index Summary

```text
USERS
phone UNIQUE
email UNIQUE partial/sparse

PARTNERS
userId UNIQUE
currentLocation 2dsphere
verificationStatus + availabilityStatus
activeOrderId

TRIPS
partnerId + status
status + scheduledDepartureAt

ORDERS
customerId + createdAt
status + createdAt
assignedPartnerId + status
deliveryWindowEnd + status

OFFERS
partnerId + status + expiresAt
orderId + status
status + expiresAt
orderId + partnerId + matchingRound UNIQUE

PAYMENTS
providerOrderId UNIQUE
providerPaymentId UNIQUE sparse
orderId

WEBHOOK EVENTS
provider + providerEventId UNIQUE

LEDGER
idempotencyKey UNIQUE
orderId + createdAt
```

Validate indexes in Atlas after deployment rather than assuming Mongoose auto-index creation will always be enabled in production.

---

# 42. Important Concurrency Scenarios

Before considering the database design complete, test these explicitly.

## Scenario A — Two partners accept same order

Expected:

```text
one transaction commits
one transaction fails/no match
one assigned partner
```

## Scenario B — Same partner accepts two orders

Expected:

```text
only one transaction can set activeOrderId from null
second fails
```

## Scenario C — Offer expires during acceptance

Expected:

```text
accept query requires expiresAt > now
expired offer cannot win
```

## Scenario D — Razorpay sends duplicate webhook

Expected:

```text
unique provider event ID blocks duplicate processing
```

## Scenario E — Complete endpoint retried

Expected:

```text
order already completed OR conditional transition fails
partner earning idempotency key prevents duplicate ledger entry
```

## Scenario F — Customer cancel and partner accept concurrently

Expected:

```text
transactions/conditional state checks yield one valid final state
never CANCELLED while still holding active partner incorrectly
```

---

# 43. Backup and Recovery

MongoDB Atlas should use its available managed backup features appropriate to the selected plan when feasible.

For the presentation prototype, also maintain deterministic seed/demo scripts so a clean demo dataset can be recreated quickly.

Never depend on manually editing Atlas documents immediately before a presentation.

---

# 44. Seed Data

Provide a development seed script for:

```text
admin user
customer demo user
approved partner demo user
sample scheduled trip
optional sample completed order
```

Do not hardcode real passwords/secrets into Git.

Development credentials may come from environment variables or clearly documented local-only defaults.

---

# 45. Final Database Rule

The MongoDB design is intentionally document-oriented, but critical correctness must remain explicit.

> **Flexible schema does not mean flexible business rules.**

RouteBite will use:

```text
Mongoose schema validation
+
MongoDB indexes
+
conditional atomic updates
+
transactions for multi-document invariants
+
idempotency keys
+
centralized service state machines
```

This provides enough safety for the prototype while keeping the project inside a familiar MERN data layer.