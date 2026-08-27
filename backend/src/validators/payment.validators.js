import { body, header, param } from 'express-validator';

export const createPaymentValidators = [
  param('orderId').isMongoId().withMessage('Invalid order ID.'),
  header('Idempotency-Key')
    .exists({ checkFalsy: true })
    .withMessage('Idempotency-Key header is required.')
    .bail()
    .isString()
    .trim()
    .isLength({ min: 8, max: 120 })
    .withMessage('Idempotency-Key must be between 8 and 120 characters.'),
];

export const verifyPaymentValidators = [
  param('orderId').isMongoId().withMessage('Invalid order ID.'),
  body('razorpayOrderId')
    .isString()
    .trim()
    .isLength({ min: 6, max: 120 })
    .withMessage('A valid Razorpay order ID is required.'),
  body('razorpayPaymentId')
    .isString()
    .trim()
    .isLength({ min: 6, max: 120 })
    .withMessage('A valid Razorpay payment ID is required.'),
  body('razorpaySignature')
    .isString()
    .trim()
    .matches(/^[a-f0-9]{64}$/i)
    .withMessage('A valid Razorpay signature is required.'),
];

export const paymentStatusValidators = [
  param('orderId').isMongoId().withMessage('Invalid order ID.'),
];
