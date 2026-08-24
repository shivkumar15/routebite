# RouteBite — Testing Strategy

> **Status:** CONFIRMED FOR PROTOTYPE
>
> This document defines how RouteBite should be tested so that the prototype is not merely demoable once, but reliably repeatable.
>
> The project uses a MERN+ stack: React, Node.js, Express.js, MongoDB Atlas, Mongoose, Socket.IO, Google Maps, Razorpay Test Mode and Cloudinary.

---

# 1. Testing Goal

The testing goal is not maximum test count.

The goal is to protect the flows most likely to produce expensive or embarrassing bugs:

```text
authentication
partner verification
order state transitions
payment confirmation
matching eligibility
offer expiry
atomic assignment
price confirmation
cancellation races
live delivery state
delivery OTP
duplicate callbacks
duplicate earnings
admin intervention
```

The project should prioritize **critical business invariants over UI snapshot volume**.

---

# 2. Testing Pyramid

Use four practical levels:

```text
Unit tests
   ↓
Service / integration tests
   ↓
API tests
   ↓
End-to-end browser rehearsal
```

Most critical logic should be covered at the service/API level because that is where RouteBite business rules live.

---

# 3. Tooling

Initial tools:

```text
Jest
Supertest
MongoDB test database / isolated test collections
React Testing Library where useful
manual Socket.IO integration tests initially
```

Browser automation such as Playwright can be added later if the core manual demo becomes stable and repetitive enough to justify it.

Do not delay the first working prototype to build a large automated frontend test suite.

---

# 4. Test Environment Rules

Never run automated tests against the same MongoDB database used for development/demo data.

Use separate environments:

```text
Development DB
Test DB
Production/demo deployment DB
```

Test environment should use its own:

```text
MONGO_URI
JWT_SECRET
Razorpay test credentials
Cloudinary test folder/prefix
```

Tests must not use live payment credentials.

---

# 5. Deterministic Test Data

Create small reusable test factories/builders for:

```text
user
admin
approved partner
pending partner
available-now partner
scheduled trip
order
payment
partner offer
```

Avoid large fixture dumps that are difficult to understand.

Each test should create only the data it needs.

---

# 6. Authentication Tests

Required cases:

```text
register valid user
reject duplicate phone
reject weak/invalid input
password is not stored raw
login valid credentials
reject invalid credentials
JWT cookie is set
protected route rejects anonymous request
logout clears authentication
normal user cannot access admin API
```

Phone verification tests:

```text
OTP expiry
wrong OTP
correct OTP
OTP reuse rejected
attempt limit if implemented
```

---

# 7. Partner Verification Tests

Required:

```text
user can submit one partner application
pending partner cannot become AVAILABLE_NOW
pending partner cannot receive offers
normal user cannot approve partner
admin can approve
admin can reject
approved partner gains partner actions
```

Security test:

Public partner application payload must not be able to set:

```text
verificationStatus = APPROVED
role = ADMIN
```

---

# 8. Order Creation Tests

Test:

```text
valid order draft
manual pickup coordinates
valid delivery coordinates
ASAP request
scheduled request
scheduled time in past rejected
negative food amount rejected
floating authoritative money rejected/normalized according to contract
missing requested items rejected
user cannot access another user's private order operation
```

GeoJSON test must verify coordinate order:

```text
[longitude, latitude]
```

not the reverse.

---

# 9. Payment Tests

Critical cases:

```text
matching cannot start before confirmed payment
successful Razorpay test confirmation updates payment state
failed payment remains retryable
duplicate provider callback is idempotent
same provider event cannot be processed twice
payment belongs to correct order/customer
customer cannot confirm payment amount by modifying frontend payload
```

The backend must calculate/verify authoritative amounts from stored order data.

---

# 10. Matching Tests

Matching tests should focus on eligibility before ranking.

Create scenarios for:

```text
approved AVAILABLE_NOW partner nearby → eligible
unapproved partner nearby → rejected
offline partner nearby → rejected
stale location → rejected
partner with active incompatible order → rejected
partner outside time window → rejected
scheduled trip too late for ASAP order → rejected
scheduled trip compatible with scheduled order → eligible
active trip has passed pickup → rejected
excessive detour → rejected
```

Ranking tests should remain deterministic.

