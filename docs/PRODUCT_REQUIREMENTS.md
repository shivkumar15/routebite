# RouteBite — Product Requirements

> **Status:** Prototype PRD
>
> This document converts `PROJECT_CONTEXT.md`, `DECISIONS.md`, and `USER_FLOWS.md` into concrete product requirements for the first working RouteBite prototype.
>
> The prototype is intended to prove the core product loop for presentation and validation. It is **not** a production commercial launch.

---

# 1. Product Goal

Build a working RouteBite prototype that demonstrates this core promise:

> A customer can request food from a local place that may not be registered on a delivery platform, and RouteBite can match that request with either a nearby delivery partner or a traveller already moving in a compatible direction.

The prototype must demonstrate the complete loop:

```text
Customer request
      ↓
Pickup + drop + time
      ↓
Test payment
      ↓
Automatic matching
      ↓
Partner accepts
      ↓
Pickup
      ↓
Price confirmation if needed
      ↓
Live delivery progress
      ↓
OTP handoff
      ↓
Order completed
      ↓
Demo earning recorded
```

---

# 2. Prototype Success Definition

The prototype is considered functionally successful when a presenter can complete at least one realistic end-to-end scenario without manually changing database records.

Required demonstration scenario:

1. Customer signs in.
2. Customer requests food from a known or manually pinned local vendor.
3. Customer selects a delivery destination.
4. Customer chooses `ASAP` or a scheduled delivery window.
5. Customer sees estimated food, delivery, and platform cost.
6. Customer completes test-mode checkout.
7. RouteBite starts automatic matching.
8. An approved partner receives the offer.
9. Partner accepts.
10. Partner moves through pickup states.
11. If actual food cost changes, customer can approve the new amount.
12. Partner marks food as picked up.
13. Customer can see active delivery progress/location.
14. Customer provides delivery OTP.
15. Order becomes completed.
16. Partner sees demo earning recorded.
17. Customer can submit a rating.

The prototype should also visibly handle at least these failure cases:

- no partner found,
- partner rejects/ignores an offer,
- customer cancels before pickup,
- price changes,
- incorrect delivery OTP.

---

# 3. Scope Priority

Requirements are classified as:

- **P0 — Must Have:** prototype is incomplete without it.
- **P1 — Should Have:** strongly improves the demonstration but can be simplified if time is limited.
- **P2 — Later:** valuable but must not block the first working prototype.

The implementation should finish **P0 end-to-end before spending significant time on P1/P2 polish**.

---

# 4. User Model

## PR-USER-001 — One core account

**Priority:** P0

A person should have one RouteBite user account.

A normal account can place customer orders.

The same account may additionally acquire partner capability after partner registration and approval.

Conceptually:

```text
USER
 ├── Customer capability
 │
 └── Optional Partner Profile
          ↓
      PENDING / APPROVED / REJECTED
```

### Acceptance Criteria

- User can sign in using one identity.
- A user does not need a second account to become a partner.
- Only an approved partner profile can activate delivery modes or receive offers.

---

## PR-USER-002 — Prototype application model

**Priority:** P0

The prototype will use **one role-aware web application**, rather than building separate customer and partner applications.

Navigation and available actions change based on the user's capabilities and current activity.

Possible primary areas:

```text
Home / Order Food
My Orders
Earn with RouteBite / Partner
Partner Activity
Profile
```

Admins may use a protected admin section within the same codebase/application for the prototype.

---

# 5. Authentication and Basic Account Requirements

## PR-AUTH-001 — Sign up / sign in

**Priority:** P0

The user must be able to create and access an account.

Minimum account data:

- name,
- phone number,
- verified phone status,
- profile information required by the prototype.

### Acceptance Criteria

- New user can complete registration.
- Existing user can sign in.
- Protected customer/partner/admin routes are not usable without authentication.
- Authentication errors are shown clearly.

---

## PR-AUTH-002 — Phone verification

**Priority:** P0

The prototype must represent phone verification through OTP.

