# Phase 11 — Demo Ledger and Earnings

Phase 11 adds an internal accounting representation without pretending that Razorpay Test Mode performs real settlement, payout, extra charge, or refund movement.

## Design decision

RouteBite does **not** introduce a second mutable ledger collection in this phase.

The demo ledger is a deterministic projection of canonical records:

```text
Order + confirmed Payment + PartnerEarning
        ↓
Demo accounting projection
```

This avoids duplicating order/payment truth and keeps provider payment state separate from prototype accounting.

## Customer demo ledger

Endpoint:

```text
GET /api/v1/orders/:orderId/demo-ledger
```

The endpoint is owner-scoped and authenticated.

It represents:

```text
customer Razorpay test payment
estimated/current demo total
customer demo adjustment
food reimbursement
partner base earning
partner incentive
partner total earning
platform fee
platform subsidy
demo refund representation
demo extra-charge representation
settlement representation
```

All money values remain integer paise.

### Completed order

For a completed order:

```text
food reimbursement = actual food price if reported, otherwise estimate
partner base earning = canonical PartnerEarning base
partner incentive = canonical PartnerEarning incentive
partner total earning = base + incentive snapshot
platform fee = final order platform fee
platform subsidy = partner incentive
```

If the final demo total is lower than the original test payment, the difference appears as a demo refund representation.

If the final demo total is higher, the difference appears as a demo additional-charge representation.

Neither means that a live provider refund or extra charge occurred.

### Matching failure

If a paid order reaches `MATCHING_FAILED`:

```text
current demo total = 0
food reimbursement = 0
partner earning = 0
platform fee retained = 0
full confirmed test payment = demo refund represented
```

This is intentionally derived from canonical order/payment state instead of mutating Razorpay provider status.

## Partner earnings

Endpoint:

```text
GET /api/v1/partner/earnings
```

Only approved authenticated partners can read their own earnings.

The response contains:

```text
completed earning count
base earning total
incentive total
total demo earnings
per-order earning history
```

The one-earning-per-order invariant remains enforced by the unique `PartnerEarning.orderId` index created in Phase 10.

## Incentive and subsidy

Partner incentive and platform subsidy are exposed as separate values even when the current prototype incentive is `₹0.00`.

When an incentive policy is activated later, platform subsidy will equal the platform-funded incentive instead of hiding that amount inside base delivery economics.

## UI

Customer:

```text
My requests
  → completed order → View demo ledger
  → matching failed order → View demo refund
```

Partner:

```text
Delivery offers
  → Demo earnings
```

## Manual verification

### Completed order

Use an already completed Phase 10 order.

Expected customer ledger:

```text
outcome = COMPLETED
Razorpay test payment visible
food reimbursement visible
partner base earning visible
partner incentive visible separately
partner total earning visible
platform fee visible
platform subsidy visible separately
settlement clearly labelled as demo-only
```

Expected partner earnings:

```text
completed earning count >= 1
the completed order appears once
base/incentive/total are separate
refresh does not duplicate the earning
```

### Matching failure

Use any previously paid order that ended in `MATCHING_FAILED`.

Expected:

```text
outcome = MATCHING_FAILED
current demo total = ₹0.00
full test payment shown as demo refund represented
food reimbursement = ₹0.00
partner earning = ₹0.00
platform fee = ₹0.00
explicit note says no live provider refund occurred
```

## Phase boundary

Phase 11 explains prototype accounting and partner earnings.

Phase 12 owns cancellation/failure recovery actions and state-machine recovery behavior. Phase 13 owns admin operations and manual issue resolution.
