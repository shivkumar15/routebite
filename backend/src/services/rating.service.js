import mongoose from 'mongoose';
import { ORDER_STATUS } from '../constants/order.constants.js';
import { Order } from '../models/order.model.js';
import { Partner } from '../models/partner.model.js';
import { Rating } from '../models/rating.model.js';
import { AppError } from '../utils/app-error.js';

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

function toPartnerRatingSummary(partner) {
  if (!partner) return null;
  return {
    partnerId: partner._id.toString(),
    ratingAverage: Number(partner.ratingAverage ?? 0),
    ratingCount: Number(partner.ratingCount ?? 0),
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
    '_id customerId status assignedPartnerId completedAt',
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

export async function getCustomerOrderRating({ customerId, orderId }) {
  const order = await getRateableOrder({ customerId, orderId });
  const [rating, partner] = await Promise.all([
    Rating.findOne({ orderId: order._id, customerId }).lean(),
    Partner.findById(order.assignedPartnerId)
      .select('_id ratingAverage ratingCount')
      .lean(),
  ]);

  return {
    canRate: !rating,
    rating: toSafeRating(rating),
    partner: toPartnerRatingSummary(partner),
  };
}

export async function submitCustomerRating({ customerId, orderId, score, feedback = '' }) {
  const session = await mongoose.startSession();
  let createdRating = null;
  let partnerId = null;

  try {
    await session.withTransaction(async () => {
      const order = await getRateableOrder({ customerId, orderId, session });
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

  const partner = await Partner.findById(partnerId)
    .select('_id ratingAverage ratingCount')
    .lean();

  return {
    rating: toSafeRating(createdRating),
    partner: toPartnerRatingSummary(partner),
  };
}