If a real SMS provider is not configured during local development, a clearly labelled development/test OTP mechanism may be used, but the product flow must remain OTP-based.

### Acceptance Criteria

- User requests OTP.
- OTP has an expiry/validity rule.
- Incorrect OTP is rejected.
- Successful OTP marks the phone as verified.

---

# 6. Partner Registration and Verification

## PR-PARTNER-001 — Apply to become a partner

**Priority:** P0

A signed-in user can choose an action such as:

> `Earn with RouteBite`

and create a partner profile.

Prototype partner information should include:

- full name,
- verified phone,
- profile photo,
- college identity/enrollment information,
- college ID upload where applicable,
- optional basic vehicle/travel information if needed by the UI.

The prototype must **not** claim this process is government-backed KYC.

---

## PR-PARTNER-002 — Partner verification state

**Priority:** P0

Partner profile states:

```text
NOT_APPLIED
    ↓
PENDING_VERIFICATION
    ↓
APPROVED
```

Alternative terminal/review state:

```text
REJECTED
```

### Acceptance Criteria

- Newly submitted partner application becomes `PENDING_VERIFICATION`.
- Pending partner cannot receive delivery offers.
- Admin can approve or reject.
- Approved partner gains partner functionality.
- Rejected partner sees a clear status.

---

## PR-PARTNER-003 — Verification badge

**Priority:** P1

Approved campus prototype partners may show a label such as:

> `Campus Partner Verified`

The application must not display `Government Verified`, `Aadhaar Verified`, or similar unsupported claims.

---

# 7. Customer — Create Food Request

## PR-ORDER-001 — Start an order

**Priority:** P0

Customer can start a new food request from the main experience.

Required information:

- requested food/items,
- vendor/display name,
- pickup location,
- delivery location,
- delivery timing preference,
- estimated food cost,
- optional pickup instructions.

---

## PR-ORDER-002 — Vendor/place search

**Priority:** P0

Customer can search for a known pickup place using the configured mapping/place provider.

Search result should provide enough information to establish pickup coordinates.

### Acceptance Criteria

- User can type vendor/place text.
- Matching search results can be selected.
- Selecting a result stores/displays its pickup location.

---

## PR-ORDER-003 — Manual pickup pin

**Priority:** P0

If a vendor cannot be found, the customer must be able to manually select/drop the pickup location on the map.

Customer should also be able to enter identifying instructions such as:

```text
Vendor: Verma Chaat
Landmark: Opposite Hanuman Mandir, red cart
```

### Acceptance Criteria

- Order creation does not depend on vendor existence in RouteBite's database.
- A valid manual pickup coordinate can be submitted.
- Vendor/display name and instructions are preserved for the partner.

---

## PR-ORDER-004 — Delivery location

**Priority:** P0

Customer can select/search/drop the delivery location.

The system stores delivery coordinates and human-readable location text where available.

---

## PR-ORDER-005 — Requested items

**Priority:** P0

Because vendors may not have RouteBite menus, customer must be able to describe what should be purchased using free-form item information.

Example:

```text
2 Pav Bhaji
1 extra butter
No onion
```

Structured catalogue/menu functionality is not required for the prototype.

---

# 8. Delivery Timing

## PR-TIME-001 — ASAP order

**Priority:** P0

Customer can select:

> `ASAP`

Initial configurable prototype hypothesis:

```text
MAX_ASAP_DELIVERY_MINUTES = 45
```

The UI does not need to expose the configuration constant. It may show an estimated/expected delivery range.

---

## PR-TIME-002 — Scheduled order

**Priority:** P0

Customer can select:

> `Schedule for Later`

and choose a future delivery time/window.

For the prototype, time windows are preferred over unrealistic second-level precision.

Example:

```text
6:00 PM – 6:30 PM
```

### Acceptance Criteria

- Scheduled time must be in the future.
- Matching must not treat a future scheduled order as an immediate ASAP request.
- A compatible `TRIP_SCHEDULED` partner can become eligible for a scheduled order.

---

# 9. Price Estimate and Prototype Payment

