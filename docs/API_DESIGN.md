# RouteBite — API Design

> **Status:** CONFIRMED FOR PROTOTYPE
>
> This document defines the HTTP and realtime API contract for the first working RouteBite prototype.
>
> It is derived from `PROJECT_CONTEXT.md`, `DECISIONS.md`, `USER_FLOWS.md`, `PRODUCT_REQUIREMENTS.md`, `PAYMENT_FLOW.md`, `MATCHING_ENGINE.md`, `ARCHITECTURE.md`, `TECH_STACK.md`, and `DATABASE_DESIGN.md`.
>
> The goal is not to maximize the number of endpoints. The goal is to make every important product action explicit, secure, debuggable, and difficult to execute twice by accident.

---

# 1. Core API Principle

The API follows one central rule:

> **REST changes authoritative business state. Socket.IO only communicates that state changed.**

Examples:

```text
Partner clicks Accept
      ↓
POST /api/v1/offers/:offerId/accept
      ↓
Express validates
      ↓
MongoDB atomic update / transaction
      ↓
API returns authoritative result
      ↓
Socket.IO emits order:updated
```

The system must never treat a Socket.IO event as durable proof that an order is assigned, paid, picked up, or completed.

If a socket connection is lost, the client must be able to reload the current truth using REST.

---

# 2. API Base Path

All application APIs use:

```text
/api/v1
```

Examples:

```text
/api/v1/auth/login
/api/v1/orders
/api/v1/partner/trips
```

The `/v1` prefix allows future incompatible API changes without silently breaking older clients.

---

# 3. Transport and Content Types

Normal requests use:

```text
HTTPS
application/json
```

File upload requests use:

```text
multipart/form-data
```

Production must use HTTPS.

Local development may use HTTP.

---

# 4. Standard Success Response

Use a consistent response envelope.

Example:

```json
{
  "success": true,
  "data": {
    "id": "66c..."
  }
}
```

For paginated results:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "hasNext": true
  }
}
```

Do not return unrelated internal database metadata simply because Mongoose produced it.

---

# 5. Standard Error Response

All expected API failures use:

```json
{
  "success": false,
  "error": {
    "code": "ORDER_ALREADY_ASSIGNED",
    "message": "This order has already been assigned to another partner.",
    "details": null,
    "requestId": "req_..."
  }
}
```

`code` is stable and machine-readable.

`message` is readable by developers/users.

`details` may contain safe validation information.

Never expose:

- stack traces,
- MongoDB connection information,
- JWT secrets,
- Razorpay secrets,
- Cloudinary secrets,
- raw password hashes,
- raw OTP hashes.

---

# 6. HTTP Status Usage

Use predictable semantics.

```text
200 OK                  successful read/update
201 Created             resource created
204 No Content          successful action with no body if appropriate
400 Bad Request         malformed input / invalid request
401 Unauthorized        not logged in / invalid session
403 Forbidden           logged in but not allowed
404 Not Found           resource not found or not visible to caller
409 Conflict            state/concurrency conflict
422 Unprocessable       valid JSON but business validation fails
429 Too Many Requests   rate-limited action
500 Internal Error      unexpected server failure
502/503                 external dependency temporarily unavailable where useful
```

State conflicts should usually use `409`.

Example:

```text
partner accepts already assigned order
→ 409 ORDER_ALREADY_ASSIGNED
```

---

# 7. Authentication Model

Prototype authentication uses:

```text
email/phone + password
bcrypt password hash
JWT stored in HttpOnly cookie
```

Recommended cookie properties in production:

```text
HttpOnly = true
Secure = true
SameSite = Lax
```

Because the preferred production deployment is same-origin, cookie handling stays simple.

The browser should not store the JWT in `localStorage`.

---

# 8. Authentication Middleware

Use middleware such as:

```text
requireAuth
requireAdmin
requireApprovedPartner
```

Authorization must be server-side.

Frontend route protection is only for user experience.

---

# 9. Request Validation

Every public write endpoint must validate untrusted input using `express-validator` before service logic.

Validation includes:

- required fields,
- string lengths,
- number ranges,
- ObjectId validity,
- latitude/longitude bounds,
- enum values,
- timestamp ordering,
- money as non-negative integer paise,
- upload type/size.

Mongoose schema validation is the second line of defense, not the only line.

---

# 10. Request IDs

Every request should receive a `requestId`.

Example:

```text
req_01...
```

Log the same request ID with:

```text
userId
orderId
partnerId
paymentId
```

when applicable.

This makes a failed demo flow traceable across logs.

---

# 11. Idempotency

Network retries must not create duplicate financial/business actions.

Endpoints that can create duplicate side effects should accept:

```text
Idempotency-Key: <random unique value>
```

Important examples:

- payment creation,
- payment confirmation where applicable,
- order completion,
- price approval,
- admin financial resolution where implemented.

The backend should persist the key/result for the relevant operation or otherwise enforce equivalent uniqueness.

A retry with the same key should return the original logical outcome when safe.

---

# 12. Authentication Endpoints

## POST `/api/v1/auth/register`

Creates a customer account.

Request:

```json
{
  "name": "Gagan",
  "email": "user@example.com",
  "phone": "+919999999999",
  "password": "strong-password"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "Gagan",
      "email": "user@example.com",
      "phone": "+919999999999",
      "phoneVerified": false,
      "role": "USER"
    }
  }
}
```

Rules:

- email/phone uniqueness checked,
- password never returned,
- client cannot set `ADMIN` role.

---

## POST `/api/v1/auth/login`

Request:

```json
{
  "emailOrPhone": "user@example.com",
  "password": "strong-password"
}
```

On success, server sets HttpOnly auth cookie.

Response contains safe user profile only.

---

## POST `/api/v1/auth/logout`

Clears the auth cookie.

Must be safe to call even when already logged out.

---

## GET `/api/v1/auth/me`

Returns the current user plus capability information.

Example:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "Gagan",
      "role": "USER",
      "phoneVerified": true
    },
    "partner": {
      "exists": true,
      "verificationStatus": "APPROVED",
      "availabilityStatus": "OFFLINE"
    }
  }
}
```

