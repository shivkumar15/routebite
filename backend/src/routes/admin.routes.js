import { Router } from 'express';
import {
  approve,
  pending,
  reject,
} from '../controllers/admin-partner.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  partnerIdValidators,
  rejectPartnerValidators,
} from '../validators/partner.validators.js';

const router = Router();

router.use(requireAuth, requireAdmin);
router.get('/partners/pending', pending);
router.post('/partners/:partnerId/approve', partnerIdValidators, validateRequest, approve);
router.post('/partners/:partnerId/reject', rejectPartnerValidators, validateRequest, reject);

export default router;
