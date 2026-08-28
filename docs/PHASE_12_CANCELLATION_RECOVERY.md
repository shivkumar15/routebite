# Phase 12 — Cancellation and Failure Recovery

## Goal

Every cancellation/failure ends in a durable visible state. RouteBite must not leave an order, partner, offer, or demo financial outcome stuck indefinitely.

## Customer cancellation

Automatic customer cancellation is allowed only before food pickup:

`DRAFT`, `AWAITING_PAYMENT`, `MATCHING`, `ASSIGNED`, `PARTNER_TO_PICKUP`, `PRICE_CONFIRMATION_REQUIRED` → `CANCELLED`

If payment was already confirmed, the demo ledger represents a full refund. This does not issue or claim a live Razorpay refund.

After `PICKED_UP`, automatic customer cancellation is blocked because food/payment exposure already exists.

## Partner cannot complete

A single partner recovery action classifies the order by purchase boundary.

Before pickup:

`ASSIGNED`, `PARTNER_TO_PICKUP`, `PRICE_CONFIRMATION_REQUIRED` → release partner → `MATCHING` → automatic rematch.

The cancelling partner is added to the order recovery exclusion list and filtered before the next offer batch is dispatched.

After pickup:

`PICKED_UP`, `OUT_FOR_DELIVERY`, `DELIVERY_OTP_REQUIRED` → release partner → `ADMIN_REVIEW_REQUIRED`.

No automatic rematch or refund is invented after food pickup.

## Existing explicit recovery paths

- no eligible partner / exhausted offers → `MATCHING_FAILED`
- price approval timeout → `ADMIN_REVIEW_REQUIRED`
- wrong OTP → explicit error + remaining attempts
- expired OTP → customer can rotate a new OTP
- payment failure → payment remains failed/retryable according to payment flow
- maps/routing failure → candidate rejected or matching failure rather than indefinite loading

## Recovery metadata

Order stores the latest recovery event, actor, reason, timestamp, rematch count and partner IDs excluded from retry.

Customer APIs expose safe recovery metadata but never expose the internal excluded-partner list.

## Exit criteria

- customer can cancel before pickup
- customer cannot auto-cancel after pickup
- paid pre-pickup cancellation represents a full demo refund
- partner failure before pickup releases partner and attempts rematch
- the same cancelling partner is not re-offered the same order during recovery
- partner failure after pickup goes to admin review
- partner active-order link is cleared on partner recovery
- no recovery path claims real Razorpay refund/payout/settlement
