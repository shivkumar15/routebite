import { ORDER_STATUS } from '../constants/order.constants.js';
import { MatchingAttempt } from '../models/matching-attempt.model.js';
import { Offer } from '../models/offer.model.js';
import { Order } from '../models/order.model.js';
import { Partner } from '../models/partner.model.js';
import { PartnerEarning } from '../models/partner-earning.model.js';
import { Payment } from '../models/payment.model.js';
import { UploadAsset } from '../models/upload-asset.model.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/app-error.js';
import { createAuthenticatedAssetUrl } from './upload.service.js';

const ATTENTION_STATUSES = [
  ORDER_STATUS.ADMIN_REVIEW_REQUIRED,
  ORDER_STATUS.MATCHING_FAILED,
  ORDER_STATUS.FAILED,
];

const ACTIVE_STATUSES = [
  ORDER_STATUS.AWAITING_PAYMENT,
  ORDER_STATUS.MATCHING,
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.PARTNER_TO_PICKUP,
  ORDER_STATUS.PRICE_CONFIRMATION_REQUIRED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERY_OTP_REQUIRED,
  ORDER_STATUS.DELIVERED,
];

function shortId(value) {
  return value?.toString().slice(-6).toUpperCase() ?? null;
}

function safePoint(point, label) {
  if (!point?.coordinates) return null;
  return {
    label,
    latitude: point.coordinates[1],
    longitude: point.coordinates[0],
  };
}

function safeCustomer(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
  };
}

function safePartner(partner, user) {
  if (!partner) return null;
  return {
    id: partner._id.toString(),
    user: user
      ? {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
        }
      : null,
    verificationStatus: partner.verificationStatus,
    availabilityStatus: partner.availabilityStatus,
    collegeName: partner.collegeIdentity?.collegeName ?? null,
    enrollmentNumber: partner.collegeIdentity?.enrollmentNumber ?? null,
    ratingAverage: partner.ratingAverage ?? 0,
    completedOrderCount: partner.completedOrderCount ?? 0,
    cancelledOrderCount: partner.cancelledOrderCount ?? 0,
    activeOrderId: partner.activeOrderId?.toString() ?? null,
  };
}