## PR-PAY-001 — Price estimate

**Priority:** P0

Before checkout, customer sees an estimated breakdown.

Prototype model:

```text
Estimated food cost     customer-entered
Delivery earning/fee    configurable
Platform fee            configurable
----------------------------------------
Estimated total
```

Initial illustrative configuration may use:

```text
DEFAULT_PARTNER_EARNING = ₹40
DEFAULT_PLATFORM_FEE = ₹10
```

These values must be configurable and must not be treated as validated unit economics.

---

## PR-PAY-002 — Test payment before matching

**Priority:** P0

Customer completes **Razorpay Test Mode** checkout before the order enters partner matching.

Expected flow:

```text
DRAFT
  ↓
PAYMENT_PENDING
  ↓
TEST_PAYMENT_SUCCESS
  ↓
MATCHING
```

If payment fails/cancels:

```text
PAYMENT_FAILED / remain retryable
```

### Acceptance Criteria

- Matching does not start for an unpaid prototype order.
- Successful test checkout is recorded.
- Failed/cancelled checkout can be retried.
- No real payout/settlement is required.

---

## PR-PAY-003 — Demo ledger

**Priority:** P0

The system must maintain enough internal records to demonstrate financial flow without moving real money.

For each completed prototype order, the system can show values such as:

```text
Food reimbursement
Partner earning
Platform fee
Total customer amount
```

Partner earning can become `DEMO_SETTLED` after successful completion.

---

# 10. Automatic Matching

## PR-MATCH-001 — Matching starts automatically

**Priority:** P0

After successful test payment, the order should enter automatic matching.

The customer should not manually browse a list of travellers as the primary order flow.

---

## PR-MATCH-002 — Hard eligibility

**Priority:** P0

A partner must pass eligibility before ranking.

Eligibility should consider, as applicable:

- approved partner status,
- partner availability state,
- current/scheduled timing,
- pickup reachability,
- delivery time window,
- route/direction compatibility for on-my-way trips,
- current trip progress,
- acceptable detour,
- partner not already committed to an incompatible active order.

Detailed matching logic belongs in `MATCHING_ENGINE.md`.

---

## PR-MATCH-003 — Candidate ranking

**Priority:** P0

Eligible candidates are ranked using deterministic logic.

Initial factors may include:

1. ability to satisfy delivery window,
2. predicted delivery ETA,
3. additional detour,
4. partner reliability/completion history when available,
5. rating when available,
6. delivery economics.

No ML ranking is required.

---

## PR-MATCH-004 — Batched offers

**Priority:** P0

Do not notify all partners simultaneously.

Initial configurable hypothesis:

```text
OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20
```

Conceptual flow:

```text
Top candidate batch
      ↓
wait for acceptance
      ↓
no acceptance
      ↓
next candidates
      ↓
optional broaden/fallback
```

---

## PR-MATCH-005 — Atomic assignment

**Priority:** P0

If two partners attempt to accept the same order, exactly one may win.

### Acceptance Criteria

- First valid atomic acceptance assigns the order.
- Subsequent acceptance attempts fail cleanly with `order already assigned` behavior.
- Customer never sees two assigned partners.

---

## PR-MATCH-006 — Matching failure

**Priority:** P0

If no partner is found/accepts within the prototype fallback process, the system must stop indefinite searching.

Customer sees a clear state such as:

> `No suitable partner is available right now.`

Customer options may include:

- try again,
- schedule for later,
- cancel order.

A `Notify me when available` feature is P2 unless it is trivial to implement.

---

# 11. Partner — Available Now Mode

## PR-AVAILABLE-001 — Go online

**Priority:** P0

Approved partner can choose:

> `Available to Deliver`

This sets the partner into an immediate availability state.

Conceptual status:

```text
OFFLINE → AVAILABLE_NOW
```

### Acceptance Criteria

- Non-approved partner cannot enter `AVAILABLE_NOW`.
- Partner location permission/current location is required for meaningful matching.
- Partner can return to `OFFLINE` when not handling an active assignment.

