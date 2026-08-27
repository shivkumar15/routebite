import {
  approvePartner,
  listPendingPartners,
  rejectPartner,
} from '../services/partner.service.js';

export async function pending(req, res, next) {
  try {
    const partners = await listPendingPartners();

    res.status(200).json({
      success: true,
      data: { partners },
    });
  } catch (error) {
    next(error);
  }
}

export async function approve(req, res, next) {
  try {
    const partner = await approvePartner({
      partnerId: req.params.partnerId,
      adminUserId: req.auth.userId,
    });

    res.status(200).json({
      success: true,
      data: { partner },
    });
  } catch (error) {
    next(error);
  }
}

export async function reject(req, res, next) {
  try {
    const partner = await rejectPartner({
      partnerId: req.params.partnerId,
      adminUserId: req.auth.userId,
      reason: req.body.reason,
    });

    res.status(200).json({
      success: true,
      data: { partner },
    });
  } catch (error) {
    next(error);
  }
}