This endpoint is useful when React initializes after page refresh.

---

# 13. Phone Verification Endpoints

## POST `/api/v1/auth/phone-otp/request`

Requires authenticated user.

Creates a short-lived phone verification OTP.

Prototype may use a development/test delivery mechanism when SMS is not configured.

Rules:

- rate limit,
- store only OTP hash,
- set expiry,
- invalidate/replace previous active OTP when appropriate.

---

## POST `/api/v1/auth/phone-otp/verify`

Request:

```json
{
  "otp": "123456"
}
```

On success:

```text
phoneVerified = true
```

Errors:

```text
OTP_INVALID
OTP_EXPIRED
OTP_TOO_MANY_ATTEMPTS
```

---

# 14. Upload API

RouteBite uses Cloudinary for files.

## POST `/api/v1/uploads`

Authenticated multipart endpoint.

Fields:

```text
file
purpose
```

Allowed prototype purposes:

```text
PROFILE_PHOTO
COLLEGE_ID
PURCHASE_RECEIPT
```

Response:

```json
{
  "success": true,
  "data": {
    "assetId": "...",
    "purpose": "PURCHASE_RECEIPT"
  }
}
```

The API should return a RouteBite-owned asset reference rather than making callers depend on Cloudinary internals everywhere.

Rules:

- MIME/type whitelist,
- size limit,
- authenticated/private storage for sensitive documents,
- never trust filename extension alone.

---

# 15. Partner Application API

## POST `/api/v1/partner/apply`

Authenticated user creates partner profile.

Request example:

```json
{
  "profilePhotoAssetId": "...",
  "collegeName": "IIIT Allahabad",
  "enrollmentNumber": "...",
  "collegeIdAssetId": "..."
}
```

Result:

```text
verificationStatus = PENDING_VERIFICATION
```

A user cannot self-approve.

---

## GET `/api/v1/partner/profile`

Returns current user's partner profile/status.

---

# 16. Partner Availability API

## PATCH `/api/v1/partner/availability`

Approved partner only.

Request:

```json
{
  "status": "AVAILABLE_NOW"
}
```

or:

```json
{
  "status": "OFFLINE"
}
```

Rules:

- rejected/pending partner cannot go online,
- partner with incompatible active order cannot freely switch state,
- going `AVAILABLE_NOW` should require sufficiently recent location.

---

## PUT `/api/v1/partner/location`

Approved partner only.

Used for periodic operational location updates when REST is preferred/fallback.

Request:

```json
{
  "latitude": 25.4358,
  "longitude": 81.8463,
  "accuracyMeters": 18
}
```

Backend stores GeoJSON:

```text
coordinates = [longitude, latitude]
```

Remember: **longitude first** in GeoJSON.

For high-frequency active-delivery updates, Socket.IO may be used instead; REST remains available as a reliable fallback.

