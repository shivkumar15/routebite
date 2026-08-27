import { Router } from 'express';
import {
  login,
  logout,
  me,
  register,
  requestEmailVerification,
  requestPhoneVerification,
  verifyEmailVerification,
  verifyPhoneVerification,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  emailOtpValidators,
  loginValidators,
  phoneOtpValidators,
  registerValidators,
} from '../validators/auth.validators.js';

const router = Router();

router.post('/register', registerValidators, validateRequest, register);
router.post('/login', loginValidators, validateRequest, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

router.post('/email-otp/request', requireAuth, requestEmailVerification);
router.post(
  '/email-otp/verify',
  requireAuth,
  emailOtpValidators,
  validateRequest,
  verifyEmailVerification,
);

// Kept for future SMS-provider integration. The prototype UI uses email verification.
router.post('/phone-otp/request', requireAuth, requestPhoneVerification);
router.post(
  '/phone-otp/verify',
  requireAuth,
  phoneOtpValidators,
  validateRequest,
  verifyPhoneVerification,
);

export default router;
