# Phase 14 — Ratings

## Goal

Allow a customer to rate the delivery partner after a successfully completed RouteBite order.

Prototype contract:

```text
customer -> partner
score 1..5
optional text feedback
one rating per completed order
simple running average
```

## API

```text
GET  /api/v1/orders/:orderId/rating
POST /api/v1/orders/:orderId/rating
```

A rating is accepted only when the authenticated customer owns the order, the order is `COMPLETED`, a partner is assigned, and the order has not already been rated.

## Persistence

The `Rating` model stores `orderId`, `customerId`, `partnerId`, `score`, optional `feedback`, and timestamps. `orderId` is unique, preventing duplicate ratings for one delivery.

`Partner.ratingAverage` and `Partner.ratingCount` are the aggregate fields. Rating creation and aggregate update occur in the same MongoDB transaction. The partner count is used as a concurrency guard so concurrent ratings do not silently overwrite each other.

The prototype uses a normal arithmetic running average. No advanced weighting is used.

## Frontend

A completed order shows `Rate partner`. After submission, My Requests displays the saved score and the action becomes `View your rating`.

The rating page has five selectable stars and optional feedback up to 500 characters. Submitted ratings are read-only in Phase 14.

The partner aggregate is visible on the Demo Earnings page.

## Manual verification

1. Open an existing `COMPLETED` customer order.
2. Choose `Rate partner`.
3. Submit a 1-5 score, optionally with feedback.
4. Confirm the rating page becomes read-only.
5. Return to My Requests and confirm the score is shown.
6. Open the partner Demo Earnings page and confirm the average/count changed.
7. Refresh both pages and confirm persistence.
8. Confirm the same order cannot create a second rating.
9. Confirm a non-completed order cannot be rated.

## Boundaries

Ratings do not alter fulfillment, payment, earnings, or settlement state. Rating edit/delete and a public review feed are outside Phase 14.
