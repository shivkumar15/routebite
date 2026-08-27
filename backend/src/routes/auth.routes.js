import { Router } from 'express';
import { login, logout, me, register } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { loginValidators, registerValidators } from '../validators/auth.validators.js';

const router = Router();

router.post('/register', registerValidators, validateRequest, register);
router.post('/login', loginValidators, validateRequest, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
