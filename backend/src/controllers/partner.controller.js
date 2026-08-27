import {
  applyForPartner,
  getMyPartnerProfile,
} from '../services/partner.service.js';
import {
  getPartnerOperationalState,
  updatePartnerAvailability,
  updatePartnerLocation,
} from '../services/partner-operations.service.js';
import { getPartnerActiveOrder } from '../services/partner-active-order.service.js';

export async function apply(req, res, next) {
  try {
    const partner = await applyForPartner({
      userId: req.auth.userId,
      payload: req.body,
    });

    res.status(201).json({
      success: true,
      data: { partner },
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const partner = await getMyPartnerProfile(req.auth.userId);

    res.status(200).json({
      success: true,
      data: { partner },
    });
  } catch (error) {
    next(error);
  }
}

export async function operationalState(req, res, next) {
  try {
    const partner = await getPartnerOperationalState(req.auth.partnerId);

    res.status(200).json({
      success: true,
      data: { partner },
    });
  } catch (error) {
    next(error);
  }
}

export async function activeOrder(req, res, next) {
  try {
    const order = await getPartnerActiveOrder(req.auth.partnerId);

    res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAvailability(req, res, next) {
  try {
    const partner = await updatePartnerAvailability({
      partnerId: req.auth.partnerId,
      status: req.body.status,
    });

    res.status(200).json({
      success: true,
      data: { partner },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateLocation(req, res, next) {
  try {
    const partner = await updatePartnerLocation({
      partnerId: req.auth.partnerId,
      payload: req.body,
    });

    res.status(200).json({
      success: true,
      data: { partner },
    });
  } catch (error) {
    next(error);
  }
}
