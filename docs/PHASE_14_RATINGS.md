# Phase 14 — Ratings

## Goal

Allow a customer to rate the delivery partner after a successfully completed RouteBite order, while giving both sides enough identity and order context to understand who/what the review belongs to.

Prototype contract:

```text
customer -> partner
score 1..5
optional text feedback
one rating per completed order
simple running average
```

## Identity and privacy policy

A rating should never feel anonymous to the person submitting it.

Customer rating view shows:

```text
partner full account name
partner short ID
partner current aggregate rating
completed order short ID
vendor
pickup -> drop
completion time
```

The customer therefore knows exactly which delivery partner they are rating.

The partner review view shows:

```text
score
written feedback
review time
completed order short ID
vendor
pickup -> drop
completion time
customer first name only
```

RouteBite intentionally does **not** expose the customer's email, phone number, or full account identity to the partner review feed. The first name gives useful human context without exposing unnecessary contact information.

This is the prototype privacy rule:

```text
customer sees partner identity clearly
partner sees order context + customer first name
customer contact details remain private
```

## API

```text
GET  /api/v1/orders/:orderId/rating
POST /api/v1/orders/:orderId/rating
GET  /api/v1/partner/ratings
```

A rating is accepted only when the authenticated customer owns the order, the order is `COMPLETED`, a partner is assigned, and the order has not already been rated.

`GET /api/v1/partner/ratings` requires an authenticated approved partner and returns only reviews belonging to that partner.

## Persistence

The `Rating` model stores `orderId`, `customerId`, `partnerId`, `score`, optional `feedback`, and timestamps. `orderId` is unique, preventing duplicate ratings for one delivery.

`Partner.ratingAverage` and `Partner.ratingCount` are the aggregate fields. Rating creation and aggregate update occur in the same MongoDB transaction. The partner count is used as a concurrency guard so concurrent ratings do not silently overwrite each other.

The prototype uses a normal arithmetic running average. No advanced weighting is used.

## Frontend

A completed order shows `Rate partner`. After submission, My Requests displays the saved score and the action becomes `View your rating`.

The customer rating page clearly identifies the partner and completed order before a score is submitted. It also tells the customer that written feedback will be visible to the partner.

Submitted ratings are read-only in Phase 14.

The partner aggregate remains visible on Demo Earnings, with a direct link to `/partner/ratings`.

The dedicated Customer Reviews page lets a partner read every received score and feedback item together with its completed-order context. Customer identity is shown as first name only.

## Manual verification

1. Open an existing `COMPLETED` customer order.
2. Choose `Rate partner`.
3. Confirm the page shows the partner's name/short ID and the correct completed order before rating.
4. Submit a 1–5 score with written feedback.
5. Confirm the rating page becomes read-only and still identifies the same partner/order.
6. Return to My Requests and confirm the score is shown.
7. Login as that delivery partner and open `Customer reviews`.
8. Confirm the review shows the same score, feedback, order/vendor/route, review date, and customer first name.
9. Confirm customer email and phone are not displayed anywhere on the partner review page/API response.
10. Open Demo Earnings and confirm the average/count changed and links to Customer Reviews.
11. Refresh both sides and confirm persistence.
12. Confirm the same order cannot create a second rating.
13. Confirm a non-completed order cannot be rated.

## Boundaries

Ratings do not alter fulfillment, payment, earnings, or settlement state. Rating edit/delete and a public review feed are outside Phase 14.
