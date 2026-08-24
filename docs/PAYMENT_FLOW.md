# RouteBite — Payment Flow

> **Status:** Prototype payment specification
>
> This document defines the payment behavior required for the first working RouteBite prototype. It is intentionally designed to demonstrate a realistic end-to-end transaction without pretending that the prototype is a production marketplace payment system.
>
> Production settlement, real partner payouts, regulated KYC/payment compliance, advanced refunds, chargebacks, and reconciliation are explicitly deferred.

---

# 1. Payment Goal

The prototype payment system must prove that RouteBite can support this business flow:

```text
Customer creates food request
        ↓
Customer sees estimated amount
        ↓
Customer completes test payment
        ↓
Order becomes eligible for matching
        ↓
Partner accepts
        ↓
Partner reaches vendor
        ↓
Actual food price is confirmed
        ↓
Customer approves difference if needed
        ↓
Food is picked up
        ↓
Delivery completes with OTP
        ↓
Partner earning is recorded
        ↓
Demo settlement is recorded
```

The prototype must make the money movement understandable even though **no real marketplace settlement is performed**.

---

# 2. Prototype Payment Principle

For the prototype, RouteBite will use:

```text
Razorpay Test Mode
+
RouteBite Internal Demo Ledger
```

The payment gateway is used to demonstrate a realistic checkout experience.

The RouteBite ledger is used to represent how the amount would conceptually be divided between:

- food reimbursement,
- partner earning,
- platform fee,
- additional incentive/subsidy where applicable.

No real partner bank payout is required for the prototype.

---

# 3. Important Boundary

The prototype should **not** claim that:

- RouteBite holds regulated escrow,
- partner bank settlement is production-ready,
- test payment equals real payment settlement,
- RouteBite has implemented marketplace financial compliance,
- a partner has actually received funds in a bank account.

The correct prototype language is:

> **Test payment completed and demo settlement recorded.**

---

# 4. Payment Timing Decision

For the working prototype, the customer completes test payment **before automatic matching begins**.

Flow:

```text
ORDER_DRAFT
    ↓
Customer confirms request
    ↓
PAYMENT_PENDING
    ↓
Test payment success
    ↓
PAYMENT_CONFIRMED
    ↓
MATCHING
```

## Why this is acceptable for the prototype

It demonstrates that the customer has committed to the request before a delivery partner is asked to spend time travelling toward the vendor.

It also avoids this problematic flow:

```text
Partner accepts
Partner travels to vendor
Customer never completes payment
```

## Production note

A commercial version may later use a more sophisticated model such as authorization before matching and capture after assignment/confirmation.

That is deliberately **not** required for the prototype.

---

# 5. Amount Components

The prototype order estimate consists of separate components.

Example:

```text
Estimated food cost       ₹200
Partner delivery earning   ₹40
Platform fee               ₹10
--------------------------------
Estimated customer total  ₹250
```

Conceptually:

```text
estimatedTotal =
    estimatedFoodCost
    + customerDeliveryCharge
    + platformFee
```

For the initial prototype, the delivery charge may directly correspond to the default partner earning.

However, the data model should keep the concepts separate because future economics may differ.

Recommended conceptual fields:

```text
estimatedFoodCost
actualFoodCost
customerDeliveryCharge
partnerBaseEarning
partnerIncentive
platformFee
platformSubsidy
estimatedCustomerTotal
finalCustomerTotal
```

---

# 6. Prototype Pricing Assumptions

Initial configurable hypotheses:

```text
DEFAULT_PARTNER_EARNING = ₹40
DEFAULT_PLATFORM_FEE = ₹10
```

If matching requires incentive escalation, example partner earnings may become:

```text
₹40 → ₹50 → ₹60
```

These numbers are **prototype assumptions, not validated unit economics**.

They must remain configurable.

---

# 7. Customer Checkout Flow

Customer completes the food request first.

Required information includes:

```text
Requested items
Estimated food cost
Pickup location
Drop location
Delivery preference
```

The confirmation screen should clearly show the estimated breakdown.

Example:

```text
Food estimate          ₹200
Delivery                ₹40
Platform fee            ₹10
----------------------------
Estimated total        ₹250

[Pay & Find Partner]
```

The CTA should communicate both actions clearly:

> **Pay & Find Partner**

This is preferable to a generic `Pay Now` because successful payment immediately starts matching.

---

# 8. Test Payment Success Flow

On successful gateway test checkout:

```text
PAYMENT_PENDING
       ↓
PAYMENT_CONFIRMED
       ↓
MATCHING
```