Given the same candidates/input, output order should be stable.

---

# 11. Google Maps Dependency Tests

Do not make every automated test depend on real Google APIs.

Wrap external map calls in a service/adapter and mock it in unit/integration tests.

Test returned conditions such as:

```text
route success
route unavailable
ETA exceeds customer window
Google timeout/error
malformed provider response
```

Have a small number of manual integration checks with real test credentials before demo/deployment.

---

# 12. Offer Dispatch Tests

Test offer generation:

```text
top batch size respected
offer has expiresAt
second batch waits until previous batch ends/no acceptance
offer rejection advances matching
offer expiry advances matching
no candidates ends in MATCHING_FAILED
```

Correctness must not depend solely on background expiry scanning.

An accept request after `expiresAt` must fail even if the periodic expiry job has not updated the record yet.

---

# 13. Atomic Acceptance — Highest Priority Concurrency Test

This is a mandatory automated test.

Setup:

```text
one order in MATCHING
partner A has valid offer
partner B has valid offer
```

Send two accept requests concurrently.

Expected invariant:

```text
exactly one succeeds
exactly one assignment exists
order has exactly one assignedPartnerId
loser receives conflict/no-longer-available response
```

Run this repeatedly, not once.

If this test is unreliable, the prototype is not ready.

---

# 14. Partner Double-Booking Test

Setup:

```text
same partner has offers for order A and order B
```

Try to accept both concurrently.

Expected:

```text
partner ends with at most one incompatible active assignment
```

This must be enforced using atomic query/transaction logic, not just frontend button disabling.

---

# 15. Price Confirmation Tests

Cases:

```text
actual == estimate → no approval required
actual < estimate → automatic downward adjustment
actual > estimate → PRICE_CONFIRMATION_REQUIRED
customer approval updates final demo amount
other user cannot approve
partner cannot approve on customer's behalf
expired confirmation cannot be silently approved
picked-up transition blocked while unresolved increase exists
```

---

# 16. Cancellation Tests

Test state-dependent cancellation:

```text
customer cancels during MATCHING → allowed
customer cancels after assignment before purchase → allowed according to rules
customer cancels after PICKED_UP → self-service rejected
partner cancels before purchase → order rematches if feasible
partner fails after purchase → ADMIN_REVIEW_REQUIRED
completed order cannot be cancelled normally
```

---

# 17. Cancellation vs Acceptance Race

Mandatory race test:

```text
customer cancel request
and
partner accept request
```

sent almost simultaneously.

Expected:

Only one valid final business outcome occurs.

The system must never end with contradictory state such as:

```text
order = CANCELLED
assignment = ACTIVE
```

Use transaction/conditional updates to define the winner.

---

# 18. Delivery Location Tests

Test:

```text
only assigned partner can submit active delivery location
location accepted only during appropriate order state
customer can read latest delivery location
other users cannot subscribe/read private order location
invalid coordinates rejected
```

Socket event loss must not change authoritative MongoDB state.

---

# 19. Socket.IO Tests

At minimum verify manually/integration-level:

```text
authenticated socket connects
user joins only authorized rooms
partner receives own offer
customer receives assignment event
customer receives order status event
customer receives active location event
losing offer is invalidated
socket reconnect + REST refresh restores truth
```

Important rule:

A socket event must never perform a business transition by itself.

The REST API must remain authoritative.

---

# 20. Delivery OTP Tests

Required:

```text
OTP stored hashed
wrong OTP rejected
expired OTP rejected
correct OTP succeeds
OTP is single-use
other partner cannot verify order
completion requires correct order state
```

Repeated valid OTP submission after completion must not create another completion event/earning.

---

# 21. Completion and Ledger Tests

Mandatory invariants:

```text
one completed order → one demo earning
one completed order → no duplicate ledger finalization
partner active assignment cleared
order cannot complete twice
```

Send duplicate completion request and verify idempotent/conflict behavior.

---

# 22. Duplicate Webhook Tests

Store a unique provider event ID or equivalent idempotency record.

Test:

```text
same Razorpay event sent twice
```

Expected:

```text
first processed
second recognized as duplicate
no duplicate payment confirmation
no duplicate matching start
```

---

# 23. Matching Failure and Demo Refund Tests

Scenario:

```text
payment confirmed
matching begins
all offers expire/reject
no candidates remain
```

