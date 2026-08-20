# RouteBite — User Flows

> **Status:** Prototype flow specification
>
> This document defines how consumers, delivery partners, and admins move through the RouteBite prototype. It translates the product decisions in `PROJECT_CONTEXT.md` and `DECISIONS.md` into concrete end-to-end behavior.
>
> Architecture, database schemas, and API contracts should be derived from these flows rather than inventing new product behavior independently.

---

# 1. Prototype UX Principles

The first RouteBite prototype should prove the complete product loop with the smallest coherent experience.

Core rules:

1. A vendor does not need to be registered with RouteBite.
2. A customer may search for a known place or manually choose a pickup pin.
3. RouteBite performs automatic partner matching.
4. Matching uses location **and time**, not geographic proximity alone.
5. A future scheduled traveller is different from a partner who is available immediately.
6. The customer completes a **test-mode payment before matching begins**.
7. Only verified/approved partners can receive delivery offers.
8. Once food has been purchased, cancellation becomes an admin/support case.
9. Delivery is completed using OTP/equivalent handoff verification.
10. Prototype failures must be visible and recoverable; the UI must not pretend that supply is always available.

---

# 2. User and Role Model

## 2.1 One User Account

For the prototype, RouteBite should use **one user account system**.

Every registered user can act as a customer.

A user who wants to deliver can additionally apply for a delivery-partner profile.

Conceptually:

```text
USER
 │
 ├── Customer capability (default)
 │
 └── Optional Partner Profile
       │
       ├── PENDING_VERIFICATION
       ├── APPROVED
       ├── REJECTED
       └── SUSPENDED
```

A user should **not** need to create a second account just to become a delivery partner.

This is especially important because the RouteBite model expects some ordinary customers/students to occasionally become `On My Way` partners.

---

## 2.2 Prototype Application Structure

For the prototype, use **one role-aware web application** rather than separate customer and partner apps.

A logged-in user can see customer features by default.

If they have an approved partner profile, they can switch to or open a partner area such as:

```text
Order Food

Earn with RouteBite
```

Admin functionality can live behind a separate protected admin route/interface within the same prototype codebase.

A future production system may split consumer and delivery experiences into dedicated mobile applications if required.

---

# 3. Authentication and Basic Account Flow

## 3.1 New User Signup

```text
Open RouteBite
      ↓
Enter phone number
      ↓
Receive OTP
      ↓
Enter OTP
      ↓
OTP valid?
 ├── No → show error / resend
 └── Yes
      ↓
Enter basic profile
      ↓
Account created
      ↓
Customer Home
```

Basic profile can contain:

- name,
- phone number,
- optional profile photo,
- optional college/campus information.

For the prototype, phone OTP is the primary account verification mechanism.

---

## 3.2 Returning User Login

```text
Enter phone number
      ↓
OTP verification
      ↓
Authenticated
      ↓
Home
```

The exact session/token architecture will be defined later in architecture/API design.

---

# 4. Become a Delivery Partner Flow

A normal RouteBite user may choose:

```text
Earn with RouteBite
```

If they do not already have an approved partner profile:

```text
User
  ↓
Apply to Become Partner
  ↓
Confirm phone verification
  ↓
Enter partner details
  ↓
Upload profile photo
  ↓
Provide college identity/enrollment information
  ↓
Upload college ID where applicable
  ↓
Submit application
  ↓
PENDING_VERIFICATION
  ↓
Admin review
  ├── APPROVED
  └── REJECTED
```

For the campus prototype, this is **manual platform verification**, not government-backed KYC.

A pending partner can still order food as a normal customer but cannot receive delivery requests.

---

# 5. Admin Partner Verification Flow

```text
Admin Login
    ↓
Pending Partner Applications
    ↓
Open application
    ↓
Review:
- name
- phone
- profile photo
- college identity/enrollment
- uploaded college ID
    ↓
Decision
 ├── Approve
 │     ↓
 │   APPROVED
 │     ↓
 │   Partner features enabled
 │
 └── Reject
       ↓
     REJECTED
```

