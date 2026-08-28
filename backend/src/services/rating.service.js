import mongoose from 'mongoose';
import { ORDER_STATUS } from '../constants/order.constants.js';
import { Order } from '../models/order.model.js';
import { Partner } from '../models/partner.model.js';
import { Rating } from '../models/rating.model.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/app-error.js';

function shortId(value) {
  return value?.toString().slice(-6).toUpperCase() ?? null;
}

function firstName(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return 'Customer';
  return normalized.split(/\s+/)[0];
}

function toSafeRating(rating) {
  if (!rating) return null;
  return {
    id: rating._id.toString(),
    orderId: rating.orderId.toString(),
    partnerId: rating.partnerId.toString(),
    score: rating.score,
    feedback: rating.feedback ?? '',
    createdAt: rating.createdAt,
  };
}

function toPartnerRatingSummary(partner, user = null) {
  if (!partner) return null;
  return {
    partnerId: partner._id.toString(),
    partnerShortId: shortId(partner._id),
    name: user?.name ?? null,
    ratingAverage: Number(partner.ratingAverage ?? 0),
    ratingCount: Number(partner.ratingCount ?? 0),
  };
}

function toRatingOrderSummary(order) {
  if (!order) return null;
  return {
    id: order._id.toString(),
    shortId: shortId(order._id),
    vendorDisplayName: order.vendorDisplayName,
    requestedItems: order.requestedItems,
    pickupText: order.pickupText,
    dropText: order.dropText,
    completedAt: order.completedAt,
  };
}

export function ratingAverageAfter({ currentAverage, currentCount, score }) {
  const count = Number(currentCount ?? 0);
  const average = Number(currentAverage ?? 0);
  const nextScore = Number(score);

  if (!Number.isInteger(count) || count < 0) return null;
  if (!Number.isFinite(average) || average < 0 || average > 5) return null;
  if (!Number.isInteger(nextScore) || nextScore < 1 || nextScore > 5) return null;

  return ((average * count) + nextScore) / (count + 1);
}

async function getRateableOrder({ customerId, orderId, session = null }) {
  const query = Order.findOne({ _id: orderId, customerId }).select(
    '_id customerId status assignedPartnerId vendorDisplayName requestedItems pickupText dropText completedAt',
  );
  if (session) query.session(session);
  const order = await query;

  if (!order) {
    throw new AppError('Order not found.', {
      statusCode: 404,
      code: 'ORDER_NOT_FOUND',
    });
  }

  if (order.status !== ORDER_STATUS.COMPLETED || !order.completedAt) {
    throw new AppError('You can rate a delivery only after the order is completed.', {
      statusCode: 409,
      code: 'RATING_ORDER_NOT_COMPLETED',
    });
  }

  if (!order.assignedPartnerId) {
    throw new AppError('This completed order has no delivery partner to rate.', {
      statusCode: 409,
      code: 'RATING_PARTNER_MISSING',
    });
  }

  return order;
}

async function getPartnerWithUser(partnerId) {
  const partner = await Partner.findById(partnerId)
    .select('_id userId ratingAverage ratingCount')
    .lean();
  if (!partner) return { partner: null, user: null };

  const user = partner.userId
    ? await User.findById(partner.userId).select('_id name').lean()
    : null;

  return { partner, user };
}

export async function getCustomerOrderRating({ customerId, orderId }) {
  const order = await getRateableOrder({ customerId, orderId });
  const [rating, partnerIdentity] = await Promise.all([
    Rating.findOne({ orderId: order._id, customerId }).lean(),
    getPartnerWithUser(order.assignedPartnerId),
  ]);

  return {
    canRate: !rating,
    rating: toSafeRating(rating),
    order: toRatingOrderSummary(order),
    partner: toPartnerRatingSummary(partnerIdentity.partner, partnerIdentity.user),
  };
}

