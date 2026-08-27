import { Router } from 'express';
import { razorpayWebhook } from '../controllers/webhook.controller.js';

const router = Router();

router.post('/razorpay', razorpayWebhook);

export default router;