The admin may include a rejection reason for prototype testing.

A future production system can replace or augment this process with stronger identity/KYC providers.

---

# 6. Customer Home Flow

Customer home should make the primary action obvious:

```text
What do you want delivered?
```

Primary options:

```text
Create Food Request
View Active Order
View Order History
Earn with RouteBite
```

If the user has an active order, the active-order status should be easy to reopen.

---

# 7. Customer Creates a Food Request

## 7.1 Step 1 — Describe the Food

The customer enters free-form food details because the vendor may not have a RouteBite menu.

Example:

```text
2 Pav Bhaji
1 Extra Butter Pav
Less spicy
```

Possible fields:

- requested items,
- quantity/details,
- optional notes.

The prototype does not require structured restaurant menus.

---

## 7.2 Step 2 — Choose Vendor / Pickup

Customer can search for a place using the map provider.

```text
Search: Sharma Chaat
       ↓
Place found?
 ├── Yes
 │     ↓
 │   Select place
 │     ↓
 │   Pickup coordinates saved
 │
 └── No
       ↓
     Drop pickup pin manually
       ↓
     Add vendor/display name
       ↓
     Add landmark/instructions
```

Example manual pickup:

```text
Vendor: Verma Chaat
Pickup pin: Civil Lines
Landmark: Opposite Hanuman Mandir, red cart
```

The order remains valid even if `Verma Chaat` does not exist in RouteBite or Google Places.

---

## 7.3 Step 3 — Choose Delivery Location

Customer selects:

- current location, or
- saved/manual delivery location.

The system stores delivery coordinates.

Example:

```text
Drop: College Hostel Gate
```

---

## 7.4 Step 4 — Choose Delivery Time

Customer chooses:

```text
● ASAP
○ Schedule for Later
```

### ASAP

The backend derives a delivery window using the configurable prototype SLA.

Initial hypothesis:

```text
MAX_ASAP_DELIVERY_MINUTES = 45
```

Example:

```text
Order time: 4:15 PM
Latest acceptable delivery: ~5:00 PM
```

### Schedule for Later

Customer selects a delivery window rather than an unrealistically exact second.

Example:

```text
6:00 PM – 6:30 PM
```

---

## 7.5 Step 5 — Enter Estimated Food Cost

Because the vendor may be offline/unregistered, RouteBite may not know the exact food price.

Customer enters an estimate:

```text
Estimated food cost: ₹200
```

The UI must clearly label this as an **estimate**, not a guaranteed menu price.

---

## 7.6 Step 6 — Show Prototype Price Summary

Example:

```text
Estimated food cost       ₹200
Delivery earning/fee       ₹40
Platform fee               ₹10
------------------------------
Estimated total           ₹250
```

All prototype price values must be configurable.

---

# 8. Customer Test Payment Flow

For the working prototype, payment occurs **before automatic matching begins**.

```text
Order Draft
    ↓
Review Order
    ↓
Proceed to Checkout
    ↓
PAYMENT_PENDING
    ↓
Razorpay Test Checkout
    ↓
Payment result
 ├── Failed / Cancelled
 │      ↓
 │   PAYMENT_FAILED
 │      ↓
 │   Retry payment / return to order
 │
 └── Test payment successful
        ↓
      PAYMENT_CONFIRMED
        ↓
      Lock core order details
        ↓
      Begin matching
```

No real money needs to move in the prototype.

### Order Editing Rule

Before successful payment:

- customer may freely edit the draft.

After successful payment and matching begins:

- core pickup/drop/items/time details should be treated as locked,
- customer should cancel before purchase and create a new request if major details must change.

This prevents matching against a constantly changing order.

---

# 9. ASAP Order Matching Flow

After test payment succeeds:

```text
PAYMENT_CONFIRMED
       ↓
MATCHING
       ↓
Discover possible partners
       ↓
Hard eligibility filtering
       ↓
Ranking
       ↓
Dispatch offer batch
```

Eligibility includes:

- approved partner,
- correct availability state,
- route compatibility when applicable,
- direction compatibility,
- pickup reachability,
- acceptable detour,
- predicted pickup time,
- predicted delivery time,
- customer delivery window.

---

## 9.1 Candidate Sources

### On-My-Way Candidate

A scheduled/active traveller can receive an ASAP order **only if the predicted delivery still fits the customer's ASAP window**.

Example:

```text
Customer order: 4:15 PM
Latest useful delivery: 5:00 PM

Partner trip departure: 6:00 PM
Predicted delivery: 6:35 PM

→ NOT ELIGIBLE
```

But:

```text
Partner departure: 4:20 PM
Predicted delivery: 4:42 PM

→ ELIGIBLE
```

### Available-Now Candidate

Partner is actively online and can make a dedicated trip.

The system evaluates current location → pickup → customer ETA.

---

# 10. Dispatch / Offer Flow

The prototype should use controlled offer batches.

Initial hypothesis:

```text
OFFER_BATCH_SIZE = 3
OFFER_TIMEOUT_SECONDS = 20
```

Flow:

```text
Rank eligible partners
       ↓
Send offer to top batch
       ↓
Wait ~20 seconds
       ↓
Accepted?
 ├── Yes → atomic assignment
 └── No
       ↓
Next batch
       ↓
Still no acceptance?
       ↓
Broaden allowed search / optional incentive
```

Partners who are not selected in the current batch should not receive unnecessary notifications.

---

# 11. Customer Experience While Matching

The customer should see a clear status such as:

```text
Finding a delivery partner…
```

Possible UI information:

- order summary,
- estimated delivery range,
- cancel option if food has not been purchased,
- matching progress message.

Do **not** expose internal ranking formulas or flood the customer with individual rejected partners.

---

# 12. Partner Receives an Offer

Partner offer should contain enough information to make a decision.

Example:

```text
New Delivery Request

Pickup: Sharma Chaat, Civil Lines
Drop: College Hostel
Estimated extra travel: 7 min
Estimated delivery: 4:42 PM
Partner earning: ₹40

[Accept] [Reject]
```

For an on-my-way partner, additionally show useful route/detour information.

Offer expires automatically after the configured timeout.

---

# 13. Atomic Partner Acceptance

If two partners press Accept almost simultaneously:

```text
Order currently: MATCHING
```

The backend performs an atomic assignment.

Only one partner succeeds:

```text
MATCHING
   ↓
ASSIGNED_TO_PARTNER_P1
```

Another partner receives:

```text
This order has already been assigned.
```

The customer should never see two assigned partners for one order.

---

# 14. Successful Assignment Flow

When a partner wins the request:

### Customer sees

```text
Partner Found

Partner name/profile
Verification status
Rating/history if available
Estimated pickup ETA
Estimated delivery ETA
Order status
```

### Partner sees

```text
Assigned Order

Exact pickup
Vendor name/instructions
Requested food
Estimated food cost
Exact drop location
Customer contact/chat option
Navigation actions
```

Order transitions:

```text
MATCHING
   ↓
ASSIGNED
   ↓
PARTNER_TO_PICKUP
```

Foreground partner location tracking can begin during the active order.

---

# 15. Available-Now Partner Flow

An approved partner chooses:

```text
Go Online
```

Flow:

```text
Partner Dashboard
      ↓
Go Online
      ↓
Location permission available?
 ├── No → request permission / cannot become AVAILABLE_NOW
 └── Yes
      ↓
AVAILABLE_NOW
      ↓
Periodic location updates
      ↓
Compatible order offer
      ↓
Accept / Reject
```

If accepted:

```text
AVAILABLE_NOW
      ↓
BUSY / ACTIVE_ORDER
      ↓
Navigate to pickup
      ↓
Complete delivery
      ↓
AVAILABLE_NOW again
```