---

## PR-AVAILABLE-002 — Current location updates

**Priority:** P0

While `AVAILABLE_NOW`, the client should periodically provide sufficiently recent location data for prototype matching.

High-frequency second-by-second Google route API calls are not required.

---

# 12. Partner — On My Way / Scheduled Trip

## PR-TRIP-001 — Create planned trip

**Priority:** P0

Approved partner can create a future/on-my-way trip with:

- origin,
- destination,
- scheduled departure time,
- departure flexibility.

Initial default hypothesis:

```text
DEFAULT_DEPARTURE_FLEX_MINUTES = 15
```

Example UI choices may be:

```text
±10 min
±15 min
±30 min
```

---

## PR-TRIP-002 — Scheduled trip is not immediate availability

**Priority:** P0

Creating a future trip must set:

```text
TRIP_SCHEDULED
```

not `AVAILABLE_NOW`.

A traveller leaving at 6 PM must not receive an ASAP 4:15 PM request that cannot satisfy the customer's time window.

---

## PR-TRIP-003 — Start trip

**Priority:** P0

When the partner actually begins travelling:

```text
TRIP_SCHEDULED → TRIP_ACTIVE
```

The system should then rely more heavily on current location and trip progress than the originally scheduled time.

---

## PR-TRIP-004 — End/cancel trip

**Priority:** P0

Partner can cancel a scheduled trip before it starts, subject to any assigned-order constraints.

An active trip should eventually end when destination/activity is completed.

Prototype exact trip-history polish is P1.

---

# 13. Partner Delivery Offer

## PR-OFFER-001 — Offer information

**Priority:** P0

Partner must see enough information to make an acceptance decision.

At minimum:

- pickup/vendor display name,
- approximate pickup location,
- drop area/location,
- requested delivery timing,
- expected earning,
- estimated trip/detour information when available,
- offer expiry countdown/state.

Sensitive/unnecessary customer information should not be exposed before assignment.

---

## PR-OFFER-002 — Accept / reject

**Priority:** P0

Partner can:

- accept,
- reject,
- ignore until offer expires.

Rejection/expiry should allow matching to continue to other candidates.

---

# 14. Assigned Order and Pickup

## PR-PICKUP-001 — Assigned order details

**Priority:** P0

After acceptance, both sides should see the assignment.

Customer sees relevant partner information such as:

- name/profile,
- verification indicator,
- rating when available,
- current order status,
- ETA/location when active tracking begins.

Partner sees:

- exact pickup details,
- vendor name/instructions,
- requested food,
- customer delivery location,
- communication option if implemented.

---

## PR-PICKUP-002 — Partner moves toward pickup

**Priority:** P0

Order status should communicate that the partner is travelling to the pickup location.

Suggested state:

```text
PARTNER_TO_PICKUP
```

---

## PR-PICKUP-003 — Actual bill entry

**Priority:** P0

At/after purchase, partner can enter actual food bill amount.

Partner should be able to upload receipt/purchase proof for the prototype where available.

---

# 15. Price Difference Flow

## PR-PRICE-001 — No meaningful price change

**Priority:** P0

If actual price matches the estimate or falls within whatever prototype rule is configured, order can proceed to pickup confirmation without unnecessary customer interaction.

The exact tolerance can initially be zero for implementation simplicity unless changed in `PAYMENT_FLOW.md`.

---

## PR-PRICE-002 — Price confirmation required

**Priority:** P0

If actual food price differs from the estimate in a way requiring approval:

```text
ASSIGNED / PURCHASE_STAGE
        ↓
PRICE_CONFIRMATION_REQUIRED
```

Customer sees:

- estimated amount,
- actual amount,
- difference,
- receipt/proof when available,
- approve action,
- contact/support action if needed.

### Acceptance Criteria

- Partner cannot silently increase the bill.
- Customer approval is recorded.
- Prototype demo ledger updates after approval.
- Rejection/disagreement can move to admin handling rather than requiring production refund logic.

---

