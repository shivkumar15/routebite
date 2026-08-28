# Phase 10 — Delivery OTP and Completion

## Goal

Finish an active delivery safely after the customer physically receives the food.

Phase 10 owns:

```text
OUT_FOR_DELIVERY
  -> DELIVERY_OTP_REQUIRED
  -> DELIVERED
  -> COMPLETED
```

`DELIVERED` is recorded inside the completion transaction and the externally persisted successful end state becomes `COMPLETED`.

## Partner flow

While `OUT_FOR_DELIVERY`, the partner sees:

```text
I reached the customer · Request OTP
```

This does not complete the order. It only moves the order to `DELIVERY_OTP_REQUIRED` and tells the customer that delivery confirmation is required.

The partner API never receives or reveals the plaintext OTP unless the customer verbally/shares it during handoff and the partner types it into the verification form.

## Customer flow

When the order becomes `DELIVERY_OTP_REQUIRED`, the customer sees a delivery-confirmation panel.

The customer presses `Generate delivery OTP` only when ready to receive the food.

Prototype OTP policy:

- 6 numeric digits
- valid for 5 minutes
- maximum 5 incorrect attempts per generated code
- a customer may generate a replacement OTP if the old code expires or is lost
- generating a replacement code invalidates the previous one

The plaintext OTP is returned only in the generation response and kept only in the current customer page state. RouteBite does not persist plaintext OTP.

If the page is refreshed, the previous plaintext code cannot be revealed again. The customer can rotate to a new OTP instead.

The UI tells the customer to share the code only after the food is physically received.

## OTP storage

The order stores only an HMAC-SHA256 hash scoped to the order ID, plus:

```text
generatedAt
expiresAt
attempts
usedAt
```

The hash field is excluded from normal Mongoose queries.

## Verification

Partner submits the 6-digit OTP to the backend.

Backend rejects:

- missing/not-generated OTP
- wrong OTP
- expired OTP
- more than the allowed attempts
- reused OTP
- delivery that is no longer waiting for OTP

Wrong attempts are persisted. The partner UI shows the remaining attempts returned by the backend.

## Completion transaction

A correct OTP executes one MongoDB transaction that:

1. atomically consumes the OTP and records `deliveredAt`,
2. creates the partner earning with one-record-per-order protection,
3. clears `partner.activeOrderId`, keeps the partner `OFFLINE`, and increments `completedOrderCount`,
4. finalizes the order as `COMPLETED` with `completedAt`.

If any invariant fails, the transaction rolls back.

After commit, Socket.IO notifies both customer and partner. MongoDB remains authoritative.

## Minimal earning boundary

Phase 10 creates the minimum safe earning record because completion must never produce duplicate earnings.

The record contains:

```text
orderId (unique)
partnerId
baseEarningPaise
incentivePaise
totalEarningPaise
earnedAt
```

Phase 11 expands this into the full demo ledger and earnings UI.

## Tracking boundary

Tracking remains valid during `OUT_FOR_DELIVERY` and `DELIVERY_OTP_REQUIRED` so the customer can still see the latest partner location while completing handoff.

After `COMPLETED`, tracking is inactive because the order is terminal and the partner's active-order link is cleared.

## Manual validation

Use an existing `OUT_FOR_DELIVERY` order.

1. Partner clicks `I reached the customer · Request OTP`.
2. Both sides should show `DELIVERY_OTP_REQUIRED`.
3. Customer clicks `Generate delivery OTP` and sees a 6-digit code.
4. Partner should detect that an OTP is active without receiving the code itself.
5. Enter `000000` first. Generated OTPs are 100000–999999, so this is a guaranteed incorrect test code. Backend should reject it and report 4 attempts remaining.
6. Enter the actual customer OTP.
7. Partner Active Delivery should disappear and the partner should become free of `activeOrderId` while remaining offline.
8. Customer should show `COMPLETED` without manually relying on socket state.
9. Refresh both pages: customer remains `COMPLETED`, partner has no active order.
10. Partner may now choose `Go available now` for a new request.

Automated tests additionally cover OTP policy/hash persistence, auth protection, expiry indexing, integer-paise earnings, and the unique earning-per-order invariant.

## Exit criteria

```text
[ ] wrong OTP rejected
[ ] expired OTP rejected by service contract
[ ] correct OTP completes once
[ ] OTP cannot be reused
[ ] duplicate completion cannot duplicate earning
[ ] partner active-order link is cleared
[ ] tracking stops after completion
[ ] customer and partner recover correct state from REST after refresh
```