---

# 17. Scheduled Trip API

## POST `/api/v1/partner/trips`

Approved partner only.

Request:

```json
{
  "origin": {
    "latitude": 25.45,
    "longitude": 81.83,
    "label": "Civil Lines"
  },
  "destination": {
    "latitude": 25.43,
    "longitude": 81.77,
    "label": "IIIT Allahabad"
  },
  "scheduledDepartureAt": "2026-08-24T12:30:00.000Z",
  "departureFlexMinutes": 15
}
```

Backend may call Google Maps and persist route geometry/polyline metadata required by matching.

Result:

```text
TRIP_SCHEDULED
```

Creating a trip does not make the partner `AVAILABLE_NOW`.

---

## GET `/api/v1/partner/trips`

Returns current user's scheduled/active/history trips.

---

## GET `/api/v1/partner/trips/:tripId`

Returns one trip owned by the current partner.

---

## POST `/api/v1/partner/trips/:tripId/start`

Transition:

```text
TRIP_SCHEDULED → TRIP_ACTIVE
```

Must validate current state and ownership.

---

## POST `/api/v1/partner/trips/:tripId/cancel`

Allowed only when cancellation does not violate an assigned order.

Transition:

```text
TRIP_SCHEDULED → TRIP_CANCELLED
```

Active-trip cancellation may require stricter handling.

---

# 18. Customer Order Creation API

## POST `/api/v1/orders`

Creates an order draft.

Request example:

```json
{
  "vendorDisplayName": "Verma Chaat",
  "itemsText": "2 pav bhaji, extra butter, no onion",
  "pickupInstructions": "Opposite Hanuman Mandir, red cart",
  "pickup": {
    "latitude": 25.44,
    "longitude": 81.85,
    "label": "Civil Lines"
  },
  "drop": {
    "latitude": 25.43,
    "longitude": 81.77,
    "label": "Hostel"
  },
  "deliveryType": "ASAP",
  "deliveryWindowStart": "2026-08-24T09:45:00.000Z",
  "deliveryWindowEnd": "2026-08-24T10:30:00.000Z",
  "estimatedFoodCostPaise": 20000
}
```

For scheduled delivery:

```text
deliveryType = SCHEDULED
```

Rules:

- pickup/drop coordinates required,
- vendor does not need a RouteBite merchant record,
- scheduled window must be future and valid,
- monetary values are integer paise.

Initial order state:

```text
DRAFT
```

---

## PATCH `/api/v1/orders/:orderId`

Customer may edit an order only while it remains safely editable, normally before successful payment/matching.

Do not support arbitrary updates to status through this endpoint.

Never expose:

```text
PATCH /orders/:id { "status": "COMPLETED" }
```

Business states change only through dedicated action endpoints.

---

## GET `/api/v1/orders`

Returns caller's customer order history.

Supports basic pagination/filtering.

---

## GET `/api/v1/orders/:orderId`

Returns authoritative order detail when caller is authorized:

- customer owner,
- assigned partner,
- admin.

The response should be role-aware so unnecessary personal information is not exposed.

---

# 19. Price Estimate API

## GET `/api/v1/orders/:orderId/estimate`

Returns prototype price breakdown for an editable draft.

Example:

```json
{
  "success": true,
  "data": {
    "estimatedFoodCostPaise": 20000,
    "deliveryChargePaise": 4000,
    "platformFeePaise": 1000,
    "estimatedTotalPaise": 25000
  }
}
```

The backend calculates authoritative totals; the frontend does not invent them.

---

# 20. Razorpay Payment API

## POST `/api/v1/orders/:orderId/payment`

Creates/reuses a Razorpay Test Mode payment/order object.

Headers:

```text
Idempotency-Key: <unique-client-key>
```

Rules:

- customer must own order,
- order must be payable,
- backend calculates amount,
- one logical active payment attempt at a time,
- frontend cannot choose arbitrary final amount.

Response contains safe Razorpay checkout information.

---

## POST `/api/v1/orders/:orderId/payment/verify`

Used when the client receives Razorpay test checkout success data and backend verification is required.

Request contains provider identifiers/signature required by Razorpay.

Backend verifies provider signature before setting:

```text
PAYMENT_CONFIRMED
```

Then order moves into:

```text
MATCHING
```

The frontend alone can never mark payment successful.

---

## POST `/api/v1/webhooks/razorpay`

Public provider callback endpoint.

This endpoint does **not** use customer JWT authentication.