# 16. Pickup Confirmation

## PR-PICKUP-004 — Mark food picked up

**Priority:** P0

Once purchase/price confirmation is resolved, partner can mark the food as picked up.

State transition:

```text
PARTNER_TO_PICKUP
      ↓
PICKED_UP
      ↓
OUT_FOR_DELIVERY
```

After `PICKED_UP`, unrestricted customer cancellation is no longer allowed in the prototype.

---

# 17. Active Delivery and Tracking

## PR-TRACK-001 — Foreground location tracking

**Priority:** P0

During an active delivery, the partner client sends foreground location updates periodically.

Initial prototype target:

```text
approximately every 10–15 seconds
```

This is an implementation hypothesis, not a permanent SLA.

---

## PR-TRACK-002 — Customer tracking view

**Priority:** P0

During active delivery, customer can see:

- current order state,
- partner location on map when available,
- delivery destination,
- approximate ETA when available.

Full production-grade background GPS tracking is not required for the web prototype.

---

## PR-TRACK-003 — Stop tracking

**Priority:** P0

Active order tracking should stop after order completion/cancellation/failure when no further tracking is required.

---

# 18. Delivery Completion

## PR-DELIVERY-001 — Delivery OTP

**Priority:** P0

A delivery verification OTP/equivalent code must be required before successful handoff completion.

### Acceptance Criteria

- OTP is associated with the order/customer.
- Incorrect OTP does not complete the order.
- Correct OTP moves the order to delivered/completed flow.
- OTP verification cannot be repeatedly reused after completion.

---

## PR-DELIVERY-002 — Complete order

**Priority:** P0

Successful handoff should result in a terminal successful state.

Conceptually:

```text
OUT_FOR_DELIVERY
      ↓
DELIVERY_OTP_REQUIRED
      ↓
DELIVERED
      ↓
COMPLETED
```

Prototype ledger records partner earning as completed/demo-settled according to the demo payment flow.

---

# 19. Ratings

## PR-RATING-001 — Customer rates partner

**Priority:** P1

After completion, customer can rate the partner.

Prototype minimum:

- 1–5 rating,
- optional short feedback.

Rating affects displayed history/reputation but does not need sophisticated fraud weighting or ML ranking.

---

# 20. Cancellation and Recovery

## PR-CANCEL-001 — Customer cancellation before purchase

**Priority:** P0

Customer may cancel while the order is in early states such as:

```text
DRAFT
PAYMENT_PENDING
MATCHING
ASSIGNED
PARTNER_TO_PICKUP
```

provided food has not yet been purchased/picked up.

Exact demo-ledger reversal behavior will be defined in `PAYMENT_FLOW.md`.

---

## PR-CANCEL-002 — Cancellation after purchase

**Priority:** P0

After `PICKED_UP`, the customer should not have a normal one-tap cancellation path.

The UI should direct the case to admin/support handling.

---

## PR-CANCEL-003 — Partner cancellation before purchase

**Priority:** P0

If assigned partner cancels before purchase, the order should return to matching when still feasible.

Conceptually:

```text
ASSIGNED
   ↓ partner cancels
MATCHING
```

Customer should be informed that RouteBite is searching for another partner.

---

## PR-CANCEL-004 — Partner cancellation after purchase

**Priority:** P0

If a partner cannot complete an order after purchase, mark the order as requiring admin intervention.

Production liability/refund automation is not required.

---

# 21. Notifications and Real-Time UX

## PR-NOTIFY-001 — In-app status updates

**Priority:** P0

The prototype must visibly update customers/partners when important order events occur.

Examples:

Customer:

- payment successful,
- finding a partner,
- partner assigned,
- partner heading to pickup,
- price confirmation requested,
- food picked up,
- partner arriving,
- delivered/completed,
- matching failed.

Partner:

- new offer,
- offer expired,
- order assigned,
- customer approved price difference,
- order cancelled,
- demo earning recorded.

The exact real-time transport technology is an architecture decision, not a PRD decision.

---

## PR-NOTIFY-002 — External notifications