function safePayment(payment) {
  return {
    id: payment._id.toString(),
    status: payment.status,
    provider: payment.provider,
    mode: payment.mode,
    currency: payment.currency,
    amountPaise: payment.amountPaise,
    activeAttempt: payment.activeAttempt,
    providerOrderId: payment.providerOrderId,
    providerPaymentId: payment.providerPaymentId,
    failureReason: payment.failureReason,
    confirmedAt: payment.confirmedAt,
    failedAt: payment.failedAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

function safeMatchingAttempt(attempt) {
  return {
    id: attempt._id.toString(),
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    resumeAt: attempt.resumeAt,
    routeSource: attempt.routeSource,
    discoveredCandidateCount: attempt.discoveredCandidateCount,
    eligibleCandidateCount: attempt.eligibleCandidateCount,
    offerReadyCount: attempt.offerReadyPartnerIds?.length ?? 0,
    rejectionSummary: attempt.rejectionSummary ?? {},
    failureReason: attempt.failureReason,
    completedAt: attempt.completedAt,
    createdAt: attempt.createdAt,
  };
}

function safeOffer(offer) {
  return {
    id: offer._id.toString(),
    partnerId: offer.partnerId.toString(),
    partnerShortId: shortId(offer.partnerId),
    tripId: offer.tripId?.toString() ?? null,
    partnerMode: offer.partnerMode,
    round: offer.round,
    rankPosition: offer.rankPosition,
    status: offer.status,
    expectedEarningPaise: offer.expectedEarningPaise,
    predictedPickupAt: offer.predictedPickupAt,
    predictedDeliveryAt: offer.predictedDeliveryAt,
    expiresAt: offer.expiresAt,
    respondedAt: offer.respondedAt,
    createdAt: offer.createdAt,
  };
}

function addTimeline(events, at, type, title, detail = null, tone = 'neutral') {
  if (!at) return;
  events.push({ at, type, title, detail, tone });
}

function buildTimeline({ order, payments, attempts, offers, earning }) {
  const events = [];

  addTimeline(events, order.createdAt, 'ORDER_CREATED', 'Food request created', order.vendorDisplayName);

  for (const payment of payments) {
    addTimeline(
      events,
      payment.createdAt,
      'PAYMENT_ATTEMPT_CREATED',
      'Razorpay test payment attempt created',
      `${payment.status} · ₹${(payment.amountPaise / 100).toFixed(2)}`,
    );
    addTimeline(
      events,
      payment.confirmedAt,
      'PAYMENT_CONFIRMED',
      'Test payment confirmed',
      payment.providerPaymentId ?? null,
      'good',
    );
    addTimeline(
      events,
      payment.failedAt,
      'PAYMENT_FAILED',
      'Payment attempt failed',
      payment.failureReason,
      'danger',
    );
  }

  for (const attempt of attempts) {
    addTimeline(
      events,
      attempt.createdAt,
      'MATCHING_ATTEMPT_STARTED',
      `Matching attempt ${attempt.attemptNumber} started`,
      attempt.resumeAt ? `Deferred until ${new Date(attempt.resumeAt).toISOString()}` : null,
    );
    addTimeline(
      events,
      attempt.completedAt,
      'MATCHING_ATTEMPT_COMPLETED',
      `Matching attempt ${attempt.attemptNumber}: ${attempt.status}`,
      attempt.failureReason ||
        `${attempt.eligibleCandidateCount} eligible of ${attempt.discoveredCandidateCount} discovered`,
      attempt.status === 'NO_CANDIDATES' ? 'danger' : 'good',
    );
  }

  for (const offer of offers) {
    addTimeline(
      events,
      offer.createdAt,
      'OFFER_DISPATCHED',
      `Offer sent to partner ${shortId(offer.partnerId)}`,
      `Round ${offer.round} · rank ${offer.rankPosition}`,
    );
    addTimeline(
      events,
      offer.respondedAt,
      'OFFER_RESOLVED',
      `Offer ${offer.status.toLowerCase()}`,
      `Partner ${shortId(offer.partnerId)}`,
      offer.status === 'ACCEPTED' ? 'good' : offer.status === 'EXPIRED' ? 'warning' : 'neutral',
    );
  }

  addTimeline(events, order.pickupStartedAt, 'PARTNER_TO_PICKUP', 'Partner started pickup leg');
  addTimeline(
    events,
    order.priceAdjustment?.reportedAt,
    'PRICE_REPORTED',
    'Partner reported actual food price',
    order.priceAdjustment?.actualFoodCostPaise != null
      ? `₹${(order.priceAdjustment.actualFoodCostPaise / 100).toFixed(2)} · ${order.priceAdjustment.status}`
      : order.priceAdjustment?.status,
  );
  addTimeline(events, order.priceAdjustment?.resolvedAt, 'PRICE_RESOLVED', `Price adjustment ${order.priceAdjustment?.status}`);
  addTimeline(events, order.pickedUpAt, 'PICKED_UP', 'Food picked up', null, 'good');
  addTimeline(events, order.deliveryStartedAt, 'OUT_FOR_DELIVERY', 'Delivery started');
  addTimeline(events, order.deliveryOtpRequestedAt, 'DELIVERY_OTP_REQUIRED', 'Partner requested delivery OTP');
  addTimeline(events, order.deliveredAt, 'DELIVERED', 'Delivery OTP verified', null, 'good');
  addTimeline(events, order.completedAt, 'COMPLETED', 'Order completed', null, 'good');

  addTimeline(
    events,
    order.recovery?.occurredAt,
    order.recovery?.lastEvent ?? 'RECOVERY',
    `Recovery: ${order.recovery?.lastEvent ?? 'event'}`,
    order.recovery?.reason,
    order.status === ORDER_STATUS.ADMIN_REVIEW_REQUIRED ? 'danger' : 'warning',
  );

  addTimeline(
    events,
    earning?.earnedAt,
    'PARTNER_EARNING_RECORDED',
    'Demo partner earning recorded',
    earning ? `₹${(earning.totalEarningPaise / 100).toFixed(2)}` : null,
    'good',
  );

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function listFilter(filter) {
  if (!filter || filter === 'ALL') return {};
  if (filter === 'ATTENTION') return { status: { $in: ATTENTION_STATUSES } };
  if (filter === 'ACTIVE') return { status: { $in: ACTIVE_STATUSES } };
  if (!Object.values(ORDER_STATUS).includes(filter)) {
    throw new AppError('Unknown admin order filter.', {
      statusCode: 422,
      code: 'INVALID_ADMIN_ORDER_FILTER',
    });
  }
  return { status: filter };
}

export async function listAdminOrders({ filter = 'ALL' } = {}) {
  const query = listFilter(filter);
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .select(
      '_id customerId status vendorDisplayName pickupText dropText deliveryType deliveryWindowStart deliveryWindowEnd assignedPartnerId pricing recovery createdAt updatedAt completedAt',
    )
    .lean();

  const customerIds = [...new Set(orders.map((order) => order.customerId.toString()))];
  const partnerIds = [
    ...new Set(
      orders
        .map((order) => order.assignedPartnerId?.toString())
        .filter(Boolean),
    ),
  ];

  const [customers, partners, payments, counts] = await Promise.all([
    User.find({ _id: { $in: customerIds } }).select('_id name email phone').lean(),
    Partner.find({ _id: { $in: partnerIds } }).select('_id userId').lean(),
    Payment.find({ orderId: { $in: orders.map((order) => order._id) } })
      .sort({ createdAt: -1 })
      .select('_id orderId status amountPaise mode confirmedAt createdAt')
      .lean(),
    Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: { $in: ATTENTION_STATUSES } }),
      Order.countDocuments({ status: ORDER_STATUS.ADMIN_REVIEW_REQUIRED }),
      Order.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
      Order.countDocuments({ status: ORDER_STATUS.COMPLETED }),
      Order.countDocuments({ status: ORDER_STATUS.CANCELLED }),
    ]),
  ]);

  const customerById = new Map(customers.map((user) => [user._id.toString(), user]));
  const partnerById = new Map(partners.map((partner) => [partner._id.toString(), partner]));
  const paymentByOrder = new Map();
  for (const payment of payments) {
    const key = payment.orderId.toString();
    if (!paymentByOrder.has(key)) paymentByOrder.set(key, payment);
  }

  return {
    filter,
    counts: {
      all: counts[0],
      attention: counts[1],
      adminReview: counts[2],
      active: counts[3],
      completed: counts[4],
      cancelled: counts[5],
    },
    orders: orders.map((order) => {
      const customer = customerById.get(order.customerId.toString());
      const partner = order.assignedPartnerId
        ? partnerById.get(order.assignedPartnerId.toString())
        : null;
      const payment = paymentByOrder.get(order._id.toString());

      return {
        id: order._id.toString(),
        shortId: shortId(order._id),
        status: order.status,
        vendorDisplayName: order.vendorDisplayName,
        pickupText: order.pickupText,
        dropText: order.dropText,
        deliveryType: order.deliveryType,
        deliveryWindowStart: order.deliveryWindowStart,
        deliveryWindowEnd: order.deliveryWindowEnd,
        customer: customer
          ? { id: customer._id.toString(), name: customer.name, email: customer.email, phone: customer.phone }
          : null,
        assignedPartnerId: partner?._id?.toString() ?? null,
        assignedPartnerShortId: partner ? shortId(partner._id) : null,
        latestPayment: payment
          ? {
              status: payment.status,
              amountPaise: payment.amountPaise,
              mode: payment.mode,
              confirmedAt: payment.confirmedAt,
            }
          : null,
        totalPaise: order.pricing?.finalCustomerTotalPaise ?? order.pricing?.estimatedCustomerTotalPaise ?? 0,
        recovery: {
          lastEvent: order.recovery?.lastEvent ?? 'NONE',
          reason: order.recovery?.reason ?? null,
          occurredAt: order.recovery?.occurredAt ?? null,
          rematchCount: order.recovery?.rematchCount ?? 0,
        },
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        completedAt: order.completedAt,
      };
    }),
  };
}

