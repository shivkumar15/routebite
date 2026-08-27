import {
  applyForPartner,
  getMyPartnerProfile,
} from '../services/partner.service.js';

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
