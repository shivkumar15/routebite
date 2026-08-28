import {
  cancelCustomerOrder,
  reportPartnerCannotComplete,
} from '../services/recovery.service.js';

function toRecovery(order) {
  return {
    event: order.recovery?.lastEvent ?? 'NONE',
    actor: order.recovery?.lastActor ?? null,
    reason: order.recovery?.reason ?? null,
    occurredAt: order.recovery?.occurredAt ?? null,
    rematchCount: order.recovery?.rematchCount ?? 0,
  };
}

export async function cancelCustomer(req, res, next) {
  try {
    const order = await cancelCustomerOrder({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
      reason: req.body.reason,
    });

    res.status(200).json({
      success: true,
      data: {
        order: {
          id: order._id.toString(),
          status: order.status,
          recovery: toRecovery(order),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function partnerCannotComplete(req, res, next) {
  try {
    const result = await reportPartnerCannotComplete({
      partnerId: req.auth.partnerId,
      reason: req.body.reason,
    });

    res.status(200).json({
      success: true,
      data: {
        order: {
          id: result.order._id.toString(),
          status: result.order.status,
          recovery: toRecovery(result.order),
        },
        rematching: result.rematching,
        matchingStatus: result.matching?.status ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
}
