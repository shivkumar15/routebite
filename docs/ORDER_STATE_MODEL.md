# RouteBite — Canonical Order State Model

> **Status:** CONFIRMED FOR PROTOTYPE
>
> This document is the canonical source of truth for order-state semantics from Phase 4 onward. Where older sections of `DATABASE_DESIGN.md`, `PRODUCT_REQUIREMENTS.md`, `PAYMENT_FLOW.md`, or `IMPLEMENTATION_PLAN.md` conflict with this document, this document wins until those older sections are cleaned up.

## Core rule

Order state and payment state are separate concepts.

- `order.status` describes fulfillment/business progress.
- payment status lives in the payment model introduced in the payment phase.
- provider/test-payment events may appear in the order timeline, but they are not order statuses.

## Canonical order statuses

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
FAILED
ADMIN_REVIEW_REQUIRED
```

### Phase 4

New customer orders begin only as:

```text
DRAFT
```

Phase 4 does not move an order into payment or matching states.

### Phase 5 payment handoff

When checkout/payment begins, the order may move:

```text
DRAFT -> AWAITING_PAYMENT
```

Payment itself is tracked separately using payment states such as:

```text
CREATED
PAYMENT_PENDING
PAYMENT_CONFIRMED
PAYMENT_FAILED
DEMO_REFUND_PENDING
DEMO_REFUNDED
DEMO_SETTLEMENT_PENDING
DEMO_SETTLED
```

Matching may begin only after authoritative backend payment confirmation:

```text
payment.status = PAYMENT_CONFIRMED
order.status = MATCHING
```

## Explicitly not order statuses

The following must not be stored in `order.status`:

```text
PAYMENT_PENDING
TEST_PAYMENT_SUCCESS
PAYMENT_FAILED
PAYMENT_CONFIRMED
```

`TEST_PAYMENT_SUCCESS` may be recorded as a timeline/event label if useful, but never as the order's durable fulfillment state.

## Phase 4 editability rule

A customer may create or edit only their own order while:

```text
order.status = DRAFT
```

No generic API may accept an arbitrary `status` field from a customer.

## Location rule

Pickup and drop points are stored internally as GeoJSON:

```js
{
  type: 'Point',
  coordinates: [longitude, latitude]
}
```

The user-facing product should eventually use search/map-pin selection; latitude and longitude are implementation details rather than expected user knowledge.

## Money rule

All authoritative money values use integer paise.

```text
₹200.00 -> 20000
```

Floating-point rupee values are not authoritative storage.
