# Phase 15 — Full Rehearsal and Hardening

## Goal

Prove that the RouteBite prototype can run the full customer → matching → partner → pickup → delivery → completion → rating flow repeatedly without manual MongoDB editing, and that important failure/restart paths finish in explicit recoverable or terminal states.

Phase 15 does not add a new product surface unless a rehearsal exposes a usability or correctness gap.

## Hardening commands

Run from `backend/`.

### Read-only state audit

```bash
npm run hardening:audit
```

Optionally scope to the latest N orders:

```bash
npm run hardening:audit -- --latest 25
```

The audit does not write to MongoDB. It checks current-state invariants including:

- active fulfilment order ↔ partner `activeOrderId` consistency,
- terminal/released orders do not keep a partner locked,
- one accepted offer maximum per order,
- accepted offer partner matches order assignment,
- matching orders have a live matching attempt,
- completed orders have completion timestamps,
- completed-order earning cardinality,
- confirmed-payment/order-state anomalies.

Legacy manually edited development records may appear as warnings. Current broken invariants appear as errors and return a non-zero exit code.

### Atomic accept race rehearsal

```bash
npm run hardening:accept-race -- --confirm-dev-db
```

This creates isolated temporary fixtures in the configured development database, submits two offer accepts concurrently for the same order, verifies exactly one winner, and deletes all fixtures afterward.

Expected invariant:

```text
2 concurrent accepts
       ↓
exactly 1 succeeds
exactly 1 fails with conflict
       ↓
1 ACCEPTED offer
1 assigned partner
1 partner activeOrderId
```

The script refuses to run without the explicit `--confirm-dev-db` flag and refuses `NODE_ENV=production`.

### Pending-offer restart rehearsal

```bash
npm run hardening:restart-offer -- --confirm-dev-db
```

This creates an isolated persisted `PENDING` offer and simulates startup/maintenance twice:

1. before the offer expires — the offer must remain `PENDING` and the order must remain `MATCHING`;
2. after the stored expiry — maintenance must mark the offer `EXPIRED` and advance the exhausted order to explicit `MATCHING_FAILED`.

This proves offer truth survives process restarts because MongoDB, not Socket.IO or process memory, is authoritative.

The script cleans all temporary fixtures and has the same development-only safety guard as the accept-race rehearsal.

## Rehearsal matrix

| Scenario | Automated / structural protection | Final manual rehearsal |
| --- | --- | --- |
| AVAILABLE_NOW happy path | Existing matching, offer, pickup, OTP, accounting tests + invariant audit | Required |
| Scheduled / On My Way happy path | Matching route/direction tests | Required |
| No partner available | Matching failure + demo refund tests | Required |
| Partner rejects offer | Persistent offer state + next-batch dispatch | Required |
| Offer expires | Offer maintenance + restart rehearsal | Required |
| Two partners accept same order | Atomic conditional writes + Mongo transaction + `hardening:accept-race` | Optional manual; automated rehearsal required |
| Customer cancel before purchase | Phase 12 recovery tests | Required |
| Partner fails before purchase | Recovery/rematch tests | Required |
| Partner fails after purchase | Admin-review recovery policy | Required |
| Actual price equals estimate | Phase 8 service rules | Required |
| Actual price lower than estimate | Demo-ledger adjustment tests | Required |
| Actual price higher than estimate | Durable approval state/timeout | Required |
| Wrong delivery OTP | OTP unit/integration tests | Required |
| Expired/reused OTP | OTP unit/integration tests | Required |
| Duplicate completion | Unique earning + completion transaction | Required |
| Duplicate Razorpay callback | Payment/webhook idempotency tests | Required |
| Browser refresh during active delivery | REST is authoritative; tracking reload endpoint | Required |
| Socket disconnect/reconnect | REST resync after socket reconnect/focus | Required |
| Server restart with pending offer | Startup maintenance + `hardening:restart-offer` | Required once |
| Rating duplicate | Unique order rating + transaction | Required |
| Partner review privacy | first-name-only review projection | Required |
| Admin investigation | Phase 13 operational projection | Required |

## Restart/reconnect contract

Socket.IO is notification transport only.

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

On backend startup RouteBite immediately runs matching resume, offer maintenance and price-confirmation maintenance before starting the normal intervals. A browser reconnect/focus reloads current offer/tracking state from REST.

Therefore a restart may delay a notification, but it must not lose an order, assignment, offer, payment, completion, or rating state.

## Phase exit criteria

Phase 15 can close only when:

```text
[ ] backend test suite green
[ ] frontend production build green
[ ] hardening syntax checks green
[ ] invariant audit has no unexplained ERROR for current prototype data
[ ] accept-race rehearsal passes
[ ] restart-offer rehearsal passes
[ ] AVAILABLE_NOW full happy path passes
[ ] scheduled/on-my-way happy path passes
[ ] core failure/recovery paths pass
[ ] refresh/reconnect rehearsal passes
[ ] no scenario requires manual MongoDB editing
[ ] final demo checklist is repeatable
```

Warnings from intentionally old/manual development fixtures must be understood and documented; they must not be silently ignored if they represent a current code path.