It must instead verify Razorpay webhook signature.

Rules:

- store provider event ID uniquely,
- duplicate webhook = safe no-op / return success,
- invalid signature rejected,
- process event idempotently.

This endpoint must use the raw request body format required by provider signature verification before JSON mutation where necessary.

---

# 21. Matching Start

There is no normal customer-facing `choose partner` endpoint.

Successful payment automatically triggers matching.

Internal flow:

```text
PAYMENT_CONFIRMED
      ↓
order service moves order to MATCHING
      ↓
matching service discovers candidates
      ↓
offers created
```

A retry endpoint may exist for a failed match:

## POST `/api/v1/orders/:orderId/rematch`

Customer only.

Allowed only from states such as:

```text
MATCHING_FAILED
```

and only when the payment/demo-refund state permits retry.

Do not allow arbitrary repeated rematching of active/assigned orders.

---

# 22. Partner Offer API

## GET `/api/v1/partner/offers`

Approved partner only.

Returns currently pending, non-expired offers intended for that partner.

The service must still check `expiresAt` at read/accept time even if a background cleanup job has not run yet.

---

## GET `/api/v1/partner/offers/:offerId`

Returns offer detail if it belongs to the current partner.

---

## POST `/api/v1/partner/offers/:offerId/accept`

This is one of the most concurrency-sensitive endpoints.

Expected behavior:

```text
Partner A accepts
Partner B accepts nearly simultaneously
           ↓
MongoDB atomic/transactional assignment
           ↓
Exactly one succeeds
```

The service must validate:

- offer belongs to partner,
- offer is `PENDING`,
- `expiresAt > now`,
- partner is approved,
- partner is still operationally compatible,
- order is still `MATCHING`,
- order has no assigned partner,
- partner has no incompatible active order.

Success:

```text
order → ASSIGNED
winning offer → ACCEPTED
other pending offers → CLOSED/EXPIRED/ORDER_ASSIGNED
```

Failure codes may include:

```text
OFFER_EXPIRED
ORDER_ALREADY_ASSIGNED
PARTNER_BUSY
PARTNER_NOT_ELIGIBLE
INVALID_ORDER_STATE
```

Use `409` for race/state conflicts.

Repeated acceptance by the winning partner should ideally return the existing assignment rather than create a second one.

---

## POST `/api/v1/partner/offers/:offerId/reject`

Marks partner's offer rejected.

Matching may continue to next candidate/batch.

Rejecting twice should not create side effects.

---

# 23. Assigned Order — Partner Actions

## POST `/api/v1/orders/:orderId/heading-to-pickup`

Assigned partner only.

Transition to/confirm:

```text
PARTNER_TO_PICKUP
```

If assignment already implies this state automatically, this endpoint may be omitted during implementation.

Do not create redundant endpoints when a state is automatic.

---

## POST `/api/v1/orders/:orderId/actual-bill`

Assigned partner only, before pickup completion.

Request:

```json
{
  "actualFoodCostPaise": 22000,
  "receiptAssetId": "asset_..."
}
```

Backend compares estimated vs actual.

If equal:

```text
price adjustment = NONE/CONFIRMED
```

If lower:

```text
AUTO_DECREASED
```

If higher:

```text
PENDING_CUSTOMER_APPROVAL
order → PRICE_CONFIRMATION_REQUIRED
```

Partner cannot silently increase final bill.

---

# 24. Customer Price Approval API

## POST `/api/v1/orders/:orderId/price-adjustment/approve`

Customer owner only.

Headers:

```text
Idempotency-Key
```

Valid only when:

```text
priceAdjustmentStatus = PENDING_CUSTOMER_APPROVAL
expiresAt > now
```

Stores approval and updates demo financial totals.

A repeated request with same logical approval should not double-add the price difference.

---

## POST `/api/v1/orders/:orderId/price-adjustment/reject`

Customer owner only.

Moves the flow into cancellation/admin path as defined by payment/order rules.

No food should be purchased after rejected higher price in the normal flow.

---

# 25. Pickup API

## POST `/api/v1/orders/:orderId/pickup`

Assigned partner only.

Allowed only when:

- assignment is active,
- actual bill is resolved,
- required higher-price approval exists,
- order is in a valid pre-pickup state.

Transition:

```text
PARTNER_TO_PICKUP / PRICE_RESOLVED
          ↓
PICKED_UP
          ↓
OUT_FOR_DELIVERY
```

Backend records timestamp.

