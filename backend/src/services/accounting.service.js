import {
  DEMO_LEDGER_OUTCOME,
  DEMO_REFUND_STATUS,
  DEMO_SETTLEMENT_STATUS,
} from '../constants/accounting.constants.js';
import { ORDER_STATUS } from '../constants/order.constants.js';
import { PAYMENT_STATUS } from '../constants/payment.constants.js';
import { Order } from '../models/order.model.js';
import { PartnerEarning } from '../models/partner-earning.model.js';
import { Payment } from '../models/payment.model.js';
import { AppError } from '../utils/app-error.js';

function integerPaise(value) {
  const amount = Number(value ?? 0);
  return Number.isSafeInteger(amount) ? amount : 0;
}

function resolveOutcome(orderStatus) {
  if (orderStatus === ORDER_STATUS.COMPLETED) return DEMO_LEDGER_OUTCOME.COMPLETED;
  if (orderStatus === ORDER_STATUS.MATCHING_FAILED) return DEMO_LEDGER_OUTCOME.MATCHING_FAILED;
  if (orderStatus === ORDER_STATUS.CANCELLED) return DEMO_LEDGER_OUTCOME.CANCELLED;
  if (orderStatus === ORDER_STATUS.ADMIN_REVIEW_REQUIRED) {
    return DEMO_LEDGER_OUTCOME.ADMIN_REVIEW_REQUIRED;
  }
  return DEMO_LEDGER_OUTCOME.IN_PROGRESS;
}

export function buildDemoLedgerProjection({ order, payment = null, earning = null }) {
  const outcome = resolveOutcome(order.status);
  const completed = outcome === DEMO_LEDGER_OUTCOME.COMPLETED;
  const matchingFailed = outcome === DEMO_LEDGER_OUTCOME.MATCHING_FAILED;
  const cancelled = outcome === DEMO_LEDGER_OUTCOME.CANCELLED;
  const reviewRequired = outcome === DEMO_LEDGER_OUTCOME.ADMIN_REVIEW_REQUIRED;
  const fullyReversed = matchingFailed || cancelled;

  const testPaymentPaise = integerPaise(payment?.amountPaise);
  const estimatedTotalPaise = integerPaise(order.pricing?.estimatedCustomerTotalPaise);
  const finalTotalPaise = integerPaise(
    order.pricing?.finalCustomerTotalPaise ?? estimatedTotalPaise,
  );
  const actualFoodCostPaise = integerPaise(
    order.priceAdjustment?.actualFoodCostPaise ?? order.pricing?.estimatedFoodCostPaise,
  );

  const partnerBaseEarningPaise = completed
    ? integerPaise(earning?.baseEarningPaise)
    : 0;
  const partnerIncentivePaise = completed
    ? integerPaise(earning?.incentivePaise)
    : 0;
  const partnerTotalEarningPaise = completed
    ? integerPaise(
        earning?.totalEarningPaise ??
          partnerBaseEarningPaise + partnerIncentivePaise,
      )
    : 0;

  const currentDemoTotalPaise = fullyReversed ? 0 : finalTotalPaise;
  const customerAdjustmentPaise = fullyReversed
    ? -testPaymentPaise
    : completed
      ? finalTotalPaise - testPaymentPaise
      : 0;

  const demoRefundPaise = fullyReversed
    ? testPaymentPaise
    : completed
      ? Math.max(0, testPaymentPaise - finalTotalPaise)
      : 0;
  const demoAdditionalChargePaise = completed
    ? Math.max(0, finalTotalPaise - testPaymentPaise)
    : 0;

  let refundStatus = DEMO_REFUND_STATUS.NONE;
  let refundReason = null;
  if (matchingFailed && testPaymentPaise > 0) {
    refundStatus = DEMO_REFUND_STATUS.MATCHING_FAILURE_REPRESENTED;
    refundReason = 'No delivery partner completed matching, so the full test payment is represented as refundable.';
  } else if (cancelled && testPaymentPaise > 0) {
    refundStatus = DEMO_REFUND_STATUS.CANCELLATION_REPRESENTED;
    refundReason = 'The request was cancelled before food pickup, so the full confirmed test payment is represented as refundable.';
  } else if (reviewRequired) {
    refundStatus = DEMO_REFUND_STATUS.REVIEW_PENDING;
    refundReason = 'The order has financial or fulfilment exposure that requires operations review before any refund or settlement outcome is represented.';
  } else if (completed && demoRefundPaise > 0) {
    refundStatus = DEMO_REFUND_STATUS.ADJUSTMENT_REPRESENTED;
    refundReason = 'The final demo total is lower than the original Razorpay test payment.';
  }

  return {
    mode: 'DEMO_ONLY',
    currency: payment?.currency ?? 'INR',
    orderId: order._id?.toString?.() ?? order.id ?? null,
    orderStatus: order.status,
    outcome,
    providerPayment: {
      provider: payment?.provider ?? null,
      mode: payment?.mode ?? null,
      status: payment?.status ?? null,
      amountPaise: testPaymentPaise,
      confirmedAt: payment?.confirmedAt ?? null,
    },
    customer: {
      testPaymentPaise,
      estimatedTotalPaise,
      currentDemoTotalPaise,
      adjustmentPaise: customerAdjustmentPaise,
      demoRefundPaise,
      demoAdditionalChargePaise,
    },
    food: {
      reimbursementPaise: completed ? actualFoodCostPaise : 0,
      actualFoodCostPaise: completed ? actualFoodCostPaise : null,
    },
    partner: {
      baseEarningPaise: partnerBaseEarningPaise,
      incentivePaise: partnerIncentivePaise,
      totalEarningPaise: partnerTotalEarningPaise,
    },
    platform: {
      feePaise: completed ? integerPaise(order.pricing?.platformFeePaise) : 0,
      subsidyPaise: partnerIncentivePaise,
    },
    refund: {
      status: refundStatus,
      amountPaise: demoRefundPaise,
      reason: refundReason,
    },
    settlement: {
      status: completed
        ? DEMO_SETTLEMENT_STATUS.REPRESENTED
        : reviewRequired
          ? DEMO_SETTLEMENT_STATUS.REVIEW_REQUIRED
          : DEMO_SETTLEMENT_STATUS.NOT_APPLICABLE,
    },
    recovery: {
      event: order.recovery?.lastEvent ?? 'NONE',
      actor: order.recovery?.lastActor ?? null,
      reason: order.recovery?.reason ?? null,
      occurredAt: order.recovery?.occurredAt ?? null,
      rematchCount: order.recovery?.rematchCount ?? 0,
    },
    note:
      'Internal prototype accounting only. Razorpay Test Mode and this ledger do not represent real settlement, payout, extra charge, or refund movement.',
  };
}

