# Phase 15 — Full Rehearsal and Hardening

## Goal

Phase 15 does not add a new marketplace feature. It proves that the RouteBite prototype can repeatedly execute its documented happy paths and recover from expected failures **without manual MongoDB editing**.

The operating rule is:

```text
MongoDB = authoritative state
Socket.IO = notification only
REST refresh/reconnect must recover current truth
```

`ADMIN_REVIEW_REQUIRED` is an explicit supported recovery outcome, not a stuck loader. Phase 15 does not invent production settlement policy for post-purchase disputes; it requires that such cases become visible and inspectable in Admin Operations without database edits.

---

## Hardening added in Phase 15

### 1. Partner offer reconnect resync

The partner offer page now reloads active offers from REST when:

- the authenticated Socket.IO connection is re-established,
- the browser window regains focus,
- the tab becomes visible,
- the browser comes back online.

This closes the restart race where the backend can resume a durable matching attempt and create an offer before the partner browser has reconnected.

### 2. Read-only invariant audit

Run:

```powershell
npm run hardening:audit
```

Optional scope:

```powershell
npm run hardening:audit -- --latest 200
```

The audit reads the latest development orders and reports current-state violations including:

- confirmed payment stuck in `DRAFT`/`AWAITING_PAYMENT`,
- `MATCHING` order with an assigned partner,
- `MATCHING` order without a live matching attempt,
- active fulfilment order without an assigned partner,
- partner/order `activeOrderId` mismatch,
- terminal/released order still locking a partner,
- multiple `ACCEPTED` offers for one order,
- accepted offer partner not matching the assigned partner,
- completed order missing `completedAt`,
- completed order with invalid earning count.

Warnings are used for known legacy/manual development records that may predate current invariants, such as an old manually-completed order with no earning record.

The audit is read-only.

### 3. Real MongoDB acceptance-race rehearsal

Normal CI does not have a MongoDB replica set, so the critical two-partner transaction race has a dev-only runner against the configured Atlas development database.

It creates isolated temporary records, fires two `acceptOffer` calls concurrently, verifies exactly one winner, and cleans all fixtures afterward.

It requires explicit confirmation:

```powershell
npm run hardening:accept-race -- --confirm-dev-db
```

The script refuses to run with `NODE_ENV=production` and refuses to create fixtures without the explicit flag.

Expected result:

```text
one fulfilled accept
one rejected/conflicted accept
one ACCEPTED offer
one assigned partner
one partner activeOrderId pointing to the order
PASS
```

### 4. CI syntax checks

GitHub Actions syntax-checks the hardening scripts before the normal backend Jest suite, then builds the frontend production bundle.

---

## Full rehearsal matrix

| Scenario | Expected result | Verification |
| --- | --- | --- |
| AVAILABLE_NOW happy path | Payment → matching → accept → pickup → delivery → OTP → completed | Manual final rehearsal |
| Scheduled / On My Way happy path | Compatible route receives/accepts offer and completes | Manual final rehearsal |
| No partner | Explicit `MATCHING_FAILED` + demo refund representation | Existing tests + manual |
| Partner rejects | Next candidate/round or explicit matching failure | Existing matching/offer flow + manual |
| Offer expires | Offer becomes `EXPIRED`; matching advances/fails explicitly | Maintenance logic + manual |
| Two partners accept same order | Exactly one assignment | `hardening:accept-race` |
| Customer cancels before pickup | `CANCELLED`, partner released, demo refund | Existing Phase 12 tests + manual |
| Partner fails before pickup | Partner released, same partner excluded, automatic rematch | Existing Phase 12 tests + manual |
| Partner fails after pickup | Partner released, `ADMIN_REVIEW_REQUIRED` | Existing Phase 12 tests + Admin Operations |
| Actual price equals estimate | Pickup can continue | Existing Phase 8 flow + manual |
| Actual price decreases | Demo total decreases automatically | Existing accounting tests + manual |
| Actual price increases | Customer approval required before pickup | Existing Phase 8 flow + manual |
| Price approval times out | Explicit review/recovery state | Startup/interval maintenance + manual |
| Wrong delivery OTP | Rejected; order remains deliverable | Existing Phase 10 tests + manual |
| Expired delivery OTP | Rejected | Existing Phase 10 tests |
| Duplicate completion | No duplicate earning | Unique earning invariant + tests |
| Duplicate Razorpay confirmation/callback | No duplicate payment transition/matching truth | Existing payment/webhook tests |
| Browser refresh during active delivery | REST reload restores order/tracking truth | Manual final rehearsal |
| Socket disconnect/reconnect | REST resync restores canonical state | Checkout reconnect + partner offer reconnect hardening |
| Server restart with pending/resumable offer | Startup maintenance resumes DB state; browser reconnect refetches offers | Startup maintenance + Phase 15 reconnect fix + manual |
| Completed-order rating | Exactly one rating, aggregate updated | Phase 14 tests + manual |
| Partner review visibility | Order context + feedback + customer first name only | Phase 14 manual verification |
| Admin investigation | Failed/review order explainable without DB access | Phase 13 manual verification |
| Database invariant audit | No current ERROR-level invariant violations | `hardening:audit` |

---

## Final manual rehearsal order

For the final browser demo, use known close coordinates first so routing uncertainty does not hide state-machine bugs.

Recommended nearby prototype coordinates:

```text
Partner / pickup
26.540920, 85.548280

Drop
26.545000, 85.552000
```

Final rehearsal should run in this order:

1. Approved partner goes `AVAILABLE_NOW`.
2. Wait more than 60 seconds to confirm the Phase 12 five-minute availability grace remains healthy.
3. Customer creates an ASAP request using the known nearby coordinates.
4. Complete Razorpay Test Mode payment.
5. Confirm partner receives the offer and accepts it.
6. Start pickup.
7. Exercise one price path (equal/decrease/increase).
8. Confirm pickup.
9. Start delivery.
10. Refresh the customer page during live delivery and confirm tracking truth reloads.
11. Temporarily restart the backend or disconnect/reconnect network if practical and confirm UI recovers without MongoDB edits.
12. Request/generate/verify delivery OTP.
13. Confirm `COMPLETED` and one partner earning.
14. Customer rates the partner with feedback.
15. Partner confirms the review appears with the correct order context.
16. Admin confirms the completed order timeline/accounting is coherent.
17. Run `npm run hardening:audit`.
18. Run `npm run hardening:accept-race -- --confirm-dev-db`.

---

## Exit criteria

Phase 15 is ready to merge only when:

```text
[ ] backend Jest suite green
[ ] frontend production build green
[ ] hardening scripts syntax-check in CI
[ ] invariant audit has no unexplained ERROR
[ ] real Atlas accept-race rehearsal passes
[ ] AVAILABLE_NOW end-to-end rehearsal passes
[ ] Scheduled / On My Way rehearsal passes
[ ] refresh/reconnect rehearsal recovers from REST
[ ] no tested flow requires manual MongoDB editing
[ ] intentional ADMIN_REVIEW_REQUIRED cases are visible in Admin Operations
```
