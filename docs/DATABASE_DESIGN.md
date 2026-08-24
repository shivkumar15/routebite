# RouteBite — Database Design

> **Status:** Prototype database specification
>
> This document defines the durable data model for the first working RouteBite prototype. It is derived from `PROJECT_CONTEXT.md`, `DECISIONS.md`, `USER_FLOWS.md`, `PRODUCT_REQUIREMENTS.md`, `PAYMENT_FLOW.md`, `MATCHING_ENGINE.md`, `ARCHITECTURE.md`, and `TECH_STACK.md`.
>
> The primary goal is **data correctness before query cleverness**. The database must make the most dangerous application bugs difficult or impossible: double assignment, duplicate payment processing, duplicate partner earnings, invalid status values, lost timers, accidental public identity documents, and inconsistent order history.

---

# 1. Database Goal

RouteBite will use **PostgreSQL as the single authoritative durable database** for the prototype.

The database stores business truth such as:

```text
Users
Partner profiles
Partner verification
Partner current operational state
Scheduled/on-my-way trips
Orders
Matching runs
Partner offers
Assignments
Payment attempts
Provider webhook events
Price-adjustment state
Demo ledger entries
Delivery OTP state
Ratings
Admin review cases
Audit/order events
Uploaded-file metadata
```

The database does **not** need to permanently store every high-frequency GPS coordinate.

The architecture rule is:

> **If losing a piece of data after a server restart would make an order incorrect, that data belongs in PostgreSQL.**

---

# 2. Database Technology

Prototype database stack:

```text
PostgreSQL
   ↓
Managed by Supabase
   ↓
Accessed by NestJS backend
   ↓
Prisma ORM for normal queries/migrations
```

PostgreSQL is chosen because RouteBite contains strongly related transactional data:

```text
Order
  ↔ Customer
  ↔ Partner
  ↔ Matching offers
  ↔ Assignment
  ↔ Payment
  ↔ Delivery state
```

These relationships benefit from:

- transactions,
- foreign keys,
- unique constraints,
- indexes,
- row-level locking,
- conditional updates,
- strong consistency.

A document database such as MongoDB would not simplify the most difficult RouteBite problems, which are mainly transactional/concurrency problems.

---

# 3. Database Ownership Boundaries

Supabase provides multiple PostgreSQL schemas internally.

RouteBite application tables should live in:

```text
public
```

Supabase-managed authentication data lives in:

```text
auth
```

Supabase Storage metadata lives in:

```text
storage
```

`pg-boss` may create/manage its own internal job tables/schema.

## Important rule

Prisma migrations should own **RouteBite application tables only**.

Do not let Prisma attempt to redesign Supabase's internal `auth` or `storage` schemas.

The frontend must not directly treat PostgreSQL tables as its application API. Normal product data access goes through the NestJS backend.

---

# 4. Authentication User vs Application User

Supabase Auth is the authentication source of truth.

It owns credentials/OTP/session identity.

RouteBite must **not** store:

```text
passwords
raw auth refresh tokens
SMS OTP secrets from Supabase Auth
```

RouteBite has its own application `users` table containing product profile data.

The application user ID should use the same UUID as the authenticated Supabase user ID.

Conceptually:

```text
Supabase Auth User
id = 550e8400-...

        ↓ same UUID

RouteBite public.users
id = 550e8400-...
```

This gives one stable user identifier throughout the system without duplicating authentication credentials.

The backend creates/upserts the RouteBite profile after a valid authenticated identity is established.

---

# 5. Global Database Conventions

## 5.1 Primary keys

Use UUID primary keys for RouteBite business entities.

Examples:

```text
user_id
order_id
trip_id
payment_id
offer_id
assignment_id
```

Reasons:

- difficult to guess sequential IDs,
- easy creation across environments,
- compatible with Supabase Auth UUIDs,
- safe to expose as resource identifiers when authorization is still enforced.

---

## 5.2 Timestamps

All durable timestamps use PostgreSQL:

```text
timestamptz
```

Store timestamps in UTC.

Examples:

```text
created_at
updated_at
expires_at
scheduled_departure_at
assigned_at
verified_at
```

The frontend converts timestamps to the user's local timezone for display.

Never store important times as formatted strings such as:

```text
"6:30 PM"
```

---

## 5.3 Money

All money is stored as **integer paise**, never floating-point rupees.

Example:

```text
₹220.50
↓
22050 paise
```

Recommended PostgreSQL type for prototype monetary fields:

```text
INTEGER
```

This safely supports values far beyond any prototype food order while avoiding JavaScript `BigInt` serialization complexity.

Examples:

```text
estimated_food_cost_paise
actual_food_cost_paise
platform_fee_paise
partner_earning_paise
```

Never use:

```text
FLOAT
DOUBLE
REAL
```

for money.

---

## 5.4 Coordinates

Latitude/longitude use PostgreSQL:

```text
DOUBLE PRECISION
```

with validation constraints:

```text
-90  <= latitude  <= 90
-180 <= longitude <= 180
```

For the campus prototype we do **not require PostGIS initially**.

Reason:

- candidate volume is small,
- coarse bounding/radius filtering is enough,
- Google Maps performs road-routing calculations,
- avoiding PostGIS reduces prototype setup and ORM complexity.

PostGIS can be introduced later when geographic query volume justifies it.

---

## 5.5 Naming

Database physical names should use:

```text
snake_case
```

Examples:

```text
partner_profiles
scheduled_departure_at
estimated_food_cost_paise
```

TypeScript/Prisma code may expose camelCase fields while mapping them to snake_case database names.

The naming convention must remain consistent once implementation begins.

---

## 5.6 Nullability

A column should be nullable only when the business concept is genuinely optional/not-yet-known.

Example:

```text
actual_food_cost_paise = NULL
```

before the partner reaches the vendor is valid.

But:

