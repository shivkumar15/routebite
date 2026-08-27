# RouteBite — Phase 5 Razorpay Test Payment

> **Status:** IMPLEMENTED — MANUAL END-TO-END VERIFICATION REQUIRED

Phase 5 implements Razorpay **Test Mode** checkout while keeping payment state separate from order fulfillment state.

## Flow

```text
DRAFT
  ↓ create/reuse payment attempt
AWAITING_PAYMENT
  ↓ Razorpay Test Checkout
browser receives provider ids/signature
  ↓
RouteBite backend verifies HMAC signature
  ↓
payment.status = PAYMENT_CONFIRMED
order.status = MATCHING
```

The Phase 6 matching engine will consume orders that are already in `MATCHING`.

## Authoritative pricing

Prototype pricing is calculated only on the backend:

```text
estimated food cost
+ ₹40 customer delivery charge
+ ₹10 platform fee
= estimated customer total
```

The partner base earning is tracked separately from the customer-facing delivery charge even though both are ₹40 in the initial prototype hypothesis.

All money is integer paise.

## Payment safety rules

- Razorpay Key Secret never reaches the frontend.
- Backend creates the Razorpay Order.
- Browser cannot choose the payment amount.
- Browser checkout success does not confirm payment by itself.
- Backend verifies HMAC-SHA256 using the provider order id stored in RouteBite's database.
- One active payment attempt is allowed per RouteBite order.
- `Idempotency-Key` protects payment creation retries.
- Provider payment ids are unique.
- Payment confirmation and `AWAITING_PAYMENT -> MATCHING` run in one MongoDB transaction.
- A failed/cancelled checkout never makes an unpaid order eligible for matching.

## Razorpay configuration

Backend `.env`:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Generate API keys while the Razorpay Dashboard is in **Test Mode**.

The Key ID may be returned to Standard Checkout. The Key Secret and webhook secret remain server-only.

## Webhook endpoint

```text
POST /api/v1/webhooks/razorpay
```

The webhook route is mounted with `express.raw()` before normal JSON parsing because Razorpay signs the exact raw request body.

Duplicate events are deduplicated with `x-razorpay-event-id`.

Implemented payment events:

```text
payment.captured
payment.failed
```

For local development, Razorpay cannot call `localhost` directly. Browser callback + backend payment-signature verification is sufficient for the Phase 5 manual checkout test. Webhook end-to-end testing requires a public HTTPS endpoint/tunnel or deployed backend.

## Manual exit criteria

```text
[ ] draft shows backend-calculated checkout breakdown
[ ] Razorpay Test Checkout opens
[ ] successful test payment is backend-confirmed
[ ] order becomes MATCHING only after confirmation
[ ] refreshing retains PAYMENT_CONFIRMED
[ ] closing checkout leaves order AWAITING_PAYMENT and allows retry
[ ] duplicate/retry does not create another active logical attempt
[ ] failed/unpaid request never becomes MATCHING
```
