# Phase 13 — Admin Operations

## Goal

Give RouteBite operations enough visibility to investigate prototype failures without editing MongoDB documents manually.

Phase 13 starts read-first. Admin resolution actions are added only when there is a defined service-layer rule for their effect on fulfillment, customer accounting, partner earning, and recovery state.

## Admin order queue

Route:

```text
GET /api/v1/admin/orders?filter=...
```

Supported filters:

```text
ALL
ATTENTION
ADMIN_REVIEW_REQUIRED
MATCHING_FAILED
FAILED
ACTIVE
COMPLETED
CANCELLED
or any canonical ORDER_STATUS
```

`ATTENTION` groups:

```text
ADMIN_REVIEW_REQUIRED
MATCHING_FAILED
FAILED
```

The dashboard returns summary counts plus the latest 100 matching orders.

Each row intentionally exposes operational fields only:

- order status and short ID,
- vendor/pickup/drop,
- customer contact,
- latest payment state,
- assigned partner reference,
- delivery window,
- demo total,
- recovery event/reason/rematch count.

## Admin order investigation

Route:

```text
GET /api/v1/admin/orders/:orderId
```

The response combines canonical records into one investigation view:

```text
Order
Customer
Assigned Partner
Payment attempts
Matching attempts
Offer history
Price adjustment
Receipt/proof link when present
Recovery metadata
Partner earning when present
Canonical demo-ledger projection
Operational timeline
```

The demo-ledger section reuses the same deterministic accounting projection used by customer-facing Phase 11. This prevents the admin UI from inventing a second interpretation of refund, adjustment, settlement, or partner earning state.

The operational timeline is a deterministic projection from persisted timestamps. It is not claimed to be a separate immutable audit-log collection.

Matching-attempt timeline tones use the canonical matching status constants. `NO_CANDIDATES` and matching-engine `FAILED` attempts are treated as failure events, not successful matching events.

Pending partner offers are shown with their expiry time. Resolved offers use their actual response timestamp, so the admin UI does not imply that an unresolved offer has already completed.

## Privacy and safety boundary

Admin order APIs do not expose:

- password hashes,
- authentication token state,
- email/phone OTP hashes,
- delivery OTP hash,
- arbitrary MongoDB fields,
- Cloudinary public IDs.

Private receipt/proof URLs are generated through the existing authenticated asset URL flow.

## Current frontend routes

```text
/admin/orders
/admin/orders/:orderId
/admin/partners
```

The admin account page links to both order operations and partner verification.

## Manual verification

1. Sign in with the ADMIN account.
2. Open `Account -> Open order operations`.
3. Confirm the default `Needs attention` queue contains existing failed/review orders.
4. Switch filters, including `Failed`, and confirm counts/list change without a page reload.
5. Open a known `MATCHING_FAILED` order.
6. Confirm matching attempts show discovered/eligible/offer-ready counts and rejection reasons.
7. For an order that dispatched an offer, confirm offer history shows the partner short ID and final offer status.
8. For a pending offer, confirm the table says when it expires instead of presenting the expiry timestamp as a completed response.
9. For a paid failed/cancelled order, confirm the canonical demo refund/adjustment/settlement representation appears.
10. For an `ADMIN_REVIEW_REQUIRED` order, confirm the demo ledger remains review-pending instead of fabricating a refund or settlement outcome.
11. For a recovery order, confirm recovery reason and operational timeline are visible.
12. Confirm a non-admin/anonymous request cannot access `/api/v1/admin/orders`.

## Resolution actions

Do not add a generic `Force status` control.

No post-purchase manual resolution is implemented until the product policy defines who absorbs the food cost, whether the customer receives a full/partial demo refund, and whether the failed partner receives any reimbursement. Guessing those consequences would create inconsistent accounting.

A future admin resolution action must therefore be implemented as a named service-layer decision, for example a policy-approved post-purchase cancellation or completion repair, with explicit accounting and partner-state consequences.
