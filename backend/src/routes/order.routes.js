import { Router } from 'express';
import { create, detail, list, update } from '../controllers/order.controller.js';
import {
  createPayment,
  paymentStatus,
  verifyPayment,
} from '../controllers/payment.controller.js';
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
router.get('/:orderId', orderIdValidators, validateRequest, detail);
router.patch('/:orderId', [...orderIdValidators, ...orderDraftValidators], validateRequest, update);

export default router;