unless the partner chooses to go offline.

A partner should not receive another single-order prototype assignment while already busy.

---

# 16. On-My-Way / Scheduled Trip Creation Flow

Approved partner chooses:

```text
I'm Going Somewhere
```

They enter:

- origin A,
- destination B,
- approximate departure time,
- departure flexibility.

Example:

```text
Origin: Civil Lines
Destination: College Campus
Leaving around: 6:00 PM
Flexibility: ±15 min
```

Flow:

```text
Create Trip
    ↓
Route preview
    ↓
Confirm
    ↓
TRIP_SCHEDULED
```

Creating the trip does **not** make the partner `AVAILABLE_NOW`.

The system may consider the trip for compatible scheduled orders and for ASAP orders only when the predicted timing fits.

---

# 17. Starting a Scheduled Trip

Around departure time, partner opens the scheduled trip and chooses:

```text
Start Trip
```

Flow:

```text
TRIP_SCHEDULED
      ↓
Location permission check
      ↓
Start Trip
      ↓
TRIP_ACTIVE
      ↓
Current route progress + location updates
```

Once active, current location and route progress become more important than the original planned departure time.

If the partner has already passed a potential pickup point and fulfilling it requires unreasonable backward travel, that order should not be offered.

---

# 18. Scheduled Customer Order Flow

Customer selects a future delivery window.

Example:

```text
Delivery requested: 6:00 PM – 6:30 PM
```

After test payment:

```text
PAYMENT_CONFIRMED
       ↓
SCHEDULED_WAITING / MATCHING
       ↓
Evaluate known compatible scheduled trips
       ↓
Partner found?
 ├── Yes → send offer / assign
 └── No  → remain waiting for compatible supply
```

The system should be able to re-evaluate the order when relevant supply changes, for example:

- a new compatible `TRIP_SCHEDULED` partner appears,
- an `AVAILABLE_NOW` partner becomes relevant nearer the delivery window,
- a previously assigned partner cancels.

For the prototype, this may be implemented with simple re-matching events rather than sophisticated forecasting.

Customer should see a message such as:

```text
Scheduled order confirmed.
We are looking for a partner for your delivery window.
```

If assigned early:

```text
Partner reserved for your scheduled delivery.
```

---

# 19. Partner Reaches Pickup

Partner navigates to the vendor/pickup pin.

When they arrive:

```text
PARTNER_TO_PICKUP
      ↓
Partner taps "Reached Pickup"
      ↓
AT_PICKUP
```

Partner verifies:

- vendor/stall exists,
- requested items are available,
- actual/quoted food price.

---

# 20. Actual Price Confirmation Flow

## 20.1 Price Matches Estimate

Example:

```text
Estimated: ₹200
Actual: ₹200
```

Partner proceeds to purchase/collect.

---

## 20.2 Actual Price Is Lower

Example:

```text
Estimated: ₹200
Actual: ₹180
```

Prototype can update the demo ledger downward and show the customer the corrected amount.

Customer approval is not required to protect the customer from an increase, though the change should remain visible.

---

## 20.3 Actual Price Is Higher

Example:

```text
Estimated: ₹200
Actual: ₹220
Additional: ₹20
```

**Important:** The partner should request approval **before purchasing the food** whenever reasonably possible.

Flow:

```text
AT_PICKUP
    ↓
Partner enters actual price
    ↓
Actual > estimate
    ↓
PRICE_CONFIRMATION_REQUIRED
    ↓
Customer notification
    ↓
Customer decision
 ├── Approve
 │      ↓
 │   Demo amount updated
 │      ↓
 │   Partner may purchase
 │
 └── Decline
        ↓
      Do not purchase
        ↓
      Cancel / contact / admin resolution
```

This prevents the partner from purchasing a more expensive order before the customer agrees.

---

# 21. Item Unavailable / Vendor Closed Flow