After this point, normal customer self-cancellation is disabled.

---

# 26. Customer Cancellation API

## POST `/api/v1/orders/:orderId/cancel`

Customer owner only.

Request may include:

```json
{
  "reason": "Changed my mind"
}
```

Allowed only according to state machine.

Early cancellation may be allowed from states such as:

```text
DRAFT
PAYMENT_PENDING
MATCHING
ASSIGNED
PARTNER_TO_PICKUP
PRICE_CONFIRMATION_REQUIRED
```

provided purchase has not occurred.

After `PICKED_UP`:

```text
403/409 SELF_SERVICE_CANCELLATION_NOT_ALLOWED
```

and UI should direct user to admin/support.

The service must handle a race between customer cancellation and partner acceptance using atomic state checks/transactions.

---

# 27. Partner Cancellation API

## POST `/api/v1/orders/:orderId/partner-cancel`

Assigned partner only.

Before purchase:

```text
ASSIGNED/PARTNER_TO_PICKUP
        ↓
assignment released
        ↓
REMATCHING/MATCHING
```

After pickup:

```text
ADMIN_REVIEW_REQUIRED
```

Backend must not simply clear `assignedPartnerId` after food purchase.

---

# 28. Delivery OTP API

Delivery OTP is separate from phone verification OTP.

## POST `/api/v1/orders/:orderId/delivery-otp/request`

Customer owner only.

Creates a short-lived handoff OTP when the order is ready for delivery verification.

Response for prototype may return the raw code to the customer's authenticated UI if no SMS delivery is configured.

Backend stores only the hash.

Rules:

- rate limit regeneration,
- expire old code when regenerated,
- record attempt count,
- only valid for the active order/customer.

---

## POST `/api/v1/orders/:orderId/delivery-otp/verify`

Assigned partner only.

Request:

```json
{
  "otp": "123456"
}
```

On correct OTP:

```text
DELIVERY_OTP_REQUIRED
       ↓
DELIVERED
       ↓
COMPLETED
```

Completion transaction should also create/confirm exactly one demo partner earning/ledger outcome.

Headers may include:

```text
Idempotency-Key
```

Rules:

- incorrect OTP does not complete order,
- expired OTP rejected,
- completed order cannot consume OTP again,
- repeated successful completion cannot duplicate earning.

Possible errors:

```text
DELIVERY_OTP_INVALID
DELIVERY_OTP_EXPIRED
DELIVERY_OTP_TOO_MANY_ATTEMPTS
ORDER_ALREADY_COMPLETED
```

---

# 29. Rating API

## POST `/api/v1/orders/:orderId/rating`

Customer owner only, after completed order.

Request:

```json
{
  "rating": 5,
  "feedback": "Fast delivery"
}
```

Rules:

- rating integer 1–5,
- one customer rating per order,
- cannot rate before completion,
- partner summary can be recalculated safely.

---

# 30. Partner Earnings API

## GET `/api/v1/partner/earnings`

Approved partner only.

Returns demo ledger/earning history.

Example:

```json
{
  "success": true,
  "data": {
    "summary": {
      "confirmedPaise": 12000,
      "demoSettledPaise": 12000
    },
    "entries": []
  }
}
```

The API must clearly label prototype/demo settlement.

Do not imply real bank payout.

---

# 31. Admin Partner Verification API

All routes require `requireAdmin`.

## GET `/api/v1/admin/partners`

Filters may include:

```text
verificationStatus=PENDING_VERIFICATION
```

---

## GET `/api/v1/admin/partners/:partnerId`

Returns application details and protected document access/reference.

---

## POST `/api/v1/admin/partners/:partnerId/approve`

Transition:

```text
PENDING_VERIFICATION → APPROVED
```

Must record admin user/time.

---

## POST `/api/v1/admin/partners/:partnerId/reject`

Request may include reason.

Transition:

```text
PENDING_VERIFICATION → REJECTED
```

---

# 32. Admin Order API

## GET `/api/v1/admin/orders`

Supports filters such as:

```text
status
customerId
partnerId
createdFrom
createdTo
```

Keep prototype filtering simple.

---

## GET `/api/v1/admin/orders/:orderId`

Returns operational order timeline including:

- customer,
- assigned partner,
- state,
- payment demo state,
- estimated/actual bill,
- receipt metadata,
- offers/matching summary,
- timestamps,
- admin review state.

---

## POST `/api/v1/admin/orders/:orderId/review`

Creates/marks admin-review status for exceptional prototype cases.

