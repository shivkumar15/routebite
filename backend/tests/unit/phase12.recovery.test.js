import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';

const {
  CUSTOMER_CANCELLABLE_ORDER_STATUSES,
  PARTNER_POST_PURCHASE_FAILURE_STATUSES,
  PARTNER_REMATCHABLE_ORDER_STATUSES,
  RECOVERY_ACTOR,
  RECOVERY_EVENT,
} = await import('../../src/constants/recovery.constants.js');
const { ORDER_STATUS } = await import('../../src/constants/order.constants.js');
const { Order } = await import('../../src/models/order.model.js');
const { buildDemoLedgerProjection } = await import('../../src/services/accounting.service.js');

function projectionOrder(status, recovery = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    status,
    pricing: {
      estimatedFoodCostPaise: 23000,
      customerDeliveryChargePaise: 4000,
      partnerBaseEarningPaise: 4000,
      platformFeePaise: 1000,
      estimatedCustomerTotalPaise: 28000,
      finalCustomerTotalPaise: null,
    },
    priceAdjustment: {},
    recovery: {
      lastEvent: RECOVERY_EVENT.NONE,
      lastActor: null,
      reason: null,
      occurredAt: null,
      rematchCount: 0,
      ...recovery,
    },
  };
}

const confirmedPayment = {
  amountPaise: 28000,
  currency: 'INR',
  provider: 'RAZORPAY',
  mode: 'TEST',
  status: 'PAYMENT_CONFIRMED',
  confirmedAt: new Date(),
};

describe('Phase 12 cancellation and recovery policy', () => {
  test('customer automatic cancellation stops before food pickup', () => {
    expect(CUSTOMER_CANCELLABLE_ORDER_STATUSES).toContain(ORDER_STATUS.PARTNER_TO_PICKUP);
    expect(CUSTOMER_CANCELLABLE_ORDER_STATUSES).toContain(ORDER_STATUS.PRICE_CONFIRMATION_REQUIRED);
    expect(CUSTOMER_CANCELLABLE_ORDER_STATUSES).not.toContain(ORDER_STATUS.PICKED_UP);
    expect(CUSTOMER_CANCELLABLE_ORDER_STATUSES).not.toContain(ORDER_STATUS.OUT_FOR_DELIVERY);
  });

  test('partner failure before pickup is rematchable but after pickup requires review', () => {
    expect(PARTNER_REMATCHABLE_ORDER_STATUSES).toContain(ORDER_STATUS.ASSIGNED);
    expect(PARTNER_REMATCHABLE_ORDER_STATUSES).toContain(ORDER_STATUS.PARTNER_TO_PICKUP);
    expect(PARTNER_POST_PURCHASE_FAILURE_STATUSES).toContain(ORDER_STATUS.PICKED_UP);
    expect(PARTNER_POST_PURCHASE_FAILURE_STATUSES).toContain(ORDER_STATUS.DELIVERY_OTP_REQUIRED);
  });

  test('recovery metadata persists event, actor, reason and excluded partners', () => {
    const partnerId = new mongoose.Types.ObjectId();
    const order = new Order({
      customerId: new mongoose.Types.ObjectId(),
      status: ORDER_STATUS.MATCHING,
      vendorDisplayName: 'Sharma Chaat',
      requestedItems: '2 pav bhaji',
      pickup: { type: 'Point', coordinates: [81.8463, 25.4358] },
      pickupText: 'Civil Lines',
      drop: { type: 'Point', coordinates: [81.7712, 25.4298] },
      dropText: 'IIIT Allahabad',
      deliveryType: 'ASAP',
      deliveryWindowStart: new Date(),
      deliveryWindowEnd: new Date(Date.now() + 45 * 60 * 1000),
      pricing: { estimatedFoodCostPaise: 23000 },
      recovery: {
        lastEvent: RECOVERY_EVENT.PARTNER_CANCELLED_BEFORE_PURCHASE,
        lastActor: RECOVERY_ACTOR.PARTNER,
        reason: 'Vehicle issue',
        occurredAt: new Date(),
        rematchCount: 1,
        excludedPartnerIds: [partnerId],
      },
    });

    expect(order.recovery.lastEvent).toBe(RECOVERY_EVENT.PARTNER_CANCELLED_BEFORE_PURCHASE);
    expect(order.recovery.rematchCount).toBe(1);
    expect(order.recovery.excludedPartnerIds[0].toString()).toBe(partnerId.toString());
  });

  test('paid cancellation before pickup represents a full demo refund once', () => {
    const ledger = buildDemoLedgerProjection({
      order: projectionOrder(ORDER_STATUS.CANCELLED, {
        lastEvent: RECOVERY_EVENT.CUSTOMER_CANCELLED_BEFORE_PURCHASE,
        lastActor: RECOVERY_ACTOR.CUSTOMER,
        reason: 'Changed plan',
      }),
      payment: confirmedPayment,
    });

    expect(ledger.outcome).toBe('CANCELLED');
    expect(ledger.customer.currentDemoTotalPaise).toBe(0);
    expect(ledger.customer.adjustmentPaise).toBe(-28000);
    expect(ledger.customer.demoRefundPaise).toBe(28000);
    expect(ledger.partner.totalEarningPaise).toBe(0);
    expect(ledger.platform.feePaise).toBe(0);
    expect(ledger.refund.status).toBe('DEMO_CANCELLATION_REFUND_REPRESENTED');
  });

  test('post-purchase admin review does not invent an automatic refund', () => {
    const ledger = buildDemoLedgerProjection({
      order: projectionOrder(ORDER_STATUS.ADMIN_REVIEW_REQUIRED, {
        lastEvent: RECOVERY_EVENT.PARTNER_FAILED_AFTER_PURCHASE,
        lastActor: RECOVERY_ACTOR.PARTNER,
        reason: 'Delivery could not continue after pickup',
      }),
      payment: confirmedPayment,
    });

    expect(ledger.outcome).toBe('ADMIN_REVIEW_REQUIRED');
    expect(ledger.customer.demoRefundPaise).toBe(0);
    expect(ledger.refund.status).toBe('DEMO_REVIEW_PENDING');
    expect(ledger.settlement.status).toBe('ADMIN_REVIEW_REQUIRED');
  });
});
