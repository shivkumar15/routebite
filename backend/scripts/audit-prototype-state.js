import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { MATCHING_ATTEMPT_STATUS } from '../src/constants/matching.constants.js';
import { OFFER_STATUS } from '../src/constants/offer.constants.js';
import { ORDER_STATUS } from '../src/constants/order.constants.js';
import { PAYMENT_STATUS } from '../src/constants/payment.constants.js';
import { MatchingAttempt } from '../src/models/matching-attempt.model.js';
import { Offer } from '../src/models/offer.model.js';
import { Order } from '../src/models/order.model.js';
import { Partner } from '../src/models/partner.model.js';
import { PartnerEarning } from '../src/models/partner-earning.model.js';
import { Payment } from '../src/models/payment.model.js';

const ACTIVE_FULFILMENT_STATUSES = new Set([
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.PARTNER_TO_PICKUP,
  ORDER_STATUS.PRICE_CONFIRMATION_REQUIRED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERY_OTP_REQUIRED,
  ORDER_STATUS.DELIVERED,
]);

const POST_PAYMENT_STATUSES = new Set([
  ORDER_STATUS.MATCHING,
  ...ACTIVE_FULFILMENT_STATUSES,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.MATCHING_FAILED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.ADMIN_REVIEW_REQUIRED,
]);

const RELEASED_STATUSES = new Set([
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.MATCHING_FAILED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.FAILED,
  ORDER_STATUS.ADMIN_REVIEW_REQUIRED,
]);

const LIVE_MATCHING_ATTEMPT_STATUSES = new Set([
  MATCHING_ATTEMPT_STATUS.WAITING_FOR_HORIZON,
  MATCHING_ATTEMPT_STATUS.RUNNING,
  MATCHING_ATTEMPT_STATUS.CANDIDATES_READY,
]);

function shortId(value) {
  return value?.toString?.().slice(-6).toUpperCase() ?? 'UNKNOWN';
}

function parseLimit() {
  const index = process.argv.indexOf('--latest');
  if (index === -1) return 100;
  const value = Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value) || value < 1 || value > 1000) {
    throw new Error('--latest must be an integer between 1 and 1000.');
  }
  return value;
}

function addIssue(issues, severity, order, code, detail) {
  issues.push({
    severity,
    order: `#${shortId(order?._id)}`,
    status: order?.status ?? '—',
    code,
    detail,
  });
}