Do not expose a generic endpoint that lets an admin set any arbitrary status string.

Admin actions should still be explicit and auditable.

---

## POST `/api/v1/admin/orders/:orderId/resolve`

Prototype-only manual resolution endpoint.

Request should use a small allowed enum such as:

```text
CANCEL_AND_DEMO_REFUND
MARK_FAILED
MARK_RESOLVED_NO_FINANCIAL_CHANGE
```

Exact allowed actions may be reduced during implementation.

Every manual resolution records:

```text
adminId
reason
action
timestamp
```

---

# 33. Health Endpoint

## GET `/api/v1/health`

Returns minimal service health.

Example:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

Do not expose secrets or detailed infrastructure metadata.

A separate readiness check may verify MongoDB connectivity if deployment needs it.

---

# 34. Socket.IO Authentication

Socket.IO connects to the same Node server.

Authentication should use the same user session/cookie when possible.

On socket connection:

1. read/verify auth cookie,
2. reject unauthenticated connection where appropriate,
3. attach safe `userId`/role to socket,
4. join authorized rooms.

Never trust a client-provided `userId` without server verification.

---

# 35. Socket Rooms

Useful room patterns:

```text
user:<userId>
partner:<partnerId>
order:<orderId>
admin
```

A client may join `order:<id>` only if it is authorized to view that order.

Do not allow arbitrary client-selected room membership without authorization.

---

# 36. Server → Client Socket Events

Recommended events:

```text
offer:new
offer:expired
order:updated
order:matching-failed
order:assigned
price:confirmation-required
price:updated
payment:updated
partner:location-updated
delivery:otp-required
order:completed
admin:review-required
```

Payloads should be small.

Example:

```json
{
  "orderId": "...",
  "status": "ASSIGNED",
  "updatedAt": "2026-08-24T10:15:00.000Z"
}
```

When the client receives an important event, it may refetch the relevant REST resource.

This is safer than making the event itself the only source of full order state.

---

# 37. Client → Server Socket Events

Keep client-originated socket commands limited.

Recommended prototype use:

```text
partner:location
```

Example payload:

```json
{
  "orderId": "...",
  "latitude": 25.43,
  "longitude": 81.78,
  "accuracyMeters": 15,
  "clientTimestamp": "2026-08-24T10:20:00.000Z"
}
```

Server validates:

- authenticated approved partner,
- partner is assigned/active where orderId supplied,
- coordinate range,
- reasonable payload size,
- rate/frequency.

Server may persist only the latest operational location rather than permanent GPS history.

Do **not** perform critical state transitions such as:

```text
accept order
complete order
approve price
cancel order
```

only through Socket.IO.

Those remain REST commands.

---

# 38. Socket Acknowledgements

For client-originated socket events, use acknowledgements for validation failures where useful.

Example:

```json
{
  "ok": false,
  "code": "LOCATION_UPDATE_NOT_ALLOWED"
}
```

However, losing a location socket packet must not corrupt order state.

---

# 39. Reconnection Behavior

On Socket.IO reconnect:

```text
reconnect
   ↓
GET current order/partner state through REST
   ↓
rejoin authorized rooms
```

Do not attempt to reconstruct business truth solely from missed socket events.

---

# 40. Matching API Boundary

The matching engine is an internal service module, not a public API clients can manipulate directly.

Clients should not be able to submit:

```text
candidate rank
eligibility result
predicted detour
winning partner
```

The backend computes these using MongoDB + Google Maps.

The frontend only receives safe result data needed for UI.

---

# 41. Google Maps API Boundary

The browser may use a restricted frontend Google Maps key for interactive maps/place UI where necessary.

Sensitive server-side route/matrix operations should be called from the backend when they affect matching decisions.

A customer must not be able to tell the backend:

```json
{
  "etaMinutes": 3,
  "detourMinutes": 0
}
```

and have those values trusted.

Server obtains authoritative route estimates from Google or computes them from trusted backend logic.

---

# 42. Cloudinary API Boundary

Cloudinary secret/API credentials remain backend-only.

Clients work with RouteBite asset IDs/reference metadata.

Sensitive assets such as college ID should not be exposed via permanently public URLs.

---

# 43. Rate Limiting

At minimum rate-limit:

```text
login attempts
phone OTP request
phone OTP verification
delivery OTP verification
payment creation
upload endpoint
location update abuse
```

The prototype can use a simple in-process Express rate limiter initially.