Expected:

```text
order = MATCHING_FAILED
payment/demo financial state = DEMO_REFUNDED or defined equivalent
customer receives clear result
```

No indefinite `MATCHING` state.

---

# 24. Server Restart Recovery Test

Important manual/integration test:

```text
create pending offer with expiresAt
stop Node server
wait beyond expiry
restart server
attempt offer acceptance
```

Expected:

Acceptance fails because `expiresAt` is authoritative.

Background scan can later mark it EXPIRED, but correctness must already hold.

Also test price-confirmation expiry similarly.

---

# 25. Authorization Matrix Tests

Create tests ensuring users cannot cross boundaries.

Examples:

```text
customer A cannot edit customer B order
partner A cannot accept partner B offer
partner cannot call admin approve endpoint
customer cannot submit partner delivery location
unassigned partner cannot read full customer delivery details
anonymous user cannot read private order
```

Authorization bugs are often more serious than ordinary validation bugs.

---

# 26. Input Validation Tests

For every write API test malformed values:

```text
missing required field
wrong type
invalid ObjectId
negative money
invalid latitude/longitude
unknown status string
oversized text
unexpected object fields where dangerous
```

Do not rely on Mongoose alone for public request validation.

---

# 27. File Upload Tests

Test:

```text
allowed image/document type
unsupported extension/MIME
oversized upload
upload failure
Cloudinary unavailable
user cannot overwrite another user's document reference
```

MongoDB should store references/metadata, not large binary file bodies.

---

# 28. Admin Tests

Test:

```text
admin sees pending partners
admin sees failed orders
admin can inspect receipt metadata
admin intervention action logged
normal user cannot perform admin actions
```

Manual admin operations should still preserve valid state transitions.

---

# 29. Frontend Testing Priorities

Automated frontend tests should focus on business-sensitive UI rather than every component.

Useful examples:

```text
matching screen handles failure
price increase requires explicit approve
wrong OTP displays error
partner offer countdown/expired state
protected admin page redirects/rejects normal user
active delivery refresh reloads state
```

Avoid excessive snapshots.

---

# 30. Manual Demo Regression Checklist

Before every presentation/deployment run:

```text
[ ] register/login
[ ] partner application
[ ] admin approval
[ ] partner AVAILABLE_NOW
[ ] customer order creation
[ ] manual pin fallback
[ ] Razorpay test payment
[ ] matching
[ ] offer received
[ ] partner accepts
[ ] pickup state
[ ] price change approval
[ ] live tracking
[ ] wrong OTP rejected
[ ] correct OTP completes
[ ] demo earning visible
```

Then run one failure case:

```text
[ ] no partner
or
[ ] double accept race
or
[ ] cancellation
```

---

# 31. Test Naming Style

Prefer names that explain business behavior.

Good:

```text
should reject acceptance when offer has expired
should allow only one partner to win concurrent acceptance
should not create partner earning twice for duplicate completion
```

Avoid vague names:

```text
test order
works fine
accept test
```

---

# 32. CI Minimum

Before merging/deploying, CI should eventually run:

```text
npm install / npm ci
lint
tests
frontend build
backend startup/build checks if applicable
```

Do not make deployment depend on a huge pipeline for the prototype.

The pipeline should be fast enough that it is actually used.

---

# 33. Bug Severity

Treat these as **blocker bugs**:

```text
two partners assigned to one order
one partner double-booked incorrectly
duplicate payment processing
duplicate earning
auth bypass
admin privilege bypass
order completed without valid OTP
customer charged/test-committed but stuck forever in matching
wrong customer receives private order/location data
```

Treat visual polish bugs as lower severity unless they prevent the demo flow.

---

# 34. Release Gate

The prototype should not be considered presentation-ready until:

```text
[ ] happy path passes repeatedly
[ ] atomic acceptance test passes
[ ] duplicate callback test passes
[ ] OTP tests pass
[ ] matching failure ends cleanly
[ ] authorization tests pass
[ ] no manual DB edits needed during normal demo
[ ] production/test secrets are not committed
```

---

# 35. Testing Principle

> **Test the invariant, not only the button.**

The most important RouteBite tests prove that the system cannot enter contradictory business states even when requests arrive twice, concurrently, late, or in the wrong order.
