import { Router } from 'express';
import { uploadAsset } from '../controllers/upload.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { uploadSingleImage } from '../middleware/upload.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { uploadValidators } from '../validators/upload.validators.js';

const router = Router();

router.post(
  '/',
  requireAuth,
  uploadSingleImage,
  uploadValidators,
  validateRequest,
  uploadAsset,
);

export default router;