RouteBite should record at least:

```text
orderId
paymentRecordId
provider
providerPaymentId/reference
paymentMode = TEST
currency
estimatedAmount
paymentStatus
createdAt
confirmedAt
```

The client must not be allowed to mark a payment successful merely because the checkout UI says success.

The backend should own the authoritative payment state.

Exact provider verification/webhook implementation will be defined during API/architecture work.

---

# 9. Test Payment Failure Flow

If payment fails or is cancelled by the customer:

```text
PAYMENT_PENDING
       ↓
PAYMENT_FAILED
```

The order must **not enter matching**.

Customer sees:

```text
Payment was not completed.
Your delivery request has not been sent to partners.

[Retry Payment]
[Edit Order]
[Cancel]
```

The user should be able to retry without recreating the entire food request.

---

# 10. Duplicate Payment Protection

The prototype must avoid accidentally creating multiple successful logical payments for the same checkout attempt.

Conceptual rule:

```text
One order
→ one active payment attempt at a time
```

If the frontend retries due to network issues, the backend must not blindly create duplicate successful payment records.

Implementation should later use an idempotency strategy for payment creation/confirmation endpoints.

---

# 11. Payment Success but No Partner Found

This is a critical RouteBite edge case because payment happens before matching.

Example:

```text
Customer test-pays ₹250
        ↓
Matching runs
        ↓
No eligible partner accepts
```

The system must not leave the order as if money were still committed indefinitely.

Prototype flow:

```text
PAYMENT_CONFIRMED
       ↓
MATCHING
       ↓
MATCHING_FAILED
       ↓
DEMO_REFUND_PENDING
       ↓
DEMO_REFUNDED
```

Because the gateway is in test mode, this represents the expected production behavior rather than an actual customer refund.

Customer should see:

```text
No delivery partner is currently available.
Your test payment has been released/refunded in the demo flow.

[Try Again]
[Schedule for Later]
```

The UI must not simply say `Payment Successful` and stop there.

---

# 12. Partner Acceptance Does Not Immediately Finalize Food Cost

A central RouteBite problem is that the vendor may not have a digital catalogue.

Therefore the amount entered by the customer may be an estimate.

Example:

```text
Customer estimated food cost = ₹200
Actual vendor bill = ₹220
```

The system must explicitly handle this difference.

---

# 13. Vendor Purchase Flow

After assignment:

```text
ASSIGNED
   ↓
PARTNER_TO_PICKUP
   ↓
Partner reaches vendor
```

Before confirming pickup, the partner enters the actual food amount.

Example partner UI:

```text
Estimated food amount: ₹200

Actual amount: [ ₹220 ]

Receipt/photo: [Upload]

[Confirm Amount]
```

For the prototype, receipt upload may be required when the actual amount differs materially from the estimate.

---

# 14. Exact Price Match

If:

```text
actualFoodCost == estimatedFoodCost
```

no additional customer approval is required.

Flow:

```text
PARTNER_TO_PICKUP
       ↓
PRICE_CONFIRMED
       ↓
PICKED_UP
```

The customer should receive a normal pickup/status update.

---

# 15. Actual Price Is Higher

Example:

```text
Estimated food cost = ₹200
Actual food cost = ₹220
Difference = +₹20
```

Order enters:

```text
PRICE_CONFIRMATION_REQUIRED
```

Customer sees:

```text
Vendor price changed

Estimated food price: ₹200
Actual food price:    ₹220
Additional amount:     ₹20

[Approve ₹20]
[Contact Partner]
[Request Help]
```

For the prototype, approving the additional amount updates the **demo financial record**.

No second real charge is required in test-mode prototype behavior unless we specifically choose to demonstrate another test checkout later.

Final customer total becomes:

```text
finalCustomerTotal =
    actualFoodCost
    + customerDeliveryCharge
    + platformFee
```

---

# 16. Actual Price Is Lower

Example:

```text
Estimated food cost = ₹200
Actual food cost = ₹180
Difference = -₹20
```

The system should automatically update the final demo total.

Flow:

```text
Estimated total = ₹250
Actual food price = ₹180
Final total = ₹230
```

Prototype ledger records:

```text
DEMO_REFUND_ADJUSTMENT = ₹20
```

No customer action is required.

The UI should show the final corrected amount.

---

# 17. Customer Does Not Approve Higher Price

If the customer does not approve the increased price, the partner should **not purchase the food**.

Possible prototype actions:

```text
Contact Partner
Cancel Before Purchase
Admin Help
```

If cancellation occurs before purchase:

```text
PRICE_CONFIRMATION_REQUIRED
        ↓
CANCELLED_BEFORE_PURCHASE
        ↓
DEMO_REFUND_PENDING
        ↓
DEMO_REFUNDED
```

A future production system may apply fees for certain cancellation scenarios, but the prototype should keep this simple.

---

# 18. Price Approval Timeout

The partner should not be forced to wait indefinitely at the vendor.

For the prototype, define a configurable price-confirmation timeout.

Initial hypothesis:

```text
PRICE_CONFIRMATION_TIMEOUT_MINUTES = 3
```

If the customer does not respond:

```text
PRICE_CONFIRMATION_REQUIRED
        ↓
PRICE_CONFIRMATION_TIMEOUT
```

Partner can then request admin intervention or cancel before purchase.

This value is a prototype hypothesis and must remain configurable.

---

# 19. Food Purchase / Pickup Confirmation

Once price is accepted or unchanged, partner confirms food purchase/pickup.

Flow:

```text
PRICE_CONFIRMED
      ↓
PICKED_UP
      ↓
OUT_FOR_DELIVERY
```

At this point, cancellation rules become stricter because the food has already been purchased.

The system should record:

```text
actualFoodCost
receipt/proof reference if available
pickupConfirmedAt
partnerId
```

---

# 20. Customer Cancellation Before Partner Purchase

Customer may cancel during states such as:

```text
MATCHING
ASSIGNED
PARTNER_TO_PICKUP
PRICE_CONFIRMATION_REQUIRED
```

provided food has **not** been purchased.

Prototype behavior:

```text
CANCELLED_BEFORE_PURCHASE
        ↓
DEMO_REFUND_PENDING
        ↓
DEMO_REFUNDED
```

The demo ledger reverses the customer amount.

---

# 21. Customer Cancellation After Pickup

Once order is:

```text
PICKED_UP
```

customer should not receive a normal self-service cancel button.

Instead:

```text
[Contact Support]
```

Reason:

The partner has already purchased the food and may have incurred real-world cost in a production environment.

Prototype handling is manual through the admin dashboard.

---

# 22. Partner Cancellation Before Purchase

If partner cancels before food purchase:

```text
ASSIGNED
   ↓
PARTNER_CANCELLED_BEFORE_PICKUP
```

RouteBite should attempt:

```text
REMATCHING
```

The customer's existing test payment remains associated with the order while rematching is attempted.

If rematching succeeds:

```text
REMATCHING
   ↓
ASSIGNED
```

If rematching fails:

```text
REMATCHING
   ↓
MATCHING_FAILED
   ↓
DEMO_REFUNDED
```

---

# 23. Partner Cancellation After Purchase

If food has already been purchased and the partner cannot complete delivery:

```text
PICKED_UP
   ↓
PARTNER_DELIVERY_FAILURE
   ↓
ADMIN_REVIEW_REQUIRED
```

Do not attempt to fully automate this in the prototype.

Admin should see:

- customer payment state,
- actual food amount,
- receipt/proof,
- partner identity,
- order timeline,
- cancellation/failure reason.

The admin can then mark the prototype financial outcome.

---

# 24. Delivery Completion

Normal delivery flow:

```text
OUT_FOR_DELIVERY
       ↓
DELIVERY_OTP_REQUIRED
       ↓
OTP_VERIFIED
       ↓
DELIVERED
       ↓
COMPLETED
```

Only after verified delivery should partner earning become final in the demo ledger.

---

# 25. Partner Earning Recording

Before delivery, partner earning may be considered:

```text
PENDING_EARNING
```

After successful completion:

```text
PENDING_EARNING
      ↓
EARNING_CONFIRMED
      ↓
DEMO_SETTLED
```

Partner dashboard may show:

```text
Order earning: ₹40
Status: Demo settled
```

If an incentive was added:

```text
Base earning:     ₹40
Extra incentive:  ₹10
----------------------
Partner earning:  ₹50
```

---

# 26. Internal Demo Ledger

The prototype should maintain an internal financial record separate from the payment-provider object.

Example completed order:

```text
Customer estimated food cost   ₹200
Actual food cost               ₹220
Partner base earning            ₹40
Partner incentive                ₹0
Platform fee                    ₹10
-----------------------------------
Final customer amount           ₹270
Partner earning                  ₹40
Food reimbursement             ₹220
Platform fee                     ₹10
```

Example conceptual ledger entries:

```text
CUSTOMER_TEST_PAYMENT       +₹250
FOOD_PRICE_ADJUSTMENT       +₹20
FOOD_REIMBURSEMENT          -₹220
PARTNER_EARNING             -₹40
PLATFORM_FEE                 +₹10
```

For the prototype these are accounting representations, **not real bank transfers**.

---

# 27. Platform Subsidy / Incentive Tracking

If the platform increases partner earning without charging the full difference to the customer, record it explicitly.

Example:

```text
Customer delivery charge = ₹40
Partner earning = ₹50

Platform subsidy = ₹10
```

Conceptually:

```text
PLATFORM_SUBSIDY = ₹10
```

This is important because otherwise prototype economics can look profitable when they are actually being subsidized.

---

# 28. Recommended Payment Status Model

Payment records should have their own status rather than reusing the order status.

Suggested prototype payment states:

```text
CREATED
PAYMENT_PENDING
PAYMENT_CONFIRMED
PAYMENT_FAILED
DEMO_REFUND_PENDING
DEMO_REFUNDED
DEMO_SETTLEMENT_PENDING
DEMO_SETTLED
```

Order and payment states are related but should remain separate concepts.

Example:

```text
Order status   = MATCHING_FAILED
Payment status = DEMO_REFUNDED
```

or:

```text
Order status   = COMPLETED
Payment status = DEMO_SETTLED
```

---

# 29. Recommended Price-Adjustment Status

Price adjustment can be represented separately:

```text
NONE
PENDING_CUSTOMER_APPROVAL
APPROVED
REJECTED
TIMED_OUT
AUTO_DECREASED
```

This avoids overloading the main payment status.

---

# 30. Payment and Order State Relationship

Normal happy path:

```text
ORDER_DRAFT
     ↓
PAYMENT_PENDING
     ↓
PAYMENT_CONFIRMED
     ↓
MATCHING
     ↓
ASSIGNED
     ↓
PARTNER_TO_PICKUP
     ↓
PRICE_CONFIRMED
     ↓
PICKED_UP
     ↓
OUT_FOR_DELIVERY
     ↓
DELIVERY_OTP_REQUIRED
     ↓
DELIVERED
     ↓
COMPLETED
     ↓
DEMO_SETTLED
```

Price-change path:

```text
PARTNER_TO_PICKUP
      ↓
PRICE_CONFIRMATION_REQUIRED
      ↓
CUSTOMER_APPROVED
      ↓
PRICE_CONFIRMED
      ↓
PICKED_UP
```

No-partner path:

```text
PAYMENT_CONFIRMED
      ↓
MATCHING
      ↓
MATCHING_FAILED
      ↓
DEMO_REFUNDED
```

---

# 31. Payment Failure After Gateway Success Callback

Frontend state alone must never be trusted as authoritative.

Possible case:

```text
Browser says payment successful
but backend verification has not completed
```

UI should show:

```text
Confirming payment...
```

until backend state becomes:

```text
PAYMENT_CONFIRMED
```

Only then should matching begin.

This protects the order flow from false or duplicated client-side success states.

---

# 32. Network Failure During Checkout

If customer loses connectivity during payment:

- do not immediately assume failure,
- re-fetch authoritative payment state from backend,
- if still pending, show `Checking payment status`,
- if confirmed, continue to matching,
- if failed/expired, allow retry.

The customer should not be required to recreate the order.

---

# 33. Receipt / Purchase Proof

For the prototype, partner should be able to upload a purchase receipt/photo.

This is particularly useful when:

- actual price differs,
- customer questions the amount,
- admin reviews a dispute.

Receipt upload does **not** prove vendor authenticity or guarantee food quality.

It is simple purchase evidence for the prototype.

---

# 34. Admin Payment View

Admin should be able to inspect an order's financial summary.

Minimum fields:

```text
Order ID
Customer
Partner
Payment mode
Payment status
Gateway reference
Estimated food cost
Actual food cost
Delivery charge
Partner base earning
Partner incentive
Platform fee
Platform subsidy
Estimated total
Final total
Price-adjustment status
Receipt/proof
Refund/demo-refund status
Demo settlement status
Order timeline
```

Admin prototype actions may include:

```text
Mark demo refund
Mark demo settlement
Review price adjustment
Review receipt
Resolve failed-delivery case
```

---

# 35. Partner Earnings Screen

Prototype partner dashboard should show:

```text
Today / order earnings
Completed orders
Pending demo earnings
Demo-settled earnings
Base earning
Incentive where applicable
```

