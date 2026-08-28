import { body } from 'express-validator';

export const actualFoodPriceValidators = [
  body('actualFoodCostPaise')
    .isInt({ min: 0, max: 100000000 })
    .withMessage('Actual food price must be integer paise.'),
  body('receiptAssetId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Receipt asset id is invalid.'),
];

export const deliveryOtpValidators = [
  body('otp')
    .isString()
    .matches(/^\d{6}$/)
    .withMessage('Delivery OTP must be a 6-digit code.'),
];