At pickup, the partner may discover:

- vendor closed,
- item unavailable,
- wrong pickup pin,
- vendor cannot prepare order.

Flow:

```text
AT_PICKUP
   ↓
Problem found
   ↓
Partner selects problem reason
   ↓
Customer contacted / notified
   ↓
Can resolve?
 ├── Yes → update/confirm request and continue
 └── No  → cancel before purchase / admin review
```

Substitutions should require customer confirmation rather than partner guessing.

---

# 22. Purchase / Pickup Confirmation

After price/availability is resolved and the food is purchased:

Partner may:

- enter final amount,
- upload receipt/photo where available,
- tap `Picked Up`.

Flow:

```text
AT_PICKUP
     ↓
Purchase confirmed
     ↓
Receipt/proof optional upload
     ↓
PICKED_UP
     ↓
OUT_FOR_DELIVERY
```

At this point unrestricted customer cancellation ends.

---

# 23. Customer Cancellation Flow

## 23.1 Before Food Purchase

Customer may cancel while the order is in states such as:

```text
MATCHING
ASSIGNED
PARTNER_TO_PICKUP
AT_PICKUP (before purchase)
PRICE_CONFIRMATION_REQUIRED
```

Flow:

```text
Customer taps Cancel
      ↓
Food purchased?
 ├── No
 │    ↓
 │  CANCELLED
 │    ↓
 │  Partner notified
 │    ↓
 │  Demo payment/ledger cancellation recorded
 │
 └── Yes
      ↓
    normal cancel button unavailable
      ↓
    contact support/admin
```

---

## 23.2 After Food Purchase

Once the order reaches:

```text
PICKED_UP
```

customer should not receive a simple unrestricted cancellation button.

Instead:

```text
Need help with this order?
Contact support/admin
```

Production refund/liability rules are intentionally deferred.

---

# 24. Partner Cancellation Flow

## 24.1 Before Purchase

If assigned partner cancels before food purchase:

```text
ASSIGNED / PARTNER_TO_PICKUP / AT_PICKUP
      ↓
Partner cancels
      ↓
Assignment released
      ↓
Order returns to MATCHING
      ↓
Try next eligible partners
```

Customer sees:

```text
Your previous partner became unavailable.
Finding another partner…
```

---

## 24.2 After Purchase

If partner cannot continue after `PICKED_UP`:

```text
PICKED_UP
   ↓
Partner reports issue
   ↓
ADMIN_INTERVENTION_REQUIRED
```

The prototype should not attempt to fully automate this uncommon but financially sensitive case.

---

# 25. Live Delivery Tracking Flow

During active delivery:

```text
ASSIGNED / PARTNER_TO_PICKUP
          ↓
Foreground location updates
          ↓
PICKED_UP
          ↓
OUT_FOR_DELIVERY
```

Customer can see:

- partner's approximate/current location,
- current order state,
- ETA where available.

Initial prototype update interval:

```text
approximately 10–15 seconds during active delivery
```

Do not continuously track users after the active order/trip is completed.

---

# 26. Partner Loses Location Permission / Tracking

If foreground location becomes unavailable:

```text
Active delivery
      ↓
Location update fails
      ↓
Mark tracking as temporarily unavailable
      ↓
Prompt partner to restore location permission
```

The customer should see a graceful status rather than a fake moving marker.

Order status updates must still be usable even if live map tracking temporarily fails.

---

# 27. Arrival and Delivery OTP Flow

When partner reaches the customer destination:

```text
OUT_FOR_DELIVERY
      ↓
Partner taps "Arrived"
      ↓
ARRIVED
```

The customer has access to a delivery OTP/equivalent handoff code.

Partner asks customer for the OTP.

```text
Partner enters OTP
      ↓
Backend verifies
      ↓
Valid?
 ├── No → show error / retry
 └── Yes
      ↓
DELIVERED
      ↓
COMPLETED
```