Do not make correctness depend on the rate limiter being perfectly distributed across multiple servers because V1 uses one server instance.

---

# 44. CORS and Same-Origin Policy

Preferred production shape:

```text
same origin for React + API + Socket.IO
```

This greatly reduces CORS complexity.

During Vite local development, use a proxy to Express where practical.

If CORS is required locally, allow only explicit development origins rather than `*` with credentials.

---

# 45. CSRF Consideration

Because authentication uses cookies, state-changing endpoints should be designed with CSRF protection in mind.

SameSite cookies reduce risk but are not a substitute for thinking about CSRF.

For the prototype, use:

- `SameSite=Lax` or stricter where compatible,
- same-origin production deployment,
- reject unexpected origins for sensitive requests where practical,
- consider CSRF token middleware if deployment behavior requires cross-site requests.

---

# 46. Sensitive Data Rules

API responses must not expose:

- password hashes,
- OTP hashes,
- JWT secrets,
- Razorpay secret/signing key,
- Cloudinary secret,
- full protected identity documents to normal users,
- other customers' phone/email unnecessarily.

Partner offer payload before assignment should contain only information necessary to decide whether to accept.

After assignment, expose only delivery-relevant information.

---

# 47. State Transition Ownership

All order state transitions must go through centralized service functions.

Example:

```text
orderService.acceptOffer()
orderService.confirmActualBill()
orderService.approvePriceChange()
orderService.markPickedUp()
orderService.cancelOrder()
orderService.verifyDeliveryOtp()
```

Do not allow controllers to directly write arbitrary status values.

Bad:

```js
order.status = req.body.status;
await order.save();
```

Correct:

```text
controller validates request
      ↓
service checks allowed transition
      ↓
MongoDB conditional update/transaction
```

---

# 48. Important Atomic Filters

Critical MongoDB writes should include the expected current state in the filter.

Conceptual example for order assignment:

```js
findOneAndUpdate(
  {
    _id: orderId,
    status: "MATCHING",
    assignedPartnerId: null
  },
  {
    $set: {
      status: "ASSIGNED",
      assignedPartnerId: partnerId
    }
  }
)
```

If another request changed the order first, the update returns no match and the API responds with a conflict rather than overwriting the newer state.

Use a transaction when several documents must change together.

---

# 49. Background Job/API Relationship

Background expiry scans may mark expired offers, price confirmations, OTPs, etc.

However API endpoints must always check deadlines themselves.

Example:

```text
Offer expires 12:00:20
Background job delayed until 12:00:30
Partner tries accept at 12:00:25
```

The accept API sees:

```text
expiresAt <= now
```

and rejects immediately.

Correctness therefore does not depend on timer precision.

---

# 50. Pagination Rules

List endpoints should use bounded pagination.

Prototype defaults:

```text
page = 1
limit = 20
max limit = 100
```

Examples:

```text
GET /api/v1/orders?page=1&limit=20
GET /api/v1/admin/orders?status=FAILED&page=1
```

Do not return every order/partner in one unbounded response.

---

# 51. Query Filtering Rules

Only allow documented query parameters.

Do not directly spread arbitrary query strings into Mongoose filters.

Bad:

```js
Order.find(req.query)
```

This can create security and correctness problems.

Build explicit filters server-side.

---

# 52. API Error Code Catalogue

Initial useful codes:

```text
AUTH_REQUIRED
INVALID_CREDENTIALS
FORBIDDEN
VALIDATION_ERROR
RESOURCE_NOT_FOUND
RATE_LIMITED

PHONE_OTP_INVALID
PHONE_OTP_EXPIRED

PARTNER_NOT_APPROVED
PARTNER_BUSY
LOCATION_STALE

ORDER_INVALID_STATE
ORDER_ALREADY_ASSIGNED
ORDER_ALREADY_COMPLETED
ORDER_CANNOT_CANCEL
MATCHING_FAILED

OFFER_EXPIRED
OFFER_ALREADY_RESOLVED

PAYMENT_NOT_CONFIRMED
PAYMENT_ALREADY_CONFIRMED
PAYMENT_VERIFICATION_FAILED

PRICE_APPROVAL_REQUIRED
PRICE_APPROVAL_EXPIRED

DELIVERY_OTP_INVALID
DELIVERY_OTP_EXPIRED
DELIVERY_OTP_TOO_MANY_ATTEMPTS

MAPS_TEMPORARILY_UNAVAILABLE
UPLOAD_FAILED
EXTERNAL_PROVIDER_ERROR
```