async function main() {
  const limit = parseLimit();
  await connectDatabase();

  try {
    const orders = await Order.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    const orderIds = orders.map((order) => order._id);

    const [payments, attempts, offers, earnings, partners] = await Promise.all([
      Payment.find({ orderId: { $in: orderIds } }).sort({ createdAt: 1 }).lean(),
      MatchingAttempt.find({ orderId: { $in: orderIds } }).sort({ attemptNumber: 1 }).lean(),
      Offer.find({ orderId: { $in: orderIds } }).sort({ createdAt: 1 }).lean(),
      PartnerEarning.find({ orderId: { $in: orderIds } }).lean(),
      Partner.find({
        $or: [
          { activeOrderId: { $in: orderIds } },
          { _id: { $in: orders.map((order) => order.assignedPartnerId).filter(Boolean) } },
        ],
      }).lean(),
    ]);

    const group = (items, keyFn) => {
      const map = new Map();
      for (const item of items) {
        const key = keyFn(item);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      }
      return map;
    };

    const paymentsByOrder = group(payments, (item) => item.orderId.toString());
    const attemptsByOrder = group(attempts, (item) => item.orderId.toString());
    const offersByOrder = group(offers, (item) => item.orderId.toString());
    const earningsByOrder = group(earnings, (item) => item.orderId.toString());
    const partnerById = new Map(partners.map((partner) => [partner._id.toString(), partner]));
    const partnersByActiveOrder = group(
      partners.filter((partner) => partner.activeOrderId),
      (partner) => partner.activeOrderId.toString(),
    );

    const issues = [];

    for (const order of orders) {
      const key = order._id.toString();
      const orderPayments = paymentsByOrder.get(key) ?? [];
      const orderAttempts = attemptsByOrder.get(key) ?? [];
      const orderOffers = offersByOrder.get(key) ?? [];
      const orderEarnings = earningsByOrder.get(key) ?? [];
      const lockedPartners = partnersByActiveOrder.get(key) ?? [];
      const confirmedPayment = orderPayments.find(
        (payment) => payment.status === PAYMENT_STATUS.CONFIRMED,
      );
      const acceptedOffers = orderOffers.filter((offer) => offer.status === OFFER_STATUS.ACCEPTED);
      const latestAttempt = orderAttempts.at(-1) ?? null;

      if (
        confirmedPayment &&
        [ORDER_STATUS.DRAFT, ORDER_STATUS.AWAITING_PAYMENT].includes(order.status)
      ) {
        addIssue(
          issues,
          'ERROR',
          order,
          'CONFIRMED_PAYMENT_BEFORE_MATCHING',
          'A confirmed payment exists but the order has not entered matching.',
        );
      }

      if (POST_PAYMENT_STATUSES.has(order.status) && !confirmedPayment) {
        addIssue(
          issues,
          'WARN',
          order,
          'POST_PAYMENT_ORDER_WITHOUT_CONFIRMED_PAYMENT',
          'No confirmed payment was found. This may be a legacy/manual development fixture.',
        );
      }

      if (order.status === ORDER_STATUS.MATCHING) {
        if (order.assignedPartnerId) {
          addIssue(
            issues,
            'ERROR',
            order,
            'MATCHING_WITH_ASSIGNED_PARTNER',
            `Matching order still references partner #${shortId(order.assignedPartnerId)}.`,
          );
        }
        if (!latestAttempt || !LIVE_MATCHING_ATTEMPT_STATUSES.has(latestAttempt.status)) {
          addIssue(
            issues,
            'ERROR',
            order,
            'MATCHING_WITHOUT_LIVE_ATTEMPT',
            latestAttempt
              ? `Latest matching attempt is terminal (${latestAttempt.status}).`
              : 'No matching attempt exists.',
          );
        }
      }

      if (ACTIVE_FULFILMENT_STATUSES.has(order.status)) {
        if (!order.assignedPartnerId) {
          addIssue(
            issues,
            'ERROR',
            order,
            'ACTIVE_ORDER_WITHOUT_PARTNER',
            'An active fulfilment order has no assigned partner.',
          );
        } else {
          const partner = partnerById.get(order.assignedPartnerId.toString());
          if (!partner) {
            addIssue(
              issues,
              'ERROR',
              order,
              'ASSIGNED_PARTNER_MISSING',
              `Assigned partner #${shortId(order.assignedPartnerId)} does not exist.`,
            );
          } else if (partner.activeOrderId?.toString() !== key) {
            addIssue(
              issues,
              'ERROR',
              order,
              'PARTNER_ACTIVE_ORDER_MISMATCH',
              `Partner #${shortId(partner._id)} does not point back to this active order.`,
            );
          }
        }
      }

      if (RELEASED_STATUSES.has(order.status) && lockedPartners.length > 0) {
        addIssue(
          issues,
          'ERROR',
          order,
          'TERMINAL_ORDER_STILL_LOCKS_PARTNER',
          `${lockedPartners.length} partner(s) still reference this released/terminal order as active.`,
        );
      }

      if (acceptedOffers.length > 1) {
        addIssue(
          issues,
          'ERROR',
          order,
          'MULTIPLE_ACCEPTED_OFFERS',
          `${acceptedOffers.length} offers are marked ACCEPTED for one order.`,
        );
      }

      if (
        acceptedOffers.length === 1 &&
        order.assignedPartnerId &&
        acceptedOffers[0].partnerId.toString() !== order.assignedPartnerId.toString()
      ) {
        addIssue(
          issues,
          'ERROR',
          order,
          'ACCEPTED_OFFER_PARTNER_MISMATCH',
          'The accepted offer belongs to a different partner than the order assignment.',
        );
      }

      if (order.status === ORDER_STATUS.COMPLETED) {
        if (!order.completedAt) {
          addIssue(
            issues,
            'ERROR',
            order,
            'COMPLETED_WITHOUT_TIMESTAMP',
            'COMPLETED order is missing completedAt.',
          );
        }
        if (orderEarnings.length !== 1) {
          addIssue(
            issues,
            orderEarnings.length === 0 ? 'WARN' : 'ERROR',
            order,
            'COMPLETED_EARNING_COUNT_INVALID',
            `Expected one earning record, found ${orderEarnings.length}. Legacy manually-completed orders may have none.`,
          );
        }
      }
    }

    for (const partner of partners) {
      if (!partner.activeOrderId) continue;
      const order = orders.find(
        (candidate) => candidate._id.toString() === partner.activeOrderId.toString(),
      );
      if (!order) continue;
      if (
        !ACTIVE_FULFILMENT_STATUSES.has(order.status) ||
        order.assignedPartnerId?.toString() !== partner._id.toString()
      ) {
        addIssue(
          issues,
          'ERROR',
          order,
          'PARTNER_LOCK_POINTS_TO_NON_ACTIVE_ORDER',
          `Partner #${shortId(partner._id)} has an activeOrderId that is not a valid active assignment.`,
        );
      }
    }

    const errors = issues.filter((issue) => issue.severity === 'ERROR');
    const warnings = issues.filter((issue) => issue.severity === 'WARN');

    console.log(`\nRouteBite Phase 15 invariant audit · latest ${orders.length} order(s)`);
    console.log(`Errors: ${errors.length} · Warnings: ${warnings.length}`);

    if (issues.length > 0) console.table(issues);
    else console.log('PASS: no invariant issues found in the audited orders.');

    if (errors.length > 0) {
      process.exitCode = 1;
      console.log('\nAudit failed because at least one current-state invariant is broken.');
    } else if (warnings.length > 0) {
      console.log('\nAudit passed with warnings. Review legacy/manual development fixtures if needed.');
    }
  } finally {
    await mongoose.connection.close();
  }
}

main().catch(async (error) => {
  console.error('Prototype invariant audit failed:', error);
  if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  process.exitCode = 1;
});
