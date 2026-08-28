import { Router } from 'express';
import {
  approve,
  pending,
  reject,
} from '../controllers/admin-partner.controller.js';
import {
  orderDetail,
  orders,
} from '../controllers/admin-operations.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { orderIdValidators } from '../validators/order.validators.js';
import {
  partnerIdValidators,
  rejectPartnerValidators,
} from '../validators/partner.validators.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/orders', orders);
router.get('/orders/:orderId', orderIdValidators, validateRequest, orderDetail);

router.get('/partners/pending', pending);
router.post('/partners/:partnerId/approve', partnerIdValidators, validateRequest, approve);
router.post('/partners/:partnerId/reject', rejectPartnerValidators, validateRequest, reject);

export default router;