```text
customer_id = NULL
```

on a normal order is not valid.

Avoid using `NULL` as an undocumented status value.

---

# 6. High-Level Entity Relationship

```text
SUPABASE AUTH USER
        │
        ▼
      users
        │
        ├──────────────► partner_profiles
        │                      │
        │                      ├────► partner_presence
        │                      └────► trips
        │
        └──────────────► orders
                               │
                 ┌─────────────┼───────────────────────┐
                 ▼             ▼                       ▼
           matching_runs   payment_attempts       order_events
                 │             │                       │
                 ▼             ▼                       │
          delivery_offers  payment_webhook_events      │
                 │                                     │
                 ▼                                     │
          order_assignments ◄───────────────────────────┘
                 │
                 ├────► delivery_otps
                 ├────► partner_earnings
                 ├────► ratings
                 └────► admin_cases

uploaded_files may be referenced by partner verification
and order receipt/proof records.
```

---

# 7. `users`

Purpose:

> RouteBite application profile corresponding to an authenticated Supabase user.

Recommended fields:

```text
id UUID PRIMARY KEY
full_name VARCHAR(120) NOT NULL
phone_number VARCHAR(30) NULL
profile_photo_file_id UUID NULL
is_admin BOOLEAN NOT NULL DEFAULT FALSE
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## Important rules

- `id` matches authenticated Supabase Auth UUID.
- Do not store password hashes here when Supabase Auth is used.
- `is_admin` may only be changed by trusted backend/admin migration logic.
- Normal customer capability is implicit; a separate `CUSTOMER` role row is unnecessary.
- Partner capability is determined by `partner_profiles.verification_status`.

Why not build a complex RBAC system now?

The prototype has only three practical capabilities:

```text
normal user
approved partner
admin
```

A generic permission engine would add complexity without solving a current problem.

---

# 8. `uploaded_files`

Purpose:

> Store metadata for private files kept in Supabase Storage.

The database stores file metadata, **not the file bytes**.

Recommended fields:

```text
id UUID PRIMARY KEY
owner_user_id UUID NOT NULL
purpose FILE_PURPOSE NOT NULL
storage_bucket VARCHAR(100) NOT NULL
storage_path TEXT NOT NULL
original_file_name TEXT NULL
mime_type VARCHAR(120) NOT NULL
size_bytes INTEGER NOT NULL
created_at TIMESTAMPTZ NOT NULL
```

Recommended `FILE_PURPOSE` enum:

```text
PROFILE_PHOTO
COLLEGE_ID
PURCHASE_RECEIPT
OTHER_PROTOTYPE_PROOF
```

Constraints:

```text
UNIQUE(storage_bucket, storage_path)
size_bytes > 0
```

## Security rule

`COLLEGE_ID` and `PURCHASE_RECEIPT` files must be stored in private buckets/paths.

Do not persist a permanently public URL for sensitive documents.

Backend-generated signed URLs should be short-lived when an authorized admin/customer/partner needs access.

---

# 9. `partner_profiles`

Purpose:

> Store partner application and verification state for a RouteBite user.

Recommended fields:

```text
id UUID PRIMARY KEY
user_id UUID NOT NULL UNIQUE
verification_status PARTNER_VERIFICATION_STATUS NOT NULL
college_name VARCHAR(180) NULL
enrollment_number VARCHAR(100) NULL
college_id_file_id UUID NULL
profile_photo_file_id UUID NULL
application_note TEXT NULL
rejection_reason TEXT NULL
reviewed_by_user_id UUID NULL
reviewed_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Recommended enum:

```text
PENDING_VERIFICATION
APPROVED
REJECTED
SUSPENDED
```

`SUSPENDED` is useful internally even if it is not a prominent prototype UI state.

Constraints/rules:

- one partner profile per user,
- only `APPROVED` partners may receive offers,
- approval/rejection actions must record reviewer/time,
- do not call this government KYC.

---

# 10. `partner_presence`

Purpose:

> Store the latest operational state/location needed for immediate matching.

This table is **current state**, not permanent GPS history.

Recommended fields:

```text
partner_id UUID PRIMARY KEY
availability_status PARTNER_AVAILABILITY_STATUS NOT NULL
current_latitude DOUBLE PRECISION NULL
current_longitude DOUBLE PRECISION NULL
last_location_at TIMESTAMPTZ NULL
last_seen_at TIMESTAMPTZ NULL
updated_at TIMESTAMPTZ NOT NULL
```

Recommended enum:

```text
OFFLINE
AVAILABLE_NOW
BUSY
```

`BUSY` is an internal operational state used to reduce accidental new offers while the partner already has an active assignment.

## Location rule

When `AVAILABLE_NOW`:

```text
current_latitude
current_longitude
last_location_at
```

should normally exist and be fresh enough for matching.

When an order completes/cancels, the application decides whether the partner returns to `AVAILABLE_NOW` or `OFFLINE` based on the partner's chosen mode.

## Privacy rule

Do not create permanent second-by-second location history just because the client sends location updates.

For the prototype, updating the current row is enough.

---

# 11. `trips`

Purpose:

> Represent planned or active On-My-Way partner journeys.

Recommended fields:

```text
id UUID PRIMARY KEY
partner_id UUID NOT NULL
status TRIP_STATUS NOT NULL
origin_latitude DOUBLE PRECISION NOT NULL
origin_longitude DOUBLE PRECISION NOT NULL
origin_display_text TEXT NULL
destination_latitude DOUBLE PRECISION NOT NULL
destination_longitude DOUBLE PRECISION NOT NULL
destination_display_text TEXT NULL
encoded_route_polyline TEXT NULL
route_distance_meters INTEGER NULL
route_duration_seconds INTEGER NULL
scheduled_departure_at TIMESTAMPTZ NOT NULL
departure_flex_minutes INTEGER NOT NULL
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
cancelled_at TIMESTAMPTZ NULL
current_progress_meters INTEGER NULL
last_progress_updated_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Recommended enum:

```text
TRIP_SCHEDULED
TRIP_ACTIVE
TRIP_COMPLETED
TRIP_CANCELLED
```

Constraints:

```text
departure_flex_minutes >= 0
route_distance_meters >= 0 when not null
route_duration_seconds >= 0 when not null
current_progress_meters >= 0 when not null
```

## Important rule

A `TRIP_SCHEDULED` record does not make the partner `AVAILABLE_NOW`.

Trip state and immediate availability are deliberately separate concepts.

---

# 12. `orders`

Purpose:

> Store the authoritative current state of a customer food-delivery request.

Recommended fields:

```text
id UUID PRIMARY KEY
customer_id UUID NOT NULL
status ORDER_STATUS NOT NULL
delivery_type DELIVERY_TYPE NOT NULL

vendor_display_name VARCHAR(180) NOT NULL
requested_items_text TEXT NOT NULL
pickup_instructions TEXT NULL

pickup_latitude DOUBLE PRECISION NOT NULL
pickup_longitude DOUBLE PRECISION NOT NULL
pickup_display_text TEXT NULL

drop_latitude DOUBLE PRECISION NOT NULL
drop_longitude DOUBLE PRECISION NOT NULL
drop_display_text TEXT NULL

requested_delivery_window_start TIMESTAMPTZ NOT NULL
requested_delivery_window_end TIMESTAMPTZ NOT NULL

estimated_food_cost_paise INTEGER NOT NULL
actual_food_cost_paise INTEGER NULL
customer_delivery_charge_paise INTEGER NOT NULL
partner_base_earning_paise INTEGER NOT NULL
partner_incentive_paise INTEGER NOT NULL DEFAULT 0
platform_fee_paise INTEGER NOT NULL
platform_subsidy_paise INTEGER NOT NULL DEFAULT 0
estimated_customer_total_paise INTEGER NOT NULL
final_customer_total_paise INTEGER NULL

price_adjustment_status PRICE_ADJUSTMENT_STATUS NOT NULL DEFAULT 'NONE'
price_confirmation_requested_at TIMESTAMPTZ NULL
price_confirmation_expires_at TIMESTAMPTZ NULL
price_confirmation_resolved_at TIMESTAMPTZ NULL

receipt_file_id UUID NULL

version INTEGER NOT NULL DEFAULT 0
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
cancelled_at TIMESTAMPTZ NULL
```

## 12.1 Recommended `ORDER_STATUS`

```text
DRAFT
PAYMENT_PENDING
MATCHING
MATCHING_FAILED
ASSIGNED
PARTNER_TO_PICKUP
PRICE_CONFIRMATION_REQUIRED
PICKED_UP
OUT_FOR_DELIVERY
DELIVERY_OTP_REQUIRED
DELIVERED
COMPLETED
CANCELLED
FAILED
ADMIN_REVIEW_REQUIRED
```

Payment status is **not** encoded inside this enum.

That separation prevents confusing states such as trying to use one string to represent both:

```text
order logistics
and
payment settlement
```

## 12.2 `DELIVERY_TYPE`

```text
ASAP
SCHEDULED
```

## 12.3 `PRICE_ADJUSTMENT_STATUS`

```text
NONE
PENDING_CUSTOMER_APPROVAL
APPROVED
REJECTED
TIMED_OUT
AUTO_DECREASED
```

## 12.4 Order constraints

Database/application migrations should enforce where practical:

```text
estimated_food_cost_paise >= 0
actual_food_cost_paise >= 0 when not null
customer_delivery_charge_paise >= 0
partner_base_earning_paise >= 0
partner_incentive_paise >= 0
platform_fee_paise >= 0
platform_subsidy_paise >= 0
estimated_customer_total_paise >= 0
final_customer_total_paise >= 0 when not null
requested_delivery_window_start < requested_delivery_window_end
```

The order row is the source of truth for the **current order status and final order financial snapshot**.

---

# 13. Why Requested Items Are Initially Stored as Text

The prototype does not maintain vendor menus/catalogues.

Therefore we intentionally avoid prematurely building:

```text
products
menu_categories
menu_variants
merchant_inventory
```

A required field such as:

```text
requested_items_text =
"2 Pav Bhaji, extra butter, no onion"
```

matches the actual product requirement and reduces schema/UI complexity.

If RouteBite later introduces merchant catalogues, structured line items can be added without changing the pickup-location thesis.

---

# 14. `matching_runs`

Purpose:

> Represent one complete attempt to find a partner for an order.

This makes matching and rematching debuggable.

Recommended fields:

```text
id UUID PRIMARY KEY
order_id UUID NOT NULL
run_number INTEGER NOT NULL
status MATCHING_RUN_STATUS NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
candidate_count INTEGER NOT NULL DEFAULT 0
offer_count INTEGER NOT NULL DEFAULT 0
failure_reason TEXT NULL
created_at TIMESTAMPTZ NOT NULL
```

Recommended enum:

```text
SEARCHING
SUCCEEDED
FAILED
CANCELLED
```

Constraint:

```text
UNIQUE(order_id, run_number)
```

Example:

```text
run 1 = initial matching
run 2 = rematching after partner cancellation
```

This is preferable to overwriting old matching information and losing why the first attempt failed.

---

# 15. `delivery_offers`

Purpose:

> Persist offers sent to individual partners during matching.

Recommended fields:

```text
id UUID PRIMARY KEY
matching_run_id UUID NOT NULL
order_id UUID NOT NULL
partner_id UUID NOT NULL
trip_id UUID NULL
status OFFER_STATUS NOT NULL
batch_number INTEGER NOT NULL
rank_position INTEGER NOT NULL
predicted_pickup_at TIMESTAMPTZ NULL
predicted_delivery_at TIMESTAMPTZ NULL
pickup_travel_seconds INTEGER NULL
additional_detour_seconds INTEGER NULL
additional_detour_meters INTEGER NULL
offered_partner_earning_paise INTEGER NOT NULL
expires_at TIMESTAMPTZ NOT NULL
responded_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ NOT NULL
```

Recommended enum:

```text
PENDING
ACCEPTED
REJECTED
EXPIRED
CANCELLED
```

Recommended constraint:

```text
UNIQUE(matching_run_id, partner_id)
```

This prevents accidental duplicate offers to the same partner during one matching run.

## Important timer rule

`expires_at` is durable truth.

The worker may use a background job to wake up near that time, but the offer does not remain valid simply because a timer/job was lost.

Any acceptance checks:

```text
now < expires_at
AND status = PENDING
```

before proceeding.

---

# 16. `order_assignments`

Purpose:

> Represent which partner currently owns an order while preserving reassignment history.

This table is central to preventing two major bugs:

1. two partners getting the same order,
2. one partner getting two simultaneous active orders.

Recommended fields:

```text
id UUID PRIMARY KEY
order_id UUID NOT NULL
partner_id UUID NOT NULL
trip_id UUID NULL
source_offer_id UUID NULL
status ASSIGNMENT_STATUS NOT NULL
assigned_at TIMESTAMPTZ NOT NULL
ended_at TIMESTAMPTZ NULL
end_reason TEXT NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Recommended enum:

```text
ACTIVE
ENDED
CANCELLED
```

## 16.1 Critical partial unique indexes

PostgreSQL should enforce:

```sql
CREATE UNIQUE INDEX ux_order_one_active_assignment
ON order_assignments(order_id)
WHERE status = 'ACTIVE';
```

and:

```sql
CREATE UNIQUE INDEX ux_partner_one_active_assignment
ON order_assignments(partner_id)
WHERE status = 'ACTIVE';
```

These are extremely important.

They guarantee at the database layer:

```text
one active partner per order
AND
one active order per partner
```

even if two requests race at exactly the same time.

Prisma may require these partial indexes to be added through a custom/raw SQL migration because they are PostgreSQL-specific.

That is acceptable and preferable to relying only on application memory.

---

# 17. Atomic Partner Acceptance Transaction

When a partner presses **Accept**, do not perform independent database writes such as:

```text
1. update offer
2. later update order
3. later create assignment
```

because a crash between them creates inconsistent state.

Instead use one database transaction.

Conceptually:

```text
BEGIN

1. verify offer belongs to partner
2. verify offer = PENDING
3. verify offer has not expired
4. verify order = MATCHING
5. insert ACTIVE order_assignment
   - unique indexes protect order and partner
6. update offer → ACCEPTED
7. update order → ASSIGNED
8. cancel other PENDING offers for this order/run
9. update matching_run → SUCCEEDED
10. update partner_presence → BUSY
11. append order_event

COMMIT
```

If another partner already won, the unique constraint/conditional state check causes the transaction to fail safely.

The losing request returns:

```text
ORDER_ALREADY_ASSIGNED
```

No partial assignment should survive.

---

# 18. `payment_attempts`

Purpose:

> Store each customer checkout attempt separately from order logistics.

Recommended fields:

```text
id UUID PRIMARY KEY
order_id UUID NOT NULL
attempt_number INTEGER NOT NULL
provider PAYMENT_PROVIDER NOT NULL
mode PAYMENT_MODE NOT NULL
status PAYMENT_STATUS NOT NULL
currency CHAR(3) NOT NULL DEFAULT 'INR'
amount_paise INTEGER NOT NULL
provider_order_id VARCHAR(200) NULL
provider_payment_id VARCHAR(200) NULL
idempotency_key VARCHAR(200) NOT NULL
failure_code VARCHAR(120) NULL
failure_message TEXT NULL
created_at TIMESTAMPTZ NOT NULL
confirmed_at TIMESTAMPTZ NULL
failed_at TIMESTAMPTZ NULL
updated_at TIMESTAMPTZ NOT NULL
```

Enums:

```text
PAYMENT_PROVIDER:
RAZORPAY

PAYMENT_MODE:
TEST
LIVE

PAYMENT_STATUS:
CREATED
PAYMENT_PENDING
PAYMENT_CONFIRMED
PAYMENT_FAILED
DEMO_REFUND_PENDING
DEMO_REFUNDED
DEMO_SETTLEMENT_PENDING
DEMO_SETTLED
```

Prototype uses:

```text
provider = RAZORPAY
mode = TEST
```

Constraints:

```text
UNIQUE(order_id, attempt_number)
UNIQUE(idempotency_key)
UNIQUE(provider_order_id) when not null
UNIQUE(provider_payment_id) when not null
amount_paise >= 0
```

## Important rule

The frontend never makes payment authoritative by writing this table directly.

The backend verifies provider information and performs the state transition.

---

# 19. `payment_webhook_events`

Purpose:

> Make external provider callbacks idempotent and auditable.

Payment providers may retry the same webhook.

Without protection this could accidentally:

```text
confirm payment twice
create duplicate ledger entries
trigger matching twice
```

Recommended fields:

```text
id UUID PRIMARY KEY
provider PAYMENT_PROVIDER NOT NULL
provider_event_id VARCHAR(250) NOT NULL
event_type VARCHAR(160) NOT NULL
processing_status WEBHOOK_PROCESSING_STATUS NOT NULL
payload JSONB NULL
received_at TIMESTAMPTZ NOT NULL
processed_at TIMESTAMPTZ NULL
error_message TEXT NULL
```

Enum:

```text
RECEIVED
PROCESSED
FAILED
IGNORED
```

Critical constraint:

```text
UNIQUE(provider, provider_event_id)
```

Processing pattern:

```text
receive webhook
      ↓
verify signature
      ↓
insert provider_event_id
      ↓
unique violation?
  ├─ yes → already processed/seen; return safe success
  └─ no  → process transactionally
```

Do not store secrets inside webhook payload metadata.

---

# 20. Payment Confirmation Transaction

Payment confirmation is another critical transaction.

Conceptually:

```text
BEGIN

1. lock/read payment attempt
2. verify it is not already confirmed
3. mark payment_attempt = PAYMENT_CONFIRMED
4. ensure order is still PAYMENT_PENDING
5. transition order → MATCHING
6. create matching_run #1 if not already present
7. append order_event

COMMIT
```

If the callback/API request repeats, unique/idempotent checks should return the already-confirmed result instead of creating another matching run.

---

# 21. `demo_ledger_entries`

Purpose:

> Record the prototype's conceptual money movement without pretending that real banking settlement occurred.

Recommended fields:

```text
id UUID PRIMARY KEY
order_id UUID NOT NULL
payment_attempt_id UUID NULL
entry_type LEDGER_ENTRY_TYPE NOT NULL
amount_paise INTEGER NOT NULL
reference_key VARCHAR(160) NOT NULL
note TEXT NULL
created_at TIMESTAMPTZ NOT NULL
```

Recommended entry types:

```text
CUSTOMER_TEST_PAYMENT
FOOD_PRICE_INCREASE
FOOD_PRICE_DECREASE
FOOD_REIMBURSEMENT
PARTNER_BASE_EARNING
PARTNER_INCENTIVE
PLATFORM_FEE
PLATFORM_SUBSIDY
DEMO_REFUND
```

Constraints:

```text
amount_paise >= 0
UNIQUE(order_id, entry_type, reference_key)
```

`reference_key` makes repeated processing safe.

Example:

```text
order-123 | PARTNER_BASE_EARNING | delivery-completion
```

cannot be inserted twice.

Ledger entries are append-only for normal application behavior.

Corrections should create compensating entries rather than silently rewriting historical financial events.

---

# 22. `partner_earnings`

Purpose:

> Provide one authoritative earning record per successfully completed order for the partner dashboard.

Recommended fields:

```text
id UUID PRIMARY KEY
order_id UUID NOT NULL UNIQUE
partner_id UUID NOT NULL
base_earning_paise INTEGER NOT NULL
incentive_paise INTEGER NOT NULL DEFAULT 0
total_earning_paise INTEGER NOT NULL
status PARTNER_EARNING_STATUS NOT NULL
confirmed_at TIMESTAMPTZ NULL
demo_settled_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Enum:

```text
PENDING
CONFIRMED
DEMO_SETTLED
REVERSED
```

Critical constraint:

```text
UNIQUE(order_id)
```

This prevents the same delivered order from generating two partner earnings if completion logic is retried.

---

# 23. Delivery Completion Transaction

Successful OTP verification and completion should use a transaction similar to:

```text
BEGIN

1. validate OTP
2. mark OTP verified
3. transition order to DELIVERED/COMPLETED
4. end ACTIVE assignment
5. create partner_earning if absent
6. create required demo_ledger_entries if absent
7. update payment/demo settlement state
8. update partner_presence from BUSY to chosen post-order state
9. append order_event

COMMIT
```

Because `partner_earnings.order_id` is unique, a retry cannot create a second earning.

Because ledger entries have unique reference keys, repeated completion cannot double-book them.

---

# 24. `delivery_otps`

Purpose:

> Securely represent the OTP required for delivery handoff.

Recommended fields:

```text
id UUID PRIMARY KEY
order_id UUID NOT NULL UNIQUE
code_hash VARCHAR(255) NOT NULL
expires_at TIMESTAMPTZ NOT NULL
attempt_count INTEGER NOT NULL DEFAULT 0
max_attempts INTEGER NOT NULL
verified_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

## Security rules

Never store:

```text
plain OTP
```

Store only a one-way hash suitable for short secret verification, combined with rate/attempt limits.

Verification requires:

```text
verified_at IS NULL
AND now < expires_at
AND attempt_count < max_attempts
```

After successful verification:

```text
verified_at = now
```

A verified OTP cannot be reused.

---

# 25. `ratings`

Purpose:

> Store customer rating of the partner after a completed order.

Recommended fields:

```text
id UUID PRIMARY KEY
order_id UUID NOT NULL UNIQUE
customer_id UUID NOT NULL
partner_id UUID NOT NULL
score SMALLINT NOT NULL
comment TEXT NULL
created_at TIMESTAMPTZ NOT NULL
```

Constraints:

```text
1 <= score <= 5
UNIQUE(order_id)
```

The backend must verify:

```text
order.customer_id == rating.customer_id
order was completed
partner was the completed assignment partner
```

before inserting.

---

# 26. `admin_cases`

Purpose:

> Handle prototype situations that intentionally require manual intervention.

Examples:

```text
partner failure after purchase
price disagreement
failed delivery
post-pickup cancellation request
receipt dispute
```

Recommended fields:

```text
id UUID PRIMARY KEY
order_id UUID NOT NULL
case_type ADMIN_CASE_TYPE NOT NULL
status ADMIN_CASE_STATUS NOT NULL
opened_by_user_id UUID NULL
reason TEXT NOT NULL
resolution_note TEXT NULL
resolved_by_user_id UUID NULL
created_at TIMESTAMPTZ NOT NULL
resolved_at TIMESTAMPTZ NULL
updated_at TIMESTAMPTZ NOT NULL
```

Enums can initially include:

```text
ADMIN_CASE_TYPE:
PRICE_DISPUTE
PARTNER_FAILURE_AFTER_PURCHASE
DELIVERY_FAILURE
CANCELLATION_AFTER_PICKUP
OTHER

ADMIN_CASE_STATUS:
OPEN
RESOLVED
CANCELLED
```