export async function getCustomerDemoLedger({ customerId, orderId }) {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order) {
    throw new AppError('Order not found.', {
      statusCode: 404,
      code: 'ORDER_NOT_FOUND',
    });
  }

  const [payment, earning] = await Promise.all([
    Payment.findOne({
      orderId: order._id,
      customerId,
      status: PAYMENT_STATUS.CONFIRMED,
    }).sort({ confirmedAt: -1, createdAt: -1 }),
    PartnerEarning.findOne({ orderId: order._id }),
  ]);

  return buildDemoLedgerProjection({ order, payment, earning });
}

export function summarizePartnerEarnings(earnings) {
  return earnings.reduce(
    (summary, earning) => {
      summary.baseEarningPaise += integerPaise(earning.baseEarningPaise);
      summary.incentivePaise += integerPaise(earning.incentivePaise);
      summary.totalEarningPaise += integerPaise(earning.totalEarningPaise);
      summary.completedEarningCount += 1;
      return summary;
    },
    {
      baseEarningPaise: 0,
      incentivePaise: 0,
      totalEarningPaise: 0,
      completedEarningCount: 0,
    },
  );
}

export async function getPartnerEarnings(partnerId) {
  const earnings = await PartnerEarning.find({ partnerId }).sort({ earnedAt: -1 });
  const orderIds = earnings.map((earning) => earning.orderId);
  const orders = orderIds.length
    ? await Order.find({ _id: { $in: orderIds } }).select(
        'vendorDisplayName status completedAt dropText',
      )
    : [];
  const orderById = new Map(orders.map((order) => [order._id.toString(), order]));

  return {
    summary: summarizePartnerEarnings(earnings),
    earnings: earnings.map((earning) => {
      const order = orderById.get(earning.orderId.toString());
      return {
        id: earning._id.toString(),
        orderId: earning.orderId.toString(),
        vendorDisplayName: order?.vendorDisplayName ?? 'Completed RouteBite order',
        dropLabel: order?.dropText ?? null,
        orderStatus: order?.status ?? null,
        baseEarningPaise: earning.baseEarningPaise,
        incentivePaise: earning.incentivePaise,
        totalEarningPaise: earning.totalEarningPaise,
        earnedAt: earning.earnedAt,
      };
    }),
    note:
      'Prototype earnings representation only. These values are not proof of a real payout or production settlement.',
  };
}
