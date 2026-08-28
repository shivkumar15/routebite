# Phase 15 — Full Rehearsal and Hardening

## Goal

Prove that the RouteBite prototype can repeatedly run the customer → matching → partner → pickup → delivery → completion → rating flow and expected failure paths **without manual MongoDB editing**.

Phase 15 does not add a new marketplace feature unless rehearsal exposes a correctness or recovery gap.

Canonical operating rule:

```text
MongoDB = authoritative state
Socket.IO = notification transport only
REST refresh/reconnect must recover current truth
```

`ADMIN_REVIEW_REQUIRED` is an explicit supported recovery outcome, not a stuck loader. The prototype does not invent production settlement policy for a post-purchase dispute; it requires that the case becomes durable, visible and inspectable in Admin Operations without editing the database.

---

## Hardening added in Phase 15

### Partner offer reconnect resync

The partner offer page reloads active offers from REST when:

- the authenticated Socket.IO connection is re-established,
- the browser window regains focus,
- the tab becomes visible,
- the browser comes back online.

This closes a restart race: backend startup maintenance can resume a persisted matching attempt before the partner browser reconnects. The notification may be missed, but the durable offer cannot be hidden from the UI after reconnect.

### Read-only state audit

Run from `backend/`:

```powershell
npm run hardening:audit
```

Optional scope:

```powershell
npm run hardening:audit -- --latest 200
```

The audit does not write to MongoDB. It checks current-state invariants including:

- confirmed payment stuck in `DRAFT`/`AWAITING_PAYMENT`,
- `MATCHING` order with an assigned partner,
- `MATCHING` order without a live matching attempt,
- active fulfilment order without an assigned partner,
- active order ↔ partner `activeOrderId` mismatch,
- terminal/released order still locking a partner,
- multiple `ACCEPTED` offers for one order,
- accepted offer partner not matching the order assignment,
- completed order missing `completedAt`,
- completed-order earning cardinality.

Current invariant breaks are `ERROR`. Known old/manual development fixtures can appear as `WARN` so legacy data is visible without pretending it came from the current code path.

### Atomic accept-race rehearsal

```powershell
npm run hardening:accept-race -- --confirm-dev-db
```

This creates isolated temporary fixtures in the configured development database, fires two `acceptOffer` calls concurrently for the same order, verifies exactly one winner, then deletes all fixtures.

Expected invariant:

```text
2 concurrent accepts
       ↓
exactly 1 succeeds
exactly 1 conflicts/rejects
       ↓
1 ACCEPTED offer
1 assigned partner
1 partner activeOrderId
```

The runner refuses to create fixtures without `--confirm-dev-db` and refuses `NODE_ENV=production`.

### Pending-offer restart rehearsal

```powershell
npm run hardening:restart-offer -- --confirm-dev-db
```

This creates an isolated persisted `PENDING` offer and runs startup-equivalent offer maintenance twice:

1. before expiry — offer remains `PENDING`, order remains `MATCHING`;
2. after persisted expiry — offer becomes `EXPIRED`, exhausted matching becomes explicit `MATCHING_FAILED`.

The fixtures are deleted afterward. This verifies that pending offer truth survives a process restart because MongoDB, not process memory, is authoritative.

### CI protection

GitHub Actions now runs:

```text
hardening script syntax check
backend Jest suite
frontend production build
```

The dev-database rehearsal commands are intentionally not executed in CI because CI has no Atlas development replica-set fixture environment.

---

## Rehearsal matrix