export async function getAdminOrderDetail(orderId) {
  const order = await Order.findById(orderId).lean();
  if (!order) {
    throw new AppError('Order not found.', { statusCode: 404, code: 'ORDER_NOT_FOUND' });
  }

  const [customer, assignedPartner, payments, attempts, offers, earning] = await Promise.all([
    User.findById(order.customerId).select('_id name email phone emailVerified phoneVerified').lean(),
    order.assignedPartnerId ? Partner.findById(order.assignedPartnerId).lean() : null,
    Payment.find({ orderId: order._id }).sort({ createdAt: -1 }).lean(),
    MatchingAttempt.find({ orderId: order._id }).sort({ attemptNumber: 1 }).lean(),
    Offer.find({ orderId: order._id }).sort({ createdAt: 1 }).lean(),
    PartnerEarning.findOne({ orderId: order._id }).lean(),
  ]);

  let partnerUser = null;
  if (assignedPartner?.userId) {
    partnerUser = await User.findById(assignedPartner.userId).select('_id name email phone').lean();
  }

  let receiptUrl = null;
  if (order.priceAdjustment?.receiptAssetId) {
    const receipt = await UploadAsset.findById(order.priceAdjustment.receiptAssetId).select('+publicId');
    if (receipt) receiptUrl = createAuthenticatedAssetUrl(receipt);
  }

  const timeline = buildTimeline({ order, payments, attempts, offers, earning });

  return {
    order: {
      id: order._id.toString(),
      shortId: shortId(order._id),
      status: order.status,
      vendorDisplayName: order.vendorDisplayName,
      requestedItems: order.requestedItems,
      pickupInstructions: order.pickupInstructions,
      pickup: safePoint(order.pickup, order.pickupText),
      drop: safePoint(order.drop, order.dropText),
      deliveryType: order.deliveryType,
      deliveryWindowStart: order.deliveryWindowStart,
      deliveryWindowEnd: order.deliveryWindowEnd,
      assignedPartnerId: order.assignedPartnerId?.toString() ?? null,
      assignedTripId: order.assignedTripId?.toString() ?? null,
      pricing: order.pricing,
      priceAdjustment: {
        ...order.priceAdjustment,
        receiptUrl,
      },
      recovery: {
        lastEvent: order.recovery?.lastEvent ?? 'NONE',
        lastActor: order.recovery?.lastActor ?? null,
        reason: order.recovery?.reason ?? null,
        occurredAt: order.recovery?.occurredAt ?? null,
        rematchCount: order.recovery?.rematchCount ?? 0,
        excludedPartnerIds: (order.recovery?.excludedPartnerIds ?? []).map((id) => id.toString()),
      },
      timestamps: {
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        pickupStartedAt: order.pickupStartedAt,
        pickedUpAt: order.pickedUpAt,
        deliveryStartedAt: order.deliveryStartedAt,
        deliveryOtpRequestedAt: order.deliveryOtpRequestedAt,
        deliveredAt: order.deliveredAt,
        completedAt: order.completedAt,
      },
    },
    customer: safeCustomer(customer),
    assignedPartner: safePartner(assignedPartner, partnerUser),
    payments: payments.map(safePayment),
    matchingAttempts: attempts.map(safeMatchingAttempt),
    offers: offers.map(safeOffer),
    earning: earning
      ? {
          id: earning._id.toString(),
          partnerId: earning.partnerId.toString(),
          baseEarningPaise: earning.baseEarningPaise,
          incentivePaise: earning.incentivePaise,
          totalEarningPaise: earning.totalEarningPaise,
          earnedAt: earning.earnedAt,
        }
      : null,
    timeline,
  };
}