Keep codes centralized.

Do not invent slightly different strings in every controller.

---

# 53. Endpoint Summary

```text
AUTH
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
POST   /api/v1/auth/phone-otp/request
POST   /api/v1/auth/phone-otp/verify

UPLOADS
POST   /api/v1/uploads

PARTNER
POST   /api/v1/partner/apply
GET    /api/v1/partner/profile
PATCH  /api/v1/partner/availability
PUT    /api/v1/partner/location
GET    /api/v1/partner/offers
GET    /api/v1/partner/offers/:offerId
POST   /api/v1/partner/offers/:offerId/accept
POST   /api/v1/partner/offers/:offerId/reject
GET    /api/v1/partner/earnings

TRIPS
POST   /api/v1/partner/trips
GET    /api/v1/partner/trips
GET    /api/v1/partner/trips/:tripId
POST   /api/v1/partner/trips/:tripId/start
POST   /api/v1/partner/trips/:tripId/cancel

ORDERS
POST   /api/v1/orders
GET    /api/v1/orders
GET    /api/v1/orders/:orderId
PATCH  /api/v1/orders/:orderId
GET    /api/v1/orders/:orderId/estimate
POST   /api/v1/orders/:orderId/payment
POST   /api/v1/orders/:orderId/payment/verify
POST   /api/v1/orders/:orderId/rematch
POST   /api/v1/orders/:orderId/heading-to-pickup
POST   /api/v1/orders/:orderId/actual-bill
POST   /api/v1/orders/:orderId/price-adjustment/approve
POST   /api/v1/orders/:orderId/price-adjustment/reject
POST   /api/v1/orders/:orderId/pickup
POST   /api/v1/orders/:orderId/cancel
POST   /api/v1/orders/:orderId/partner-cancel
POST   /api/v1/orders/:orderId/delivery-otp/request
POST   /api/v1/orders/:orderId/delivery-otp/verify
POST   /api/v1/orders/:orderId/rating

ADMIN
GET    /api/v1/admin/partners
GET    /api/v1/admin/partners/:partnerId
POST   /api/v1/admin/partners/:partnerId/approve
POST   /api/v1/admin/partners/:partnerId/reject
GET    /api/v1/admin/orders
GET    /api/v1/admin/orders/:orderId
POST   /api/v1/admin/orders/:orderId/review
POST   /api/v1/admin/orders/:orderId/resolve

PROVIDER
POST   /api/v1/webhooks/razorpay

SYSTEM
GET    /api/v1/health
```

Implementation may remove an endpoint when its state transition is fully automatic, but it should not add generic state-changing endpoints that bypass domain rules.

---

# 54. Critical API Tests Before Demo

At minimum, automate tests for:

```text
register/login/logout
unauthenticated protected route
normal user blocked from admin route
pending partner blocked from offers
approved partner can go online
invalid coordinates rejected
order creation
payment failure does not start matching
payment success starts matching
expired offer cannot be accepted
two simultaneous offer accepts → exactly one winner
partner with active incompatible order cannot win second order
customer cancellation vs acceptance race
higher bill requires customer approval
pickup blocked before price approval
customer cannot self-cancel after pickup
wrong delivery OTP rejected
correct OTP completes order
duplicate completion does not duplicate earning
duplicate Razorpay webhook is harmless
socket disconnect does not lose order truth
```

These are higher priority than broad cosmetic UI tests.

---

# 55. API Implementation Order

Build APIs vertically around working user flows.

Recommended order:

```text
1. auth + current user
2. partner application + admin approval
3. partner availability/location
4. trip creation
5. customer order creation
6. estimate + Razorpay test payment
7. matching + offers
8. atomic offer acceptance
9. pickup / actual price flow
10. active tracking
11. delivery OTP + completion
12. earnings
13. cancellation/rematching
14. admin exceptional handling
```

Do not implement every GET endpoint first and postpone the difficult state transitions.

The objective is an end-to-end vertical slice as early as possible.

---

# 56. Contract Change Rule

When implementation reveals an API contract problem:

1. do not silently change the endpoint behavior only in code,
2. update this document,
3. update `DATABASE_DESIGN.md` if persistence/invariants change,
4. update `ARCHITECTURE.md` if communication boundaries change,
5. update `USER_FLOWS.md` / `PRODUCT_REQUIREMENTS.md` if user-visible behavior changes,
6. add/update an ADR when the decision is significant.

The API should remain understandable enough that a new engineer can implement the frontend without reading backend source code first.