**Priority:** P2

WhatsApp, email, full SMS status updates, and production push notifications are not required for the first prototype.

Phone OTP remains required where part of authentication/delivery verification.

---

# 22. Admin Requirements

## PR-ADMIN-001 — Admin access

**Priority:** P0

The prototype must have a protected admin role/area.

Normal users must not be able to access admin actions.

---

## PR-ADMIN-002 — Partner verification queue

**Priority:** P0

Admin can view pending partner applications and inspect submitted prototype verification information.

Admin actions:

- approve,
- reject.

---

## PR-ADMIN-003 — Order operations

**Priority:** P0

Admin can view orders with at least:

- order ID,
- customer,
- assigned partner if any,
- pickup/drop,
- current state,
- estimated/actual bill,
- payment demo state,
- timestamps,
- receipt/proof where uploaded.

---

## PR-ADMIN-004 — Manual intervention

**Priority:** P0

Admin can handle prototype exceptional cases such as:

- cancellation after pickup,
- partner cancellation after purchase,
- price disagreement,
- failed delivery,
- basic dispute flagging,
- manually marking a prototype issue resolved where appropriate.

The admin tool must not pretend to provide production-grade automated dispute resolution.

---

# 23. Order State Machine Requirements

## PR-STATE-001 — Core order states

**Priority:** P0

The implementation should support a coherent state machine rather than arbitrary status strings.

Recommended prototype states:

```text
DRAFT
  ↓
PAYMENT_PENDING
  ↓
TEST_PAYMENT_SUCCESS
  ↓
MATCHING
  ↓
ASSIGNED
  ↓
PARTNER_TO_PICKUP
  ↓
[PRICE_CONFIRMATION_REQUIRED]
  ↓
PICKED_UP
  ↓
OUT_FOR_DELIVERY
  ↓
DELIVERY_OTP_REQUIRED
  ↓
DELIVERED
  ↓
COMPLETED
```

Failure/terminal/support states may include:

```text
PAYMENT_FAILED
MATCHING_FAILED
CANCELLED
FAILED
ADMIN_REVIEW_REQUIRED
```

`PRICE_CONFIRMATION_REQUIRED` is conditional.

---

## PR-STATE-002 — State transition validation

**Priority:** P0

Backend must reject obviously invalid state transitions.

Examples:

- cannot mark `PICKED_UP` before assignment,
- cannot complete order without delivery verification,
- cannot assign a second partner after successful assignment,
- cannot normally cancel a completed order,
- cannot start matching before successful prototype payment.

---

# 24. Partner Availability / Trip States

## PR-STATE-003 — Partner availability

**Priority:** P0

Partner availability should distinguish at least:

```text
OFFLINE
AVAILABLE_NOW
```

Partner with active delivery should not be treated as freely available for incompatible new work.

---

## PR-STATE-004 — Trip lifecycle

**Priority:** P0

Scheduled/on-my-way trip lifecycle should distinguish at least:

```text
TRIP_SCHEDULED
TRIP_ACTIVE
TRIP_COMPLETED
TRIP_CANCELLED
```

A scheduled future trip must not be confused with `AVAILABLE_NOW`.

---

# 25. Mapping Requirements

## PR-MAP-001 — Google Maps Platform

**Priority:** P0

The prototype will use Google Maps Platform for mapping/routing capabilities as defined in the current decision log.

Needed product capabilities include:

- interactive map,
- pickup/drop selection,
- place search,
- geocoding,
- route display/calculation,
- distance/ETA,
- route matrix where justified by matching.

---

## PR-MAP-002 — Cost/control safeguards

**Priority:** P0

Prototype configuration must avoid uncontrolled map API usage.

Implementation should support:

- API key restrictions,
- environment-based keys,
- quotas/billing alerts configured outside code,
- avoiding route recalculation on every GPS location event.

---

# 26. Communication

## PR-COMM-001 — Customer-partner clarification

**Priority:** P1

After assignment, provide a basic way for customer and partner to clarify pickup details.

