import { Router } from 'express';
import {
  confirmPartnerPickup,
  reportPartnerPrice,
  startPartnerPickup,
} from '../controllers/delivery.controller.js';
import {
  accept as acceptOffer,
  list as listOffers,
  reject as rejectOffer,
} from '../controllers/offer.controller.js';
import {
  activeOrder,
  apply,
  me,
  operationalState,
  updateAvailability,
  updateLocation,
} from '../controllers/partner.controller.js';
import {
  startPartnerDelivery,
  updatePartnerDeliveryLocation,
} from '../controllers/tracking.controller.js';
import {
  cancel,
  complete,
  create,
  detail,
  list,
  start,
} from '../controllers/trip.controller.js';
import { requireApprovedPartner, requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { actualFoodPriceValidators } from '../validators/delivery.validators.js';
import { offerIdValidators } from '../validators/offer.validators.js';
import {
  partnerApplicationValidators,
  partnerAvailabilityValidators,
  partnerLocationValidators,
} from '../validators/partner.validators.js';
import { createTripValidators, tripIdValidators } from '../validators/trip.validators.js';

const router = Router();

router.post('/apply', requireAuth, partnerApplicationValidators, validateRequest, apply);
router.get('/profile', requireAuth, me);

router.get('/operational-state', requireAuth, requireApprovedPartner, operationalState);
router.get('/active-order', requireAuth, requireApprovedPartner, activeOrder);
router.post('/active-order/start-pickup', requireAuth, requireApprovedPartner, startPartnerPickup);
router.post(
  '/active-order/actual-price',
  requireAuth,
  requireApprovedPartner,
  actualFoodPriceValidators,
  validateRequest,
  reportPartnerPrice,
);
router.post('/active-order/confirm-pickup', requireAuth, requireApprovedPartner, confirmPartnerPickup);
router.post('/active-order/start-delivery', requireAuth, requireApprovedPartner, startPartnerDelivery);
router.put(
  '/active-order/location',
  requireAuth,
  requireApprovedPartner,
  partnerLocationValidators,
  validateRequest,
  updatePartnerDeliveryLocation,
);
router.patch(
  '/availability',
  requireAuth,
  requireApprovedPartner,
  partnerAvailabilityValidators,
  validateRequest,
  updateAvailability,
);
router.put(
  '/location',
  requireAuth,
  requireApprovedPartner,
  partnerLocationValidators,
  validateRequest,
  updateLocation,
);

router.get('/offers', requireAuth, requireApprovedPartner, listOffers);
router.post(
  '/offers/:offerId/accept',
  requireAuth,
  requireApprovedPartner,
  offerIdValidators,
  validateRequest,
  acceptOffer,
);
router.post(
  '/offers/:offerId/reject',
  requireAuth,
  requireApprovedPartner,
  offerIdValidators,
  validateRequest,
  rejectOffer,
);

router.post(
  '/trips',
  requireAuth,
  requireApprovedPartner,
  createTripValidators,
  validateRequest,
  create,
);
router.get('/trips', requireAuth, requireApprovedPartner, list);
router.get(
  '/trips/:tripId',
  requireAuth,
  requireApprovedPartner,
  tripIdValidators,
  validateRequest,
  detail,
);
router.post(
  '/trips/:tripId/start',
  requireAuth,
  requireApprovedPartner,
  tripIdValidators,
  validateRequest,
  start,
);
router.post(
  '/trips/:tripId/cancel',
  requireAuth,
  requireApprovedPartner,
  tripIdValidators,
  validateRequest,
  cancel,
);
router.post(
  '/trips/:tripId/complete',
  requireAuth,
  requireApprovedPartner,
  tripIdValidators,
  validateRequest,
  complete,
);

export default router;
