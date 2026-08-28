process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';

const { ORDER_STATUS } = await import('../../src/constants/order.constants.js');
const {
  DEMO_LEDGER_OUTCOME,
  DEMO_REFUND_STATUS,
  DEMO_SETTLEMENT_STATUS,
} = await import('../../src/constants/accounting.constants.js');
const {
  buildDemoLedgerProjection,
  summarizePartnerEarnings,
} = await import('../../src/services/accounting.service.js');

function baseOrder(overrides = {}) {
  return {
    id: 'order-1',
    status: ORDER_STATUS.COMPLETED,
    pricing: {
      estimatedFoodCostPaise: 13000,
      customerDeliveryChargePaise: 4000,
      partnerBaseEarningPaise: 4000,
      platformFeePaise: 1000,
      estimatedCustomerTotalPaise: 18000,
      finalCustomerTotalPaise: 17000,
    },
    priceAdjustment: {
      actualFoodCostPaise: 12000,
    },
    ...overrides,
  };
}

function confirmedPayment(amountPaise = 18000) {
  return {
    provider: 'RAZORPAY',
    mode: 'TEST',
    status: 'PAYMENT_CONFIRMED',
    currency: 'INR',
    amountPaise,
    confirmedAt: new Date('2026-08-28T10:00:00.000Z'),
  };
}

describe('Phase 11 demo accounting projection', () => {
  test('completed order separates reimbursement, base earning, incentive, fee, and subsidy', () => {
    const ledger = buildDemoLedgerProjection({
      order: baseOrder(),
      payment: confirmedPayment(),
      earning: {
        baseEarningPaise: 4000,
        incentivePaise: 1000,
        totalEarningPaise: 5000,
      },
    });

    expect(ledger.outcome).toBe(DEMO_LEDGER_OUTCOME.COMPLETED);
    expect(ledger.customer.testPaymentPaise).toBe(18000);
    expect(ledger.customer.currentDemoTotalPaise).toBe(17000);
    expect(ledger.customer.adjustmentPaise).toBe(-1000);
    expect(ledger.customer.demoRefundPaise).toBe(1000);
    expect(ledger.food.reimbursementPaise).toBe(12000);
    expect(ledger.partner.baseEarningPaise).toBe(4000);
    expect(ledger.partner.incentivePaise).toBe(1000);
    expect(ledger.partner.totalEarningPaise).toBe(5000);
    expect(ledger.platform.feePaise).toBe(1000);
    expect(ledger.platform.subsidyPaise).toBe(1000);
    expect(ledger.refund.status).toBe(DEMO_REFUND_STATUS.ADJUSTMENT_REPRESENTED);
    expect(ledger.settlement.status).toBe(DEMO_SETTLEMENT_STATUS.REPRESENTED);
  });

  test('higher final demo total is represented as an extra adjustment, not a live charge', () => {
    const ledger = buildDemoLedgerProjection({
      order: baseOrder({
        pricing: {
          estimatedFoodCostPaise: 13000,
          customerDeliveryChargePaise: 4000,
          partnerBaseEarningPaise: 4000,
          platformFeePaise: 1000,
          estimatedCustomerTotalPaise: 18000,
          finalCustomerTotalPaise: 20000,
        },
        priceAdjustment: { actualFoodCostPaise: 15000 },
      }),
      payment: confirmedPayment(),
      earning: {
        baseEarningPaise: 4000,
        incentivePaise: 0,
        totalEarningPaise: 4000,
      },
    });

    expect(ledger.customer.adjustmentPaise).toBe(2000);
    expect(ledger.customer.demoAdditionalChargePaise).toBe(2000);
    expect(ledger.customer.demoRefundPaise).toBe(0);
    expect(ledger.refund.status).toBe(DEMO_REFUND_STATUS.NONE);
  });

  test('matching failure represents the full confirmed test payment as refundable', () => {
    const ledger = buildDemoLedgerProjection({
      order: baseOrder({
        status: ORDER_STATUS.MATCHING_FAILED,
        pricing: {
          estimatedFoodCostPaise: 13000,
          customerDeliveryChargePaise: 4000,
          partnerBaseEarningPaise: 4000,
          platformFeePaise: 1000,
          estimatedCustomerTotalPaise: 18000,
          finalCustomerTotalPaise: null,
        },
        priceAdjustment: {},
      }),
      payment: confirmedPayment(),
      earning: null,
    });

    expect(ledger.outcome).toBe(DEMO_LEDGER_OUTCOME.MATCHING_FAILED);
    expect(ledger.customer.currentDemoTotalPaise).toBe(0);
    expect(ledger.customer.adjustmentPaise).toBe(-18000);
    expect(ledger.customer.demoRefundPaise).toBe(18000);
    expect(ledger.food.reimbursementPaise).toBe(0);
    expect(ledger.partner.totalEarningPaise).toBe(0);
    expect(ledger.platform.feePaise).toBe(0);
    expect(ledger.refund.status).toBe(
      DEMO_REFUND_STATUS.MATCHING_FAILURE_REPRESENTED,
    );
    expect(ledger.settlement.status).toBe(DEMO_SETTLEMENT_STATUS.NOT_APPLICABLE);
  });

  test('partner earnings summary keeps base and incentive totals separate', () => {
    const summary = summarizePartnerEarnings([
      { baseEarningPaise: 4000, incentivePaise: 0, totalEarningPaise: 4000 },
      { baseEarningPaise: 4000, incentivePaise: 1000, totalEarningPaise: 5000 },
    ]);

    expect(summary).toEqual({
      baseEarningPaise: 8000,
      incentivePaise: 1000,
      totalEarningPaise: 9000,
      completedEarningCount: 2,
    });
  });
});