This avoids inventing automatic financial/legal outcomes where the prototype intentionally uses human review.

---

# 27. `order_events`

Purpose:

> Immutable operational/audit history for debugging an order.

The current order state still lives in `orders.status`.

`order_events` explains **how it got there**.

Recommended fields:

```text
id UUID PRIMARY KEY
order_id UUID NOT NULL
event_type VARCHAR(120) NOT NULL
from_status ORDER_STATUS NULL
to_status ORDER_STATUS NULL
actor_type ACTOR_TYPE NOT NULL
actor_user_id UUID NULL
metadata JSONB NULL
created_at TIMESTAMPTZ NOT NULL
```

Recommended actor types:

```text
CUSTOMER
PARTNER
ADMIN
SYSTEM
PAYMENT_PROVIDER
WORKER
```

Example events:

```text
ORDER_CREATED
PAYMENT_CONFIRMED
MATCHING_STARTED
OFFER_SENT
PARTNER_ASSIGNED
PRICE_CONFIRMATION_REQUESTED
PRICE_APPROVED
FOOD_PICKED_UP
OTP_VERIFIED
ORDER_COMPLETED
ORDER_CANCELLED
```

## Important rule

`order_events` is append-only audit data.

Do not reconstruct the current order status by replaying events in the prototype.

We are **not implementing event sourcing**.

The authoritative current state remains `orders.status`.

---

# 28. Source-of-Truth Matrix

To reduce bugs, each concept must have one clear authoritative location.

| Concept | Source of truth |
|---|---|
| Authenticated identity | Supabase Auth |
| Product user profile | `users` |
| Partner verification | `partner_profiles.verification_status` |
| Current online/location state | `partner_presence` |
| Scheduled/on-my-way trip | `trips` |
| Current order state | `orders.status` |
| Current active assignment | `order_assignments` where `status = ACTIVE` |
| Offer validity | `delivery_offers.status + expires_at` |
| Payment attempt state | `payment_attempts.status` |
| Provider webhook deduplication | `payment_webhook_events` unique provider event ID |
| Final order financial snapshot | amount fields on `orders` |
| Demo financial history | `demo_ledger_entries` |
| Partner earning settlement demo | `partner_earnings` |
| Delivery verification | `delivery_otps` |
| Order history/debug audit | `order_events` |
| Uploaded file bytes | Supabase Storage |
| Uploaded file metadata | `uploaded_files` |

When code needs to know something, it should read the appropriate source instead of inventing a second copy.

---

# 29. Foreign-Key Strategy

Use foreign keys for RouteBite-owned relational data.

Examples:

```text
partner_profiles.user_id → users.id
trips.partner_id → partner_profiles.id (or canonical partner identifier)
orders.customer_id → users.id
matching_runs.order_id → orders.id
delivery_offers.order_id → orders.id
order_assignments.order_id → orders.id
payment_attempts.order_id → orders.id
ratings.order_id → orders.id
```

## Deletion policy

For durable business/financial entities prefer:

```text
ON DELETE RESTRICT
```

rather than broad cascading deletes.

An accidental user deletion should not silently erase:

```text
orders
payments
assignment history
financial records
```

For the prototype, users/orders with business history should normally be deactivated/status-managed rather than physically deleted.

---

# 30. Index Strategy

Indexes should support actual product queries, not be added randomly.

Recommended starting indexes:

## Users/partners

```text
partner_profiles(verification_status)
partner_presence(availability_status, last_location_at)
```

For coarse location discovery:

```text
partner_presence(current_latitude, current_longitude)
```

At campus scale this is sufficient alongside application-level bounding-box filtering.

## Trips

```text
trips(partner_id, status)
trips(status, scheduled_departure_at)
```

## Orders

```text
orders(customer_id, created_at DESC)
orders(status, created_at)
```

## Matching

```text
matching_runs(order_id, run_number)
delivery_offers(order_id, status)
delivery_offers(partner_id, status, expires_at)
delivery_offers(status, expires_at)
```

## Assignments

```text
order_assignments(order_id, status)
order_assignments(partner_id, status)
```

plus the critical partial unique indexes for ACTIVE assignments.

## Payments

```text
payment_attempts(order_id, created_at DESC)
payment_attempts(provider_payment_id)
payment_webhook_events(provider, provider_event_id)
```

## Audit/admin

```text
order_events(order_id, created_at)
admin_cases(status, created_at)
partner_earnings(partner_id, created_at DESC)
```

Indexes should be measured later; do not create dozens of speculative indexes because every index also increases write/storage cost.

---

# 31. Order State Transition Safety

The database stores the current status, but allowed transitions belong in one centralized backend state-machine/domain service.

Do not allow arbitrary code to execute:

```text
order.status = anything
```

Examples of valid conceptual transitions:

```text
DRAFT
→ PAYMENT_PENDING

PAYMENT_PENDING
→ MATCHING

MATCHING
→ ASSIGNED
or MATCHING_FAILED

ASSIGNED
→ PARTNER_TO_PICKUP

PARTNER_TO_PICKUP
→ PRICE_CONFIRMATION_REQUIRED
or PICKED_UP

PRICE_CONFIRMATION_REQUIRED
→ PICKED_UP
or CANCELLED
or ADMIN_REVIEW_REQUIRED

PICKED_UP
→ OUT_FOR_DELIVERY

OUT_FOR_DELIVERY
→ DELIVERY_OTP_REQUIRED

DELIVERY_OTP_REQUIRED
→ DELIVERED

DELIVERED
→ COMPLETED
```

Failure/admin paths are handled explicitly.

## Conditional updates

Important transitions should include the expected current state in the database update.

Example concept:

```sql
UPDATE orders
SET status = 'ASSIGNED', version = version + 1
WHERE id = :order_id
  AND status = 'MATCHING';
```

If affected rows = 0, another operation changed the order and this request must re-read state rather than overwrite it.