For prototype, this may be implemented as one simple channel rather than a full messaging platform.

Core order matching must not depend on a conversation occurring.

---

# 27. Prototype Screens / Views

The exact visual design is not fixed, but the prototype must provide enough UI to satisfy the required flows.

## Customer / shared views — P0

1. Landing / sign-in / registration
2. Phone verification
3. Home / create food request
4. Pickup search + map/manual pin
5. Drop location selection
6. Food/item details
7. ASAP / scheduled timing
8. Price summary
9. Test checkout
10. Matching/searching screen
11. Assigned order detail
12. Price-change approval view
13. Active delivery/tracking view
14. Delivery OTP/handoff view
15. Order completion view
16. My Orders / order details
17. Profile

## Partner views — P0

1. Partner application
2. Verification pending/status
3. Partner home
4. Available Now control
5. Create scheduled/on-my-way trip
6. Active/scheduled trip view
7. Incoming delivery offer
8. Assigned delivery detail
9. Pickup/bill/receipt view
10. Active delivery/navigation/tracking state
11. OTP completion flow
12. Earnings/demo ledger view

## Admin views — P0

1. Admin login/access-protected area
2. Partner verification queue
3. Partner application detail
4. Orders list
5. Order detail
6. Manual intervention/dispute flags

P1/P2 design polish must not delay the P0 functional loop.

---

# 28. Prototype Data Requirements

The system must retain enough durable information to reconstruct an order and debug a demonstration failure.

At minimum, durable records will eventually be needed for:

- users,
- partner profiles,
- verification state,
- trips,
- orders,
- pickup/drop coordinates,
- requested items,
- order state transitions/timestamps,
- partner assignment,
- offers/acceptance result where useful,
- price estimate,
- actual bill,
- receipt metadata/file reference,
- demo payment state,
- demo partner earning,
- rating,
- admin intervention status.

Live partner location is operational data and does not need to be stored forever at full resolution.

Exact schema belongs in `DATABASE_DESIGN.md`.

---

# 29. Non-Functional Prototype Requirements

## PR-NFR-001 — Security basics

**Priority:** P0

Even though this is a prototype:

- secrets/API keys must not be committed to Git,
- passwords/tokens must not be stored insecurely,
- admin routes must be access controlled,
- user input must be validated,
- uploaded files must have size/type restrictions,
- sensitive identity documents must not be publicly accessible.

---

## PR-NFR-002 — Privacy

**Priority:** P0

The prototype should minimize unnecessary sensitive data collection.

In particular:

- do not require Aadhaar for the campus prototype,
- do not expose personal documents to other users,
- only share delivery-relevant information with the assigned partner,
- stop active location tracking when it is no longer needed.

---

## PR-NFR-003 — Reliability for demo

**Priority:** P0

Core flow errors must produce understandable states rather than blank screens or indefinite loaders.

At minimum handle:

- mapping API failure,
- payment test failure,
- no partner available,
- offer expiry,
- stale/failed location update,
- invalid OTP,
- invalid state transition.

---

## PR-NFR-004 — Observability

**Priority:** P1

Backend should log key lifecycle events with useful IDs, for example:

- order created,
- test payment succeeded/failed,
- matching started,
- offers created,
- partner accepted/rejected,
- assignment succeeded,
- price confirmation requested/approved,
- pickup confirmed,
- delivery OTP verified/failed,
- order completed/cancelled/failed.

Logs should avoid leaking secrets or identity-document contents.

---

## PR-NFR-005 — Configurability

**Priority:** P0

Prototype hypotheses must not be scattered as unexplained magic numbers.

Configuration should support values such as:

```text
MAX_ASAP_DELIVERY_MINUTES = 45
MAX_ROUTE_DETOUR_MINUTES = 10
MAX_ROUTE_DETOUR_KM = 1.5
OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20
DEFAULT_DEPARTURE_FLEX_MINUTES = 15
DEFAULT_PARTNER_EARNING = 40
DEFAULT_PLATFORM_FEE = 10
ACTIVE_DELIVERY_LOCATION_UPDATE_SECONDS ≈ 10–15
```