It should not claim the amount has been transferred to a real bank account.

Use wording such as:

```text
Demo settled
```

rather than:

```text
Bank transfer completed
```

---

# 36. Customer Order Payment Summary

After delivery, customer should see a final summary.

Example:

```text
Food estimate          ₹200
Actual food amount     ₹220
Delivery                ₹40
Platform fee            ₹10
----------------------------
Final total             ₹270

Payment: Test payment
Order: Completed
```

If the actual food price was lower, show the adjustment clearly.

---

# 37. Security Requirements for Prototype

Even in test mode:

1. Provider secret keys must never be exposed to the frontend.
2. Payment success must be confirmed by the backend.
3. Amount calculation must be validated server-side.
4. Customer must not be allowed to arbitrarily submit a lower platform/delivery fee.
5. Partner must not be allowed to modify final customer totals directly.
6. Price changes require controlled server-side state transitions.
7. Payment/ledger changes should be auditable with timestamps and actor identity.
8. Admin financial actions should require admin authorization.

---

# 38. Data Integrity Rules

The backend should enforce at least these invariants:

```text
finalCustomerTotal >= 0
actualFoodCost >= 0
partnerEarning >= 0
platformFee >= 0
```

Only one active final settlement outcome should exist per order.

A completed order must not simultaneously be marked fully refunded without an explicit administrative correction flow.

Payment and ledger mutations should be traceable rather than silently overwritten.

---

# 39. Prototype Acceptance Criteria

The payment feature is considered complete for the prototype when the following scenarios work end-to-end:

### Scenario A — Normal order

```text
Customer creates order
→ test payment succeeds
→ matching starts
→ partner accepts
→ vendor price matches estimate
→ pickup
→ OTP delivery
→ demo settlement recorded
```

### Scenario B — Higher vendor price

```text
Customer estimates ₹200
→ partner reports ₹220
→ customer approves +₹20
→ final total updates
→ delivery completes
→ final ledger reflects ₹220 food amount
```

### Scenario C — Lower vendor price

```text
Customer estimates ₹200
→ partner reports ₹180
→ demo refund adjustment ₹20
→ delivery completes
→ final customer summary shows corrected total
```

### Scenario D — Payment fails

```text
Checkout fails
→ matching never starts
→ customer can retry
```

### Scenario E — No partner found

```text
Test payment succeeds
→ matching fails
→ demo refund recorded
→ customer sees clear recovery options
```

### Scenario F — Partner cancels before pickup

```text
Partner accepts
→ cancels before purchase
→ rematching runs
→ payment remains associated with same order
```

### Scenario G — Customer cancels before purchase

```text
Customer cancels
→ order closes
→ demo refund recorded
```

### Scenario H — Failure after food purchase

```text
Food picked up
→ partner cannot deliver
→ admin review required
→ no automatic financial outcome is silently assumed
```

---

# 40. Explicitly Out of Scope for Prototype

Do **not** block the prototype on:

- real partner bank payouts,
- real marketplace split settlement,
- real escrow infrastructure,
- government-grade financial KYC,
- automated production refunds,
- chargeback handling,
- GST/tax invoicing design,
- accounting reconciliation pipelines,
- settlement batching,
- payout retry infrastructure,
- production fraud scoring,
- payment-provider failover,
- multiple payment gateways,
- cash-on-delivery,
- production wallet system.

---

# 41. Production Questions to Revisit Later

Before commercial launch, RouteBite must revisit:

- Should customer funds be authorized before matching and captured after assignment?
- What legal/payment structure should be used for food reimbursement?
- How should partners receive actual payouts?
- Which marketplace/split-settlement provider should be used?
- What KYC is legally required for partners?
- Who is merchant of record for each component?
- How should refunds work after food purchase?
- How should customer/partner fraud be handled?
- How should taxes and invoicing be handled?
- How should chargebacks be allocated?
- How should reconciliation work?
- What cancellation fees are economically/legal appropriate?

These are important production questions but intentionally do not block the prototype.

---

# 42. Final Prototype Payment Principle

The payment system should optimize for **clarity, safety, and demonstrability**, not production financial sophistication.

The prototype must prove three things:

1. the customer can commit to an order before partner fulfilment,
2. uncertain offline-vendor prices can be handled without breaking the order flow,
3. partner earnings and platform economics can be represented transparently after successful delivery.

The implementation must keep the boundary between **real payment-provider test events** and **RouteBite's simulated marketplace settlement** explicit at all times.