---

# 32. Optimistic Version Field

`orders.version` exists to help detect stale writes.

Typical concept:

```text
client/service reads version = 7

update expects version = 7

successful update:
version becomes 8
```

If version is already 8, the stale operation must not blindly overwrite newer state.

Not every simple query needs optimistic locking, but it is useful for high-risk operations such as:

- cancellation vs acceptance,
- price approval vs timeout,
- admin action vs partner action.

Database transactions/unique constraints remain the main protection for assignment/payment races.

---

# 33. Cancellation vs Partner Acceptance Race

Possible race:

```text
Customer presses Cancel
at almost the same instant
Partner presses Accept
```

Both operations must not succeed independently.

The solution is conditional state + transaction logic.

Acceptance requires:

```text
order.status = MATCHING
```

Cancellation also requires an allowed cancellable state.

Whichever transaction successfully changes/locks the authoritative state first wins.

The second operation re-reads the order and returns the correct outcome.

Do not solve this using frontend button disabling alone.

---

# 34. Price Confirmation Timer

Do not rely on:

```text
setTimeout(...3 minutes...)
```

inside one Node.js process as the source of truth.

Store:

```text
price_confirmation_expires_at
```

on the order.

The worker schedules/checks the deadline.

If the server restarts, it can query:

```text
price_adjustment_status = PENDING_CUSTOMER_APPROVAL
AND price_confirmation_expires_at <= now
```

and safely apply timeout behavior.

The same principle applies to offer expiry.

---

# 35. Background Jobs (`pg-boss`)

`pg-boss` uses PostgreSQL for durable background jobs.

Possible RouteBite jobs:

```text
expire delivery offer
continue next matching batch
price confirmation timeout
matching timeout/failure
scheduled matching work
reconciliation/recovery checks
```

## Important rule

A background job is a **wake-up mechanism**, not the business source of truth.

Example:

```text
job says "expire offer 123"
```

worker must still check:

```text
offer exists
status = PENDING
expires_at <= now
```

before changing it.

This makes repeated/delayed jobs safe.

Do not manually modify pg-boss internal tables from RouteBite business code.

---

# 36. Reconciliation Queries

For a lower-bug prototype, the worker should periodically repair/check states that may have been interrupted by process crashes.

Examples:

```text
PENDING offers whose expires_at is in the past

PENDING price confirmations whose deadline passed

MATCHING orders with no active matching run

ASSIGNED orders with no ACTIVE assignment

ACTIVE assignments whose orders are terminal

COMPLETED orders missing partner_earnings
```

The reconciliation job should be conservative and idempotent.

It should log/raise admin review rather than guessing when the correct outcome is ambiguous.

---

# 37. Direct Database Access Rule

Application clients must not perform unrestricted direct writes to business tables.

Preferred flow:

```text
React client
    ↓
NestJS API
    ↓
Authorization + validation + domain rules
    ↓
Prisma/PostgreSQL
```

Why?

If the frontend could directly write:

```text
order.status = COMPLETED
partner.verification_status = APPROVED
payment.status = PAYMENT_CONFIRMED
```

most backend invariants become meaningless.

Supabase may still be used directly by the frontend for carefully scoped authentication behavior, but RouteBite business state changes remain backend-controlled.

---

# 38. Row-Level Security / Supabase Safety

Because Supabase exposes APIs around PostgreSQL, application tables should not accidentally become publicly readable/writable.

Recommended prototype posture:

- enable RLS on RouteBite public tables where exposed through Supabase APIs,
- define no broad anonymous mutation policies,
- backend database/service access performs trusted operations,
- frontend business data normally comes from NestJS APIs,
- Storage buckets containing IDs/receipts remain private.

The exact Supabase policy SQL can be implemented during scaffold/security work.

---

# 39. Transaction Boundaries

Use a transaction when multiple writes together represent **one business fact**.

Critical transaction examples:

```text
Payment confirmation
Partner offer acceptance/assignment
Customer cancellation with assignment release
Partner cancellation/rematching transition
Price approval + final amount update
OTP verification + order completion + earning creation
Admin resolution that changes order/financial state
```

Do not put slow external network calls inside database transactions when avoidable.

Bad:

```text
BEGIN
call Google Maps for 3 seconds
call Razorpay
update database
COMMIT
```

Better:

```text
call external provider
validate response

BEGIN
persist resulting business transition quickly
COMMIT
```

Transactions should be short to reduce lock contention/deadlocks.

---

# 40. External Provider Data

Do not let Google/Razorpay response JSON become the only representation of important business information.

Example:

Google may return a route object.

RouteBite should extract/store the values it actually needs:

```text
route duration
route distance
encoded polyline
predicted pickup/delivery timestamps
```

Provider metadata can additionally be stored in limited JSONB when useful for debugging, but core fields remain explicit/typed.

Likewise payment provider IDs should have their own indexed columns.

---

# 41. JSONB Usage Rule

JSONB is allowed for:

```text
audit metadata
provider webhook payload snapshot
non-critical matching debug metadata
```

JSONB should **not** replace typed columns for core fields such as:

```text
order status
customer ID
partner ID
money
payment status
pickup coordinates
assignment
```

If the application frequently filters/validates a value, it probably deserves a real column.

---

# 42. No Generic Soft Delete Everywhere

Do not add:

```text
deleted_at
```

to every table by habit.

RouteBite business entities already have explicit lifecycle states.

Examples:

```text
order → CANCELLED
trip → TRIP_CANCELLED
partner → SUSPENDED
admin case → RESOLVED
```

Durable transactional history should usually remain stored.

Physical cleanup may later exist for temporary/upload data according to privacy/retention rules.

---

# 43. Data Retention for Location

The prototype should minimize location retention.

`partner_presence` stores only the latest relevant coordinate.

When partner stops sharing location:

- location does not need to be continually appended to history,
- the application may clear coordinates after a reasonable inactive period if desired,
- completed orders keep business timestamps but not full second-by-second movement history.

If historical route evidence becomes necessary later, design a deliberate retention policy rather than silently accumulating GPS data forever.

---

# 44. Migration Strategy

All application schema changes must be versioned in migrations.

Use Prisma migrations for normal schema evolution.

Use reviewed raw SQL inside migrations for PostgreSQL features Prisma cannot fully express, especially:

```text
partial unique indexes
specific CHECK constraints
special database indexes if later required
```

Rules:

1. never manually edit production/prototype DB schema without migration history,
2. review generated SQL before applying destructive migrations,
3. backup important demo data before risky schema changes,
4. never use `prisma db push` as the uncontrolled deployment strategy once shared environments exist,
5. seed data separately from schema migrations.

---

# 45. Seed Data

A reproducible demo environment should include seed capability.

Seed examples:

```text
Admin user profile reference
Approved test partner A
Approved test partner B
Pending partner
Sample campus coordinates
Sample scheduled trip
Optional historical completed order/rating
```

Do not seed real identity documents, real Aadhaar data, or real payment credentials.

Use clearly synthetic demo data.

---

# 46. Database Testing Requirements

The database design is not complete until the dangerous invariants are tested.

Minimum integration tests:

```text
[ ] Two partners accept same order concurrently → only one ACTIVE assignment

[ ] One partner accepts two orders concurrently → only one ACTIVE assignment

[ ] Duplicate Razorpay webhook event → processed only once

[ ] Duplicate delivery completion request → only one partner earning

[ ] Duplicate rating submission → only one rating per order

[ ] Expired offer cannot be accepted

[ ] Pending partner cannot receive offer

[ ] Wrong order state cannot transition to PICKED_UP

[ ] Customer cannot cancel completed order

[ ] OTP cannot be reused after verification

[ ] Price timeout survives worker restart/reconciliation

[ ] Offer timeout survives worker restart/reconciliation

[ ] Deleting user cannot accidentally cascade-delete order/payment history
```

Concurrency tests should use the real PostgreSQL test database, not only mocks.

---

# 47. Initial Tables Summary

P0/P1 application tables:

```text
users
uploaded_files
partner_profiles
partner_presence
trips
orders
matching_runs
delivery_offers
order_assignments
payment_attempts
payment_webhook_events
demo_ledger_entries
partner_earnings
delivery_otps
ratings
admin_cases
order_events
```

This may look like several tables, but each represents a distinct business responsibility.

They all live inside **one PostgreSQL database** and one modular-monolith application architecture.

We are not creating separate databases/services for each domain.

---

# 48. Tables We Deliberately Do Not Need Yet

Do not add until requirements justify them:

```text
vendors
merchant_accounts
menus
menu_categories
inventory
shopping_cart
coupons
subscription plans
bank_accounts
real payout accounts
Aadhaar records
fraud_scores
ML feature tables
multi-order route batches
city/zone sharding metadata
Kafka/event-store tables
chat message infrastructure
```

This keeps the prototype aligned with the actual product.

---

# 49. Recommended Prisma Module Ownership

The backend should not have one giant file directly querying every table.

Suggested domain ownership:

```text
Auth/User module
  users

Partner module
  partner_profiles
  partner_presence
  uploaded_files (partner docs)

Trip module
  trips

Order module
  orders
  order_assignments
  order_events

Matching module
  matching_runs
  delivery_offers

Payment module
  payment_attempts
  payment_webhook_events
  demo_ledger_entries
  partner_earnings

Delivery module
  delivery_otps

Rating module
  ratings

Admin module
  admin_cases
```

Modules may use shared repository/database infrastructure, but ownership clarifies which business service is allowed to mutate which state.

---

# 50. Implementation Order

Create the schema in an order that allows vertical testing early.

Recommended sequence:

```text
1. users
2. uploaded_files
3. partner_profiles
4. partner_presence
5. trips
6. orders
7. payment_attempts
8. matching_runs
9. delivery_offers
10. order_assignments
11. order_events
12. delivery_otps
13. demo_ledger_entries
14. partner_earnings
15. ratings
16. admin_cases
17. payment_webhook_events
```

Then immediately add:

```text
constraints
indexes
partial unique assignment indexes
seed script
integration tests
```

Do not postpone integrity constraints until after feature development.

---

# 51. Database Acceptance Criteria

Before API implementation is considered stable, verify:

```text
[ ] Every business table has a clear owner/source-of-truth purpose
[ ] UUIDs are used consistently
[ ] All business timestamps use TIMESTAMPTZ
[ ] All monetary values use integer paise
[ ] Coordinate ranges are validated
[ ] Foreign keys exist for RouteBite-owned relationships
[ ] Sensitive files are private and referenced by metadata IDs
[ ] Order/payment/assignment states use constrained enums
[ ] One ACTIVE assignment per order is DB-enforced
[ ] One ACTIVE assignment per partner is DB-enforced
[ ] Payment provider event IDs are unique
[ ] Partner earning is unique per order
[ ] Rating is unique per order
[ ] Delivery OTP stores a hash, not plaintext
[ ] Offer/price deadlines are stored durably
[ ] Order events provide enough history to debug demo failures
[ ] Critical multi-write operations use transactions
[ ] Worker jobs re-check database truth before acting
[ ] No critical business truth exists only in process memory
```

---

# 52. Final Database Principle

The RouteBite prototype should prefer database-enforced invariants over assumptions such as:

```text
"the frontend won't send this twice"
"two partners probably won't accept simultaneously"
"the webhook probably arrives once"
"the server probably won't restart during the timer"
```

Those assumptions eventually fail.

The safer model is:

> **Application code decides what should happen; PostgreSQL guarantees that impossible states cannot be committed easily.**

That principle should guide every schema or concurrency change made after this document.
