import {
  acceptOffer,
  getPartnerActiveOffers,
  rejectOffer,
} from '../services/offer.service.js';

export async function list(req, res, next) {
  try {
    const offers = await getPartnerActiveOffers(req.auth.partnerId);
    res.status(200).json({ success: true, data: { offers } });
  } catch (error) {
    next(error);
  }
}

export async function accept(req, res, next) {
  try {
    const result = await acceptOffer({
      offerId: req.params.offerId,
      partnerId: req.auth.partnerId,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function reject(req, res, next) {
  try {
    const offer = await rejectOffer({
      offerId: req.params.offerId,
      partnerId: req.auth.partnerId,
    });
    res.status(200).json({ success: true, data: { offer } });
  } catch (error) {
    next(error);
  }
}