export async function submitCustomerRating({ customerId, orderId, score, feedback = '' }) {
  const session = await mongoose.startSession();
  let createdRating = null;
  let partnerId = null;
  let ratedOrder = null;

  try {
    await session.withTransaction(async () => {
      const order = await getRateableOrder({ customerId, orderId, session });
      ratedOrder = order;
      partnerId = order.assignedPartnerId;

      const existing = await Rating.findOne({
        orderId: order._id,
        customerId,
      }).session(session);

      if (existing) {
        throw new AppError('You have already rated this delivery.', {
          statusCode: 409,
          code: 'RATING_ALREADY_SUBMITTED',
        });
      }

      const partner = await Partner.findById(partnerId)
        .select('_id ratingAverage ratingCount')
        .session(session);

      if (!partner) {
        throw new AppError('Delivery partner no longer exists.', {
          statusCode: 409,
          code: 'RATING_PARTNER_MISSING',
        });
      }

      const nextAverage = ratingAverageAfter({
        currentAverage: partner.ratingAverage,
        currentCount: partner.ratingCount,
        score,
      });

      if (nextAverage == null) {
        throw new AppError('Partner rating aggregate is invalid.', {
          statusCode: 500,
          code: 'RATING_AGGREGATE_INVALID',
        });
      }

      const created = await Rating.create(
        [
          {
            orderId: order._id,
            customerId,
            partnerId,
            score,
            feedback: feedback.trim(),
          },
        ],
        { session },
      );
      [createdRating] = created;

      const updateResult = await Partner.updateOne(
        {
          _id: partner._id,
          ratingCount: partner.ratingCount,
        },
        {
          $set: { ratingAverage: nextAverage },
          $inc: { ratingCount: 1 },
        },
        { session, runValidators: true },
      );

      if (updateResult.modifiedCount !== 1) {
        throw new AppError('Partner rating changed concurrently. Please submit again.', {
          statusCode: 409,
          code: 'RATING_CONCURRENT_UPDATE',
        });
      }
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('You have already rated this delivery.', {
        statusCode: 409,
        code: 'RATING_ALREADY_SUBMITTED',
      });
    }
    throw error;
  } finally {
    await session.endSession();
  }

  const partnerIdentity = await getPartnerWithUser(partnerId);

  return {
    rating: toSafeRating(createdRating),
    order: toRatingOrderSummary(ratedOrder),
    partner: toPartnerRatingSummary(partnerIdentity.partner, partnerIdentity.user),
  };
}

export async function getPartnerReceivedRatings(partnerId) {
  const partner = await Partner.findById(partnerId)
    .select('_id ratingAverage ratingCount')
    .lean();

  if (!partner) {
    throw new AppError('Partner profile not found.', {
      statusCode: 404,
      code: 'PARTNER_PROFILE_NOT_FOUND',
    });
  }

  const ratings = await Rating.find({ partnerId: partner._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const orderIds = ratings.map((rating) => rating.orderId);
  const customerIds = ratings.map((rating) => rating.customerId);

  const [orders, customers] = await Promise.all([
    Order.find({ _id: { $in: orderIds } })
      .select('_id vendorDisplayName pickupText dropText completedAt')
      .lean(),
    User.find({ _id: { $in: customerIds } })
      .select('_id name')
      .lean(),
  ]);

  const orderById = new Map(orders.map((order) => [order._id.toString(), order]));
  const customerById = new Map(customers.map((user) => [user._id.toString(), user]));

  return {
    summary: toPartnerRatingSummary(partner),
    privacy: {
      customerIdentity: 'FIRST_NAME_ONLY',
      note: 'Customer email, phone and full account identity are not exposed in partner reviews.',
    },
    reviews: ratings.map((rating) => {
      const order = orderById.get(rating.orderId.toString());
      const customer = customerById.get(rating.customerId.toString());

      return {
        id: rating._id.toString(),
        score: rating.score,
        feedback: rating.feedback ?? '',
        createdAt: rating.createdAt,
        customerDisplayName: firstName(customer?.name),
        order: order
          ? {
              id: order._id.toString(),
              shortId: shortId(order._id),
              vendorDisplayName: order.vendorDisplayName,
              pickupText: order.pickupText,
              dropText: order.dropText,
              completedAt: order.completedAt,
            }
          : {
              id: rating.orderId.toString(),
              shortId: shortId(rating.orderId),
              vendorDisplayName: 'Completed delivery',
              pickupText: null,
              dropText: null,
              completedAt: null,
            },
      };
    }),
  };
}