Exact names can change during implementation, but the values should remain centralized/configurable.

---

# 30. Explicitly Out of Scope for First Prototype

The following must **not block** the prototype:

- production bank payouts,
- real marketplace split settlements,
- automated financial reconciliation,
- government-backed KYC,
- Aadhaar-based authentication,
- advanced document authenticity checks,
- production refund automation,
- production dispute arbitration,
- fraud/abuse ML,
- machine-learning matching/ranking,
- complex surge pricing,
- demand forecasting,
- multi-order batching,
- city-scale route optimization,
- full vendor onboarding/catalogue platform,
- vendor merchant portal,
- native Android/iOS apps,
- production-grade background GPS,
- WhatsApp notification integration,
- advanced analytics dashboard,
- microservice architecture,
- multi-city launch,
- non-food delivery categories.

---

# 31. P0 Build Checklist

The prototype should not be considered ready until the following work together:

```text
[ ] User registration/sign-in
[ ] Phone verification flow
[ ] One account with optional partner profile
[ ] Partner application
[ ] Admin approve/reject partner
[ ] Customer creates food request
[ ] Vendor/place search
[ ] Manual pickup pin fallback
[ ] Delivery location
[ ] Free-form requested items
[ ] ASAP order
[ ] Scheduled order
[ ] Estimated price breakdown
[ ] Razorpay test checkout
[ ] Demo payment/ledger state
[ ] AVAILABLE_NOW partner mode
[ ] TRIP_SCHEDULED partner mode
[ ] TRIP_ACTIVE lifecycle
[ ] Automatic eligibility filtering
[ ] Deterministic candidate ranking
[ ] Batched delivery offers
[ ] Partner accept/reject/expiry
[ ] Atomic single-partner assignment
[ ] No-partner-found handling
[ ] Assigned order details
[ ] Actual food bill input
[ ] Receipt/proof upload
[ ] Customer price-change approval
[ ] Pickup confirmation
[ ] Foreground live location during delivery
[ ] Customer tracking/status screen
[ ] Delivery OTP verification
[ ] Order completion
[ ] Partner demo earning recorded
[ ] Customer cancellation before purchase
[ ] Partner cancellation/rematching before purchase
[ ] Admin intervention for post-purchase failures
[ ] Order state transition validation
[ ] Basic admin order monitoring
[ ] Basic security/input validation
[ ] Error states suitable for live demo
```

---

# 32. Product Acceptance Scenario

Before presenting RouteBite, perform this exact rehearsal:

```text
1. Admin account is ready.

2. User A registers as customer.

3. User B registers and applies to become a partner.

4. Admin approves User B.

5. User B chooses AVAILABLE_NOW
   OR creates a compatible scheduled trip.

6. User A creates an order:
   - local vendor name
   - manually pinned or searched pickup
   - requested food
   - campus drop
   - ASAP/scheduled time

7. User A sees estimate and completes test payment.

8. Order enters MATCHING.

9. User B receives offer.

10. User B accepts.

11. Both sides see assignment.

12. Partner reaches pickup.

13. Partner enters actual bill and uploads proof.

14. If bill changed, User A approves difference.

15. Partner marks PICKED_UP.

16. User A sees delivery progress/location.

17. Partner reaches User A.

18. User A provides OTP.

19. Order becomes COMPLETED.

20. Partner demo earning is recorded.

21. Customer rates partner.
```

A second rehearsal should intentionally exercise one failure case such as no partner acceptance or incorrect OTP.

---

# 33. Requirement Change Rule

If implementation exposes a missing/incorrect product requirement:

1. do not silently change behavior only in code,
2. determine whether the change affects `PROJECT_CONTEXT.md` or `DECISIONS.md`,
3. update this PRD,
4. update `USER_FLOWS.md` when user behavior changes,
5. update specialized technical docs when the implementation contract changes.

The goal is to keep documentation and code aligned throughout the prototype.
