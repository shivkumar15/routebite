import { Router } from 'express';
import { apply, me } from '../controllers/partner.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { partnerApplicationValidators } from '../validators/partner.validators.js';

const router = Router();

router.post('/apply', requireAuth, partnerApplicationValidators, validateRequest, apply);
router.get('/profile', requireAuth, me);

export default router;