| Scenario | Structural / automated protection | Final manual rehearsal |
| --- | --- | --- |
| AVAILABLE_NOW happy path | Matching + offer + pickup + OTP + accounting tests | Required |
| Scheduled / On My Way happy path | Route/direction matching tests | Required |
| No partner available | Explicit matching failure + demo refund | Required |
| Partner rejects | Persistent offer state + next-batch dispatch | Required |
| Offer expires | Offer maintenance | Required |
| Two partners accept same order | Mongo transaction + conditional writes + `hardening:accept-race` | DB rehearsal required |
| Customer cancels before purchase | Phase 12 recovery tests | Required |
| Partner fails before purchase | Release + exclude + automatic rematch | Required |
| Partner fails after purchase | Durable `ADMIN_REVIEW_REQUIRED` + Admin Operations | Required |
| Actual price equals estimate | Phase 8 state rules | Required |
| Actual price decreases | Demo-ledger adjustment tests | Required |
| Actual price increases | Durable customer approval state | Required |
| Price approval timeout | Startup/interval maintenance → explicit review | Required |
| Wrong delivery OTP | OTP tests | Required |
| Expired/reused OTP | OTP tests | Required |
| Duplicate completion | Completion transaction + unique earning | Required |
| Duplicate Razorpay confirmation/callback | Payment/webhook idempotency | Required |
| Browser refresh during active delivery | REST tracking reload | Required |
| Socket disconnect/reconnect | Customer REST resync + partner offer reconnect resync | Required |
| Server restart with pending offer | Startup maintenance + `hardening:restart-offer` | DB rehearsal required |
| Completed-order rating | Unique rating + aggregate transaction | Required |
| Partner review privacy/context | Order context + feedback + customer first name only | Required |
| Admin investigation | Phase 13 operational projection | Required |
| Database invariant audit | `hardening:audit` | Required |

---

## Restart / reconnect contract

Persistent truth lives in MongoDB:

```text
Order
MatchingAttempt
Offer
Partner.activeOrderId
Payment
PartnerEarning
Rating
```

On backend startup RouteBite immediately runs matching resume, offer maintenance and price-confirmation maintenance before normal recurring intervals begin.

A restart may delay or lose an individual Socket.IO notification. It must not lose the actual order, payment, offer, assignment, completion, earning or rating state. Customer checkout already reloads canonical REST state when the authenticated socket reconnects; Phase 15 adds the same durable resync behavior to the partner offer page.

---

## Final browser rehearsal

For the final happy-path rehearsal, first remove routing uncertainty by using known nearby coordinates:

```text
Partner / pickup
Latitude:  26.540920
Longitude: 85.548280

Customer drop
Latitude:  26.545000
Longitude: 85.552000
```

Recommended sequence:

1. Approved partner goes `AVAILABLE_NOW`.
2. Wait more than 60 seconds to reconfirm the five-minute browser-prototype freshness grace.
3. Customer creates an ASAP request with the known nearby coordinates.
4. Complete Razorpay Test Mode payment.
5. Partner receives and accepts the offer.
6. Start pickup.
7. Exercise one actual-price path.
8. Confirm pickup and start delivery.
9. Refresh customer browser during active delivery and verify REST restores tracking truth.
10. Exercise disconnect/reconnect or backend restart if practical and verify the UI recovers without DB edits.
11. Request/generate/verify the delivery OTP.
12. Confirm `COMPLETED` and exactly one partner earning.
13. Customer rates the partner with written feedback.
14. Partner confirms review score, feedback and correct order context.
15. Admin confirms completed-order timeline/accounting is coherent.
16. Run `npm run hardening:audit`.
17. Run `npm run hardening:accept-race -- --confirm-dev-db`.
18. Run `npm run hardening:restart-offer -- --confirm-dev-db`.

A separate final rehearsal must also prove a compatible **Scheduled / On My Way** partner path.

---

## Exit criteria

Phase 15 can merge only when:

```text
[ ] backend Jest suite green
[ ] frontend production build green
[ ] hardening syntax checks green
[ ] invariant audit has no unexplained ERROR
[ ] accept-race rehearsal passes
[ ] restart-offer rehearsal passes
[ ] AVAILABLE_NOW full happy path passes
[ ] Scheduled / On My Way happy path passes
[ ] core failure/recovery paths remain explicit
[ ] refresh/reconnect rehearsal recovers from REST
[ ] no tested flow requires manual MongoDB editing
[ ] intentional ADMIN_REVIEW_REQUIRED cases are visible in Admin Operations
[ ] final demo checklist is repeatable
```
