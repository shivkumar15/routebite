import { Router } from 'express';
import { customerDemoLedger } from '../controllers/accounting.controller.js';
import { approvePrice, rejectPrice } from '../controllers/delivery.controller.js';
import { generateDeliveryOtp } from '../controllers/delivery-otp.controller.js';
import { detail as matchingDetail } from '../controllers/matching.controller.js';
import { create, detail, list, update } from '../controllers/order.controller.js';
import {
  createPayment,
  paymentStatus,
  verifyPayment,
} from '../controllers/payment.controller.js';
import { customerTracking } from '../controllers/tracking.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { orderDraftValidators, orderIdValidators } from '../validators/order.validators.js';
import {
  createPaymentValidators,
  paymentStatusValidators,
  verifyPaymentValidators,
} from '../validators/payment.validators.js';

const router = Router();

router.use(requireAuth);

router.post('/', orderDraftValidators, validateRequest, create);
router.get('/', list);
router.post('/:orderId/payment', createPaymentValidators, validateRequest, createPayment);
router.get('/:orderId/payment', paymentStatusValidators, validateRequest, paymentStatus);
router.post('/:orderId/payment/verify', verifyPaymentValidators, validateRequest, verifyPayment);
router.get('/:orderId/matching', orderIdValidators, validateRequest, matchingDetail);
router.get('/:orderId/tracking', orderIdValidators, validateRequest, customerTracking);
router.get('/:orderId/demo-ledger', orderIdValidators, validateRequest, customerDemoLedger);
router.post('/:orderId/delivery-otp', orderIdValidators, validateRequest, generateDeliveryOtp);
router.post(
  '/:orderId/price-adjustment/approve',
  orderIdValidators,
  validateRequest,
  approvePrice,
);
router.post(
  '/:orderId/price-adjustment/reject',
  orderIdValidators,
  validateRequest,
  rejectPrice,
);
router.get('/:orderId', orderIdValidators, validateRequest, detail);
router.patch('/:orderId', [...orderIdValidators, ...orderDraftValidators], validateRequest, update);

export default router;