The partner should not be able to mark a normal successful delivery complete without handoff verification.

---

# 28. OTP Failure / Customer Unreachable

If OTP repeatedly fails or customer cannot be reached:

```text
ARRIVED
   ↓
Cannot complete handoff
   ↓
Retry/contact customer
   ↓
Still unresolved
   ↓
DELIVERY_ISSUE
   ↓
Admin/support intervention
```

Do not automatically mark the order delivered merely because the partner reached the location.

---

# 29. Order Completion Flow

After successful OTP verification:

```text
DELIVERED
    ↓
COMPLETED
```

System records prototype ledger entries such as:

```text
Final food amount
Partner earning
Platform fee
Demo settlement state
```

Partner sees:

```text
Delivery completed
Earning recorded: ₹X
```

Customer sees:

```text
Order delivered successfully
```

---

# 30. Rating Flow

After completion, customer may rate the delivery partner.

Prototype rating:

```text
1–5 stars
Optional short feedback
```

Do not build a sophisticated reputation algorithm yet.

Initially, display simple values such as:

- average rating,
- completed deliveries.

A future reliability score can additionally use completion/cancellation behavior.

---

# 31. No Partner Found Flow

RouteBite must not leave the customer waiting indefinitely.

Conceptual fallback:

```text
Strict eligible candidates
       ↓
Available-now candidates
       ↓
Broaden acceptable radius/detour within safe configured limits
       ↓
Optional higher incentive
       ↓
Still nobody available
       ↓
MATCHING_FAILED
```

Customer sees:

```text
No suitable delivery partner is available right now.
```

Possible actions:

```text
[Try Again]
[Schedule for Later]
[Cancel Order]
```

A future `Notify Me` capability may be added but should not block the first prototype.

---

# 32. Scheduled Order Cannot Be Fulfilled

If a scheduled order approaches its delivery window and no compatible partner can be found:

```text
SCHEDULED_WAITING
      ↓
Final matching attempts
      ↓
No feasible partner
      ↓
MATCHING_FAILED
```

Customer should be notified before or at the point the promised window can no longer reasonably be met.

Prototype options:

- retry with a later delivery window,
- switch to ASAP if supply exists,
- cancel.

---

# 33. Scheduled Partner Delayed

A scheduled partner may start late enough that the customer delivery window becomes infeasible.

The system should re-check ETA compatibility rather than blindly keeping the assignment.

Conceptually:

```text
Assigned scheduled partner
       ↓
Departure delayed
       ↓
Recalculate predicted delivery
       ↓
Still within customer window?
 ├── Yes → continue
 └── No
       ↓
     release/re-evaluate assignment
       ↓
     rematch if possible
```

The exact tolerance rules remain configurable.

---

# 34. Offer Expiry / Partner Reject Flow

Partner may:

- reject,
- ignore,
- allow offer to expire.

All three mean the current candidate does not receive the order.

```text
Offer sent
   ↓
Accept?
 ├── Yes → attempt atomic assignment
 └── No / expired
        ↓
      continue dispatch
```

The customer's order remains in matching until assigned or matching fails.

---

# 35. Admin Order Operations Flow

Prototype admin dashboard should show:

- pending partner applications,
- active partners,
- scheduled trips,
- active orders,
- order state,
- customer and assigned partner,
- pickup/drop,
- uploaded receipts/proofs,
- reported problems,
- failed/cancelled orders.

Possible prototype actions:

```text
Review order
Approve/reject partner
Cancel order
Mark issue resolved
Review receipt
Inspect order timeline
```

Manual intervention is intentionally acceptable during the prototype stage.

---

# 36. Core Order State Machine

The prototype should use a clear persisted order state machine.

Main happy path:

```text
DRAFT
  ↓
PAYMENT_PENDING
  ↓
PAYMENT_CONFIRMED
  ↓
MATCHING
  ↓
ASSIGNED
  ↓
PARTNER_TO_PICKUP
  ↓
AT_PICKUP
  ↓
[PRICE_CONFIRMATION_REQUIRED]   optional
  ↓
PICKED_UP
  ↓
OUT_FOR_DELIVERY
  ↓
ARRIVED
  ↓
DELIVERED
  ↓
COMPLETED
```

Scheduled orders may use:

```text
PAYMENT_CONFIRMED
      ↓
SCHEDULED_WAITING
      ↓
MATCHING / ASSIGNED
```

Terminal/exception states can include:

```text
PAYMENT_FAILED
CANCELLED
MATCHING_FAILED
DELIVERY_ISSUE
FAILED
```

### Important Rule

State transitions should be validated by the backend.

For example:

```text
MATCHING → PICKED_UP
```

must not be allowed because an order cannot be picked up without first being assigned and reaching pickup.

---

# 37. Delivery Partner Availability State

Separate order state from partner availability.

Example partner availability:

```text
OFFLINE
   ↓
AVAILABLE_NOW
   ↓
BUSY
   ↓
AVAILABLE_NOW / OFFLINE
```

Partner should not receive new single-order prototype offers while `BUSY`.

---

# 38. Scheduled Trip State Machine

On-my-way trips should have their own lifecycle:

```text
TRIP_DRAFT
    ↓
TRIP_SCHEDULED
    ↓
TRIP_ACTIVE
    ↓
TRIP_COMPLETED
```

Alternate:

```text
TRIP_SCHEDULED → TRIP_CANCELLED
TRIP_ACTIVE → TRIP_CANCELLED / interrupted
```

An order and a partner trip are related but are not the same entity/state machine.

---

# 39. Partner Verification State Machine

```text
NOT_APPLIED
     ↓
PENDING_VERIFICATION
     ↓
 ┌───┴────┐
 ▼        ▼
APPROVED  REJECTED
```

Future administrative state:

```text
APPROVED → SUSPENDED
```

Only `APPROVED` partners can become `AVAILABLE_NOW` or create active delivery supply for the prototype.

---

# 40. Prototype Notification Events

The prototype primarily uses in-app notifications/status changes.

Important events include:

### Customer

```text
Payment confirmed
Matching started
Partner found
Partner changed/rematching
Partner reached pickup
Price approval required
Food picked up
Partner arriving
Order delivered
Order cancelled
Matching failed
```

### Partner

```text
New order offer
Offer expired
Order assigned
Order already taken
Customer approved price
Customer cancelled before purchase
Delivery completed
```

Phone OTP is used where required for authentication and delivery verification.

Full push/SMS/WhatsApp infrastructure is not required for the first prototype.

---

# 41. Prototype Data/Privacy Behavior

The prototype should follow several basic privacy rules even before production hardening:

- Do not track partner location when they are offline and not on an active trip/order.
- Only approved partners receive customer delivery assignments.
- Do not expose uploaded partner identity documents to normal customers.
- Customer sees partner verification status, not raw verification documents.
- Admin-only identity uploads should require protected access.
- Do not describe manual campus verification as government KYC.

Detailed security/privacy architecture will be designed later.

---

# 42. Happy-Path Presentation Scenario

The following scenario should eventually be demonstrable end-to-end.

### Setup

Partner Rahul is an approved RouteBite campus partner.

At 4:00 PM he creates:

```text
On My Way
Civil Lines → College Campus
Departure: 4:25 PM
Flexibility: ±15 min
```

### Customer

At 4:10 PM, customer creates:

```text
Food: 2 Pav Bhaji
Vendor: Verma Chaat
Pickup: manually pinned near Civil Lines
Drop: College Hostel
Delivery: ASAP
Estimated food price: ₹200
```

Customer sees:

```text
Food estimate: ₹200
Delivery: ₹40
Platform fee: ₹10
Total estimate: ₹250
```

Customer completes Razorpay test payment.

### Matching

RouteBite evaluates Rahul:

```text
route compatible ✓
direction compatible ✓
pickup ahead ✓
detour acceptable ✓
predicted delivery inside customer window ✓
```

Rahul receives the offer and accepts.

### Pickup

Rahul reaches Verma Chaat.

Actual price is ₹220.

He enters:

```text
Actual price: ₹220
```

Customer receives:

```text
Price increased by ₹20
[Approve]
```

Customer approves.

Rahul purchases the food, optionally uploads receipt proof, and marks it `Picked Up`.

### Delivery

Customer sees Rahul moving toward campus.

Rahul reaches the hostel and enters the customer's OTP.

OTP succeeds.

```text
DELIVERED → COMPLETED
```

Prototype records:

```text
Food amount: ₹220
Partner earning: ₹40
Platform fee: ₹10
Demo settlement: recorded
```

Customer rates Rahul.

This scenario demonstrates the core RouteBite thesis without requiring the vendor to be registered on RouteBite.

---

# 43. Secondary Presentation Scenario — Available Now Partner

If no suitable on-my-way traveller exists:

```text
Customer creates paid request
      ↓
No compatible scheduled/on-route partner
      ↓
Nearby APPROVED partner is AVAILABLE_NOW
      ↓
System evaluates ETA
      ↓
Offer sent
      ↓
Partner accepts
      ↓
Dedicated pickup + delivery
```

This demonstrates why the second supply mode exists and prevents RouteBite from depending entirely on coincidental traveller routes.

---

# 44. Prototype Non-Goals

The following should **not** be added merely to make the prototype look more sophisticated:

- full restaurant/vendor onboarding,
- structured restaurant menus,
- government-grade KYC,
- real partner bank payouts,
- production split settlements,
- ML partner ranking,
- automated fraud scoring,
- advanced surge pricing,
- multi-order batching,
- native background GPS infrastructure,
- city-scale dispatch optimization,
- separate microservices for every feature.

The prototype's job is to prove the end-to-end RouteBite workflow.

---

# 45. Flows That Must Work Before the Prototype Is Considered Complete

The prototype is functionally complete when the following can be demonstrated:

### Customer

```text
Signup/Login
→ Create food request
→ Search or manually pin vendor
→ Choose drop
→ ASAP or scheduled time
→ Enter estimated price
→ Test checkout
→ Matching
→ Partner assignment
→ Price confirmation when required
→ Track order
→ OTP delivery
→ Rating
```

### Available-Now Partner

```text
Partner verification
→ Go Online
→ Location available
→ Receive offer
→ Accept
→ Reach pickup
→ Confirm price
→ Pick up
→ Deliver
→ OTP
→ Earning recorded
```

### On-My-Way Partner

```text
Partner verification
→ Create A → B trip
→ Set departure/flexibility
→ TRIP_SCHEDULED
→ Receive compatible request
→ Accept
→ Start trip
→ Pick up
→ Deliver
→ Complete
```

### Admin

```text
Login
→ Review partner
→ Approve/reject
→ View orders
→ Inspect receipts/issues
→ Handle prototype exceptions manually
```

### Failure Handling

At minimum demonstrate or test:

```text
Payment failure
No partner found
Offer expiry
Two simultaneous accepts
Customer cancellation before purchase
Partner cancellation before purchase
Price increase requiring approval
Vendor/item unavailable
OTP failure
```

---

# 46. Documentation Dependency

After this document is accepted:

1. `PRODUCT_REQUIREMENTS.md` should convert these flows into explicit prototype features and acceptance criteria.
2. `MATCHING_ENGINE.md` should define the matching calculations behind Sections 9–18.
3. `PAYMENT_FLOW.md` should formalize prototype and future production payment states.
4. `ARCHITECTURE.md` should map these flows to system components.
5. `DATABASE_DESIGN.md` should model the state machines/entities defined here.
6. `API_DESIGN.md` should expose operations required by these flows.

No architecture document should silently change these user flows without first updating the relevant product decision/document.
